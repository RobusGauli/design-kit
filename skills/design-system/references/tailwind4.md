# Recipe — Tailwind 4: utilities that exist ONLY for tokens

Read this ALONGSIDE the stack recipe, not instead of it. It is one idea: **clear Tailwind's stock
namespaces, then re-declare them from the token sheet**, so `bg-red-500` stops existing and
`bg-g900` starts. Without the reset, "no raw colour utilities" is a rule a lint must chase; with
it, the utility is simply not emitted.

Tailwind itself has no switch to disable arbitrary values (`bg-[#fff]`, `p-[13px]`). **The lint is
that switch** — `design/lint.mjs` refuses them in screens, and
`eslint-plugin-better-tailwindcss`'s `no-restricted-classes` refuses them anywhere you point it
(`lint-configs.md`).

## The entry

```css
/* src/theme/styles.css — the PRODUCT's stylesheet entry */
@import "./tokens.css";     /* GENERATED. Unlayered, on purpose — see the cascade note below */
@import "./base.css";       /* hand-written: the reset, .sr-only, the focus ring, reduced motion */
@import "tailwindcss" source(none);
@source "../";              /* the product's own files */
@source "../../index.html";

@theme {
  /* DROP THE STOCK PALETTE: every colour in this app comes from the token sheet. */
  --color-*: initial;

  --color-bg:     var(--ds-color-bg);
  --color-g0:     var(--ds-primitive-gray-0);
  --color-g900:   var(--ds-primitive-gray-900);
  --color-accent: var(--ds-color-accent);
  /* …one line per token you want a utility for, and no more */

  --radius-control: var(--ds-radius-sm);
  --radius-card:    var(--ds-radius-lg);

  --font-sans: var(--ds-font-sans);

  /* `--text-*` is TAILWIND's namespace and `--ds-text-*-size` is ours, which is why this is a
     one-line var() per step rather than repeated literals: a token sheet that named its own
     scale `--text-*` would make the bridge self-referential. */
  --text-sm: var(--ds-text-sm-size);
  --text-sm--line-height: var(--ds-text-sm-leading);

  --ease-harbor: var(--ds-motion-easing);
}
```

## `source(none)` is the second half, and it is the biggest adoption gotcha

Tailwind's automatic detection scans the whole project, which in a real repo means docs and
vendored code whose prose quotes class names. `source(none)` means **nothing is emitted until a
`@source` line names the files that actually ship**.

Name the product's sources in the product's entry, and the prototypes' in the DESIGN entry:

```css
/* design/design.css */
@import "../src/theme/styles.css";
@source "./index.html";
@source "./catalogue";
@source "./journeys";
```

So the product's build never scans `design/` and never emits a utility only a prototype uses.
**A new directory of components outside the named ones needs its own line, or its utilities
silently do not exist.** That is the single likeliest silent failure here — assert the emitted
stylesheet is tens of kilobytes rather than zero.

## The cascade note, and it is load-bearing

`tokens.css` and `base.css` are imported **UNLAYERED**, so `base.css`'s
`:focus-visible { box-shadow: var(--ds-shadow-focus) }` outranks every utility Tailwind emits
into `@layer utilities`. That matters because most components carry a resting
`shadow-[var(--ds-shadow-hairline)]` which would otherwise silently delete the focus ring.

The one case that needs composing rather than winning is an invalid control while focused — the
red inset AND the ring:

```css
:is(input, select, textarea)[aria-invalid="true"]:focus-visible {
  box-shadow: inset 0 0 0 1.5px var(--ds-color-danger-strong), var(--ds-shadow-focus);
}
```

## Teach the class merger your scale names

`tailwind-merge` resolves a conflict only between two classes it can put in the same group, and it
recognises a value by looking it up in its own copy of the theme. After `--color-*: initial` and
custom radius names, it needs telling:

```ts
const twMerge = extendTailwindMerge({
  extend: { theme: {
    color: ["bg", "accent", "g0", "g900", /* … */],
    radius: ["control", "mat", "card", "lg", "pill"],
    text: ["3xl", "2xl", "xl", "lg", "md", "base", "sm", "xs"],
    font: ["sans", "mono"], ease: ["standard"], animate: ["spin", "pulse", "shimmer"],
  } },
});
```

Without it a consumer's `className` override loses silently to whatever Tailwind emitted last,
with no error anywhere. Test it: `cn("rounded-control", "rounded-pill")` must be `rounded-pill`.

## What a SCREEN may write

Layout utilities and nothing else: `flex`, `grid`, `gap-4`, `p-6`, `w-full`, `max-w-2xl`,
`items-center`. **No colour, no radius, no shadow, no font size, no `[var(--…)]`, and never a
`dark:` variant** — the theme swaps on the root. When a screen needs one, a component is missing.

## `@theme` vs `@theme inline`

Use `@theme inline` when a variable must be substituted at build time rather than referenced —
for instance when a value feeds a Tailwind feature that cannot read a runtime `var()`. For colours
and sizes that only ever land in a CSS property, plain `@theme` with `var()` is what keeps the
theme switch working at runtime, which is the whole point.
