import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

// Copies the browser ESM build of WebTorrent into public/vendor so the
// browser can load it via dynamic import() with the bundler fully bypassed
// (see lib/torrent/client.ts). The npm package root is Node-only and must
// never be bundled for the browser.
const files = ["webtorrent.min.js", "webtorrent.min.js.map"];
let copied = 0;
for (const name of files) {
  const source = join(process.cwd(), "node_modules/webtorrent/dist", name);
  const target = join(process.cwd(), "public/vendor", name);
  if (!existsSync(source)) {
    console.info(`webtorrent ${name} not installed yet; skipping`);
    continue;
  }
  mkdirSync(dirname(target), { recursive: true });
  if (name.endsWith(".js")) {
    // Rewrite the sourceMappingURL to the served vendor path so devtools
    // does not 404 on it.
    const text = readFileSync(source, "utf8").replace(
      /\/\/# sourceMappingURL=\S+/,
      "//# sourceMappingURL=/vendor/webtorrent.min.js.map",
    );
    writeFileSync(target, text);
  } else {
    copyFileSync(source, target);
  }
  copied += 1;
}
console.info(`webtorrent vendor copy done (${copied}/${files.length})`);

