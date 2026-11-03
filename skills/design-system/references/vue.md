# Recipe — Vue / Nuxt

There is no worked example yet: add one the first time a Vue repo adopts this, and verify it with
the same four checks. Same tokens, same bridge, same manifest, same lint as `react.md`.

## The layout

```
src/theme/tokens.json     the DTCG source
src/theme/tokens.css      GENERATED
src/ui/                   the design system: Button.vue, Field.vue, …
design/vite.config.js     root: "design", outDir: "../dist-design", port 5174
design/index.html         the bridge tag + #root
design/main.js            the routes, discovered with import.meta.glob
design/screen.js          a reactive object over `studio:state`
design/journeys/<name>/   journey.json, <id>.vue, <id>--<variant>.vue
```

**A plain Vite root, not Nuxt**, for the design app — even in a Nuxt product. Nuxt owns routing
and the server; the prototype needs one route shape and no server at all. The product's own Nuxt
build never sees `design/`.

```js
// design/vite.config.js
import vue from "@vitejs/plugin-vue";
export default {
  root: new URL(".", import.meta.url).pathname,
  publicDir: false,
  appType: "spa",
  plugins: [vue()],
  resolve: { alias: { "@ui": new URL("../src/ui", import.meta.url).pathname } },
  server: { port: 5174, strictPort: true },
  build: { outDir: new URL("../dist-design", import.meta.url).pathname, emptyOutDir: true },
};
```

## The reactive reader

```js
// design/screen.js
import { reactive } from "vue";
const read = () => ({
  state: document.documentElement.dataset.state ?? "ready",
  variant: document.documentElement.dataset.variant ?? "",
  theme: document.documentElement.dataset.theme ?? "",
});
const screen = reactive(read());
window.addEventListener("studio:state", () => Object.assign(screen, read()));
export const useScreen = () => screen;
```

## A component

```vue
<!-- src/ui/Button.vue -->
<script setup>
defineProps({ variant: { type: String, default: "primary" }, type: { type: String, default: "button" } });
</script>

<template>
  <button data-slot="button" :data-variant="variant" :type="type"><slot /></button>
</template>

<style scoped>
button {
  display: inline-flex;
  align-items: center;
  height: var(--ds-space-12);
  padding: 0 var(--ds-space-5);
  border: 0;
  border-radius: var(--ds-radius-sm);
  background: var(--ds-color-accent);
  color: var(--ds-color-accent-fg);
  font-size: var(--ds-text-sm-size);
}
button[data-variant="secondary"] {
  background: var(--ds-color-surface);
  color: var(--ds-color-fg);
  box-shadow: var(--ds-shadow-hairline-strong);
}
</style>
```

Vue's fallthrough attributes put a screen's `data-go` on the root automatically, as long as the
component has a single root element and does not set `inheritAttrs: false`. **A component with
`inheritAttrs: false` must bind `v-bind="$attrs"` onto its root**, or `data-go` never reaches the
DOM and the click does nothing.

## THE VUE-SPECIFIC RULE, and the lint enforces it

```vue
<!-- YES -->
<button data-go="confirm" data-slot="button" type="button">Pay now</button>

<!-- NO — all three are refused: -->
<button :data-go="target">…</button>
<button v-bind:data-go="target">…</button>
<button :data-go="`${journey}/confirm`">…</button>
```

Every other attribute may be bound. **`data-go` may not**, because the flow map is derived from
the source by a grep and a bound value is an edge nobody can see. If a screen genuinely needs two
destinations, write two elements with two literals and show one — that IS the branch.

`design/lint.mjs` refuses `:data-go`, `v-bind:data-go` and `data-go={…}` by name, in `.vue` files
as everywhere else.

## The lint, and one Vue trap

stylelint reads `.vue` through `postcss-html` (`lint-configs.md`). The trap: `:style="{ color: c }"`
is an inline style the floor lint's `style=` grep will not see. **Do not use `:style` in
`design/`** — a screen that needs a computed style needs a component.

## The checks

```
node design/tokens-to-css.mjs --check
node design/lint.mjs
node design/contrast.mjs
bun  design/shots.mjs <journey>    # node also works
node design/verify.mjs --build
```
