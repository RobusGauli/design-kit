# The anatomy of a screen, in four stacks

Every screen, in every stack, is the same four things: a root that declares its identity and its
states, a body composed of components, links that are `data-go` string literals, and nothing else.

## The journey's own document — `JOURNEY.md`

Every journey keeps its brief INSIDE its directory: `design/journeys/<name>/JOURNEY.md`. It is
the document the studio opens on and the one a round is about. Four sections, in this order:

```markdown
# Checkout

## Brief
One paragraph: the ask, in the person's words — a new journey, or a patch of one that exists.

## Targets
What this is measured against: files under `targets/`, Figma links, or "none".

## Screens
### cart — Cart
**Composed from:** page, card, list, button, badge
### payment — Payment
**Composed from:** page, card, field, button
**Not in the system yet:** a stepper — its own piece of work
```

- `# <title>` is the journey's human title — the same one `journey.json` holds.
- One `### <id> — <title>` per screen, `<id>` the screen's file name without its extension.
- Under each, ONE `**Composed from:**` line naming the system's components, and — only when the
  screen needed something the system has not got — ONE `**Not in the system yet:**` line. The
  studio shows both beside the screen; nothing else under a screen's heading is read.
- No list of screens, states, variants or links beyond that: the files say those.


```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>payment — checkout</title>
    <!-- RELATIVE, so the file opens from file:// as well as from a server. CLASSIC, in <head>. -->
    <script src="../../studio-bridge.js"></script>
    <link rel="stylesheet" href="../../components.css" />
  </head>
  <body>
    <main data-screen="payment" data-slot="page" data-states="empty loading error ready">
      <div data-when="loading"><span data-slot="skeleton"></span></div>
      <div data-slot="card" data-when="error ready">
        <span data-slot="badge" data-tone="danger" data-when="error">
          <span data-slot="badge-dot"></span>could not save
        </span>
        <p data-slot="text">Hello <span data-bind="visitor">there</span>.</p>
        <div data-slot="card-footer">
          <button data-go="back" data-slot="button" data-variant="ghost" type="button">Back</button>
          <button data-go="confirm" data-slot="button" type="button">Pay now</button>
        </div>
      </div>
    </main>
  </body>
</html>
```

The four states are CSS, not script:

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

## React

```tsx
import { Button } from "@ui/Button.tsx";
import { useScreen } from "../../screen.ts";

export default function Payment() {
  const { state } = useScreen();
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-8"
          data-screen="payment" data-states="empty loading error ready">
      {state === "loading" ? <Skeleton /> : <Card …/>}
      <Button data-go="confirm">Pay now</Button>
    </main>
  );
}
```

`screen.ts`, whole:

```ts
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

## Svelte

```svelte
<script>
  import { screen } from "../../screen.js";   // a readable store over the same event
  export let data = null;
</script>

<main data-screen="payment" data-states="empty loading error ready">
  {#if $screen.state === "loading"}<Skeleton />{:else}<Card />{/if}
  <button data-go="confirm" data-slot="button" type="button">Pay now</button>
</main>
```

`screen.js`:

```js
import { readable } from "svelte/store";
const read = () => ({ ...document.documentElement.dataset });
export const screen = readable(read(), (set) => {
  const on = () => set(read());
  window.addEventListener("studio:state", on);
  return () => window.removeEventListener("studio:state", on);
});
```

## Vue

```vue
<script setup>
import { useScreen } from "../../screen.js";
const screen = useScreen();
</script>

<template>
  <main data-screen="payment" data-states="empty loading error ready">
    <Skeleton v-if="screen.state === 'loading'" />
    <!-- data-go IS A PLAIN ATTRIBUTE. `:data-go="x"` is refused by the lint. -->
    <button data-go="confirm" data-slot="button" type="button">Pay now</button>
  </main>
</template>
```

## What every one of them has in common

- `data-screen` and `data-states` on the root, spelled as literal attributes.
- `data-go` as a literal attribute, never bound.
- `data-slot` on every component root, which is what makes a designer's comment name a component.
- No URL parsing. No theme script. No router. The bridge did all three before first paint.
