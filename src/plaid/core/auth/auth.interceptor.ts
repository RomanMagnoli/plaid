import {Injectable} from '@angular/core';
import {HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest} from '@angular/common/http';
import {EMPTY, Observable, throwError} from 'rxjs';
import {catchError, filter, mergeMap, skip, take} from 'rxjs/operators';
import {AuthState} from './auth.state';
import {User} from '../../model/user';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private authState: AuthState) {}

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const authInfo = this.authState.getAuthInfo();
    if (authInfo) {
      const newRequest: HttpRequest<any> = request.clone({
        setHeaders: {Authorization: this.authState.getAuthHeader()},
        url: request.url.substr(0, 7) !== 'http://' && request.url.substr(0, 8) !== 'https://'
          ? authInfo.jiraUrl + request.url
          : request.url
      });
      return next.handle(newRequest).pipe(
        catchError((error: HttpErrorResponse) => this.handleError(request, next, error))
      );
    } else {
      return this.handleError(request, next, null);
    }
  }

  private handleError(request: HttpRequest<any>, next: HttpHandler, error: HttpErrorResponse | null): Observable<HttpEvent<any>> {
    if (!error || error.status !== 404 || request.method !== 'GET' ||
      !/\/rest\/api\/3\/issue\/[A-Za-z][A-Za-z0-9_]*-[1-9][0-9]*\?/.test(request.url)) {
      // 404 status when calling GET /rest/api/3/issue/{issueKey} is unfortunately our only way to tell if issue ID is
      // invalid. In any other case we report the error to authState to bring up application error modal.
      if (error) {
        this.authState.setError(error);
      }
    }

    if (!error || [0, 401, 403].includes(error.status)) { // If the error is related to lack of connection or authorization:
      // Retry the request after authentication, except /rest/api/3/myself, because requests to this end point will be
      // retried in the process of authentication.
      return request.url === '/rest/api/3/myself'
        ? EMPTY
        : this.retryAfterAuthenticated(() => this.intercept(request, next));
    } else { // Otherwise let the error propagate
      return throwError(error);
    }
  }

  private retryAfterAuthenticated(event$fn: () => Observable<HttpEvent<any>>): Observable<HttpEvent<any>> {
    return this.authState.getAuthenticatedUser$().pipe(
      skip<User>(1),
      filter<User>((user: User) => user != null),
      take<User>(1),
      mergeMap<User, Observable<HttpEvent<any>>>(() => event$fn())
    );
  }
}
