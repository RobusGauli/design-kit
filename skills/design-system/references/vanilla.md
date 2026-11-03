# Recipe — vanilla (no framework, no build step)

**The worked example is `templates/design-vanilla`; `design init --example vanilla` copies it.**
This is the recipe to reach for whenever you do not control the stack: a brownfield app, a Rails
or Django or Go product, a static site, or a repo whose toolchain you must not touch. It needs
**nothing**: no npm install, no bundler, no dev server. The files open from `file://`.

## The layout

```
design/
  tokens.json        the DTCG source
  tokens.css         GENERATED — node design/tokens-to-css.mjs
  components.css     the system. @import "./tokens.css" at the top
  catalogue.html     every component × state, both themes via ?theme=
  index.html         the journey index
  design.json        no `preview` key — the static door serves this as it is
  studio-bridge.js     copied from the skill's assets/, never edited
  lint.mjs contrast.mjs tokens-to-css.mjs shots.mjs verify.mjs
  journeys/<name>/   journey.json, <id>.html, <id>--<variant>.html
```

## `design.json`

```json
{
  "tokens": "design/tokens.json",
  "css": "design/tokens.css",
  "system": ["design/components.css"],
  "screens": ["design/journeys"],
  "product": ["src"],
  "catalogue": "/catalogue.html",
  "lint": "node design/lint.mjs"
}
```

**Omit `preview` entirely.** That is what tells the studio to serve `design/` statically on its
own loopback port — no command, no confirm, no toolchain.

## Components are ATTRIBUTE selectors, not classes — in `@layer components`

Every component rule lives inside `@layer components { … }` (the state rules below stay outside
it — that is what lets them win).

```css
[data-slot="button"] {
  display: inline-flex;
  align-items: center;
  height: var(--ds-space-12);
  padding: 0 var(--ds-space-5);
  border: 0;
  border-radius: var(--ds-radius-sm);
  background: var(--ds-color-accent);
  color: var(--ds-color-accent-fg);
  font-family: var(--ds-font-sans);
  font-size: var(--ds-text-sm-size);
}
[data-slot="button"][data-variant="secondary"] {
  background: var(--ds-color-surface);
  color: var(--ds-color-fg);
  box-shadow: var(--ds-shadow-hairline-strong);
}
[data-slot="button"]:disabled,
[data-slot="button"][aria-disabled="true"] { … }
```

Selecting on the attribute rather than a class is what makes `data-slot` **load-bearing instead of
decorative**: a component root that forgot it is unstyled, so it cannot be forgotten. It is also
the identity a designer's comment, a shot and a test all use.

## The four surface states, in CSS, with no script

```css
/* the components IN a layer … */
@layer components {
  [data-slot="empty"] { display: flex; /* … */ }
}
/* … and the state rules OUTSIDE it */
[data-when] { display: none; }
html[data-state="empty"]   [data-when~="empty"],
html[data-state="loading"] [data-when~="loading"],
html[data-state="error"]   [data-when~="error"],
html[data-state="ready"]   [data-when~="ready"] { display: revert-layer; }
```

**The layer is not optional.** Without it `[data-when] { display: none }` and a later
`[data-slot="empty"] { display: flex }` weigh the same, the later one wins, and the empty block
shows in every state — a real agent's cart did exactly that. An unlayered rule beats every layered
one, and `revert-layer` hands a revealed branch back its component's own `display`. The lint says
`state-rule-loses` over the unlayered form.

The bridge stamped `data-state` on `<html>` from `?state=` before first paint. No flash, no
script in the screen, and a screenshot of `?state=error` is a screenshot of the error state.

## The bridge tag, and why it is relative

```html
<script src="../../studio-bridge.js"></script>
```

**Classic, in `<head>`, no `defer`, no `type="module"`** — anything else stamps after first paint.
**Relative**, because a static journey is real files at real paths, so `../../` resolves under a
server AND under `file://`. (A single-page design app is served at every screen path and must use
an absolute `/studio-bridge.js` instead, or the relative one 404s on a nested route.)

## Variants

A variant is a FILE: `detail--dense.html`. In a static journey the bridge rewrites
`data-go="detail?variant=dense"` to `detail--dense.html`, so the link is still one literal in the
source and the flow map can still be grepped.

## The catalogue

One HTML page with a section per component and a row per state. `?theme=dark` is the only door to
the other theme, and nothing is remembered: a design review that starts in whatever theme the last
reader left it in is a review of the wrong screen.

## The checks

```
node design/tokens-to-css.mjs      regenerate after editing tokens.json
node design/lint.mjs               tokens inside, layout outside, links that land
node design/contrast.mjs           every declared pair, both modes
bun  design/shots.mjs <journey>    every screen × variant × state × theme (node also works)
node design/verify.mjs             all of it, PASS/FAIL per check
```

Wire `node design/verify.mjs` into whatever the repo runs as tests. If the repo has no test
command at all, say so and put the four lines in the README.
