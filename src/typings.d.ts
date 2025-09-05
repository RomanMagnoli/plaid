export {};

declare global {
  interface Window {
    require: NodeRequire;
    process: NodeJS.Process;
  }
}
