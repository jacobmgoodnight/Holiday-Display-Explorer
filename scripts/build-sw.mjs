import { readFile, writeFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
const files = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./data/displays.json",
  "./data/source-candidates.json",
  "./data/import-report.json",
  "./config.json",
  ...(await readdir("dist/assets")).map((f) => "./assets/" + f),
];
const hash = createHash("sha256")
  .update(files.join("|") + (await readFile("dist/data/displays.json")) + (await readFile("dist/data/source-candidates.json")) + (await readFile("dist/data/import-report.json")))
  .digest("hex")
  .slice(0, 12);
const sw = await readFile("public/sw.js", "utf8");
await writeFile(
  "dist/sw.js",
  sw.replace("__BUILD__", hash).replace("__PRECACHE__", JSON.stringify(files)),
);
