# The token contract

One file, `tokens.json`, in the **Design Tokens Community Group format, first stable version
2025.10** (stable since 2025-10-28). It is the interchange every tool is converging on — Tokens
Studio, Figma's W3C export plugins and Spectrum all emit it — which is why it is worth the
ceremony over a hand-rolled JSON shape.

## The shape

- `$value`, `$type`, `$description`, `$extensions`, `$deprecated`.
- Groups by nesting. `$type` on a group is inherited by everything under it.
- Aliases are `{group.token}` inside a value, anywhere in a string:
  `"$value": "inset 0 0 0 1px {color.border}"`.
- Types handled by `tokens-to-css.mjs`: `color`, `dimension`, `number`, `fontFamily`,
  `fontWeight`, `duration`, `cubicBezier`, `shadow`, `string`.
- A `dimension` or `duration` may be the spec's object (`{ "value": 12, "unit": "px" }`) **or**
  the shorthand string (`"12px"`). The presets use the shorthand, because a token file a designer
  edits by hand is worth more than a token file that is quotable in the specification.

## The two extensions, and they are the whole vendor surface

```jsonc
"$extensions": {
  "ds.design/modes": { "dark": "#15181f" },     // an override for one mode
  "ds.design/css":   { "name": "g0" }           // emit `--g0`, not `--ds-primitive-gray-0`
  // or:               { "property": "color-scheme" }  // a PLAIN property, not a custom one
}
```

`name` is the **adapter layer** a brownfield repo lives on (`brownfield.md`): the semantic tier is
written once, and the names the existing components already read are aliased to it, so nothing
existing is rewritten. `property` exists for `color-scheme`, which has to be a real property or
the UA's own controls and scrollbars do not follow the theme.

## The three tiers

| tier | what it is | example |
|---|---|---|
| **primitive** | the ramps and the raw scales. **THE KNOBS.** Nothing below names a literal | `primitive.gray.500`, `primitive.page`, `primitive.signal.red` |
| **semantic** | what a component asks for, always as surface / on-surface PAIRS | `color.bg` / `color.fg`, `color.danger` / `color.danger-fg` |
| **component** | the styling layer's own names — a Tailwind `@theme` bridge, or the component CSS | `--color-g900: var(--ds-primitive-gray-900)` |

Component-level declarations rarely change once they are in place, which is exactly what makes
theming and brownfield adoption happen at a higher tier.

## The required keys — a missing one is a LINT FAILURE

```
color.bg          color.fg          color.border     color.accent
color.accent-fg   color.danger      color.danger-fg  color.focus
space.1 … space.8
text.{xs,sm,base,md,lg,xl,2xl,3xl}.size  and  .leading
radius.{sm,md,lg,full}
shadow.{1,2,3}
motion.{fast,base,slow}  motion.easing
breakpoint.{sm,md,lg}
```

**Pairs are a property of the NAMES**, and that is what makes the contrast check mechanical:
`color.<x>` beside `color.<x>-fg` is a surface and the thing that sits on it, and
`node design/contrast.mjs` measures every such pair in every mode. So:

- `color.danger` is the danger **SURFACE** — what a badge or an inline warning is made of —
  and `color.danger-fg` is the ink on it.
- A **MARK** that is not text — a dot, an invalid ring, an icon — is `color.danger-strong`. It
  has no `-fg`, so it is not paired, and WCAG 1.4.11's 3:1 non-text floor is what applies.

Getting this backwards is the commonest mistake: naming the loud red `color.danger` and its own
darker text grade `color.danger-fg` produces a "pair" at 1.7:1 that is not a pair at all.

## Modes

One `light` (the base `$value`) and one `dark` (the override). The generator emits three blocks,
and the doubling is the **three-state theme contract**:

```css
:root { … }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { … } }
:root[data-theme="dark"] { … }
```

An explicit stamp wins in BOTH directions and the OS decides only when nothing is stamped.
Expressing "light" by deleting the attribute is not light — it is "follow the OS" — and on a
dark-mode machine the light half of a toggle would then do nothing at all.

## The namespace

Everything is emitted under `--ds-`, path segments joined by `-`:
`primitive.gray.500` → `--ds-primitive-gray-500`, `text.sm.leading` → `--ds-text-sm-leading`.
The namespace is what lets a lint say "a `var()` that `tokens.css` does not declare" and mean it,
and what keeps a prototype's variables from colliding with a product's.

## The knobs

The primitive tier IS the knobs: `brand` hue, accent, `radius.base`, density, `font`. A designer
who wants "rounder and warmer" changes two numbers there and re-runs the generator; the semantic
tier follows because it aliases rather than repeats. `assets/tokens.neutral.json`,
`tokens.warm.json` and `tokens.dense.json` are three starting positions of the same knobs.
