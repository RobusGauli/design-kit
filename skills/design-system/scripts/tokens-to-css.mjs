#!/usr/bin/env node
/* tokens-to-css — one DTCG token file → the CSS custom properties every stack reads.
 *
 * ZERO DEPENDENCIES, Node 18+ or Bun. It is the generator the design-system skill installs and
 * the one the worked examples carry; the three copies are byte-identical and a test says so.
 *
 * WHAT IT ACCEPTS. The Design Tokens Community Group format, first stable version 2025.10:
 * `$value`, `$type` (inherited down a group), `$description`, `$extensions`, groups by nesting,
 * aliases as `{group.token}`. Types handled: color, dimension, number, fontFamily, fontWeight,
 * duration, cubicBezier, shadow, string. A `dimension` or `duration` may be written either as the
 * spec's object (`{ "value": 12, "unit": "px" }`) or as the shorthand string (`"12px"`) — the
 * shorthand is what the presets use, because a token file a designer edits by hand is worth more
 * than a token file that is quotable in the specification.
 *
 * TWO EXTENSIONS, AND THEY ARE THE WHOLE OF THE VENDOR SURFACE:
 *   "ds.design/modes": { "dark": <value> }   an override for one mode
 *   "ds.design/css":   { "name": "g0" }      emit `--g0` instead of `--ds-primitive-gray-0`
 *                        { "property": "color-scheme" }  emit a plain property, not a custom one
 * The `name` form is the ADAPTER LAYER a brownfield repo lives on (references/brownfield.md):
 * the semantic tier is written once, and the names the existing components already read are
 * aliased to it, so nothing existing is rewritten and the lint can still see one source.
 *
 * WHAT IT EMITS. `:root { … }`, then the same overrides twice — once under
 * `@media (prefers-color-scheme: dark)` guarded by `:root:not([data-theme="light"])`, once under
 * `:root[data-theme="dark"]`. That doubling is the three-state theme contract: an explicit stamp
 * wins in BOTH directions and the OS decides only when nothing is stamped. Expressing "light" by
 * deleting the attribute is not light — it is "follow the OS" — and on a dark-mode machine the
 * light half of a toggle would then do nothing at all.
 *
 *   node tokens-to-css.mjs                      paths from design/design.json
 *   node tokens-to-css.mjs --config <path>      a design.json somewhere else
 *   node tokens-to-css.mjs --in a.json --out b.css
 *   node tokens-to-css.mjs --check              regenerate and compare DECLARATIONS, not bytes
 *
 * `--check` compares the PARSED declarations, never the text: a formatter may reflow the file,
 * and a generated file that a formatter is allowed to touch must not fail for having been
 * formatted. What it may never do is drift in a value. */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

/** Every mode this generator knows. One today; the shape is what makes a second one cheap. */
export const MODES = ["dark"];
const NS = "ds";
const EXT_MODES = "ds.design/modes";
const EXT_CSS = "ds.design/css";

const isToken = (n) => n !== null && typeof n === "object" && !Array.isArray(n) && "$value" in n;

/** Every token in the document, depth-first, with `$type` inherited from the nearest group. */
export function flatten(doc) {
  const out = [];
  const walk = (node, path, inherited) => {
    const type = typeof node.$type === "string" ? node.$type : inherited;
    if (isToken(node)) {
      out.push({ path, type, value: node.$value, ext: node.$extensions ?? {} });
      return;
    }
    for (const [key, child] of Object.entries(node)) {
      if (key.startsWith("$")) continue;
      if (child === null || typeof child !== "object") continue;
      walk(child, [...path, key], type);
    }
  };
  walk(doc, [], undefined);
  return out;
}

/** The CSS name a token is emitted under — `--ds-<path>`, an alias, or a plain property. */
export function cssName(token) {
  const css = token.ext[EXT_CSS] ?? {};
  if (typeof css.property === "string") return css.property;
  if (typeof css.name === "string") return `--${css.name}`;
  return `--${NS}-${token.path.join("-")}`;
}

/** Is this token emitted as an ordinary CSS property rather than a custom property? */
const _isPlain = (token) => typeof token.ext[EXT_CSS]?.property === "string";

/** One `$value` as CSS text, before aliases are resolved. */
export function scalar(value, type) {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) {
    if (type === "cubicBezier") return `cubic-bezier(${value.join(", ")})`;
    return value.map((v) => (typeof v === "string" && v.includes(" ") ? `"${v}"` : v)).join(", ");
  }
  if (value !== null && typeof value === "object" && "value" in value && "unit" in value) {
    return `${value.value}${value.unit}`;
  }
  throw new Error(
    `a $value of type ${type ?? "(none)"} is not renderable: ${JSON.stringify(value)}`,
  );
}

/** `{a.b.c}` → `var(--ds-a-b-c)`, using the document's own names so an alias follows a rename. */
export function resolveAliases(text, byPath) {
  return text.replace(/\{([^{}]+)\}/g, (_whole, path) => {
    const target = byPath.get(path);
    if (target === undefined) throw new Error(`alias {${path}} names no token`);
    return `var(${cssName(target)})`;
  });
}

/** `{ light: [[name, value], …], dark: [[name, value], …] }` — dark holds only the overrides. */
export function declarationsOf(doc) {
  const tokens = flatten(doc);
  const byPath = new Map(tokens.map((t) => [t.path.join("."), t]));
  const light = [];
  const dark = [];
  for (const token of tokens) {
    const name = cssName(token);
    light.push([name, resolveAliases(scalar(token.value, token.type), byPath)]);
    const override = token.ext[EXT_MODES]?.dark;
    if (override !== undefined) {
      dark.push([name, resolveAliases(scalar(override, token.type), byPath)]);
    }
  }
  return { light, dark, tokens, byPath };
}

const block = (pairs, indent) =>
  pairs.map(([name, value]) => `${indent}${name}: ${value};`).join("\n");

/** The whole stylesheet. `source` is only ever a comment — nothing reads it back. */
export function toCss(doc, source = "tokens.json") {
  const { light, dark } = declarationsOf(doc);
  return `/* GENERATED from ${source} by design/tokens-to-css.mjs — DO NOT HAND-EDIT.
   Change ${source} and re-run \`node design/tokens-to-css.mjs\`. The three blocks below are the
   three-state theme contract: an explicit data-theme wins in both directions, the OS decides
   only when nothing is stamped. */

:root {
${block(light, "  ")}
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
${block(dark, "    ")}
  }
}

:root[data-theme="dark"] {
${block(dark, "  ")}
}
`;
}

/** Every declaration in a stylesheet as `<selector chain> | <property> | <value>`, whitespace
 *  and comma spacing normalised — which is what makes `--check` a value comparison rather than a
 *  formatting one. */
export function declarations(css) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out = [];
  const stack = [];
  let buf = "";
  const flush = () => {
    const decl = buf.trim();
    buf = "";
    if (decl === "") return;
    const at = decl.indexOf(":");
    if (at === -1) return;
    const value = decl
      .slice(at + 1)
      .trim()
      .replace(/\s+/g, " ")
      .replace(/\s*,\s*/g, ",");
    out.push(`${stack.join(" >> ")} | ${decl.slice(0, at).trim()} | ${value}`);
  };
  for (const c of text) {
    if (c === "{") {
      stack.push(buf.trim().replace(/\s+/g, " "));
      buf = "";
    } else if (c === "}") {
      flush();
      stack.pop();
    } else if (c === ";") {
      flush();
    } else {
      buf += c;
    }
  }
  return out;
}

/* ---------------------------------------------------------------- the CLI */

/** `--flag value` out of an argv tail. */
export function flag(argv, name) {
  const at = argv.indexOf(`--${name}`);
  return at === -1 ? null : (argv[at + 1] ?? null);
}

/** Where the tokens and the generated sheet live, per design.json or per argv. */
export function paths(argv, cwd = process.cwd()) {
  const from = (p) => (isAbsolute(p) ? p : join(cwd, p));
  const inFlag = flag(argv, "in");
  const outFlag = flag(argv, "out");
  if (inFlag !== null && outFlag !== null) return { tokens: from(inFlag), css: from(outFlag) };
  const configPath = from(flag(argv, "config") ?? "design/design.json");
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const near = (p) => (isAbsolute(p) ? p : resolve(dirname(configPath), "..", p));
  return {
    tokens: inFlag === null ? near(config.tokens) : from(inFlag),
    css: outFlag === null ? near(config.css) : from(outFlag),
  };
}

export function main(argv, cwd = process.cwd()) {
  const { tokens, css } = paths(argv, cwd);
  const doc = JSON.parse(readFileSync(tokens, "utf8"));
  const generated = toCss(doc, tokens.split("/").pop());
  if (argv.includes("--check")) {
    const committed = readFileSync(css, "utf8");
    const want = declarations(generated);
    const have = declarations(committed);
    const missing = want.filter((d) => !have.includes(d));
    const extra = have.filter((d) => !want.includes(d));
    if (missing.length === 0 && extra.length === 0) {
      console.log(`✓ ${css} is current — ${want.length} declarations`);
      return 0;
    }
    for (const d of missing) console.error(`  generated, not committed:  ${d}`);
    for (const d of extra) console.error(`  committed, not generated:  ${d}`);
    console.error(`✗ ${css} is stale — re-run \`node design/tokens-to-css.mjs\``);
    return 1;
  }
  writeFileSync(css, generated);
  console.log(`✓ ${css} — ${declarations(generated).length} declarations`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(main(process.argv.slice(2)));
