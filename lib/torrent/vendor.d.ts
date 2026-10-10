// The npm webtorrent package ships no TypeScript declarations, so this
// ambient declaration covers the dynamic import in client.ts. (This file
// must stay a global script — no imports/exports — for it to apply.)
declare module "webtorrent" {
  const WebTorrent: new (opts?: unknown) => {
    torrents: unknown[];
    seed: (...args: never[]) => unknown;
    add: (...args: never[]) => unknown;
    get: (...args: never[]) => unknown;
    remove: (...args: never[]) => void;
    destroy: (...args: never[]) => void;
  };
  export default WebTorrent;
}
