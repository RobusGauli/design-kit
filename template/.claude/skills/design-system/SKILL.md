---
name: design-system
description: The foundations every screen in this repo is built from — the token contract, the type and spacing scales, the four states, the component rules and the lints that enforce them. Use before writing any UI, any component, any stylesheet or any prototype screen.
---

# The design system — read the skill in `.harbor/skills/`

**The whole of this skill lives at `.harbor/skills/design-system/SKILL.md`. Read that file.** Its
`references/` carry the per-stack recipes (vanilla, React, Vue, Svelte, Tailwind 4, brownfield),
the token contract, and the component catalogue; its `scripts/` are the four zero-dependency
checks a repo runs — `lint.mjs`, `tokens-to-css.mjs`, `contrast.mjs`, `verify.mjs` — plus
`shots.mjs`.

**This file is a POINTER and nothing else, on purpose.** `.harbor/skills/` is where the skills
are written and committed, whatever agent reads this repo, so one copy there is the source of
truth for every one of them. A second spelling of a 150-line skill is a
second behaviour, and the one nobody edited would be the one that shipped — which is the same
rule the five shared scripts are held to byte-for-byte.
