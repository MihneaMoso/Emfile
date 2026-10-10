// Minimal structural types for the WebTorrent browser bundle (no bundled
// TypeScript declarations). We describe only the surface Emfile uses.

export interface TorrentFile {
  name: string;
  length: number;
  getBlob(cb: (err: Error | null | undefined, blob?: Blob) => void): void;
}

export interface Torrent {
  infoHash: string;
  magnetURI: string;
  name: string;
  numPeers: number;
  progress: number;
  downloadSpeed: number;
  files: TorrentFile[];
  on(event: string, cb: (...args: never[]) => void): void;
  once(event: string, cb: (...args: never[]) => void): void;
  removeListener(event: string, cb: (...args: never[]) => void): void;
  destroy(cb?: (err?: Error) => void): void;
}

export interface WebTorrentClient {
  torrents: Torrent[];
  seed(
    input: File | File[] | Blob,
    opts?: { name?: string; announce?: string[] },
    cb?: (torrent: Torrent) => void,
  ): Torrent;
  add(
    magnet: string,
    opts?: { announce?: string[] },
    cb?: (torrent: Torrent) => void,
  ): Torrent;
  get(infoHashOrMagnet: string): Torrent | undefined;
  remove(infoHashOrMagnet: string, cb?: (err?: Error) => void): void;
  destroy(cb?: (err?: Error) => void): void;
}

export type TorrentConstructor = new (opts?: {
  tracker?: { rtcConfig?: { iceServers: Array<{ urls: string | string[] }> } };
}) => WebTorrentClient;
