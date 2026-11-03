#!/usr/bin/env node
/* verify.mjs — the checks, each printed PASS or FAIL, and one exit code.
 *
 * THE ENGINE'S GATE READS THIS OUTPUT, NOT AGENT PROSE. "It looks right" is not a check; lines that
 * each say PASS or FAIL are. Run it before you say a journey is ready to sign.
 *
 *   node design/verify.mjs              lint + tokens current + contrast + the shots
 *   node design/verify.mjs --build      ALSO run the product's own production build and refuse
 *                                       an output that contains the string `studio-bridge`
 *   node design/verify.mjs --digest <journey>
 *                                       print the journey's digest — one sha over its screens',
 *                                       its variants' and its design system's content, the value
 *                                       Harbor reports — and nothing else
 *
 * NO SHOTS IS A SKIP, NEVER A PASS: `shots SKIP — none taken` is what a journey nobody has shot yet
 * reads, and the summary says so — a PASS over zero pictures let a signature be asked for over a
 * journey nobody had seen.
 *
 * IT ALSO WRITES `design/verify.json` — the same verdicts, machine-readable, beside the config.
 * The studio reads that file and draws it as THE AGENT'S CLAIM, timestamped, because the studio
 * runs no script of the repo's and never will (a key-gated page exec'ing a file the agent wrote
 * is what the preview door's confirm exists to prevent). Stdout is unchanged, byte for byte: the
 * gate reads the lines, and this file is a second copy of the same answer for a reader that is
 * not a terminal. A write that fails changes nothing — not a line of output, not the exit code.
 *
 * A SHOT OF NOTHING IS NOT A SHOT, and this file learned that the expensive way. Measured
 * 2026-09-16, with a real agent: `shots.mjs` photographed 24 404 pages, every PNG came back
 * white with the four bytes `no` drawn in a corner, THIS SCRIPT PRINTED PASS, and the designer's
 * gate opened over white thumbnails. `shots.mjs` refuses a non-200 now; this is the other side
 * of the same lock, because a stale white PNG on disk is just as blank as a fresh one. Three
 * nets, no dependency:
 *   · a file under the size floor — a screen does not compress to nothing;
 *   · a PNG whose pixels are all (or all but a rounding error) the corner's colour;
 *   · two DIFFERENT screens whose files are byte-identical, which is what "everything is the
 *     same 404" looks like from here, and the failure names both of them.
 * The PNG is decoded with `node:zlib`, which is a builtin — this file still takes no dependency.
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative } from "node:path";
import { inflateSync } from "node:zlib";
import { run as contrast } from "./contrast.mjs";
import { run as lint } from "./lint.mjs";
import { main as tokens } from "./tokens-to-css.mjs";

function flag(argv, name) {
  const at = argv.indexOf(`--${name}`);
  return at === -1 ? null : (argv[at + 1] ?? null);
}

/** A check's word: 0 is PASS, a negative code is SKIP (it did not run), anything else FAIL. */
const word = (code) => (code === 0 ? "PASS" : code < 0 ? "SKIP" : "FAIL");
const label = (name, code) => `${word(code)}  ${name}`;

/* ---------- the journey's digest ---------------------------------------------------------- */

/** What a screen file is — Harbor's own list (`GET /api/design`'s scan). */
const SCREEN_EXT = new Set(["html", "tsx", "jsx", "svelte", "vue"]);

/** What a `system` root may hold — Harbor's own set (`GET /api/design`'s system walk). */
const SYSTEM_EXT = new Set([
  ".css",
  ".html",
  ".htm",
  ".js",
  ".mjs",
  ".jsx",
  ".ts",
  ".tsx",
  ".svelte",
  ".vue",
]);
/** Never part of the system: what Harbor's walk skips too. */
const SKIP = new Set([".git", "node_modules", "shots", "rounds", "targets"]);

/** Every file under `abs` the system walk takes — a named file whatever it is called. */
function systemFiles(abs, into = []) {
  let st;
  try {
    st = statSync(abs);
  } catch {
    return into;
  }
  if (st.isFile()) {
    into.push(abs);
    return into;
  }
  for (const name of readdirSync(abs)) {
    if (SKIP.has(name) || name.startsWith(".")) continue;
    const child = join(abs, name);
    if (statSync(child).isDirectory()) systemFiles(child, into);
    else if (SYSTEM_EXT.has(name.slice(name.lastIndexOf(".")).toLowerCase())) into.push(child);
  }
  return into;
}

/** The design system's sha: `tokens`, `css` and every `system[]` file, by repo-relative path in
 *  code-unit order, `path\nsha256\n` each, cut to 16 hex; "" with none. Harbor's `system.sha`. */
export function systemSha(config, cwd) {
  const files = new Set();
  for (const p of [config.tokens, config.css, ...(config.system ?? [])])
    if (typeof p === "string" && p !== "")
      for (const f of systemFiles(isAbsolute(p) ? p : join(cwd, p))) files.add(f);
  const lines = [...files]
    .map(
      (f) =>
        `${relative(cwd, f).split("\\").join("/")}\n${createHash("sha256").update(readFileSync(f, "utf8")).digest("hex")}\n`,
    )
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return lines.length === 0
    ? ""
    : createHash("sha256").update(lines.join("")).digest("hex").slice(0, 16);
}

/**
 * `--digest <journey>`: one sha over every screen and variant file directly in the journey's
 * directory — by file name in code-unit order, `name\nsha256\n` each — then `system\n<systemSha>\n`
 * when there is a system (a screen is what it is drawn with), cut to 16 hex. The same value Harbor
 * reports as the journey's `digest`; written beside a signature, it says which screens, drawn with
 * which system, were signed. Null when no root holds the journey.
 */
export function journeyDigest(config, cwd, name) {
  for (const base of config.screens ?? []) {
    const dir = join(isAbsolute(base) ? base : join(cwd, base), name);
    if (!existsSync(dir) || !statSync(dir).isDirectory()) continue;
    const lines = readdirSync(dir)
      .filter((f) => {
        const dot = f.lastIndexOf(".");
        return !f.startsWith(".") && dot > 0 && SCREEN_EXT.has(f.slice(dot + 1).toLowerCase());
      })
      .map((f) => {
        const sha = createHash("sha256")
          .update(readFileSync(join(dir, f), "utf8"))
          .digest("hex");
        return `${f}\n${sha}\n`;
      })
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    if (lines.length === 0) return "";
    const system = systemSha(config, cwd);
    return createHash("sha256")
      .update(lines.join("") + (system === "" ? "" : `system\n${system}\n`))
      .digest("hex")
      .slice(0, 16);
  }
  return null;
}

/* ---------- the shots are of something ---------------------------------------------------- */

/**
 * The size floor, in bytes.
 *
 * MEASURED, not guessed (chromium 1194, 1440×900, playwright's own PNG encoder): an empty page
 * is 5,850 bytes and a white page with the word "no" on it — the exact artefact this check was
 * written for — is 6,256. The smallest REAL screen in the worked examples is several times that.
 * 8 KB sits above the blank ones and well under the real ones; the ink check below is the
 * precise net, and this is the cheap one that also catches a truncated or half-written file.
 */
export const SHOT_FLOOR = 8 * 1024;

/** Below this fraction of pixels differing from the corner, the image is blank to a human. */
export const INK_FLOOR = 0.002;

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

const paeth = (a, b, c) => {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

/** One scanline, in place, from its filter byte and the line above it (PNG spec §9.2). */
function unfilter(type, line, prev, bpp, stride) {
  if (type === 0) return true;
  if (type > 4) return false;
  for (let i = 0; i < stride; i++) {
    const a = i >= bpp ? line[i - bpp] : 0;
    const b = prev[i];
    const c = i >= bpp ? prev[i - bpp] : 0;
    const add = type === 1 ? a : type === 2 ? b : type === 3 ? (a + b) >> 1 : paeth(a, b, c);
    line[i] = (line[i] + add) & 0xff;
  }
  return true;
}

/**
 * How much of a PNG is NOT the colour of its top-left pixel — `{ ink }` as a fraction of pixels,
 * or `{ ink: null, why }` when this decoder cannot judge (an interlaced or 16-bit file; nothing
 * a browser writes, but a hand-made PNG might be).
 *
 * THE CORNER AND NOT THE MODE, deliberately: a screen whose top-left pixel is a full-bleed
 * header reads as heavily inked, which is the safe direction. This only fires when very nearly
 * every pixel in the image is the corner's colour — a page with nothing on it.
 */
export function pngInk(buf) {
  if (buf.length < 8 || !buf.subarray(0, 8).equals(SIGNATURE))
    return { ink: null, why: "not a PNG" };
  let at = 8;
  let head = null;
  const idat = [];
  while (at + 8 <= buf.length) {
    const len = buf.readUInt32BE(at);
    const type = buf.toString("ascii", at + 4, at + 8);
    const data = buf.subarray(at + 8, at + 8 + len);
    if (type === "IHDR" && len >= 13) {
      head = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        depth: data[8],
        colour: data[9],
        interlace: data[12],
      };
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    at += 12 + len;
  }
  if (head === null) return { ink: null, why: "no IHDR" };
  if (head.depth !== 8) return { ink: null, why: `${head.depth}-bit, which this decoder skips` };
  if (head.interlace !== 0) return { ink: null, why: "interlaced, which this decoder skips" };
  const bpp = CHANNELS[head.colour];
  if (bpp === undefined) return { ink: null, why: `colour type ${head.colour}` };
  let raw;
  try {
    raw = inflateSync(Buffer.concat(idat));
  } catch {
    return { ink: null, why: "the IDAT did not inflate" };
  }
  const stride = head.width * bpp;
  if (raw.length < (stride + 1) * head.height) return { ink: null, why: "the IDAT is short" };

  let prev = Buffer.alloc(stride);
  let line = Buffer.alloc(stride);
  const corner = Buffer.alloc(bpp);
  let differ = 0;
  for (let y = 0; y < head.height; y++) {
    const off = y * (stride + 1);
    raw.copy(line, 0, off + 1, off + 1 + stride);
    if (!unfilter(raw[off], line, prev, bpp, stride)) {
      return { ink: null, why: `filter ${raw[off]} is not a PNG filter` };
    }
    if (y === 0) line.copy(corner, 0, 0, bpp);
    for (let x = 0; x < stride; x += bpp) {
      for (let c = 0; c < bpp; c++) {
        if (line[x + c] !== corner[c]) {
          differ++;
          break;
        }
      }
    }
    const swap = prev;
    prev = line;
    line = swap;
  }
  return { ink: differ / (head.width * head.height), why: "" };
}

/** Every picture Harbor (or `shots.mjs`) took of a journey the config's screen roots hold —
 *  `.harbor/shots/<journey>/*.png`, git-ignored: the pictures are Harbor's, never committed. */
export function shotFiles(config, cwd) {
  const out = [];
  for (const base of config.screens ?? []) {
    const dir = isAbsolute(base) ? base : join(cwd, base);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir).sort()) {
      const shots = join(cwd, ".harbor", "shots", name);
      if (!statSync(join(dir, name)).isDirectory()) continue;
      if (!existsSync(shots) || !statSync(shots).isDirectory()) continue;
      for (const file of readdirSync(shots).sort()) {
        if (file.toLowerCase().endsWith(".png")) out.push(join(shots, file));
      }
    }
  }
  return out;
}

/**
 * The shots are of something — the three nets in the header, over every committed PNG.
 *
 * A journey with NO shots yet is a SKIP (-1), and says so: not a failure while a journey is being
 * built, and never a PASS — nothing was looked at.
 */
export function shotsCheck(config, cwd) {
  const files = shotFiles(config, cwd);
  if (files.length === 0) {
    console.log("shots SKIP — none taken (run `bun design/shots.mjs <journey>`)");
    return -1;
  }
  const bad = [];
  const bySha = new Map();
  for (const file of files) {
    const rel = relative(cwd, file);
    const bytes = readFileSync(file);
    if (bytes.length < SHOT_FLOOR) {
      bad.push(`blank-shot     ${rel}  ${bytes.length} bytes, under the ${SHOT_FLOOR}-byte floor`);
      continue;
    }
    const { ink, why } = pngInk(bytes);
    if (ink === null) {
      bad.push(`unreadable-shot  ${rel}  ${why}`);
      continue;
    }
    if (ink < INK_FLOOR) {
      bad.push(
        `blank-shot     ${rel}  ${(ink * 100).toFixed(3)}% of it is not the corner's colour — that is an empty page`,
      );
      continue;
    }
    const sha = createHash("sha256").update(bytes).digest("hex");
    bySha.set(sha, [...(bySha.get(sha) ?? []), rel]);
  }
  /* TWO DIFFERENT SCREENS, ONE IMAGE. Every screen answering the same 404 is what this looks
     like from disk, and it is the net that caught the real failure. A screen and its own
     variant are different files, so any repeat at all is a repeat. */
  for (const [, names] of bySha) {
    if (names.length < 2) continue;
    bad.push(`same-shot      ${names.join("  ==  ")} — different screens, identical bytes`);
  }
  for (const line of bad.sort()) console.error(`  ${line}`);
  if (bad.length > 0) {
    console.error(
      `\n${bad.length} shot problem${bad.length === 1 ? "" : "s"} — re-run \`node design/shots.mjs\` against a preview that is actually serving the screens`,
    );
    return 1;
  }
  console.log(`✓ ${files.length} shots, each of something, none a copy of another`);
  return 0;
}

/**
 * `design/verify.json` beside the config — the same verdicts, for a reader that is not a
 * terminal. `{ when, checks: { tokens, contrast, lint, shots, build } }`, each `PASS`/`FAIL`, and
 * `SKIP` for a check this run did not make (`build` without `--build`).
 *
 * IT NEVER CHANGES THE ANSWER. Every failure here is swallowed: a read-only checkout, a
 * `design/` somebody made unwritable, a full disk — none of them is a verdict about the design
 * system, and a verify that failed because it could not write its own receipt would be the
 * checks reporting on the reporter.
 */
export function writeReport(configPath, checks) {
  try {
    writeFileSync(
      join(dirname(configPath), "verify.json"),
      `${JSON.stringify({ when: new Date().toISOString(), checks }, null, 2)}\n`,
    );
  } catch {
    /* said above: a receipt that cannot be written is not a failed check */
  }
}

export function run(argv, cwd = process.cwd()) {
  const named = flag(argv, "config") ?? "design/design.json";
  const configPath = isAbsolute(named) ? named : join(cwd, named);
  if (!existsSync(configPath)) {
    console.error(`FAIL  design.json — nothing at ${configPath}`);
    return 2;
  }
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const results = [];
  /* THE KEYS ARE THE CHECKS AND THE ORDER IS THE RUN'S. `build` starts SKIP because a run
     without `--build` did not make that check, and a missing key and a failed one must never
     read the same to whatever is drawing this. */
  const checks = { tokens: "SKIP", contrast: "SKIP", lint: "SKIP", shots: "SKIP", build: "SKIP" };
  const verdict = (key, code) => {
    checks[key] = word(code);
    return code;
  };

  const digestOf = flag(argv, "digest");
  if (digestOf !== null) {
    const digest = journeyDigest(config, cwd, digestOf);
    if (digest === null) {
      console.error(
        `FAIL  no journey called ${digestOf} under ${(config.screens ?? []).join(", ")}`,
      );
      return 2;
    }
    console.log(digest);
    return 0;
  }

  console.log("— tokens.css is current —");
  results.push([
    "tokens.css is generated from tokens.json",
    verdict("tokens", tokens(["--config", configPath, "--check"], cwd)),
  ]);

  console.log("\n— contrast —");
  results.push([
    "every declared pair clears WCAG 2.2 AA",
    verdict("contrast", contrast(["--config", configPath], cwd)),
  ]);

  console.log("\n— the design lint —");
  results.push([
    "tokens inside, layout outside, links that land",
    verdict("lint", lint(["--config", configPath], cwd)),
  ]);

  console.log("\n— the shots —");
  results.push([
    "every shot is of a screen, and no two are the same",
    verdict("shots", shotsCheck(config, cwd)),
  ]);

  if (argv.includes("--build")) {
    console.log("\n— the production guard —");
    const command = config.build ?? "npm run build";
    const built = spawnSync(command, { cwd, shell: true, stdio: "inherit" });
    if (built.status !== 0) results.push([`\`${command}\` succeeds`, verdict("build", 1)]);
    else
      results.push([
        "the production build carries no studio-bridge",
        verdict("build", lint(["--config", configPath, "--build", config.dist ?? "dist"], cwd)),
      ]);
  }

  /* BEFORE THE SUMMARY IS PRINTED, so an agent that reads the last line and stops has already
     left the receipt behind. Nothing below this line writes to stdout differently because of it. */
  writeReport(configPath, checks);

  console.log("");
  for (const [name, code] of results) console.log(label(name, code));
  const failed = results.filter(([, code]) => code > 0).length;
  const skipped = results.filter(([, code]) => code < 0).map(([name]) => name);
  console.log(
    failed > 0
      ? `\n✗ ${failed} check${failed === 1 ? "" : "s"} failed`
      : skipped.length > 0
        ? "\n✓ all checks pass — shots SKIP, none taken"
        : "\n✓ all checks pass",
  );
  return failed === 0 ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(run(process.argv.slice(2)));
