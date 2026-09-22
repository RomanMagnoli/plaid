const {app, BrowserWindow, ipcMain, nativeTheme, net, safeStorage, shell} = require('electron');
const fs = require('fs');
const path = require('path');
const {pathToFileURL} = require('url');
const {createOauthService} = require('./electron-oauth');

let authInfo;

function isTrustedSender(event) {
  const senderUrl = event.senderFrame && event.senderFrame.url;
  const productionPrefix = pathToFileURL(path.join(__dirname, 'build') + path.sep).href;
  return senderUrl === 'http://localhost:4300/' || (senderUrl && senderUrl.startsWith(productionPrefix));
}

function requireTrustedSender(event) {
  if (!isTrustedSender(event)) {
    throw new Error('Rejected IPC call from an untrusted renderer');
  }
}

function credentialsPath() {
  return path.join(app.getPath('userData'), 'jira-credentials.bin');
}

function loadAuthInfo() {
  if (authInfo) {
    return authInfo;
  }
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      return null;
    }
    const encrypted = Buffer.from(fs.readFileSync(credentialsPath(), 'utf8'), 'base64');
    authInfo = JSON.parse(safeStorage.decryptString(encrypted));
    return authInfo;
  } catch {
    return null;
  }
}

function persistAuthInfo(value) {
  authInfo = value;
  if (!safeStorage.isEncryptionAvailable()) {
    return;
  }
  const encrypted = safeStorage.encryptString(JSON.stringify(value));
  fs.writeFileSync(credentialsPath(), encrypted.toString('base64'), {encoding: 'utf8', mode: 0o600});
}

function clearAuthInfo() {
  authInfo = null;
  try {
    fs.unlinkSync(credentialsPath());
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

const oauthService = createOauthService({app, net, safeStorage, shell, persistAuthInfo});

function authProfile() {
  const saved = loadAuthInfo();
  return saved ? {jiraUrl: saved.jiraUrl, username: saved.username, password: "", method: saved.method} : null;
}

function validateExternalUrl(rawUrl) {
  const parsed = new URL(rawUrl);
  if (!['https:', 'http:'].includes(parsed.protocol)) {
    throw new Error('Only HTTP(S) external URLs are allowed');
  }
  return parsed.href;
}

function validateJiraUrl(rawUrl) {
  const saved = loadAuthInfo();
  if (!saved) {
    throw new Error('Jira credentials are not configured');
  }
  const base = new URL(saved.jiraUrl);
  const target = new URL(rawUrl);
  const basePrefix = base.href.endsWith('/') ? base.href : base.href + '/';
  if (!['https:', 'http:'].includes(target.protocol) ||
      target.origin !== base.origin ||
      !target.href.startsWith(basePrefix)) {
    throw new Error('Rejected request outside the configured Jira instance');
  }
  return {saved, target};
}

function registerElectronBridge() {
  ipcMain.handle('plaid:open-external', async (event, rawUrl) => {
    requireTrustedSender(event);
    return shell.openExternal(validateExternalUrl(rawUrl));
  });

  ipcMain.on('plaid:auth:get-profile', event => {
    requireTrustedSender(event);
    event.returnValue = authProfile();
  });

  ipcMain.on('plaid:auth:set', (event, value) => {
    requireTrustedSender(event);
    const jiraUrl = validateExternalUrl(value.jiraUrl).replace(/\/$/, '');
    persistAuthInfo({method: 'basic', jiraUrl, username: value.username, password: value.password});
    event.returnValue = authProfile();
  });

  ipcMain.on('plaid:auth:clear', event => {
    requireTrustedSender(event);
    clearAuthInfo();
    event.returnValue = null;
  });

  ipcMain.on('plaid:oauth:get-configuration', event => {
    requireTrustedSender(event);
    event.returnValue = oauthService.configurationProfile();
  });

  ipcMain.handle('plaid:oauth:login', async (event, options) => {
    requireTrustedSender(event);
    return oauthService.login(options);
  });

  ipcMain.on('plaid:theme:get', event => {
    requireTrustedSender(event);
    event.returnValue = nativeTheme.shouldUseDarkColors;
  });

  ipcMain.on('plaid:theme:set', (event, source) => {
    requireTrustedSender(event);
    if (['system', 'light', 'dark'].includes(source)) {
      nativeTheme.themeSource = source;
    }
  });

  ipcMain.handle('plaid:jira-request', async (event, request) => {
    requireTrustedSender(event);
    const {saved, target} = validateJiraUrl(request.url);
    // Jira Cloud runs its XSRF protection on any write request that looks like it comes from a browser, and rejects
    // it with 403 "XSRF check failed" regardless of the Authorization header or X-Atlassian-Token. net.fetch uses
    // Chromium's stack, so it would send a Chrome User-Agent; identifying as this app keeps writes working.
    const headers = {
      Accept: 'application/json',
      'User-Agent': 'plaid/' + app.getVersion(),
      'X-Atlassian-Token': 'no-check'
    };
    let requestUrl = target.href;
    if (saved.method === 'oauth') {
      try {
        headers.Authorization = "Bearer " + await oauthService.accessToken(saved);
      } catch (error) {
        if (error.code !== "OAUTH_SESSION_EXPIRED") {
          throw error;
        }
        return {
          status: 401,
          statusText: "Unauthorized",
          headers: {},
          body: {message: error.message, oauthSessionExpired: true}
        };
      }
      requestUrl = `https://api.atlassian.com/ex/jira/${encodeURIComponent(saved.cloudId)}${target.pathname}${target.search}`;
    } else {
      headers.Authorization = 'Basic ' + Buffer.from(saved.username + ':' + saved.password).toString('base64');
    }
    let body;
    if (request.body !== null && request.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(request.body);
    }

    const response = await net.fetch(requestUrl, {
      method: request.method,
      headers,
      body,
      // Authenticate with the Authorization header only; session cookies would make Jira fall back to cookie auth.
      credentials: 'omit',
      redirect: 'manual',
      signal: AbortSignal.timeout(30000)
    });
    const responseText = await response.text();
    let responseBody = responseText;
    if (responseText) {
      try {
        responseBody = JSON.parse(responseText);
      } catch {}
    } else {
      responseBody = null;
    }

    return {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: responseBody
    };
  });

  nativeTheme.on('updated', () => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send('plaid:theme-updated', nativeTheme.shouldUseDarkColors);
    }
  });
}

module.exports = {registerElectronBridge, validateExternalUrl};
