---
name: design-system
description: Lay or extend a product's design system — DTCG tokens, the type and space scales, contrast, states, the component floor, a catalogue and a mechanical lint — in whatever stack the repo already has (vanilla, React, Svelte, Vue, or brownfield). Use before building any screen or journey, and whenever design/DESIGN.md is still a stub.
---

# The design system

A screen can only be compliant against a system that exists. This skill lays one, or adapts one
that is already there, **in the stack the repo already has**. It is not a component library and
it does not install one: the system is the product's own components, and this teaches them how to
be compliant.

## 1. LOOK FIRST, and say what you found

Before writing anything, answer these in five lines in the conversation:

| | |
|---|---|
| **Stack** | what renders UI today — plain HTML, React, Svelte, Vue, a meta-framework, server templates |
| **CSS** | a stylesheet, CSS modules, Tailwind (which major), CSS-in-JS, a UI kit |
| **Tokens** | is there a `tokens.json`, a `_variables.scss`, a theme object, a design-system package? |
| **Build** | what command builds production, and what directory it writes |
| **Serving** | how a page is served in development |

**STOP AND ASK** — do not guess — when: `design/DESIGN.md` is still a stub of questions and
nobody asked you to lay foundations; the repo already has a design system and you were not told
to change it; there are two competing colour sets and no one has said which is canonical; the
product is brownfield (then read `references/brownfield.md` and ask its one question first).

## 2. The stack table — which recipe to open

| what you found | read | note |
|---|---|---|
| plain HTML / server templates / no framework | `references/vanilla.md` | the worked example is `design-vanilla` |
| React + Vite | `references/react.md` | the worked example is `design-react` |
| Svelte / SvelteKit | `references/svelte.md` | same tokens, same bridge, same manifest |
| Vue / Nuxt | `references/vue.md` | `:data-go` is refused — read the recipe's last section |
| Tailwind 4, any of the above | `references/tailwind4.md` | ALSO — it is the reset that makes utilities exist only for tokens |
| an existing product with its own CSS | `references/brownfield.md` | the adapter layer. Read it BEFORE the stack recipe |

**Never branch on a framework's name anywhere in the code you write.** Branch on what is in the
directory. The recipes are the stack's side of the seam and may name it; nothing you install into
`design/` may.

## 3. The foundations, in this order, each verified before the next

This is the nine-item floor. It is a checklist: copy it into the conversation and tick it.

1. **`tokens.json`** — DTCG 2025.10, three tiers (`primitive → semantic → component`), modes as
   overrides, the `--ds-` namespace, and **every required key** (`references/tokens-contract.md`).
   Start from a preset: `assets/tokens.neutral.json`, `tokens.warm.json` or `tokens.dense.json`.
   **The primitive tier is the KNOBS**: a designer who wants "rounder and warmer" changes two
   numbers there and regenerates.
2. **`tokens.css`**, generated — `node design/tokens-to-css.mjs`. **Never hand-edited.** Wire
   `node design/tokens-to-css.mjs --check` into the repo's test command so a stale sheet is a red
   test rather than a mystery.
3. **The type scale**: seven or eight steps, size and line height paired, **floor 12px**. And the
   **4px space scale**: eight steps.
4. **Colour, measured**: `node design/contrast.mjs`. Every `color.<x>` beside a `color.<x>-fg` is
   a surface and its on-surface; WCAG 2.2 AA is 4.5:1 for text and 3:1 for large text and
   non-text. A mark that is not text (a dot, an invalid ring) is named `<x>-strong` and is not
   paired. Fix the token, never the check.
5. **Radii, elevation, motion**: three durations and one easing, and only `opacity`, `transform`,
   `background` and `box-shadow` ever move. `prefers-reduced-motion` turns all of it off.
6. **The states**, both kinds: interactive (hover · focus-visible · active · disabled) and
   surface (empty · loading · error · ready), as NAMED rules in the system rather than as
   one-offs in a screen.
7. **The component floor**, in this order and no further until a journey asks: **button,
   field + input, card, badge, empty, skeleton.** Each in the stack's idiom, each with a fixture,
   each root carrying `data-slot="<name>"` (`references/components.md` has the anatomy, the
   states and the ARIA APG pattern per primitive).
8. **The catalogue**: every component × state × theme at ONE URL. It is the documentation; there
   is no Storybook and no generated prop table.
9. **The lint**, wired into the repo's own test command: `node design/lint.mjs`, plus the mature
   per-stack tools in `references/lint-configs.md` where the repo will take a devDependency.
   Then **fill `design/DESIGN.md`** from what now exists — it is a stub of questions and
   your job is to answer them.

## 4. The rules that hold in every stack

They are the same fourteen in a vanilla repo and in a Vue one, and `design/lint.mjs` enforces the
mechanical half of them.

1. **Tokens only inside the system.** A screen composes components and layout; it names no
   colour, radius, shadow or font size. When a screen needs one, **a component is missing**.
2. No hex, no `rgb(`/`hsl(`/`oklch(` literal, no `!important`, no inline `style=` with a literal
   — anywhere. (`design-lint-ok` in a comment on the line or the line above is the one escape
   hatch, and it takes a reason beside it.)
3. Never a per-component dark variant. **The theme swaps on the root.** Anything that must differ
   by theme differs as a TOKEN with a mode override.
4. Colour is never the only signal — a red dot with no word says nothing to a reader who cannot
   see it.
5. Every control has a name. The focus ring is the token sheet's, and no component deletes it.
6. The floor is 12px. Nothing in the type scale goes below it.
7. Every surface has the four states, and a surface that cannot show one says why.
8. Every component has a fixture and a catalogue entry.
9. **Every component root carries `data-slot="<name>"`; every screen root carries `data-screen`
   and `data-states`.** That is the identity a comment, a shot and a test all use instead of
   reading markup — and it is what lets a designer's comment name a COMPONENT rather than a pixel.
10. Every `var(--…)` resolves to something the generated sheet declares.
11. Icons are SVG files copied in (Lucide, ISC), never an icon font.
12. The product never imports `design/`, and the production build contains no `studio-bridge`.
13. Variants are files, dimensions are parameters (`prototype/SKILL.md` §2).
14. One brand override point: the font token. Declare the face, put its name first, regenerate.

## 5. The scripts — deterministic work is a script, never prose

All six are zero-dependency and run under Node 18+ or Bun. Copy them from this skill's `scripts/` to `design/` and
run them from the repo root. Never edit a copy: re-running the design-kit installer brings
the copies under `design/` up to the skill's bytes, and never touches `DESIGN.md`, `design.json` or
a journey.

| | |
|---|---|
| `scripts/tokens-to-css.mjs` | DTCG → `:root{--ds-…}` + the two dark blocks. `--check` compares PARSED declarations, so a formatter may reflow the file and only a VALUE drift fails |
| `scripts/contrast.mjs` | WCAG 2.x over the declared pairs, in every mode. **Not APCA**: it was pulled from the WCAG 3 draft in 2023 and nothing will settle before ~2029 |
| `scripts/lint.mjs` | §4's mechanical half, plus the manifest and link checks, plus `--build <dir>` for the production guard |
| `scripts/shots.mjs` | every screen × variant × state × theme, reusing a preview that already answers and otherwise starting its own on an ephemeral port |
| `scripts/studio.mjs` | a read-only dashboard over `design/journeys` (screens, flow map, shots, JOURNEY.md) on 127.0.0.1: `node design/studio.mjs --open`. Writes nothing, starts no preview |
| `scripts/verify.mjs` | runs the first three and prints PASS or FAIL per check. **This output is what counts, not your prose** |

`assets/` holds the three token presets, `studio-bridge.js` (the same file Harbor ships: copy it to `design/`, never edit it),
the `design.json` template and the design entry `index.html`.

## 6. `design.json` — the one contract

```jsonc
{
  "tokens": "src/theme/tokens.json",   // the DTCG source; where the knobs are
  "css":    "src/theme/tokens.css",    // generated from it — never hand-edited
  "system": ["src/ui"],                // where components live: the lint's "inside"
  "screens":["design/journeys"],       // the lint's "outside": layout only, tokens never
  "product":["src"],                   // must never import design/
  "catalogue": "/catalogue",           // a route on the preview origin, or a file under design/
  "lint": "node design/lint.mjs",
  "preview": { "command": "bun run design", "origin": "http://localhost:5174" }  // absent → served statically
}
```

**There is no `stack:` field, on purpose.** Whatever reads this branches on what is in the
directory — `.html` files are served statically, a `preview.command` is a toolchain — never on a
framework's name. Omit `preview` entirely when the screens are plain HTML: that is the case that
needs no toolchain and no configuration at all.

## 7. Verify, and say the four results

```
node design/tokens-to-css.mjs --check     the generated sheet is current
node design/contrast.mjs                  every declared pair clears AA
node design/lint.mjs                      tokens inside, layout outside, links that land
node design/verify.mjs --build            ALSO: the production build carries no studio-bridge
```

Print the commands and their results. Then say, in one line each: what you built, what you had to
ask about, and what is still a stub in `design/DESIGN.md`.
