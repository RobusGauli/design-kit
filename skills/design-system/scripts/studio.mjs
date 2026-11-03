#!/usr/bin/env node
/* design/studio.mjs — a read-only dashboard over design/journeys. Zero dependencies, Node 18+ or Bun.
 *
 *   node design/studio.mjs [--port N] [--open]        run from the repo root
 *
 * It serves `design/` (screens, the bridge, the sheets) and `.harbor/shots/` on 127.0.0.1 and one
 * dashboard page: journeys, screens and variants from the files on disk, a screen in a frame with
 * its state / theme / variant / viewport, the flow map grepped from `data-go` literals, the shots,
 * and JOURNEY.md. It never writes, never runs anything from the repo and never starts a preview:
 * with `preview.origin` in design.json the frame points there (as shots.mjs does), else the
 * screens are plain .html served from here.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, watch } from "node:fs";
import { createServer } from "node:http";
import { readdir, readFile, realpath, stat } from "node:fs/promises";
import { basename, extname, join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_PORT = 4399;
const KEEPALIVE_MS = 25_000;
const DEBOUNCE_MS = 150;
const POLL_MS = 1000;
const POLL_CAP = 5000;
const READ_CAP = 2 * 1024 * 1024;
const SCREEN_EXTS = new Set([".html", ".tsx", ".jsx", ".svelte", ".vue"]);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
};

/* ---------------------------------------------------------------- reading the repo */

/** Blank comments so a commented-out link is not an edge. Same rules as lint.mjs `decomment`. */
function decomment(text, ext) {
  let out = text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
  if (ext !== ".css") out = out.replace(/(^|[^:\w])\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, " "));
  return out.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, " "));
}

/** Every `data-go` string literal in a file, as lint.mjs `linksOf` reads them. */
function linksOf(text, ext) {
  const found = [];
  /* the lookbehind keeps `:data-go="x"` (a bound attribute the lint refuses) from being an edge */
  const pattern = /(?<![:\w-])data-go\s*=\s*"([^"]*)"/g;
  const body = decomment(text, ext);
  for (let m = pattern.exec(body); m !== null; m = pattern.exec(body)) {
    found.push(m[1]);
  }
  return found;
}

/** The states a screen declares; `ready` when it declares none, as shots.mjs does. */
function statesOf(text) {
  const declared = /data-states\s*=\s*"([^"]*)"/.exec(text)?.[1] ?? "ready";
  const states = declared.split(/\s+/).filter(Boolean);
  return states.length === 0 ? ["ready"] : states;
}

/** `detail--dense.html` -> { id: "detail", variant: "dense" }, as lint.mjs `screensOf`. */
function nameOf(file) {
  const bare = file.slice(0, -extname(file).length);
  const at = bare.indexOf("--");
  return at === -1 ? { id: bare, variant: null } : { id: bare.slice(0, at), variant: bare.slice(at + 2) };
}

/** `<id>[--<variant>].<state>.<theme>.png` -> its parts, or null for any other file. */
function shotOf(file) {
  const m = /^(.+)\.([^.]+)\.([^.]+)\.png$/.exec(file);
  if (m === null) return null;
  const { id, variant } = nameOf(`${m[1]}.x`);
  return { file, id, variant, state: m[2], theme: m[3] };
}

/** The real path of `file` when it lies inside `base`, else null. Symlinks out are refused. */
async function insideOf(base, file) {
  try {
    const [realBase, real] = await Promise.all([realpath(base), realpath(file)]);
    return real === realBase || real.startsWith(realBase + sep) ? real : null;
  } catch {
    return null;
  }
}

async function readInside(base, file) {
  const real = await insideOf(base, file);
  if (real === null) return null;
  const info = await stat(real);
  if (!info.isFile() || info.size > READ_CAP) return null;
  return readFile(real, "utf8");
}

async function jsonInside(base, file, problem) {
  let text;
  try {
    text = await readInside(base, file);
  } catch {
    text = null;
  }
  if (text === null) return { value: null, problem: null };
  try {
    const value = JSON.parse(text);
    if (value !== null && typeof value === "object" && !Array.isArray(value)) return { value, problem: null };
    return { value: null, problem: `${problem} is not a JSON object` };
  } catch (err) {
    return { value: null, problem: `${problem} is not valid JSON: ${err.message}` };
  }
}

async function direntsOf(dir) {
  try {
    return await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

/** Only `http(s)` origins; anything else in design.json is ignored. */
function previewOrigin(config) {
  try {
    const url = new URL(config?.preview?.origin);
    return url.protocol === "http:" || url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}

async function screensOf(designDir, dir) {
  const entries = (await direntsOf(dir)).filter(
    (e) => e.isFile() && SCREEN_EXTS.has(extname(e.name)) && !e.name.startsWith("."),
  );
  const versions = await Promise.all(
    entries.map(async (e) => {
      const ext = extname(e.name);
      const text = (await readInside(designDir, join(dir, e.name)).catch(() => null)) ?? "";
      return { ...nameOf(e.name), file: e.name, states: statesOf(text), links: linksOf(text, ext) };
    }),
  );
  const byId = new Map();
  for (const v of versions.sort((a, b) => (a.variant ?? "").localeCompare(b.variant ?? ""))) {
    if (!byId.has(v.id)) byId.set(v.id, []);
    byId.get(v.id).push({ variant: v.variant, file: v.file, states: v.states, links: v.links });
  }
  return byId;
}

async function journeyOf(designDir, name) {
  const dir = join(designDir, "journeys", name);
  const { value: manifest, problem } = await jsonInside(designDir, join(dir, "journey.json"), "journey.json");
  const error = problem ?? (manifest === null ? "journey.json is missing" : null);
  const declared = typeof manifest?.screens === "object" && manifest.screens !== null ? manifest.screens : {};
  const onDisk = await screensOf(designDir, dir);
  const order = [...Object.keys(declared).filter((id) => onDisk.has(id)), ...[...onDisk.keys()].sort()];
  const screens = [...new Set(order)].map((id) => ({
    id,
    title: typeof declared[id]?.title === "string" ? declared[id].title : id,
    route: typeof declared[id]?.route === "string" ? declared[id].route : null,
    versions: onDisk.get(id),
  }));
  const entry = screens.some((s) => s.id === manifest?.entry) ? manifest.entry : (screens[0]?.id ?? null);
  const brief = await stat(join(dir, "JOURNEY.md")).then((s) => s.isFile(), () => false);
  return {
    name,
    title: typeof manifest?.title === "string" ? manifest.title : name,
    entry,
    error,
    brief,
    screens,
  };
}

async function shotsOf(shotsDir, name) {
  const files = (await direntsOf(join(shotsDir, name))).filter((e) => e.isFile()).map((e) => shotOf(e.name));
  const key = (s) => [s.id, s.variant ?? "", s.state, s.theme].join("\0");
  return files.filter((s) => s !== null).sort((a, b) => key(a).localeCompare(key(b)));
}

/** Everything the dashboard shows, built from the files on disk. */
async function buildIndex(root) {
  const designDir = join(root, "design");
  const shotsDir = join(root, ".harbor", "shots");
  const config = await jsonInside(designDir, join(designDir, "design.json"), "design.json");
  const names = (await direntsOf(join(designDir, "journeys")))
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .map((e) => e.name)
    .sort();
  const journeys = await Promise.all(
    names.map(async (name) => ({ ...(await journeyOf(designDir, name)), shots: await shotsOf(shotsDir, name) })),
  );
  return {
    root: basename(root),
    preview: previewOrigin(config.value),
    warnings: config.problem === null ? [] : [config.problem],
    journeys,
  };
}

/* ---------------------------------------------------------------- watching */

/** A cheap fingerprint of a tree (names, sizes, mtimes), for platforms where `fs.watch` cannot recurse. */
async function signatureOf(dir) {
  const parts = [];
  const queue = [dir];
  while (queue.length > 0 && parts.length < POLL_CAP) {
    const here = queue.pop();
    for (const e of await direntsOf(here)) {
      if (e.name.startsWith(".") || e.name === "node_modules") continue;
      const path = join(here, e.name);
      if (e.isDirectory()) queue.push(path);
      else if (e.isFile()) {
        const info = await stat(path).catch(() => null);
        if (info !== null) parts.push(`${path}:${info.size}:${info.mtimeMs}`);
      }
    }
  }
  return parts.sort().join("\n");
}

/** Watch each target recursively; any that cannot be watched (or are not there yet) are polled. */
function startWatching(targets, notify, log) {
  const stops = [];
  const polled = [];
  for (const target of targets) {
    try {
      const watcher = watch(target.dir, { recursive: true }, (_event, name) => {
        if (name === null || !basename(String(name)).startsWith(".")) notify(target.kind, name);
      });
      watcher.on("error", () => {});
      stops.push(() => watcher.close());
    } catch {
      polled.push(target);
    }
  }
  if (polled.length > 0) {
    log(`studio: live reload is polling every ${POLL_MS / 1000}s (${polled.map((t) => t.kind).join(", ")})`);
    const last = new Map();
    const tick = async () => {
      for (const target of polled) {
        const now = await signatureOf(target.dir);
        if (last.has(target.kind) && last.get(target.kind) !== now) notify(target.kind, null);
        last.set(target.kind, now);
      }
    };
    tick();
    const timer = setInterval(tick, POLL_MS);
    timer.unref();
    stops.push(() => clearInterval(timer));
  }
  return () => stops.forEach((stop) => stop());
}

/* ---------------------------------------------------------------- serving */

const SECURITY = { "x-content-type-options": "nosniff", "referrer-policy": "no-referrer" };

function reply(res, status, body, headers = {}) {
  if (res.headersSent) return res.end();
  res.writeHead(status, { ...SECURITY, "content-type": "text/plain; charset=utf-8", ...headers });
  res.end(body);
}

/** `/a/%2e%2e/b` -> its segments, or null when any of them could leave the base or names a dotfile. */
function segmentsOf(path) {
  let decoded;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    return null;
  }
  const segments = decoded.split("/").filter((s) => s !== "");
  const bad = (s) => s.startsWith(".") || s.includes("\0") || s.includes("\\");
  return segments.some(bad) ? null : segments;
}

/** Stream a file under `base` with an ETag and Last-Modified; 404 for anything outside it. */
async function sendFile(req, res, base, segments, onlyExt) {
  const real = await insideOf(base, join(base, ...segments));
  const info = real === null ? null : await stat(real).catch(() => null);
  const ext = extname(segments[segments.length - 1] ?? "").toLowerCase();
  if (real === null || info === null || !info.isFile() || (onlyExt && ext !== onlyExt)) {
    return reply(res, 404, "not found");
  }
  const etag = `W/"${info.size.toString(16)}-${Math.floor(info.mtimeMs).toString(16)}"`;
  const headers = {
    ...SECURITY,
    etag,
    "last-modified": info.mtime.toUTCString(),
    "cache-control": "no-cache",
  };
  if (req.headers["if-none-match"] === etag) {
    res.writeHead(304, headers);
    return res.end();
  }
  const stream = createReadStream(real);
  stream.on("open", () => {
    res.writeHead(200, { ...headers, "content-type": TYPES[ext] ?? "application/octet-stream", "content-length": info.size });
    if (req.method === "HEAD") {
      stream.destroy();
      res.end();
    } else stream.pipe(res);
  });
  stream.on("error", () => (res.headersSent ? res.destroy() : reply(res, 404, "not found")));
  res.on("close", () => stream.destroy());
}

function pageFor(origin) {
  const frame = origin === null ? "'self'" : `'self' ${origin}`;
  const hash = (text) => `'sha256-${createHash("sha256").update(text).digest("base64")}'`;
  return {
    body: PAGE,
    csp: [
      "default-src 'none'",
      `script-src ${hash(CLIENT)}`,
      `style-src ${hash(STYLE)}`,
      "img-src 'self'",
      "connect-src 'self'",
      `frame-src ${frame}`,
      "base-uri 'none'",
      "form-action 'none'",
      "frame-ancestors 'none'",
    ].join("; "),
  };
}

/**
 * Start the viewer. `root` is the repo root; `port` 0 asks for any free one, and a taken port
 * falls back to one that is free. Resolves to `{ url, port, close }`.
 */
export async function start({ root = process.cwd(), port = DEFAULT_PORT, log = console.error } = {}) {
  const repo = resolve(root);
  const designDir = join(repo, "design");
  const shotsDir = join(repo, ".harbor", "shots");
  const clients = new Set();
  let indexing = null;
  let listening = 0;

  /* Built fresh per request, with concurrent requests sharing one build. Never cached past it:
     a watcher that dies quietly (EMFILE, an unmounted dir) must cost live reload, not correctness. */
  const index = () => {
    indexing ??= buildIndex(repo).finally(() => {
      indexing = null;
    });
    return indexing;
  };

  async function handle(req, res) {
    const host = req.headers.host;
    if (host !== `127.0.0.1:${listening}` && host !== `localhost:${listening}`) {
      return reply(res, 403, "bad host");
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      return reply(res, 405, "read-only", { allow: "GET, HEAD" });
    }
    const raw = req.url.split("?")[0];
    const segments = raw.startsWith("/") ? segmentsOf(raw) : null;
    if (segments === null) return reply(res, 400, "bad path");
    if (segments.length === 0) {
      const { body, csp } = pageFor((await index()).preview);
      return reply(res, 200, body, { "content-type": TYPES[".html"], "content-security-policy": csp, "cache-control": "no-store" });
    }
    if (segments[0] === "_studio") return handleStudio(req, res, segments.slice(1));
    return sendFile(req, res, designDir, segments, null);
  }

  async function handleStudio(req, res, rest) {
    if (rest.length === 1 && rest[0] === "index.json") {
      return reply(res, 200, JSON.stringify(await index()), { "content-type": TYPES[".json"], "cache-control": "no-store" });
    }
    if (rest.length === 1 && rest[0] === "events") {
      res.writeHead(200, { ...SECURITY, "content-type": "text/event-stream", "cache-control": "no-cache" });
      res.write("retry: 2000\n\n");
      clients.add(res);
      res.on("close", () => clients.delete(res));
      return undefined;
    }
    if (rest[0] === "shots" && rest.length === 3) return sendFile(req, res, shotsDir, rest.slice(1), ".png");
    return reply(res, 404, "not found");
  }

  const server = createServer((req, res) => {
    handle(req, res).catch((err) => {
      log(`studio: ${req.url}: ${err.message}`);
      reply(res, 500, "something broke; see the terminal");
    });
  });
  server.on("clientError", (_err, socket) => socket.destroy());

  const listen = (n) =>
    new Promise((done, fail) => {
      server.once("error", fail);
      server.listen(n, "127.0.0.1", () => {
        server.off("error", fail);
        done();
      });
    });
  try {
    await listen(port);
  } catch (err) {
    if (err.code !== "EADDRINUSE") throw err;
    log(`studio: port ${port} is in use, taking a free one`);
    await listen(0);
  }
  listening = server.address().port;

  let pending = new Map();
  let timer = null;
  const notify = (kind, name) => {
    if (!pending.has(kind)) pending.set(kind, new Set());
    if (name) pending.get(kind).add(String(name));
    clearTimeout(timer);
    timer = setTimeout(() => {
      for (const [k, files] of pending) {
        const line = `data: ${JSON.stringify({ kind: k, files: [...files] })}\n\n`;
        for (const client of clients) client.write(line);
      }
      pending = new Map();
    }, DEBOUNCE_MS);
  };
  const stopWatching = startWatching(
    [
      { kind: "design", dir: designDir },
      { kind: "shots", dir: shotsDir },
    ],
    notify,
    log,
  );
  const keepalive = setInterval(() => clients.forEach((c) => c.write(": ping\n\n")), KEEPALIVE_MS);
  keepalive.unref();

  return {
    port: listening,
    url: `http://127.0.0.1:${listening}/`,
    close: () =>
      new Promise((done) => {
        stopWatching();
        clearInterval(keepalive);
        clearTimeout(timer);
        for (const client of clients) client.end();
        server.close(() => done());
        server.closeAllConnections?.();
      }),
  };
}

/* ---------------------------------------------------------------- the dashboard page */

const STYLE = String.raw`
:root{color-scheme:light dark;--bg:#fafaf9;--panel:#fff;--line:#e4e4e0;--ink:#1c1c1a;--mute:#6b6b66;--accent:#2f5fd0;--bad:#c0392b;--sel:#e9effc}
@media (prefers-color-scheme:dark){:root{--bg:#161615;--panel:#1e1e1c;--line:#34342f;--ink:#ecece8;--mute:#9a9a92;--accent:#7ea1f2;--bad:#ef7a6c;--sel:#232c44}}
*{box-sizing:border-box}
html,body{height:100%;margin:0}
body{font:13px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;background:var(--bg);color:var(--ink);display:flex;flex-direction:column}
header{display:flex;gap:12px;align-items:center;padding:8px 14px;border-bottom:1px solid var(--line);background:var(--panel)}
header strong{font-size:14px}
header .grow{flex:1}
.mute{color:var(--mute)}
#live{width:8px;height:8px;border-radius:50%;background:var(--mute)}
#live[data-on="1"]{background:#2e9e5b}
#warn{padding:6px 14px;background:var(--sel);border-bottom:1px solid var(--line);color:var(--bad)}
.view{display:none;flex:1;min-height:0}
body[data-view="ready"] #ready{display:flex}
body[data-view="loading"] #loading,body[data-view="empty"] #empty,body[data-view="error"] #error{display:flex}
#loading,#empty,#error{align-items:center;justify-content:center;flex-direction:column;gap:10px;text-align:center;padding:24px}
#empty code,#panel-shots code{background:var(--panel);border:1px solid var(--line);padding:1px 6px;border-radius:4px}
nav{width:260px;flex:none;overflow:auto;border-right:1px solid var(--line);background:var(--panel);padding:8px 0}
nav details{padding:0 0 4px}
nav summary{cursor:pointer;padding:6px 14px;font-weight:600;list-style:none}
nav summary small{display:block;font-weight:400;color:var(--mute)}
nav .bad{color:var(--bad);font-weight:400;display:block;font-size:12px}
nav button{all:unset;display:block;box-sizing:border-box;width:100%;padding:4px 14px 4px 26px;cursor:pointer}
nav button.var{padding-left:40px;color:var(--mute)}
nav button:hover{background:var(--bg)}
nav button[aria-current="true"]{background:var(--sel);color:var(--accent)}
nav button:focus-visible,.bar button:focus-visible,.tabs button:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}
main{flex:1;min-width:0;display:flex;flex-direction:column}
.tabs{display:flex;gap:2px;padding:6px 12px 0;border-bottom:1px solid var(--line)}
.tabs button{all:unset;cursor:pointer;padding:6px 12px;border-bottom:2px solid transparent;color:var(--mute)}
.tabs button[aria-selected="true"]{color:var(--ink);border-color:var(--accent)}
.bar{display:flex;flex-wrap:wrap;gap:14px;align-items:center;padding:8px 12px;border-bottom:1px solid var(--line);background:var(--panel)}
.bar label{display:flex;gap:6px;align-items:center;color:var(--mute)}
.bar select,.bar button{font:inherit;color:var(--ink);background:var(--bg);border:1px solid var(--line);border-radius:6px;padding:3px 8px}
.bar button{cursor:pointer}
.bar button[aria-pressed="true"]{border-color:var(--accent);color:var(--accent);background:var(--sel)}
.bar a{color:var(--accent);margin-left:auto}
.panel{display:none;flex:1;min-height:0;overflow:auto}
.panel[data-on="1"]{display:block}
#panel-preview[data-on="1"]{display:flex;flex-direction:column}
#stage{flex:1;min-height:0;position:relative;background:var(--bg);overflow:hidden}
#wrap{margin:0 auto;position:relative;height:100%}
#frame{border:0;background:#fff;transform-origin:0 0;box-shadow:0 0 0 1px var(--line)}
#nopreview{padding:24px;text-align:center}
#panel-flow,#panel-brief,#panel-shots{padding:16px}
#panel-brief{max-width:760px}
#panel-brief h1{font-size:20px}#panel-brief h2{font-size:16px}#panel-brief h3{font-size:14px}
#panel-brief pre,#panel-brief code{font-family:ui-monospace,monospace}
svg text{font:12px system-ui,sans-serif;fill:var(--ink)}
svg .node rect{fill:var(--panel);stroke:var(--line);stroke-width:1.5}
svg .node{cursor:pointer}
svg .node[data-cur="1"] rect{stroke:var(--accent);fill:var(--sel)}
svg .node[data-kind="missing"] rect{stroke:var(--bad);stroke-dasharray:4 3}
svg .node[data-kind="external"] rect{stroke-dasharray:4 3}
svg .node[data-kind="missing"]{cursor:default}
svg .edge{fill:none;stroke:var(--mute);stroke-width:1.4}
svg .edge[data-kind="missing"]{stroke:var(--bad)}
svg marker path{fill:var(--mute)}
.group{margin:0 0 18px}
.group h3{margin:0 0 6px;font-size:13px}
.thumbs{display:flex;flex-wrap:wrap;gap:10px}
.thumbs a{display:block;width:220px;color:var(--mute);text-decoration:none}
.thumbs img{display:block;width:220px;min-height:60px;border:1px solid var(--line);border-radius:4px;background:var(--panel)}
button.retry{font:inherit;padding:4px 12px}
`;

const CLIENT = String.raw`
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var NS = "http://www.w3.org/2000/svg";
  var VIEWPORTS = ["fit", "375", "768", "1440"];
  var TABS = ["preview", "flow", "shots", "brief"];
  var index = null, sel = null, frameUrl = "", briefs = {}, reloadTimer = 0;

  function el(tag, attrs, kids) {
    var node = document.createElement(tag);
    fill(node, attrs, kids);
    return node;
  }
  function svg(tag, attrs, kids) {
    var node = document.createElementNS(NS, tag);
    fill(node, attrs, kids);
    return node;
  }
  function fill(node, attrs, kids) {
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (typeof v === "function") node.addEventListener(k, v);
      else if (v !== null && v !== undefined && v !== false) node.setAttribute(k, v === true ? "" : String(v));
    });
    (kids || []).forEach(function (kid) {
      if (kid !== null && kid !== undefined) node.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
    });
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function path() { return Array.prototype.map.call(arguments, encodeURIComponent).join("/"); }

  /* ------------------------------------------------------------ selection <-> URL */

  function normalize(want) {
    var j = index.journeys.filter(function (x) { return x.name === want.j; })[0] || index.journeys[0];
    var s = j.screens.filter(function (x) { return x.id === want.s; })[0] ||
      j.screens.filter(function (x) { return x.id === j.entry; })[0] || j.screens[0] || null;
    var v = s && (s.versions.filter(function (x) { return (x.variant || "") === (want.v || ""); })[0] || s.versions[0]);
    var states = v ? v.states : ["ready"];
    return {
      j: j, s: s, v: v || null,
      state: states.indexOf(want.state) >= 0 ? want.state : states.indexOf("ready") >= 0 ? "ready" : states[0],
      theme: want.theme === "dark" ? "dark" : "light",
      vp: VIEWPORTS.indexOf(want.vp) >= 0 || /^\d{2,5}$/.test(want.vp || "") ? want.vp : "fit",
      tab: TABS.indexOf(want.tab) >= 0 ? want.tab : "preview"
    };
  }
  function plain(n) {
    return { j: n.j.name, s: n.s ? n.s.id : "", v: n.v ? n.v.variant || "" : "", state: n.state, theme: n.theme, vp: n.vp, tab: n.tab };
  }
  function fromLocation() {
    var q = new URLSearchParams(location.search);
    return { j: q.get("j"), s: q.get("s"), v: q.get("v"), state: q.get("state"), theme: q.get("theme"), vp: q.get("vp"), tab: q.get("tab") };
  }
  function choose(patch, push) {
    var next = plain(sel);
    Object.keys(patch).forEach(function (k) { next[k] = patch[k]; });
    sel = normalize(next);
    var q = new URLSearchParams(plain(sel));
    history[push ? "pushState" : "replaceState"](null, "", "?" + q.toString());
    render();
  }

  /* ------------------------------------------------------------ loading */

  function view(name) { document.body.setAttribute("data-view", name); }

  function load() {
    return fetch("/_studio/index.json", { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("the viewer answered " + r.status); return r.json(); })
      .then(function (data) {
        index = data;
        $("repo").textContent = data.root;
        var warn = $("warn");
        warn.hidden = data.warnings.length === 0;
        warn.textContent = data.warnings.join(" · ");
        if (data.journeys.length === 0) { view("empty"); return; }
        sel = normalize(fromLocation());
        view("ready");
        render();
      })
      .catch(function (err) {
        $("error-text").textContent = "Could not load the journeys: " + err.message;
        view("error");
      });
  }

  /* ------------------------------------------------------------ render */

  function render() {
    renderNav();
    renderBar();
    TABS.forEach(function (t) {
      $("tab-" + t).setAttribute("aria-selected", String(t === sel.tab));
      $("panel-" + t).setAttribute("data-on", t === sel.tab ? "1" : "0");
    });
    $("bar").hidden = sel.tab !== "preview";
    if (sel.tab === "preview") updateFrame();
    if (sel.tab === "flow") renderFlow();
    if (sel.tab === "shots") renderShots();
    if (sel.tab === "brief") renderBrief();
  }

  function renderNav() {
    var nav = $("nav");
    clear(nav);
    index.journeys.forEach(function (j) {
      var box = el("details", { open: j.name === sel.j.name }, [
        el("summary", {}, [j.title, el("small", {}, [j.name]), j.error ? el("span", { class: "bad" }, [j.error]) : null])
      ]);
      j.screens.forEach(function (s) {
        s.versions.forEach(function (v) {
          var cur = j.name === sel.j.name && sel.s && s.id === sel.s.id && (v.variant || "") === (sel.v.variant || "");
          box.appendChild(el("button", {
            class: v.variant ? "var" : "", type: "button", "aria-current": String(cur),
            click: function () { choose({ j: j.name, s: s.id, v: v.variant || "" }, true); }
          }, [v.variant ? "⤷ " + v.variant : s.title]));
        });
      });
      nav.appendChild(box);
    });
  }

  function seg(label, values, current, pick, text) {
    var wrap = el("label", {}, [label]);
    values.forEach(function (v) {
      wrap.appendChild(el("button", { type: "button", "aria-pressed": String(v === current), click: function () { pick(v); } }, [text ? text(v) : v]));
    });
    return wrap;
  }
  function choice(label, values, current, pick) {
    var select = el("select", { change: function () { pick(select.value); } }, values.map(function (v) {
      return el("option", { value: v, selected: v === current }, [v || "base"]);
    }));
    return el("label", {}, [label, select]);
  }

  function renderBar() {
    var bar = $("bar");
    clear(bar);
    if (!sel.s) return;
    var variants = sel.s.versions.map(function (v) { return v.variant || ""; });
    bar.appendChild(choice("state", sel.v.states, sel.state, function (v) { choose({ state: v }); }));
    bar.appendChild(seg("theme", ["light", "dark"], sel.theme, function (v) { choose({ theme: v }); }));
    if (variants.length > 1) bar.appendChild(choice("variant", variants, sel.v.variant || "", function (v) { choose({ v: v }); }));
    bar.appendChild(seg("viewport", VIEWPORTS, sel.vp, function (v) { choose({ vp: v }); }, function (v) { return v === "fit" ? "fit" : v; }));
    var url = screenUrl();
    if (url) bar.appendChild(el("a", { href: url, target: "_blank", rel: "noopener" }, ["open in a tab"]));
  }

  /* ------------------------------------------------------------ the frame */

  /* the same mapping as shots.mjs: .html is a file, anything else is a route on the preview */
  function screenUrl() {
    if (!sel.s) return null;
    var isHtml = /\.html$/.test(sel.v.file);
    if (!index.preview && !isHtml) return null;
    var q = new URLSearchParams({ state: sel.state, theme: sel.theme });
    if (!isHtml && sel.v.variant) q.set("variant", sel.v.variant);
    return (index.preview || "") + "/journeys/" + path(sel.j.name, isHtml ? sel.v.file : sel.s.id) + "?" + q.toString();
  }

  function updateFrame() {
    var url = screenUrl();
    $("nopreview").hidden = url !== null;
    $("wrap").hidden = url === null;
    $("nopreview").textContent = sel.s
      ? "This screen is " + sel.v.file + ", which needs a preview server. Declare preview.origin in design/design.json and start it."
      : "This journey has no screens yet.";
    if (url !== null && url !== frameUrl) { frameUrl = url; $("frame").src = url; }
    layout();
  }

  function layout() {
    var stage = $("stage"), wrap = $("wrap"), frame = $("frame");
    var w = stage.clientWidth, h = stage.clientHeight;
    if (sel.vp === "fit") {
      wrap.style.width = "100%"; frame.style.width = "100%"; frame.style.height = "100%"; frame.style.transform = "none";
      return;
    }
    var vp = Number(sel.vp), k = Math.min(1, w / vp);
    wrap.style.width = Math.round(vp * k) + "px";
    frame.style.width = vp + "px";
    frame.style.height = Math.round(h / k) + "px";
    frame.style.transform = "scale(" + k + ")";
  }

  /* a journey walks itself inside the frame; follow it so the controls stay true (same origin only) */
  function followFrame() {
    try {
      var win = $("frame").contentWindow, parts = win.location.pathname.split("/").map(decodeURIComponent);
      if (win.location.origin !== location.origin || parts[1] !== "journeys") return;
      var j = index.journeys.filter(function (x) { return x.name === parts[2]; })[0];
      var v = null, s = null;
      if (j) j.screens.forEach(function (x) { x.versions.forEach(function (y) { if (y.file === parts[3]) { s = x; v = y; } }); });
      if (!s) return;
      var d = win.document.documentElement.dataset;
      sel = normalize({ j: j.name, s: s.id, v: v.variant || "", state: d.state, theme: d.theme, vp: sel.vp, tab: sel.tab });
      frameUrl = screenUrl();
      history.replaceState(null, "", "?" + new URLSearchParams(plain(sel)).toString());
      renderNav(); renderBar();
    } catch (e) { /* cross-origin or not loaded: leave the controls alone */ }
  }

  function reloadFrame() {
    if (index.preview || sel.tab !== "preview") return;
    try { $("frame").contentWindow.location.reload(); } catch (e) { frameUrl = ""; updateFrame(); }
  }

  /* ------------------------------------------------------------ the flow map */

  function edgesOf(j) {
    var ids = {}, edges = [], seen = {};
    j.screens.forEach(function (s) { ids[s.id] = true; });
    j.screens.forEach(function (s) {
      s.versions.forEach(function (v) {
        v.links.forEach(function (raw) {
          var target = raw.split("?")[0].trim();
          if (target === "" || target === "back" || target.charAt(0) === "#") return;
          var kind = "screen", to = target, label = target;
          if (target.indexOf("/") >= 0) {
            var parts = target.split("/");
            kind = "external"; to = parts[parts.length - 2] + "/" + parts[parts.length - 1].replace(/\.[a-z0-9]+$/i, ""); label = to;
          } else if (!ids[target]) kind = "missing";
          var key = s.id + ">" + to;
          if (to === s.id || seen[key]) return;
          seen[key] = true;
          edges.push({ from: s.id, to: to, kind: kind, label: label });
        });
      });
    });
    return edges;
  }

  function layers(j, edges) {
    var layer = {}, order = [];
    function walk(root) {
      if (layer[root] !== undefined) return;
      layer[root] = 0; order.push(root);
      var queue = [root];
      while (queue.length) {
        var at = queue.shift();
        edges.forEach(function (e) {
          if (e.from === at && layer[e.to] === undefined) { layer[e.to] = layer[at] + 1; order.push(e.to); queue.push(e.to); }
        });
      }
    }
    walk(j.entry);
    j.screens.forEach(function (s) { walk(s.id); });
    return { layer: layer, order: order };
  }

  function renderFlow() {
    var panel = $("panel-flow"), j = sel.j;
    clear(panel);
    if (j.screens.length === 0) { panel.appendChild(el("p", { class: "mute" }, ["No screens in this journey."])); return; }
    var edges = edgesOf(j), lay = layers(j, edges);
    var W = 160, H = 44, GX = 80, GY = 22, PAD = 16, rows = {}, pos = {}, kinds = {}, labels = {};
    j.screens.forEach(function (s) { kinds[s.id] = "screen"; labels[s.id] = s.title; });
    edges.forEach(function (e) { if (e.kind !== "screen" && !kinds[e.to]) { kinds[e.to] = e.kind; labels[e.to] = e.kind === "missing" ? e.to + " (missing)" : e.to; } });
    var maxX = 0, maxY = 0;
    lay.order.forEach(function (id) {
      var l = lay.layer[id]; rows[l] = (rows[l] || 0);
      pos[id] = { x: PAD + l * (W + GX), y: PAD + rows[l] * (H + GY) };
      rows[l] += 1;
      maxX = Math.max(maxX, pos[id].x + W + PAD); maxY = Math.max(maxY, pos[id].y + H + PAD);
    });
    var root = svg("svg", { width: maxX, height: maxY, viewBox: "0 0 " + maxX + " " + maxY, role: "img", "aria-label": "flow of " + j.title }, [
      svg("defs", {}, [svg("marker", { id: "arrow", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" }, [svg("path", { d: "M0 0L10 5L0 10z" })])])
    ]);
    edges.forEach(function (e) {
      var a = pos[e.from], b = pos[e.to], x1 = a.x + W, y1 = a.y + H / 2, x2 = b.x, y2 = b.y + H / 2;
      root.appendChild(svg("path", { class: "edge", "data-kind": e.kind === "missing" ? "missing" : "", "marker-end": "url(#arrow)", d: "M" + x1 + " " + y1 + "C" + (x1 + 50) + " " + y1 + " " + (x2 - 50) + " " + y2 + " " + x2 + " " + y2 }));
    });
    lay.order.forEach(function (id) {
      var p = pos[id], kind = kinds[id];
      var node = svg("g", {
        class: "node", "data-kind": kind, "data-cur": String(kind === "screen" && sel.s && sel.s.id === id ? 1 : 0), tabindex: kind === "missing" ? null : 0, role: "button",
        click: function () { open(id, kind); },
        keydown: function (ev) { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); open(id, kind); } }
      }, [
        svg("rect", { x: p.x, y: p.y, width: W, height: H, rx: 8 }),
        svg("text", { x: p.x + W / 2, y: p.y + H / 2 + 4, "text-anchor": "middle" }, [labels[id].length > 22 ? labels[id].slice(0, 21) + "…" : labels[id]])
      ]);
      root.appendChild(node);
    });
    panel.appendChild(root);
    function open(id, kind) {
      if (kind === "screen") choose({ s: id, v: "" }, true);
      else if (kind === "external") {
        var parts = id.split("/"), other = index.journeys.filter(function (x) { return x.name === parts[0]; })[0];
        if (other && other.screens.some(function (s) { return s.id === parts[1]; })) choose({ j: parts[0], s: parts[1], v: "" }, true);
      }
    }
  }

  /* ------------------------------------------------------------ shots */

  function renderShots() {
    var panel = $("panel-shots"), shots = sel.j.shots;
    clear(panel);
    if (shots.length === 0) {
      panel.appendChild(el("p", {}, ["No shots for this journey yet. Take them with ", el("code", {}, ["node design/shots.mjs " + sel.j.name]), "."]));
      return;
    }
    var groups = {}, names = [];
    shots.forEach(function (s) {
      var name = s.id + (s.variant ? "--" + s.variant : "");
      if (!groups[name]) { groups[name] = []; names.push(name); }
      groups[name].push(s);
    });
    names.forEach(function (name) {
      var row = el("div", { class: "thumbs" });
      groups[name].forEach(function (s) {
        var href = "/_studio/shots/" + path(sel.j.name, s.file);
        row.appendChild(el("a", { href: href, target: "_blank", rel: "noopener" }, [
          el("img", { src: href, loading: "lazy", decoding: "async", alt: name + " " + s.state + " " + s.theme }),
          el("span", {}, [s.state + " · " + s.theme])
        ]));
      });
      panel.appendChild(el("section", { class: "group" }, [el("h3", {}, [name]), row]));
    });
  }

  /* ------------------------------------------------------------ JOURNEY.md, a safe subset */

  function inline(parent, text) {
    text.split(/(\*\*[^*]+\*\*|\x60[^\x60]+\x60)/).forEach(function (part) {
      if (part.slice(0, 2) === "**" && part.length > 4) parent.appendChild(el("strong", {}, [part.slice(2, -2)]));
      else if (part.charAt(0) === "\x60" && part.length > 2) parent.appendChild(el("code", {}, [part.slice(1, -1)]));
      else if (part) parent.appendChild(document.createTextNode(part));
    });
  }

  function markdown(text, into) {
    var para = [], list = null;
    function flush() {
      if (para.length) { var p = el("p"); inline(p, para.join(" ")); into.appendChild(p); para = []; }
      list = null;
    }
    text.split(/\r?\n/).forEach(function (line) {
      var m = /^(#{1,3})\s+(.*)$/.exec(line), item = /^\s*[-*]\s+(.*)$/.exec(line);
      if (m) { flush(); var h = el("h" + m[1].length); inline(h, m[2]); into.appendChild(h); }
      else if (item) {
        if (para.length) flush();
        if (!list) { list = el("ul"); into.appendChild(list); }
        var li = el("li"); inline(li, item[1]); list.appendChild(li);
      } else if (line.trim() === "") flush();
      else { list = null; para.push(line.trim()); }
    });
    flush();
  }

  function renderBrief() {
    var panel = $("panel-brief"), name = sel.j.name;
    clear(panel);
    if (!sel.j.brief) { panel.appendChild(el("p", { class: "mute" }, ["This journey has no JOURNEY.md."])); return; }
    function show(text) { if (sel.tab === "brief" && sel.j.name === name) { clear(panel); markdown(text, panel); } }
    if (briefs[name] !== undefined) return show(briefs[name]);
    panel.appendChild(el("p", { class: "mute" }, ["Loading…"]));
    fetch("/journeys/" + path(name, "JOURNEY.md"), { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("answered " + r.status); return r.text(); })
      .then(function (text) { briefs[name] = text; show(text); })
      .catch(function (err) { clear(panel); panel.appendChild(el("p", { class: "mute" }, ["Could not read JOURNEY.md: " + err.message])); });
  }

  /* ------------------------------------------------------------ live reload */

  function listen() {
    var source = new EventSource("/_studio/events");
    source.onopen = function () { $("live").setAttribute("data-on", "1"); $("live").title = "live"; };
    source.onerror = function () { $("live").setAttribute("data-on", "0"); $("live").title = "disconnected, retrying"; };
    source.onmessage = function (event) {
      var change = {};
      try { change = JSON.parse(event.data); } catch (e) { /* ignore a malformed event */ }
      clearTimeout(reloadTimer);
      reloadTimer = setTimeout(function () {
        briefs = {};
        load().then(function () { if (change.kind === "design" && index && sel) reloadFrame(); });
      }, 100);
    };
  }

  /* ------------------------------------------------------------ boot */

  TABS.forEach(function (t) { $("tab-" + t).addEventListener("click", function () { choose({ tab: t }, true); }); });
  $("retry").addEventListener("click", function () { view("loading"); load(); });
  $("frame").addEventListener("load", followFrame);
  window.addEventListener("popstate", function () { if (index && index.journeys.length) { sel = normalize(fromLocation()); render(); } });
  window.addEventListener("resize", function () { if (sel) layout(); });
  view("loading");
  load();
  listen();
})();
`;

const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>design studio</title>
<style>${STYLE}</style>
</head>
<body data-view="loading">
<header><strong>design studio</strong><span id="repo" class="mute"></span><span class="grow"></span><span id="live" data-on="0" title="connecting"></span></header>
<div id="warn" hidden></div>
<div id="loading" class="view"><p class="mute">Loading journeys…</p></div>
<div id="error" class="view"><p id="error-text"></p><button id="retry" class="retry" type="button">Retry</button></div>
<div id="empty" class="view">
  <h2>No journeys yet</h2>
  <p>There is nothing in <code>design/journeys/</code>. Ask your agent: <em>&ldquo;prototype a checkout&rdquo;</em>.</p>
</div>
<div id="ready" class="view">
  <nav id="nav" aria-label="Journeys"></nav>
  <main>
    <div class="tabs" role="tablist">
      <button id="tab-preview" role="tab" type="button">Preview</button>
      <button id="tab-flow" role="tab" type="button">Flow</button>
      <button id="tab-shots" role="tab" type="button">Shots</button>
      <button id="tab-brief" role="tab" type="button">Brief</button>
    </div>
    <div id="bar" class="bar"></div>
    <section id="panel-preview" class="panel">
      <div id="stage"><p id="nopreview" hidden></p><div id="wrap"><iframe id="frame" title="screen preview"></iframe></div></div>
    </section>
    <section id="panel-flow" class="panel"></section>
    <section id="panel-shots" class="panel"></section>
    <section id="panel-brief" class="panel"></section>
  </main>
</div>
<script>${CLIENT}</script>
</body>
</html>
`;

/* ---------------------------------------------------------------- the command */

function flag(argv, name) {
  const at = argv.indexOf(`--${name}`);
  return at === -1 ? null : (argv[at + 1] ?? "");
}

function openBrowser(url, log) {
  const [command, args] =
    process.platform === "darwin"
      ? ["open", [url]]
      : process.platform === "win32"
        ? ["cmd", ["/c", "start", "", url]]
        : ["xdg-open", [url]];
  const child = spawn(command, args, { stdio: "ignore", detached: true });
  child.on("error", () => log(`studio: could not open a browser; open ${url} yourself`));
  child.unref();
}

async function main(argv) {
  const wanted = flag(argv, "port");
  const port = wanted === null ? DEFAULT_PORT : wanted === "" ? Number.NaN : Number(wanted);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    console.error(`studio: --port wants a number from 0 to 65535, got "${wanted}"`);
    return 2;
  }
  let running;
  try {
    running = await start({ port });
  } catch (err) {
    console.error(`studio: could not start: ${err.message}`);
    return 1;
  }
  console.log(running.url);
  const root = process.cwd();
  if ((await stat(join(root, "design")).catch(() => null))?.isDirectory() !== true) {
    console.error(`studio: no design/ in ${root}; run it from the repo root`);
  }
  if (argv.includes("--open")) openBrowser(running.url, console.error);
  const stop = () => running.close().then(() => process.exit(0));
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  return null;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then((code) => {
    if (code !== null) process.exit(code);
  });
}
