# Recipe — React + Vite

**The worked example is `templates/design-react`; `design init --example react` copies it.**
Read `tailwind4.md` too if the repo uses Tailwind — the `@theme` reset is what makes the lint's
"no token utilities in a screen" rule mean anything.

## The layout

```
src/theme/tokens.json      the DTCG source            ← the knobs
src/theme/tokens.css       GENERATED, never edited
src/theme/base.css         the reset, .sr-only, the focus ring, reduced motion — hand-written
src/theme/styles.css       the styling layer's bridge, and the PRODUCT's entry
src/ui/                    the design system. The lint's "inside"
src/main.tsx               the product. Imports src/ui, never design/
design/vite.config.ts      root: "design", outDir: "../dist-design", port 5174, @ui → ../src/ui
design/index.html          the bridge tag + #root
design/main.tsx            the routes, discovered with import.meta.glob
design/design.css          @import "../src/theme/styles.css" + the @source lines for design/
design/screen.ts           the ten-line hook
design/journeys/<name>/    journey.json, <id>.tsx, <id>--<variant>.tsx
```

## Two Vite roots, and that IS the production guarantee

```ts
// design/vite.config.ts
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  publicDir: false,
  appType: "spa",
  plugins: [react(), tailwindcss(), bridge()],
  resolve: { alias: { "@ui": fileURLToPath(new URL("../src/ui", import.meta.url)) } },
  server: { port: 5174, strictPort: true },
  build: { outDir: fileURLToPath(new URL("../dist-design", import.meta.url)), emptyOutDir: true },
});
```

The product's build starts at the root `index.html` → `src/main.tsx` and never reaches `design/`.
**A different entry graph, not a flag inside a bundle.** `bun run design:build` emits
`dist-design/`, which is what a UAT host deploys.

The bridge is a CLASSIC script, so Vite will not bundle it — it says so, and that is the point.
Eight lines copy it beside the HTML:

```ts
const bridge = (): Plugin => ({
  name: "studio-bridge",
  generateBundle() {
    this.emitFile({ type: "asset", fileName: "studio-bridge.js",
      source: readFileSync(fileURLToPath(new URL("./studio-bridge.js", import.meta.url)), "utf8") });
  },
});
```

## The entry, and the absolute src

```html
<!-- design/index.html -->
<script src="/studio-bridge.js"></script>       <!-- ABSOLUTE: an SPA serves this file at every
                                                   screen path, so a relative src 404s there -->
<div id="root"></div>
<script type="module" src="./main.tsx"></script>
```

## Routes without a router

```tsx
const modules = import.meta.glob("./journeys/**/*.tsx", { eager: true });
// ./journeys/example/detail--dense.tsx → { journey: "example", id: "detail", variant: "dense" }
```

`/` is the journey index, `/catalogue` is the catalogue, `/journeys/<name>/<id>` is a screen and
`?variant=` picks the file. A variant with no file of its own falls back to the base screen —
which is what lets the bridge carry `?variant=` across a link without ever risking a 404.
**A router is a dependency; add one the day you have fifty screens.**

## The ten-line hook

```ts
// design/screen.ts
import { useSyncExternalStore } from "react";
const read = () => {
  const d = document.documentElement.dataset;
  return `${d.state ?? "ready"}|${d.variant ?? ""}|${d.theme ?? ""}`;
};
const subscribe = (notify: () => void) => {
  window.addEventListener("studio:state", notify);
  return () => window.removeEventListener("studio:state", notify);
};
export function useScreen() {
  const [state = "ready", variant = "", theme = ""] =
    useSyncExternalStore(subscribe, read, () => "ready||").split("|");
  return { state, variant, theme };
}
```

## Component conventions that keep the lint true

- **Variants are plain typed maps**, not `cva` or `tailwind-variants`:
  `const variants = { primary: "…" } as const`, and the prop is `keyof typeof variants` — a
  literal union, not `string`.
- **`cn()` always, and `className` LAST**, or a caller's override loses to whatever the utility
  framework emitted last. Teach the class merger your scale names; a merger that does not know
  `rounded-card` keeps both classes and the override silently fails.
- **No `forwardRef`.** React 19 passes `ref` as an ordinary prop.
- **`render`, never `asChild`**, for composing an element — and a component rendered as an `<a>`
  must not carry `type`.
- **`data-slot` on the root and on every meaningful part**, spelled `"data-slot": "button"` in a
  props object or `data-slot="button"` in JSX. The lint accepts both.

## The checks

```
bun run tokens            node design/tokens-to-css.mjs
bun test src              the fixture mount, the class merger, the token lint
bun run lint:design       node design/lint.mjs
bun run design:build      dist-design/
bun run build             dist/ — then: node design/lint.mjs --build dist
```
