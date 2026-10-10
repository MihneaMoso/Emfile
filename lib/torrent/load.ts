export function trackers(): string[] {
  const raw = process.env.NEXT_PUBLIC_TRACKERS ?? "";
  const list = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (list.length > 0) return list;
  return [
    "wss://tracker.openwebtorrent.com",
    "wss://tracker.webtorrent.dev",
  ];
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
