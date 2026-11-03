# Recipe — Svelte / SvelteKit

There is no worked example yet: add one the first time a Svelte repo adopts this, and verify it
with the same four checks. Everything below is the same tokens, the same bridge, the same manifest
and the same lint as `react.md` — only the styling idiom differs.

## The layout

```
src/lib/theme/tokens.json    the DTCG source
src/lib/theme/tokens.css     GENERATED
src/lib/ui/                  the design system: Button.svelte, Field.svelte, …
design/vite.config.js        root: "design", outDir: "../dist-design", port 5174
design/index.html            the bridge tag + the mount point
design/main.js               the routes, discovered with import.meta.glob
design/screen.js             a readable store over `studio:state`
design/journeys/<name>/      journey.json, <id>.svelte, <id>--<variant>.svelte
```

**A plain Vite root, not SvelteKit**, for the design app — even in a SvelteKit product. SvelteKit
owns routing, and the prototype needs exactly one route shape that the eight lines below give it.
The product's own SvelteKit build never sees `design/`, which is the production guarantee.

```js
// design/vite.config.js
import { svelte } from "@sveltejs/vite-plugin-svelte";
export default {
  root: new URL(".", import.meta.url).pathname,
  publicDir: false,
  appType: "spa",
  plugins: [svelte()],
  resolve: { alias: { $ui: new URL("../src/lib/ui", import.meta.url).pathname } },
  server: { port: 5174, strictPort: true },
  build: { outDir: new URL("../dist-design", import.meta.url).pathname, emptyOutDir: true },
};
```

## The store

```js
// design/screen.js
import { readable } from "svelte/store";
const read = () => ({
  state: document.documentElement.dataset.state ?? "ready",
  variant: document.documentElement.dataset.variant ?? "",
  theme: document.documentElement.dataset.theme ?? "",
});
export const screen = readable(read(), (set) => {
  const on = () => set(read());
  window.addEventListener("studio:state", on);
  return () => window.removeEventListener("studio:state", on);
});
```

## A component

Svelte's scoped styles are per-component, which is exactly the shape the system wants: the styles
live with the component and read only tokens.

```svelte
<!-- src/lib/ui/Button.svelte -->
<script>
  export let variant = "primary";
  export let type = "button";
</script>

<button data-slot="button" data-variant={variant} {type} on:click {...$$restProps}>
  <slot />
</button>

<style>
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

**`data-variant={variant}` is fine — it is not `data-go`.** Only `data-go` must be a literal.

## A screen

```svelte
<script>
  import Button from "$ui/Button.svelte";
  import { screen } from "../../screen.js";
</script>

<main data-screen="payment" data-states="empty loading error ready">
  {#if $screen.state === "loading"}
    <Skeleton />
  {:else}
    <Card />
  {/if}
  <!-- A LITERAL. `data-go={target}` is refused by the lint, in Svelte as everywhere else. -->
  <Button data-go="confirm">Pay now</Button>
</main>
```

A component must SPREAD `$$restProps` onto its root, or `data-go` never reaches the DOM and the
click does nothing. That is the commonest Svelte-specific failure here.

## The lint, and one Svelte trap

`design/lint.mjs` reads `.svelte` files and refuses `data-go={…}` in them. stylelint reads them
too, through `postcss-html` (`lint-configs.md`). The trap: Svelte's `class:` directive and
`style:` directive both take expressions — `style:color={c}` is an inline style with a literal in
disguise, and the floor lint will not see it. Do not use `style:` in `design/`.

## The checks

Identical to every other stack:

```
node design/tokens-to-css.mjs --check
node design/lint.mjs
node design/contrast.mjs
bun  design/shots.mjs <journey>    # node also works
node design/verify.mjs --build
```
