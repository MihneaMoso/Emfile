// WebTorrent browser build is loaded at runtime via dynamic import() of
// /vendor/webtorrent.min.js with the bundler bypassed (see client.ts).
// - No declaration for the npm `webtorrent` package exists on purpose:
//   importing it would pull Node-only code into the browser bundle.
// - client.ts imports via a `string`-typed variable (not a literal) so
//   TypeScript types it as `Promise<any>` without module resolution, and
//   bundlers leave the webpackIgnore'd runtime import untouched.
export {};



