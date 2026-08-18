#!/usr/bin/env node
/** Local static preview for the AIly web app. Used by the Windows launcher. */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain; charset=utf-8",
};

export function parseServeArgs(argv, defaults = {}) {
  const out = {
    port: defaults.port ?? 8765,
    root: defaults.root ?? process.cwd(),
    host: defaults.host ?? "127.0.0.1",
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--port" && argv[i + 1]) {
      out.port = Number(argv[++i]);
    } else if (arg === "--root" && argv[i + 1]) {
      out.root = argv[++i];
    } else if (arg === "--host" && argv[i + 1]) {
      out.host = argv[++i];
    }
  }
  if (!Number.isInteger(out.port) || out.port < 1 || out.port > 65535) {
    throw new Error("invalid port");
  }
  out.root = path.resolve(out.root);
  return out;
}

export function resolveSafePath(root, urlPath) {
  const raw = String(urlPath || "/").split("?")[0];
  let decoded;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  if (decoded.includes("\0") || decoded.includes("\\")) {
    return null;
  }
  const trimmed = decoded.replace(/^\/+/, "");
  const normalized = path.posix.normalize(`/${trimmed}`);
  if (normalized === "/") {
    return path.resolve(root, "index.html");
  }
  const candidate = path.resolve(root, `.${normalized}`);
  const rootWithSep = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  if (candidate !== root && !candidate.startsWith(rootWithSep)) {
    return null;
  }
  if (normalized.endsWith("/")) {
    return path.resolve(candidate, "index.html");
  }
  return candidate;
}

export function createStaticServer({ root }) {
  return http.createServer((req, res) => {
    const filePath = resolveSafePath(root, req.url || "/");
    if (!filePath) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Forbidden");
      return;
    }
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Not found");
        return;
      }
      const ext = path.extname(filePath);
      res.writeHead(200, { "Content-Type": TYPES[ext] || "application/octet-stream" });
      res.end(data);
    });
  });
}

const isMain =
  Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const opts = parseServeArgs(process.argv.slice(2));
  const server = createStaticServer(opts);
  server.listen(opts.port, opts.host, () => {
    console.log(`http://${opts.host}:${opts.port}/`);
  });
}
