---
name: prototype
description: Build and iterate a clickable user journey in design/ — screens as files, variants as files, states as URL parameters, links as data-go attributes, shots as evidence — and answer the designer's numbered feedback rounds. Use whenever someone asks for screens, a flow, a prototype, a journey or a variation.
---

# The prototype — read the skill in `.agents/skills/`

**The whole of this skill lives at `.agents/skills/prototype/SKILL.md`. Read that file**, and read
`.agents/skills/design-system/SKILL.md` before it: a journey is built from the system only.

Its `references/` hold the journey's anatomy (`JOURNEY.md`, `journey.json`, the `--variant` file
rule, the four states, `data-go`) and how a feedback round is answered.

Four rules from it that cost the most when they are learned late:

- **Never start, stop or kill the preview server. If `preview.origin` answers, shoot through it;
  if it does not, `shots.mjs` starts and stops its own on a free port.** A designer is looking at
  that server in a browser tab.
- **The signature, where there is one, is the person's; never yours.** Close by naming
  `node design/studio.mjs --open` to browse the screens, and nothing that wants a reply.
- **Run the design scripts BARE, from the repo root, one command each.** A rule matches from the
  first character, so `NODE_PATH=… node design/shots.mjs x`, `node design/shots.mjs x | tail`,
  `cd x && …` and `a && b` all miss it and cost a prompt — all four measured. No env prefix, no
  pipe, no chain: `export` the variable as its own command if you need one. Same for reading the
  tree: `ls` and `find` are on the safe list on their own, and not behind `cd … && echo … &&`.
- **`bun design/shots.mjs <name>`** (or `node`, when there is no bun — bun needs nothing
  installed, node needs a global playwright; both skip the shots whose inputs have not moved, and
  `--all` overrides that) — the journey's name is required, and shooting the others is
  24 PNGs in somebody's `git status` that nobody asked for.
- **COMMIT THE JOURNEY BEFORE YOU STOP.** `git add design/journeys/<name> && git commit`. What
  the designer reviews is what is in git; an untracked directory is a document pointing at files
  nobody else can read.

**This file is a POINTER and nothing else** — `.agents/skills/` is the one source of truth, for
the reason the design-system pointer beside it gives.
