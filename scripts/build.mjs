#!/usr/bin/env node
/** Build the static privacy.gainratio.com docs site into dist/ for Cloudflare Pages using an explicit allowlist. */
import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(root, "dist");

const ROOT_FILES = [
  "index.html",
  "404.html",
  "_headers",
  "robots.txt",
  "sitemap.xml",
  "favicon.svg",
  "d03dcbb5dd638c273ffab95af29a9add.txt",
];

const DIRS = ["assets", "docs", "examples", "security"];

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
for (const file of ROOT_FILES) {
  await cp(join(root, file), join(dist, file));
}
for (const dir of DIRS) {
  await cp(join(root, dir), join(dist, dir), { recursive: true });
}
console.log("built", dist);
