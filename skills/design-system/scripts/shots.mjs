#!/usr/bin/env node
/* shots.mjs — photograph every screen × variant × state × theme of a journey, and REPORT WHAT
 * MOVED. Zero dependencies, Node 18+ or Bun.
 *
 * THE PIXEL DIFF IS INFORMATION, NOT A GATE. Playwright's own documentation warns that
 * screenshots differ by OS, by browser build and by installed fonts; a committed PNG that fails
 * on the next machine teaches a team that gates are noise. So this prints a moved list, writes
 * the new files, and exits 0 unless it could not take a REAL shot. The gate is the lint, the
 * contrast script and the designer's eyes.
 *
 * A RUNNER THAT PHOTOGRAPHS A 404 IS NOT A RUNNER. Measured 2026-09-16, with a real agent: with
 * no preview answering, this script served the React project's `design/` as STATIC FILES, every
 * `…/journeys/checkout/cart` was a 404 whose body is the four bytes `no`, and all 24 PNGs came
 * back white with "no" in the corner. `verify.mjs` printed PASS, the agent said "shot every
 * screen", and the designer's gate opened over white thumbnails. So:
 *   · a response that is not 200 FAILS, and the message names the URL;
 *   · a document with no `[data-screen]` root within 10 s FAILS, and names the URL;
 *   · and the static fallback is ONLY right when `design.json` declares no `preview` at all.
 *
 * WHICH PREVIEW, SAID OUT LOUD. `design.json`'s `preview.origin` BELONGS TO THE STUDIO — the
 * page may already own a server there, and killing it leaves the designer's tab pointed at a
 * foreign process. NEVER START, STOP OR KILL THE STUDIO'S PREVIEW. The rule is:
 *   · no `preview` in `design.json`  → a static server of our own, on an EPHEMERAL port;
 *   · `preview.origin` answers       → shoot through it, touch nothing;
 *   · `preview.origin` is silent     → run `preview.command` OURSELVES, wait for it, shoot, and
 *                                      stop the tree we started. Nothing else is stopped, ever.
 * It prints which of the three it did, because "it shot something" and "it shot the studio's
 * preview" are different sentences and a reader deserves the true one.
 *
 * THREE DOORS, BEST FIRST, AND EACH PROVED WITH A REAL SHOT — never with a `typeof`.
 *   1. `Bun.WebView`, webkit backend — the system WebKit, macOS only, NO EXTERNAL ANYTHING.
 *      In-process: no child, no browser to install. Run this under `bun` to get it.
 *   2. `Bun.WebView`, chrome backend — a Chrome or Chromium the machine already has, driven over
 *      the DevTools protocol. Bun finds it in the standard places; `BUN_CHROME_PATH` overrides.
 *      This is the door on Linux, where the webkit backend does not exist.
 *   3. `node` + a `playwright` the machine already has, through a `node -e` child. The last
 *      resort, and the only one that needs something installed.
 * Playwright is in no package.json and must not be: a browser download for one check is a cost
 * every contributor pays. Measured on this journey's 24 shots, 2026-09-17: door 1 1.5 s,
 * door 3 2.4 s.
 *
 * `Bun.WebView` WAS WRITTEN OFF ON A MEASUREMENT BUG, so read this before removing it again.
 * The note it carried said the headless screenshot "returns nothing on current Bun". It does
 * not. `screenshot()` resolves to a **Blob**, and `new Uint8Array(blob)` is 0 bytes for every
 * blob there has ever been — so the probe that rejected this door was reading its own mistake.
 * `await blob.bytes()`, or `encoding: "buffer"`, is the shot: 15 KB in 7 ms, zero-copy mmap.
 *
 * WKWebView SNAPSHOTS AT THE DISPLAY'S BACKING SCALE, not at the size you asked for — 2880×1800
 * for a 1440×900 view on a retina Mac. `Bun.Image` normalises it (statically linked into bun;
 * no sharp, no install), and the resize is handed to its worker thread WHILE THE NEXT SHOT
 * NAVIGATES. That ordering is the whole trick: awaited in line it costs 95 ms a shot and makes
 * this slower than playwright (4.2 s), pipelined it disappears (1.5 s).
 *
 * AND THE PLAYWRIGHT DOOR FINDS A GLOBAL INSTALL ITSELF rather than asking for a `NODE_PATH`.
 * Measured 2026-09-16: playwright was installed with `npm i -g`, `require.resolve("playwright")`
 * failed anyway — node does not search the global root — and every run died on *no browser
 * runner* with an instruction the designer could not act on, because `NODE_PATH=… node
 * design/shots.mjs` does not match the allow list the skill installs (the rules match from a
 * command's FIRST character, `prototype/SKILL.md` §4) and so costs a permission prompt per shot.
 *
 * IT RE-SHOOTS WHAT MOVED, and skips what did not. The digest of every input that can change a
 * pixel — the screen's own bytes, everything under `design/` and `src/`, the geometry, and this
 * script's own version — is recorded beside the PNGs. A round that edits one screen costs six
 * shots, not twenty-four. `--all` shoots everything regardless.
 *
 * THE JOURNEY IS REQUIRED, and that is a fix rather than a shape. It used to default to EVERY
 * journey in the directory, so an agent answering a round on `checkout` re-shot `example` too
 * and left 24 PNGs nobody asked for in `git status` — measured on the critic's fourth pass, and
 * it is the kind of noise that gets a whole tool turned off. Photographing a journey nobody
 * named is never what was meant; naming it costs one word.
 *
 *   bun design/shots.mjs checkout               the journey, named — bun opens door 1
 *   node design/shots.mjs checkout              the same, on whatever door node can open
 *   node design/shots.mjs --journey checkout    the name, spelled out
 *   node design/shots.mjs checkout --all        every shot, even the ones nothing touched
 *   node design/shots.mjs checkout --width 1440 --height 900
 *
 * With HARBOR_DESIGN_SHOTS=1 the host takes the pictures, and this says so and exits 0. Anywhere
 * else a door that cannot open FAILS FAST, in one sentence, and never hangs.
 */

import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { delimiter, dirname, extname, isAbsolute, join, resolve } from "node:path";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
};

/** How long a preview we started ourselves gets to answer before we give up on it. */
const PREVIEW_WAIT_MS = 60_000;
const PREVIEW_POLL_MS = 250;

export function flag(argv, name) {
  const at = argv.indexOf(`--${name}`);
  return at === -1 ? null : (argv[at + 1] ?? null);
}

/** Every flag this script reads, so `bareWord` knows which argv entries are a flag's VALUE. */
const FLAGS = ["config", "width", "height", "journey"];

/** Bumped when a change to this script would make an OLD png of an UNCHANGED screen wrong.
 *  It is an input to every digest, so bumping it re-shoots the world exactly once. */
const SHOT_VERSION = 2;
/** How long a browser door may take to prove itself before it counts as shut. */
const PROBE_MS = 10_000;

/** How many views shoot at once. Measured 2026-09-17 on the webkit door: 1 view 1.46 s for 24
 *  shots, 2 views 1.22 s, 4 views 1.45 s — WKWebView contends with itself past two, so this is
 *  the top of the curve and not a knob worth growing. */
const VIEWS = 2;

/**
 * The first argv entry that is neither a flag nor a flag's value — the journey's name.
 *
 * Written out rather than "argv[0]" because the flags may come first: `--width 1440 checkout` is
 * a shape a person types, and reading `1440` as the journey would fail with a confusing message
 * about a directory that does not exist.
 */
export function bareWord(argv) {
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      if (FLAGS.includes(a.slice(2))) i++;
      continue;
    }
    return a;
  }
  return null;
}

/** What is in `design/journeys/`, for the message that says which names are real. */
export function journeyNames(dir) {
  try {
    return readdirSync(dir).filter((n) => statSync(join(dir, n)).isDirectory());
  } catch {
    return [];
  }
}

/** A read-only static server over one directory, on an ephemeral loopback port. */
export async function serve(root) {
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, "http://127.0.0.1").pathname);
    if (path.includes("..") || path.split("/").some((s) => s.startsWith("."))) {
      res.writeHead(403).end("no");
      return;
    }
    let file = join(root, path);
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    if (!existsSync(file)) {
      res.writeHead(404).end("no");
      return;
    }
    res.writeHead(200, {
      "content-type": TYPES[extname(file)] ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    res.end(readFileSync(file));
  });
  await new Promise((done, fail) => server.once("error", fail).listen(0, "127.0.0.1", done));
  return { origin: `http://127.0.0.1:${server.address().port}`, stop: () => server.close() };
}

const answers = async (origin) => {
  try {
    await fetch(origin, { signal: AbortSignal.timeout(1500) });
    return true;
  } catch {
    return false;
  }
};

/**
 * Run `preview.command` ourselves, in the repo, and hold it until the shots are taken.
 *
 * THIS SCRIPT MAY, AND THE STUDIO'S PAGE MAY NOT: it is running in the agent's own shell, under
 * the human's own permission prompt, and `design.json` is a file that shell already owns. What
 * it must never do is touch a preview somebody ELSE started — hence the caller's probe first.
 *
 * `detached` so the kill reaches the dev server a `bun run …` spawns underneath itself; killing
 * the shell alone leaves the port held by an orphan, which is the exact mess this file exists to
 * stop making.
 */
export async function startCommand(command, cwd, origin) {
  const shell = process.env.SHELL || "/bin/sh";
  const child = spawn(shell, ["-lc", command], {
    cwd,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const tail = [];
  const keep = (d) => {
    tail.push(String(d));
    if (tail.length > 40) tail.splice(0, tail.length - 40);
  };
  child.stdout.on("data", keep);
  child.stderr.on("data", keep);
  const stop = () => {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      try {
        child.kill("SIGTERM");
      } catch {
        /* already gone */
      }
    }
  };
  const deadline = Date.now() + PREVIEW_WAIT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      return {
        ok: false,
        stop,
        why: `\`${command}\` exited (${child.exitCode})\n${tail.join("")}`,
      };
    }
    if (await answers(origin)) return { ok: true, stop, why: "" };
    await new Promise((done) => setTimeout(done, PREVIEW_POLL_MS));
  }
  return {
    ok: false,
    stop,
    why: `nothing answered ${origin} within ${PREVIEW_WAIT_MS / 1000}s\n${tail.join("")}`,
  };
}

/* A string run by a child `node`, because this script's own runtime cannot import a package the
   project does not depend on. EVERYTHING THROUGH THE ENVIRONMENT, never argv: `node -e` drops the
   `--` separator and shifts what is left, so an argv index here is a wrong URL.

   THE TWO REFUSALS LIVE HERE, where the response and the document are. A screenshot is taken of
   whatever the browser has; only the browser knows the status code and whether a screen mounted,
   so only the browser can say "this is not a screen" before the PNG exists. */
const PAGE = `
const { chromium } = require("playwright");
const spec = JSON.parse(process.env.SHOT_SPEC);
(async () => {
  const browser = await chromium.launch({ args: ["--no-proxy-server"], executablePath: process.env.SHOTS_CHROMIUM || undefined });
  const context = await browser.newContext({
    viewport: { width: spec.width, height: spec.height },
    colorScheme: spec.theme, deviceScaleFactor: 1, reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const out = [];
  for (const shot of spec.shots) {
    const res = await page.goto(shot.url, { waitUntil: "domcontentloaded", timeout: 30000 });
    const status = res === null ? 0 : res.status();
    if (status !== 200) throw new Error(shot.url + " answered " + status + " — that is not a screen, and nothing was photographed");
    try {
      await page.waitForSelector("[data-screen]", { state: "attached", timeout: 10000 });
    } catch {
      throw new Error(shot.url + " has no [data-screen] root after 10s — that is not a screen, and nothing was photographed");
    }
    await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}" });
    await page.evaluate(() => document.fonts.ready);
    const png = await page.screenshot({ type: "png", animations: "disabled" });
    out.push({ file: shot.file, png: png.toString("base64") });
  }
  console.log(JSON.stringify({ shots: out }));
  await browser.close();
})().catch((e) => { console.log(JSON.stringify({ error: String((e && e.message) || e) })); process.exit(1); });
`;

/* Printed by the node that will do the loading: nothing when it already resolves playwright,
   the directory to put on `NODE_PATH` when a GLOBAL install has it, and a non-zero exit when
   there is no playwright anywhere this looks. Asked of that node rather than computed here, so
   `SHOTS_NODE` naming a different one still gets its own global root. */
const FIND = `
const { existsSync } = require("node:fs");
const { dirname, join } = require("node:path");
try { require.resolve("playwright"); console.log(""); process.exit(0); } catch {}
for (const root of [
  join(dirname(process.execPath), "..", "lib", "node_modules"),
  join(process.env.HOME || "", ".bun", "install", "global", "node_modules"),
]) {
  if (existsSync(join(root, "playwright", "package.json"))) { console.log(root); process.exit(0); }
}
process.exit(1);
`;

/** `node` and a `playwright` it can load, with the `NODE_PATH` that made it loadable — or
 *  `null` when the machine has none. */
export function playwrightDoor() {
  const node = process.env.SHOTS_NODE ?? "node";
  const found = spawnSync(node, ["-e", FIND], { env: process.env, encoding: "utf8" });
  if (found.status !== 0) return null;
  const root = (found.stdout ?? "").trim();
  const env = { ...process.env };
  if (root !== "") env.NODE_PATH = [env.NODE_PATH, root].filter(Boolean).join(delimiter);
  return { kind: "playwright", node, env, line: "node + playwright" };
}

/* What the page must satisfy before it is photographed, run inside the view. It answers the
   SECOND of the two refusals — a 200 that is not a screen — and it is the same sentence on both
   doors, because a wait that differs between runners is a flake that only shows up on one. */
const READY = `(async () => {
  for (let i = 0; i < 200; i++) {
    if (document.querySelector("[data-screen]")) break;
    await new Promise((r) => setTimeout(r, 5));
  }
  if (!document.querySelector("[data-screen]")) return false;
  const style = document.createElement("style");
  style.textContent = "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}";
  document.head.appendChild(style);
  await document.fonts.ready;
  return true;
})()`;

/** A PNG's pixel width, straight out of IHDR — four bytes at offset 16. Cheaper than decoding
 *  the image to ask whether it needs resizing, which is the only question here. */
const pngWidth = (bytes) =>
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(16);

/**
 * Bun's own WebView, PROVED WITH A REAL SHOT — webkit first, then chrome.
 *
 * The `typeof` version of this check is what put a runner that photographs nothing at the front
 * of the queue once already; the blob-vs-bytes note in the header is what put a runner that
 * photographs everything at the BACK of it. So neither the constructor existing nor the backend
 * being named is evidence: a door is open when a throwaway shot of `about:blank` comes back with
 * bytes in it, and not before.
 */
export async function bunDoor(width, height) {
  const WebView = globalThis.Bun?.WebView;
  if (typeof WebView !== "function") return null;
  /* A PROBE THAT NEVER ANSWERS IS A DOOR THAT IS SHUT — a sandboxed shell hangs here forever. */
  const within = (p) =>
    Promise.race([
      p,
      new Promise((_, no) => setTimeout(() => no(new Error("no answer")), PROBE_MS)),
    ]);
  for (const backend of ["webkit", "chrome"]) {
    let view = null;
    try {
      view = new WebView({ backend, headless: true, width, height });
      await within(view.navigate("about:blank"));
      const probe = await within(view.screenshot({ format: "png", encoding: "buffer" }));
      if (probe.length === 0) continue;
      /* A backing-scale snapshot has to be brought back to the asked-for geometry, and
         `Bun.Image` is what does it. Without it this door would write PNGs at whatever scale the
         display happens to be, which is a baseline nobody else's machine can reproduce. */
      const scaled = pngWidth(probe) !== width;
      if (scaled && typeof globalThis.Bun?.Image !== "function") continue;
      return { kind: "bun", backend, width, height, scaled, line: `Bun.WebView (${backend})` };
    } catch {
      /* Next backend. A webkit constructor throws on Linux; a chrome one throws with no Chrome. */
    } finally {
      /* `close()` is synchronous and returns undefined on this binding, so it is guarded rather
         than `.catch()`ed — and it is guarded because this runs on the throw path too. */
      try {
        view?.close();
      } catch {
        /* already gone */
      }
    }
  }
  return null;
}

/** The best door on this machine, or `null`. */
export async function runner(width, height) {
  return (await bunDoor(width, height)) ?? playwrightDoor();
}

/**
 * Shoot through `Bun.WebView`: `VIEWS` views pulling from one queue, and every resize handed to
 * `Bun.Image`'s worker thread rather than awaited in line (see the header — that ordering is
 * worth 2.7 s on 24 shots).
 *
 * THE STATUS IS ASKED FOR SEPARATELY, with `fetch`, because a webview will happily render a 404
 * and no API here reports the code. It is ~2 ms on loopback and it buys the FIRST of the two
 * refusals: 24 photographs of a 404 page passed every check in the chain once, and the message
 * has to name the URL and the number.
 */
async function shootBun(door, shots) {
  const queue = [...shots];
  const pending = [];
  const out = [];
  const views = [];
  try {
    for (let i = 0; i < Math.min(VIEWS, shots.length); i++) {
      const view = new globalThis.Bun.WebView({
        backend: door.backend,
        headless: true,
        width: door.width,
        height: door.height,
      });
      await view.navigate("about:blank");
      views.push(view);
    }
    await Promise.all(
      views.map(async (view) => {
        for (;;) {
          const shot = queue.shift();
          if (shot === undefined) return;
          const res = await fetch(shot.url).catch(() => null);
          if (res === null) throw new Error(`${shot.url} did not answer at all`);
          if (res.status !== 200) {
            throw new Error(
              `${shot.url} answered ${res.status} — that is not a screen, and nothing was photographed`,
            );
          }
          await view.navigate(shot.url);
          if ((await view.evaluate(READY)) !== true) {
            throw new Error(
              `${shot.url} has no [data-screen] root after 1s — that is not a screen, and nothing was photographed`,
            );
          }
          const raw = await view.screenshot({ format: "png", encoding: "buffer" });
          if (raw.length === 0) throw new Error(`${shot.url} photographed nothing`);
          if (!door.scaled) {
            out.push({ file: shot.file, bytes: raw });
            continue;
          }
          pending.push(
            new globalThis.Bun.Image(raw)
              .resize(door.width, door.height, { filter: "box" })
              .png()
              .bytes()
              .then((bytes) => out.push({ file: shot.file, bytes })),
          );
        }
      }),
    );
    await Promise.all(pending);
  } finally {
    /* Every one, even if one throws: a view left open holds a WebKit process for the life of
       this script, and on the failure paths above there is always one still open. */
    for (const view of views) {
      try {
        view.close();
      } catch {
        /* already gone */
      }
    }
  }
  return out;
}

async function shootPlaywright(runner, shots, theme, width, height) {
  const child = spawn(runner.node, ["-e", PAGE], {
    env: { ...runner.env, SHOT_SPEC: JSON.stringify({ shots, theme, width, height }) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let out = "";
  let err = "";
  child.stdout.on("data", (d) => {
    out += d;
  });
  child.stderr.on("data", (d) => {
    err += d;
  });
  await new Promise((done) => child.on("close", done));
  let report;
  try {
    report = JSON.parse(out.trim().split("\n").pop() ?? "");
  } catch {
    throw new Error(`the shot printed no verdict: ${out}${err}`.trim());
  }
  if (report.shots === undefined) throw new Error(`the shot failed: ${report.error}`);
  return report.shots.map((s) => ({ file: s.file, bytes: Buffer.from(s.png, "base64") }));
}

/* ---------- what moved, and what did not ---------------------------------------------------
   THE POINT OF THIS IS THE ROUND, not the first run. A round answers one critique by editing one
   screen, and re-photographing the other seven is both the slowest part of the loop and pure
   noise in `git status` — measured on the critic's fourth pass, which is also where "the journey
   is required" came from, for the same reason.

   WHAT COUNTS AS AN INPUT is deliberately generous: this screen's own bytes, every OTHER file in
   its journey directory, and EVERY file under `design/` outside `journeys/` and under `src/` —
   the tokens, the shared css, the bridge, the components a framework screen imports.

   THE THREE LAYERS ARE THE WHOLE DESIGN, and collapsing them is what the first cut got wrong:
   with the screens themselves folded into the shared digest, editing ONE screen changed the
   digest of ALL of them and re-shot the world — the exact cost this is here to remove, measured
   the first time it ran.

   ponytail: the shared set is `design/` + `src/`, so a screen that imports from somewhere else
   in the repo (a `packages/` workspace, say) can go stale. `--all` is the hammer, the skill says
   so, and the upgrade path is to read the preview's own module graph — which is a bundler, and
   not worth owning until someone is actually bitten. */

/** Every file under `dir`, sorted, skipping the outputs and the places nobody's source lives.
 *  `skip` names directories to leave out — `journeys`, for the shared layer. */
export function inputFiles(dir, skip = [], into = []) {
  if (!existsSync(dir)) return into;
  for (const name of readdirSync(dir).sort()) {
    if (name === "shots" || name === "rounds" || name === "node_modules" || name.startsWith(".")) {
      continue;
    }
    if (skip.includes(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) inputFiles(path, skip, into);
    else into.push(path);
  }
  return into;
}

const digestOf = (root, files, seed) => {
  const hash = createHash("sha256");
  hash.update(seed);
  for (const file of files) {
    hash.update(file.slice(root.length));
    hash.update(readFileSync(file));
  }
  return hash.digest("hex");
};

/** LAYER ONE: everything every journey shares — `design/` outside `journeys/`, plus `src/`. */
export function sharedDigest(root, designDir) {
  return digestOf(
    root,
    [...inputFiles(designDir, ["journeys"]), ...inputFiles(join(root, "src"))],
    `${SHOT_VERSION}\n`,
  );
}

/** LAYER TWO: what one journey's directory holds that is not a screen — `journey.json`, a local
 *  stylesheet, a fixture. A screen file is layer three and is hashed on its own. */
export function journeyDigest(root, journey, shared, screens) {
  return digestOf(
    root,
    inputFiles(journey).filter((f) => !screens.includes(f)),
    `${shared}\n`,
  );
}

/** LAYER THREE: this shot. The geometry and the screen's own bytes, over the two layers above. */
export function shotDigest(context, screenBytes, path, width, height) {
  return createHash("sha256")
    .update(`${context}\n${width}x${height}\n${path}\n`)
    .update(screenBytes)
    .digest("hex");
}

/** What the last run recorded, or `{}` — an unreadable ledger means "shoot everything", never a
 *  crash, because the ledger is a cache and a cache is never the truth. */
export function readLedger(shotsDir) {
  try {
    const parsed = JSON.parse(readFileSync(join(shotsDir, ".digests.json"), "utf8"));
    return parsed !== null && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/** `<id>[--<variant>].<state>.<theme>.png` — the one naming pattern the studio and the document
 *  both read back. */
export const shotName = (id, variant, state, theme) =>
  `${id}${variant === null ? "" : `--${variant}`}.${state}.${theme}.png`;

/**
 * Resolve the origin to photograph, and say out loud which of the three doors it is.
 *
 * Returns `{ origin, stop, line }`, or `{ origin: null, why }` when the declared preview could
 * not be brought up — which is a FAILURE and never a reason to serve the project statically. A
 * framework prototype served as files is a directory listing and a pile of 404s, which is what
 * produced 24 white PNGs and a green check.
 */
export async function preview(config, designDir, root) {
  const declared = config.preview ?? null;
  if (declared === null || typeof declared.origin !== "string") {
    const own = await serve(designDir).catch((e) => ({ error: e }));
    if ("error" in own)
      return {
        origin: null,
        stop: () => {},
        why: `this shell cannot open a port (${own.error?.code ?? own.error}) — a sandbox; Harbor takes the pictures when it runs`,
      };
    const port = new URL(own.origin).port;
    return { origin: own.origin, stop: own.stop, line: `started my own on :${port}` };
  }
  if (await answers(declared.origin)) {
    return {
      origin: declared.origin,
      stop: () => {},
      line: `using the running preview at ${declared.origin}`,
    };
  }
  if (typeof declared.command !== "string" || declared.command.trim() === "") {
    return {
      origin: null,
      stop: () => {},
      why: `nothing is answering ${declared.origin} and design.json names no preview.command to start`,
    };
  }
  const started = await startCommand(declared.command, root, declared.origin);
  if (!started.ok) return { origin: null, stop: started.stop, why: started.why };
  return {
    origin: declared.origin,
    stop: started.stop,
    line: `started my own on :${new URL(declared.origin).port} (\`${declared.command}\`) — and will stop it again`,
  };
}

export async function run(argv, cwd = process.cwd()) {
  /* A host that photographs the screens itself (Harbor's studio does) sets this, and its sandbox
     can neither open a port nor launch a browser: stand down at once instead of probing for 20 s. */
  if (process.env.HARBOR_DESIGN_SHOTS === "1") {
    console.log("This environment takes the pictures itself as the screens change — nothing to run here.");
    return 0;
  }
  const named = flag(argv, "config") ?? "design/design.json";
  const configPath = isAbsolute(named) ? named : join(cwd, named);
  if (!existsSync(configPath)) {
    console.error(`no design.json at ${configPath}`);
    return 2;
  }
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const designDir = dirname(configPath);
  const root = resolve(designDir, "..");
  const near = (p) => (isAbsolute(p) ? p : join(root, p));
  const width = Number(flag(argv, "width") ?? 1440);
  const height = Number(flag(argv, "height") ?? 900);
  const all = argv.includes("--all");
  /* The name, as a bare word or behind `--journey`. A bare word is anything that is not a flag
     and does not follow one — so `--width 1440 checkout` still finds `checkout`. */
  const only = flag(argv, "journey") ?? bareWord(argv);
  if (only === null) {
    console.error(
      "which journey? node design/shots.mjs <journey>\n" +
        "  · one journey per run: shooting every one re-writes PNGs nobody asked for\n" +
        `  · this repo has: ${journeyNames(join(root, "design", "journeys")).join(" ") || "none yet"}`,
    );
    return 2;
  }

  const door = await runner(width, height);
  if (door === null) {
    console.error(
      "no browser runner. Any ONE of these opens a door:\n" +
        "  · run it under bun — `bun design/shots.mjs` — on macOS that needs nothing else\n" +
        "  · install Chrome or Chromium (BUN_CHROME_PATH names one out of the way)\n" +
        "  · `npm i -g playwright && npx playwright install chromium` for the node door.",
    );
    return 1;
  }

  /* THE PREVIEW: the studio's when it answers, ours otherwise — and never the studio's to kill. */
  const { origin, stop, line, why } = await preview(config, designDir, root);
  if (origin === null) {
    stop();
    console.error(`no preview to shoot through: ${why}`);
    return 1;
  }
  console.log(`  (${door.line}, ${line})`);

  const moved = [];
  let skipped = 0;
  try {
    const shared = sharedDigest(root, designDir);
    for (const base of config.screens ?? []) {
      const dir = near(base);
      if (!existsSync(dir)) continue;
      for (const name of readdirSync(dir).sort()) {
        if (name !== only) continue;
        const journey = join(dir, name);
        if (!statSync(journey).isDirectory()) continue;
        if (!existsSync(join(journey, "journey.json"))) continue;
        /* THE PICTURES LIVE OUTSIDE THE JOURNEY, git-ignored: `design/.shots/<journey>/`.
           The `.gitignore` goes first, so no picture is ever a file git sees. */
        const shotsDir = join(root, "design", ".shots", name);
        mkdirSync(shotsDir, { recursive: true });
        const ignore = join(root, "design", ".shots", ".gitignore");
        if (!existsSync(ignore)) writeFileSync(ignore, "*\n");
        const ledger = all ? {} : readLedger(shotsDir);
        const next = { ...ledger };
        const files = readdirSync(journey).filter((f) =>
          [".html", ".tsx", ".jsx", ".vue", ".svelte"].includes(extname(f)),
        );
        const context = journeyDigest(
          root,
          journey,
          shared,
          files.map((f) => join(journey, f)),
        );
        for (const theme of ["light", "dark"]) {
          const wanted = [];
          for (const file of files) {
            const bare = file.slice(0, -extname(file).length);
            const at = bare.indexOf("--");
            const id = at === -1 ? bare : bare.slice(0, at);
            const variant = at === -1 ? null : bare.slice(at + 2);
            const bytes = readFileSync(join(journey, file));
            const states = (
              /data-states\s*=\s*"([^"]*)"/.exec(bytes.toString("utf8"))?.[1] ?? "ready"
            )
              .split(/\s+/)
              .filter(Boolean);
            for (const state of states) {
              const isHtml = extname(file) === ".html";
              const url = `${origin}/journeys/${name}/${isHtml ? file : id}?state=${state}&theme=${theme}${variant === null || isHtml ? "" : `&variant=${variant}`}`;
              const out = join(shotsDir, shotName(id, variant, state, theme));
              /* THE ORIGIN IS NOT AN INPUT. An ephemeral port changes on every run, so mixing
                 the whole url into the digest would make every shot look moved — which is the
                 bug that makes a cache worse than none. The PATH is what identifies a screen. */
              const digest = shotDigest(
                context,
                bytes,
                `${new URL(url).pathname}${new URL(url).search}`,
                width,
                height,
              );
              const key = shotName(id, variant, state, theme);
              if (ledger[key] === digest && existsSync(out)) {
                skipped++;
                continue;
              }
              next[key] = digest;
              wanted.push({ url, file: out });
            }
          }
          if (wanted.length === 0) continue;
          const taken =
            door.kind === "bun"
              ? await shootBun(door, wanted)
              : await shootPlaywright(door, wanted, theme, width, height);
          for (const shot of taken) {
            if (shot.bytes.length === 0) {
              console.error(`${shot.file}: the runner returned 0 bytes — nothing written`);
              return 1;
            }
            const before = existsSync(shot.file) ? readFileSync(shot.file) : null;
            if (before === null || !Buffer.from(before).equals(Buffer.from(shot.bytes))) {
              moved.push(shot.file);
            }
            writeFileSync(shot.file, shot.bytes);
          }
        }
        /* THE LEDGER IS WRITTEN LAST, and only for a journey whose shots all came back. A digest
           recorded before the PNG exists is a promise to skip a shot that was never taken. */
        writeFileSync(join(shotsDir, ".digests.json"), `${JSON.stringify(next, null, 2)}\n`);
      }
    }
  } catch (e) {
    console.error(String(e?.message ?? e));
    return 1;
  } finally {
    stop();
  }

  const unchanged = skipped === 0 ? "" : ` · ${skipped} unchanged`;
  if (moved.length === 0) console.log(`✓ shots current — nothing moved${unchanged}`);
  else {
    console.log(`✓ ${moved.length} shot${moved.length === 1 ? "" : "s"} moved${unchanged}:`);
    for (const f of moved) console.log(`    ${f}`);
  }
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(await run(process.argv.slice(2)));
