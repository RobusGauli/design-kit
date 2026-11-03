#!/usr/bin/env node
/* design/lint.mjs — the stack-neutral compliance floor. Zero dependencies, Node 18+ or Bun.
 *
 * WHAT IT IS FOR. "A stricter linter, mechanically enforced" — the rules of the design system as
 * a command that FAILS THE BUILD, not as a paragraph a reviewer can read and still miss. It is
 * the floor a repo that will take no new devDependency still has; `references/lint-configs.md`
 * names the mature per-stack upgrades (stylelint + declaration-strict-value, postcss-html,
 * eslint-plugin-better-tailwindcss) that sit on top of it. It is not a formatter and not a fixer.
 *
 * WHAT IT READS. `design/design.json`, and nothing else:
 *   tokens     the DTCG source — the required-key contract is checked against it
 *   css        the generated sheet — every `var(--…)` anywhere must be declared in it
 *   system     WHERE COMPONENTS LIVE. The lint's "inside": tokens are allowed, raw values are not
 *   screens    WHERE PROTOTYPES LIVE. The lint's "outside": layout only, tokens never
 *   product    the production source. It must never import `design/`
 *
 * THE INSIDE/OUTSIDE SPLIT IS THE WHOLE IDEA. A component may name a token; a screen may not.
 * When a screen needs one, that is the signal a component is missing — build the component. So
 * the token-utility and arbitrary-value rules fire OUTSIDE only, and the rules that fire
 * everywhere are the ones no file may break: a raw colour, an `!important`, a `var()` that does
 * not exist, an inline `style=` carrying a literal, a `data-go` that is not a string literal.
 *
 *   node design/lint.mjs                      the whole check
 *   node design/lint.mjs --config <path>      a design.json somewhere else
 *   node design/lint.mjs --build <dir>        ALSO: that production build contains no studio-bridge
 *
 * Every offence is one line: `<path>:<line>  <rule>  <what was found>`. */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { declarations, flatten } from "./tokens-to-css.mjs";

/** Source files the lint reads. Everything else in a journey directory (json, md, png) is data. */
const SOURCE = new Set([
  ".html",
  ".htm",
  ".css",
  ".js",
  ".mjs",
  ".jsx",
  ".ts",
  ".tsx",
  ".svelte",
  ".vue",
]);
/** Files that carry a component ROOT, and therefore must carry a `data-slot`. */
const COMPONENT = new Set([".html", ".css", ".jsx", ".tsx", ".svelte", ".vue"]);
const SKIP_DIR = new Set([
  ".git",
  "node_modules",
  "dist",
  "dist-design",
  "build",
  "shots",
  "targets",
  "rounds",
]);

/** The contract of §2.5 — a missing key is a lint failure, which is what makes it a contract. */
export const REQUIRED = [
  ...["bg", "fg", "border", "accent", "accent-fg", "danger", "danger-fg", "focus"].map(
    (k) => `color.${k}`,
  ),
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => `space.${n}`),
  ...["xs", "sm", "base", "md", "lg", "xl", "2xl", "3xl"].flatMap((s) => [
    `text.${s}.size`,
    `text.${s}.leading`,
  ]),
  ...["sm", "md", "lg", "full"].map((k) => `radius.${k}`),
  ...[1, 2, 3].map((n) => `shadow.${n}`),
  ...["fast", "base", "slow", "easing"].map((k) => `motion.${k}`),
  ...["sm", "md", "lg"].map((k) => `breakpoint.${k}`),
];

/* ---------------------------------------------------------------- the rules */

const HEX = /#[0-9a-fA-F]{3,8}\b/;
const COLOUR_FN = /\b(rgba?|hsla?|oklch|oklab|lab|lch|color-mix)\s*\(/;
/* Tailwind (and any utility framework) colour idioms, plus the stock palette by name. */
const UTILITY_TOKEN =
  /\b(?:bg|text|border|ring|fill|stroke|from|via|to|shadow|rounded|font|decoration|outline|divide|accent|caret)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|[1-9]00|950)\b/;
const ARBITRARY = /\b[a-zA-Z0-9:_-]*\[[^\]\s]*\](?!:)/;
const DARK_VARIANT = /\bdark:[a-z[]/;
/* A `data-go` whose value is not a quoted literal — the thing that would make the map blind. */
const BOUND_GO = /(?::data-go|v-bind:data-go|\[attr\.data-go\]|data-go\s*=\s*[^"'\s>])/;
const STYLE_LITERAL = /style\s*=\s*(?:"[^"]*(?:#[0-9a-fA-F]{3}|:\s*[a-z]+\s*(?:;|"))|\{\{)/;

/** A CSS declaration whose property is design-bearing and whose value is a bare literal. */
const BARE_VALUE =
  /(^|[;{])\s*(color|background(?:-color)?|border(?:-color|-radius|-width)?|font(?:-family|-size)?|padding|margin|gap|box-shadow|line-height|letter-spacing)\s*:\s*([^;{}]+)/g;
/* A VALUE IS CHECKED PART BY PART, because `margin: 0 auto` is two keywords and not a literal.
   `font-weight` is deliberately NOT design-bearing here: there is no required token for it, and
   every mature config — stylelint-declaration-strict-value included — leaves it out. */
const OK_PART =
  /^(?:inherit|initial|unset|revert|revert-layer|none|auto|0|transparent|currentColor|currentcolor|fit-content|min-content|max-content|[0-9.]+%)$/;
const okValue = (value) =>
  value.includes("var(") ||
  value
    .split(/\s+/)
    .filter(Boolean)
    .every((part) => OK_PART.test(part));

/* ---------------------------------------------------------------- walking */

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  if (statSync(dir).isFile()) {
    out.push(dir);
    return out;
  }
  for (const name of readdirSync(dir).sort()) {
    if (SKIP_DIR.has(name) || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const lineOf = (text, index) => text.slice(0, index).split("\n").length;

/** Every line of a source file with its comments blanked out, so prose about `#fff` is not a
 *  violation and a commented-out rule is not a rule. */
export function decomment(text, ext) {
  let out = text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
  if (ext !== ".css") out = out.replace(/(^|[^:\w])\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, " "));
  out = out.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, " "));
  return out;
}

/* ---------------------------------------------------------------- the checks */

/** Offences in one file. `where` is "system", "screens" or "product". */
export function offences(rel, text, where, knownVars) {
  const ext = extname(rel);
  const body = decomment(text, ext);
  const source = text.split("\n");
  const found = [];
  /* THE ONE ESCAPE HATCH, and it is biome's shape for biome's reason: `design-lint-ok` in a
     comment ON the offending line or the line ABOVE drops that offence. It is not a config file
     and it is not a glob — it is a reason, written where the exception is, by the person taking
     it. The reduced-motion `!important` and the visually-hidden `margin: -1px` are what it is
     for, and there are two of them in the whole of both examples. */
  const excused = (line) =>
    (source[line - 1] ?? "").includes("design-lint-ok") ||
    (source[line - 2] ?? "").includes("design-lint-ok");
  const at = (index, rule, what) => {
    const line = lineOf(body, index);
    if (excused(line)) return;
    found.push({ path: rel, line, rule, what });
  };

  const scan = (re, rule, message) => {
    const rx = new RegExp(re.source, `${re.flags.includes("g") ? "" : "g"}${re.flags}`);
    let m = rx.exec(body);
    while (m !== null) {
      at(m.index, rule, message ?? m[0]);
      m = rx.exec(body);
    }
  };

  /* EVERYWHERE. */
  if (where !== "product") {
    scan(HEX, "raw-colour", null);
    scan(COLOUR_FN, "raw-colour", null);
    scan(/!important/, "important", null);
    scan(STYLE_LITERAL, "inline-style", null);
    scan(BOUND_GO, "bound-data-go", null);
    scan(DARK_VARIANT, "dark-variant", null);

    const vars = /var\(\s*(--[a-zA-Z0-9_-]+)/g;
    let v = vars.exec(body);
    while (v !== null) {
      if (!knownVars.has(v[1])) at(v.index, "unknown-var", v[1]);
      v = vars.exec(body);
    }

    if (ext === ".css" || ext === ".html" || ext === ".vue" || ext === ".svelte") {
      BARE_VALUE.lastIndex = 0;
      let d = BARE_VALUE.exec(body);
      while (d !== null) {
        const value = d[3].trim();
        /* The match starts at the `;` or `{` BEFORE the property, which is usually the end of the
           previous line — so the offence would be reported one line early, and `design-lint-ok`
           on the line above would never line up with it. Point at the PROPERTY. */
        if (!okValue(value)) at(d.index + d[0].indexOf(d[2]), "raw-value", `${d[2]}: ${value}`);
        d = BARE_VALUE.exec(body);
      }
    }
  }

  /* OUTSIDE ONLY: a screen composes; it never names a token. */
  if (where === "screens") {
    scan(UTILITY_TOKEN, "token-in-a-screen", null);
    scan(ARBITRARY, "arbitrary-value", null);
    if (SOURCE.has(ext) && ext !== ".mjs" && ext !== ".js" && ext !== ".ts") {
      if (!/data-screen\s*=/.test(body)) at(0, "no-data-screen", rel);
      else if (!/data-states\s*=/.test(body)) at(0, "no-data-states", rel);
    }
  }

  /* INSIDE ONLY: a component root is reachable by name or it is not a component. */
  if (where === "system" && COMPONENT.has(ext)) {
    /* `data-slot="x"` in markup, `"data-slot": "x"` in a props object, `[data-slot=x]` in CSS —
       three spellings of one rule, because the rule is about the ATTRIBUTE, not the syntax. */
    if (!/data-slot["']?\s*[=:]|\[data-slot/.test(body)) at(0, "no-data-slot", rel);
  }

  /* THE PRODUCTION GUARD, half one: nothing in the product may reach into the playground. */
  if (where === "product") {
    scan(
      /(?:from|import|require)\s*\(?\s*["'][^"']*\bdesign\/[^"']*["']/,
      "product-imports-design",
      null,
    );
  }

  return found;
}

/* ---------------------------------------------------------------- the state rule */

/** A selector's specificity as `[ids, classes + attributes + pseudo-classes, elements]`. */
const specificity = (sel) => [
  (sel.match(/#[\w-]/g) ?? []).length,
  (sel.match(/\[|\.[a-zA-Z_-]|:(?!:)[a-zA-Z-]/g) ?? []).length,
  (sel.replace(/\[[^\]]*\]|\([^)]*\)/g, "").match(/(^|[\s>+~(])[a-zA-Z][\w-]*/g) ?? []).length,
];
const atLeast = (a, b) =>
  a[0] !== b[0] ? a[0] > b[0] : a[1] !== b[1] ? a[1] > b[1] : a[2] >= b[2];

/**
 * THE STATE RULE MUST WIN (plan 50 review, #12). `[data-when] { display: none }` and a LATER
 * `[data-slot=…] { display: flex }` of the same weight, both outside any layer: the slot rule wins,
 * and a state's branch shows in every state — measured on a real agent's cart, whose empty block
 * sat over a full order. The fix is the recipe's: the components in `@layer components`, the state
 * rules outside it (an unlayered rule beats any layered one, and `revert-layer` hands a revealed
 * branch back its component's display). One offence per file, naming the first rule that wins.
 */
export function stateOffences(rel, text) {
  let body = decomment(text, ".css");
  /* A LAYERED RULE ALWAYS LOSES to an unlayered one: blank every `@layer … { … }` block. */
  for (let at = body.search(/@layer[^;{]*\{/); at !== -1; at = body.search(/@layer[^;{]*\{/)) {
    let i = body.indexOf("{", at) + 1;
    for (let depth = 1; i < body.length && depth > 0; i++)
      depth += body[i] === "{" ? 1 : body[i] === "}" ? -1 : 0;
    body = body.slice(0, at) + body.slice(at, i).replace(/[^\n]/g, " ") + body.slice(i);
  }
  const rules = [...body.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    sel: m[1].trim(),
    decl: m[2],
    at: m.index + m[1].length - m[1].trimStart().length,
  }));
  const hide = rules.find(
    (r) => r.sel.includes("[data-when]") && /(^|[;\s])display\s*:\s*none/.test(r.decl),
  );
  if (hide === undefined) return [];
  const weight = specificity(hide.sel);
  const wins = rules.find(
    (r) =>
      r.at > hide.at &&
      r.sel.includes("[data-slot") &&
      !r.sel.includes("data-when") &&
      /(^|[;\s])display\s*:/.test(r.decl) &&
      r.sel.split(",").some((one) => atLeast(specificity(one), weight)),
  );
  if (wins === undefined) return [];
  return [
    {
      path: rel,
      line: lineOf(body, wins.at),
      rule: "state-rule-loses",
      what: `\`${wins.sel.split("\n").pop().trim()}\` sets display after \`[data-when] { display: none }\` and wins it — put the components in \`@layer components { … }\` and keep the state rules outside it`,
    },
  ];
}

/* ---------------------------------------------------------------- the manifest */

/** Screens on disk under one journey directory: `<id>[--<variant>].<ext>` → { id, variant }. */
export function screensOf(dir) {
  return readdirSync(dir)
    .filter((n) => SOURCE.has(extname(n)) && !n.startsWith("studio-") && !n.endsWith(".mjs"))
    .map((n) => {
      const bare = n.slice(0, -extname(n).length);
      const at = bare.indexOf("--");
      return {
        file: n,
        id: at === -1 ? bare : bare.slice(0, at),
        variant: at === -1 ? null : bare.slice(at + 2),
      };
    });
}

/** Every `data-go` LITERAL in a file — the source edge set the flow map is derived from. */
export function linksOf(text, ext) {
  const body = decomment(text, ext);
  const out = [];
  /* A LOOKBEHIND, because `\b` matches between `:` and `d`: without it `:data-go="x"` would be
     read as an edge to a screen called `x`, and Vue's bound attribute — which `offences` refuses
     by name — would ALSO be reported as a link to nowhere. One offence, one line. */
  const rx = /(?<![:\w-])data-go\s*=\s*"([^"]*)"/g;
  let m = rx.exec(body);
  while (m !== null) {
    out.push(m[1]);
    m = rx.exec(body);
  }
  return out;
}

function manifestOffences(root, screensRoots) {
  const found = [];
  for (const base of screensRoots) {
    if (!existsSync(base)) continue;
    for (const name of readdirSync(base).sort()) {
      const dir = join(base, name);
      if (!statSync(dir).isDirectory()) continue;
      const manifestPath = join(dir, "journey.json");
      const rel = (p) => relative(root, p).split(sep).join("/");
      if (!existsSync(manifestPath)) {
        found.push({
          path: rel(dir),
          line: 0,
          rule: "no-manifest",
          what: "journey.json is missing",
        });
        continue;
      }
      let manifest;
      try {
        manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      } catch (e) {
        found.push({
          path: rel(manifestPath),
          line: 0,
          rule: "bad-manifest",
          what: String(e.message),
        });
        continue;
      }
      const onDisk = screensOf(dir);
      const ids = new Set(onDisk.map((s) => s.id));
      for (const id of Object.keys(manifest.screens ?? {})) {
        if (!ids.has(id)) {
          found.push({ path: rel(manifestPath), line: 0, rule: "screen-without-a-file", what: id });
        }
      }
      if (manifest.entry !== undefined && !ids.has(manifest.entry)) {
        found.push({
          path: rel(manifestPath),
          line: 0,
          rule: "entry-without-a-file",
          what: String(manifest.entry),
        });
      }
      for (const screen of onDisk) {
        const file = join(dir, screen.file);
        for (const link of linksOf(readFileSync(file, "utf8"), extname(screen.file))) {
          const target = link.split("?")[0];
          if (target === "back" || target === "" || target.startsWith("#")) continue;
          if (target.includes("/")) continue;
          if (!ids.has(target)) {
            found.push({
              path: rel(file),
              line: 0,
              rule: "link-to-nowhere",
              what: `data-go="${link}"`,
            });
          }
        }
      }
    }
  }
  return found;
}

/* ---------------------------------------------------------------- the CLI */

export function flag(argv, name) {
  const at = argv.indexOf(`--${name}`);
  return at === -1 ? null : (argv[at + 1] ?? null);
}

export function run(argv, cwd = process.cwd()) {
  const named = flag(argv, "config") ?? "design/design.json";
  const configPath = isAbsolute(named) ? named : join(cwd, named);
  if (!existsSync(configPath)) {
    console.error(`no design.json at ${configPath} — the design system is not set up in this repo`);
    return 2;
  }
  const root = resolve(dirname(configPath), "..");
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const near = (p) => (isAbsolute(p) ? p : join(root, p));
  const rel = (p) => relative(root, p).split(sep).join("/");
  const found = [];

  /* 1. The token contract. */
  const doc = JSON.parse(readFileSync(near(config.tokens), "utf8"));
  const present = new Set(flatten(doc).map((t) => t.path.join(".")));
  for (const key of REQUIRED) {
    if (!present.has(key)) {
      found.push({ path: rel(near(config.tokens)), line: 0, rule: "missing-token", what: key });
    }
  }

  /* 2. Every `var(--…)` anywhere has to be a property the generated sheet declares. */
  const sheet = readFileSync(near(config.css), "utf8");
  const knownVars = new Set(
    declarations(sheet)
      .map((d) => d.split(" | ")[1])
      .filter((p) => p.startsWith("--")),
  );
  for (const m of sheet.matchAll(/(--[a-zA-Z0-9_-]+)\s*:/g)) knownVars.add(m[1]);

  /* 3. The files, inside and outside. */
  const scopes = [
    ["system", config.system ?? []],
    ["screens", config.screens ?? []],
    ["product", config.product ?? []],
  ];
  const generated = new Set([near(config.css), near(config.tokens)].map((p) => resolve(p)));
  for (const [where, roots] of scopes) {
    for (const dir of roots) {
      for (const file of walk(near(dir))) {
        if (generated.has(resolve(file))) continue;
        if (!SOURCE.has(extname(file))) continue;
        /* A test, a story and a catalogue fixture do not ship, and a test that PLANTS a violation
           to prove the lint sees it must not be the thing the lint refuses. */
        if (/\.(test|spec|stories|cat)\.[a-z]+$/.test(file)) continue;
        if (/(^|\/)studio-bridge\.js$/.test(rel(file))) continue;
        found.push(...offences(rel(file), readFileSync(file, "utf8"), where, knownVars));
        if (where === "system" && extname(file) === ".css")
          found.push(...stateOffences(rel(file), readFileSync(file, "utf8")));
      }
    }
  }

  /* 4. The manifest and the links. */
  found.push(...manifestOffences(root, (config.screens ?? []).map(near)));

  /* 5. The production guard's second half, when a build is named. */
  const build = flag(argv, "build");
  if (build !== null) {
    let leaked = 0;
    for (const file of walk(near(build))) {
      if (readFileSync(file, "utf8").includes("studio-bridge")) {
        found.push({
          path: rel(file),
          line: 0,
          rule: "bridge-in-production",
          what: "contains `studio-bridge`",
        });
        leaked++;
      }
    }
    if (leaked === 0) console.log(`✓ ${build} carries no studio-bridge`);
  }

  for (const o of found) console.error(`${o.path}:${o.line}  ${o.rule}  ${o.what}`);
  if (found.length > 0) {
    console.error(`\n✗ ${found.length} offence${found.length === 1 ? "" : "s"}`);
    return 1;
  }
  console.log("✓ design lint clean");
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(run(process.argv.slice(2)));
