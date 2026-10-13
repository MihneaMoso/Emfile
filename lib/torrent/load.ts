export function trackers(): string[] {
  const raw = process.env.NEXT_PUBLIC_TRACKERS ?? "";
  const list = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (list.length > 0) return list;
  // Default verified live 2026-10-13: openwebtorrent accepts WebSocket
  // handshakes; tracker.webtorrent.dev does not (removed). Override with
  // NEXT_PUBLIC_TRACKERS if signaling ever needs to move again.
  return ["wss://tracker.openwebtorrent.com"];
}

export function stunServers(): string[] {
  const raw = process.env.NEXT_PUBLIC_STUN ?? "";
  const list = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (list.length > 0) return list;
  return [
    "stun:stun.l.google.com:19302",
    "stun:global.stun.twilio.com:3478",
  ];
}
