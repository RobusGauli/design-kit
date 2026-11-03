# Lint configs — the mature tools, verbatim, per stack

`design/lint.mjs` is the FLOOR: zero dependencies, so a repo that will take no new devDependency
still has mechanical enforcement. These are the upgrades on top of it, and they are worth wiring
the moment the repo will take them, because they parse CSS properly where the floor greps.

Detect and wire what is already there. **Do not add a linter to a repo that has none without
asking.**

---

## stylelint — any stack that authors CSS

```
npm i -D stylelint stylelint-declaration-strict-value stylelint-value-no-unknown-custom-properties
# and, for .vue / .svelte / .html:
npm i -D postcss-html stylelint-config-html
```

`.stylelintrc.json`:

```json
{
  "plugins": [
    "stylelint-declaration-strict-value",
    "stylelint-value-no-unknown-custom-properties"
  ],
  "overrides": [
    { "files": ["**/*.vue", "**/*.svelte", "**/*.html"], "customSyntax": "postcss-html" }
  ],
  "rules": {
    "scale-unlimited/declaration-strict-value": [
      ["/color$/", "/^(margin|padding|gap|font-size|line-height|border-radius|box-shadow|z-index|transition)/", "background", "border", "fill", "stroke"],
      {
        "ignoreValues": ["transparent", "currentColor", "inherit", "initial", "unset", "revert", "revert-layer", "none", "auto", "0"],
        "expandShorthand": true,
        "disableFix": true
      }
    ],
    "csstools/value-no-unknown-custom-properties": [true, { "importFrom": ["design/tokens.css"] }],
    "color-no-hex": true,
    "color-named": "never",
    "function-disallowed-list": ["rgb", "rgba", "hsl", "hsla", "oklch", "oklab"],
    "custom-property-pattern": "^ds-",
    "declaration-no-important": true
  },
  "ignoreFiles": ["**/tokens.css", "**/node_modules/**", "**/dist/**"]
}
```

- `declaration-strict-value` is the one plugin that expresses "tokens only": per property (a
  regex is allowed), require a variable or a function.
- `value-no-unknown-custom-properties` with `importFrom` is what turns a typo'd
  `var(--ds-colr-bg)` from a silent nothing into a failure.
- `custom-property-pattern: ^ds-` keeps the prototype's variables from leaking into the product's
  and the other way round.
- **`tokens.css` is ignored**: it is the generated file whose whole job is to hold the literals.

## eslint-plugin-better-tailwindcss — any stack using Tailwind 3 or 4

```
npm i -D eslint-plugin-better-tailwindcss
```

```js
import better from "eslint-plugin-better-tailwindcss";

export default [
  {
    files: ["src/**/*.{ts,tsx,js,jsx,vue,svelte,html}", "design/**/*.{ts,tsx,js,jsx,vue,svelte,html}"],
    plugins: { "better-tailwindcss": better },
    settings: { "better-tailwindcss": { entryPoint: "src/theme/styles.css" } },
    rules: {
      "better-tailwindcss/no-unknown-classes": "error",
      "better-tailwindcss/no-restricted-classes": ["error", {
        restrict: [{
          // The documented arbitrary-value pattern: bans bg-[#fff], p-[13px], text-[13px].
          pattern: "^[a-zA-Z0-9:-]*\\[([^\\[\\]]*)\\](?!:)",
          message: "arbitrary values are not tokens — add a token, or use an existing utility",
        }],
      }],
    },
  },
];
```

- `no-unknown-classes` is validated against the v4 entry CSS, so **after `--color-*: initial` only
  token utilities pass**. That reset is what makes the rule meaningful; see `tailwind4.md`.
- Tailwind itself has **no switch** to disable arbitrary values. The lint is the switch.
- In a repo whose SYSTEM legitimately uses arbitrary values for shadows and tracking
  (`shadow-[var(--ds-shadow-1)]`), scope `no-restricted-classes` to the `design/` files only and
  let `design/lint.mjs` hold the inside.

## CSS-in-JS

Only Atlassian has a real answer (`@atlaskit/eslint-plugin-design-system`'s
`ensure-design-token-usage` over `css()` and styled templates). For prototypes, **forbid CSS-in-JS
under `design/`** and the problem disappears.

## Wiring it so the studio never learns which tool it is

`design.json`'s `"lint"` names ONE command. Put everything behind it:

```json
{ "lint": "node design/lint.mjs && npx stylelint 'design/**/*.css' 'src/ui/**/*.css'" }
```

Then wire that command into the repo's own `test_cmd`, so the design rules fail the build rather
than the review — which is what "mechanically enforced" means.
