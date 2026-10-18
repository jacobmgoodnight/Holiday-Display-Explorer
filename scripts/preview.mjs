import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
const root = path.resolve("dist");
const base = "/holiday-display-explorer/";
http
  .createServer(async (req, res) => {
    try {
      let p = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
      if (!p.startsWith(base)) {
        res.writeHead(302, { Location: base });
        return res.end();
      }
      p = p.slice(base.length) || "index.html";
      const file = path.resolve(root, p);
      if (!file.startsWith(root + path.sep)) throw Error();
      const data = await readFile(file);
      const ext = path.extname(file);
      res.writeHead(200, {
        "Content-Type":
          {
            ".html": "text/html",
            ".js": "text/javascript",
            ".css": "text/css",
            ".json": "application/json",
            ".webmanifest": "application/manifest+json",
            ".png": "image/png",
            ".svg": "image/svg+xml",
          }[ext] || "application/octet-stream",
      });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  })
  .listen(4173, "127.0.0.1", () =>
    console.log("http://127.0.0.1:4173/holiday-display-explorer/"),
  );
