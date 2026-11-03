# Brownfield — the adapter layer

A product with ten years of CSS does not get a new design system by rewriting its CSS. It gets one
by **naming** what it already has, and then moving the frontier one directory at a time.

## The one question to ask BEFORE writing anything

> *"Which of these is canonical?"* — with the list beside it: the colours the product actually
> uses (grouped, with counts), the fonts, the radii, the shadows.

A codebase in this state always has two or three of everything, and only a human knows which one
won. **Guessing here produces an adapter that is wrong in a way nobody notices for months.** Ask,
wait, then write.

## The rule

**Never edit existing CSS.** Write the semantic tier, alias it to whatever the codebase already
has, and let NEW code use only `--ds-*`.

```jsonc
// tokens.json — the adapter tier
{
  "color": {
    "$type": "color",
    "bg":        { "$value": "var(--brand-gray-0)" },      // already a variable: point at it
    "fg":        { "$value": "#1f2933" },                  // only a hex exists: carry the hex
    "border":    { "$value": "var(--brand-rule)" },
    "accent":    { "$value": "var(--brand-primary-600)" },
    "accent-fg": { "$value": "#ffffff" }
  }
}
```

And where the EXISTING components read names you cannot change, alias the other way — that is
what `ds.design/css`'s `name` is for:

```jsonc
"compat": {
  "$type": "color",
  "brand-gray-0": { "$value": "{color.bg}", "$extensions": { "ds.design/css": { "name": "brand-gray-0" } } }
}
```

Now one file is the source of both names, and the old components keep working unchanged.

## What this buys, and what it does not

It buys: one place the values live, a contrast check that can run, a lint that can be true of new
code, and a theme that can be added later without touching a component.

It does not buy an improved product. **An adapter that never improves is the failure mode**, and
it is invisible unless you measure it — so:

## Measure coverage, and put the number where someone sees it

**Coverage** is the share of `--ds-*` tokens whose value is still a LITERAL rather than an alias
to another `--ds-*`. Carrying a hex in the adapter tier is fine; carrying all of them forever is
the adapter never improving. Print the number in the report, put it in `design/DESIGN.md`,
and put it in the journey document when it changes.

## Moving the frontier

1. **Lint NEW files only.** `design.json`'s `system` and `screens` name the directories the lint
   is true of. Start with `design/` and one component directory.
2. Take one directory at a time. Replace its literals with `--ds-*`, delete the compat aliases
   nothing reads any more, add the directory to `system`, re-run the lint.
3. Never take two directories in one piece of work. A frontier that moves in one place at a time
   is a frontier a reviewer can read.

## What NOT to do

- **Do not run a codemod over the whole repo.** Atlassian's own migration guide is the honest
  reference here: the tools "suggest tokens based on context" and then "manual review is
  required". A thousand-file diff nobody reviewed is a thousand-file diff nobody reviewed.
- **Do not rename existing variables.** The adapter exists so you do not have to.
- **Do not add a theme before the adapter is complete.** A half-aliased system in dark mode is a
  page with three colours that did not move.
- **Do not put the prototypes in the product's routes.** `design/` is its own root, and the
  production build must not be able to reach it (`node design/lint.mjs --build <dir>` proves it).
