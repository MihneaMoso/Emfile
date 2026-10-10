import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const source = join(process.cwd(), "node_modules/webtorrent/dist/webtorrent.min.js");
const target = join(process.cwd(), "public/vendor/webtorrent.min.js");

if (!existsSync(source)) {
  console.info("webtorrent bundle not installed yet; skipping vendor copy");
  process.exit(0);
}

mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
console.info("copied webtorrent browser build to public/vendor/webtorrent.min.js");
