#!/usr/bin/env node
/* contrast.mjs — WCAG 2.x ratios over the token file's declared surface / on-surface pairs.
 *
 * WCAG 2.x, NOT APCA, and that is a dated decision rather than a preference: APCA was pulled from
 * the WCAG 3 working draft in July 2023, WCAG 3's contrast method "is yet to be determined", and
 * nothing is expected to settle before about 2029. A gate that moves under a repo is worse than a
 * gate one grade too blunt. Treat APCA as advisory if you want it; measure this.
 *
 * WHAT IT MEASURES. The pairs are a property of the token NAMES: `color.<x>` beside
 * `color.<x>-fg` is a surface and its on-surface, which is the shadcn/M3/Primer convention and
 * the whole reason a contrast check can be mechanical at all. `color.fg` is measured against
 * `color.bg`. Every pair is measured in EVERY mode.
 *
 * The floor is WCAG 2.2 AA: 4.5:1 for text, 3:1 for large text and non-text. This prints the
 * ratio for every pair and fails on anything under 4.5 unless the pair is listed as non-text in
 * design.json's `contrast.large` array.
 *
 *   node design/contrast.mjs [--config design/design.json] [--min 4.5]
 */

import { pathToFileURL } from "node:url";
import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { flatten, MODES } from "./tokens-to-css.mjs";

/** `#abc`, `#aabbcc`, `#aabbccdd`, `rgb(…)`, `rgba(…)` → [r, g, b, a] in 0–255 / 0–1. */
export function parseColour(text) {
  const value = String(text).trim();
  const hex = /^#([0-9a-fA-F]{3,8})$/.exec(value);
  if (hex !== null) {
    let h = hex[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join("");
    const n = (i) => Number.parseInt(h.slice(i, i + 2), 16);
    return [n(0), n(2), n(4), h.length === 8 ? n(6) / 255 : 1];
  }
  const fn = /^rgba?\(([^)]+)\)$/.exec(value);
  if (fn !== null) {
    const parts = fn[1]
      .split(/[,\s/]+/)
      .filter(Boolean)
      .map(Number);
    return [parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1];
  }
  return null;
}

/** Composite `top` over `under`, both [r,g,b,a]. A translucent token is measured where it lands. */
export const over = (top, under) =>
  [0, 1, 2].map((i) => Math.round(top[i] * top[3] + under[i] * (1 - top[3])));

const channel = (c) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

export const luminance = ([r, g, b]) =>
  0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

export function ratio(fg, bg) {
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Every token's value in one mode, aliases resolved to literals. */
export function resolved(doc, mode) {
  const tokens = flatten(doc);
  const byPath = new Map(tokens.map((t) => [t.path.join("."), t]));
  const raw = (path, seen = new Set()) => {
    if (seen.has(path)) return null;
    seen.add(path);
    const token = byPath.get(path);
    if (token === undefined) return null;
    const ext = token.$extensions ?? token.ext ?? {};
    const value = mode === "light" ? token.value : (ext["ds.design/modes"]?.[mode] ?? token.value);
    if (typeof value === "string") {
      const alias = /^\{([^{}]+)\}$/.exec(value.trim());
      if (alias !== null) return raw(alias[1], seen);
    }
    return value;
  };
  const out = new Map();
  for (const token of tokens) out.set(token.path.join("."), raw(token.path.join(".")));
  return out;
}

/** The pairs a token document declares, by name: `<x>` / `<x>-fg`, and `bg` / `fg`. */
export function pairs(doc) {
  const names = new Set(
    flatten(doc)
      .filter((t) => t.path[0] === "color")
      .map((t) => t.path.slice(1).join(".")),
  );
  const out = [["bg", "fg"]];
  for (const name of [...names].sort()) {
    if (!name.endsWith("-fg")) continue;
    const surface = name.slice(0, -3);
    if (names.has(surface)) out.push([surface, name]);
  }
  return out;
}

export function report(doc, min = 4.5, large = []) {
  const lines = [];
  let failures = 0;
  for (const mode of ["light", ...MODES]) {
    const values = resolved(doc, mode);
    const page = parseColour(values.get("color.bg") ?? "#ffffff") ?? [255, 255, 255, 1];
    for (const [surface, fg] of pairs(doc)) {
      const s = parseColour(values.get(`color.${surface}`) ?? "");
      const f = parseColour(values.get(`color.${fg}`) ?? "");
      if (s === null || f === null) continue;
      const ground = over(s, page);
      const r = ratio(over(f, ground), ground);
      const floor = large.includes(surface) ? 3 : min;
      const ok = r >= floor;
      if (!ok) failures++;
      lines.push(
        `${ok ? "  " : "✗ "}${mode.padEnd(5)}  ${`${surface} / ${fg}`.padEnd(34)} ${r.toFixed(2)}:1  (needs ${floor})`,
      );
    }
  }
  return { lines, failures };
}

export function flag(argv, name) {
  const at = argv.indexOf(`--${name}`);
  return at === -1 ? null : (argv[at + 1] ?? null);
}

export function run(argv, cwd = process.cwd()) {
  const named = flag(argv, "config") ?? "design/design.json";
  const configPath = isAbsolute(named) ? named : join(cwd, named);
  if (!existsSync(configPath)) {
    console.error(`no design.json at ${configPath}`);
    return 2;
  }
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const near = (p) => (isAbsolute(p) ? p : resolve(dirname(configPath), "..", p));
  const doc = JSON.parse(readFileSync(near(config.tokens), "utf8"));
  const min = Number(flag(argv, "min") ?? 4.5);
  const { lines, failures } = report(doc, min, config.contrast?.large ?? []);
  for (const line of lines) (failures > 0 ? console.error : console.log)(line);
  if (failures > 0) {
    console.error(`\n✗ ${failures} pair${failures === 1 ? "" : "s"} under the floor`);
    return 1;
  }
  console.log(`✓ ${lines.length} pairs, all at or over ${min}:1`);
  return 0;
}

/* pathToFileURL, not `file://${argv[1]}`: that never matches on Windows or in a path with a
   space, and the script would then exit 0 having checked nothing. */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(run(process.argv.slice(2)));
