## Design work in this repo

Screens and journeys live in `design/`, never in the production build. Before writing any UI,
read `.agents/skills/design-system/SKILL.md` (the foundations: tokens, scale, states, rules, lints)
and `.agents/skills/prototype/SKILL.md` (journeys, screens, variants, `data-go`, shots, rounds),
then `design/DESIGN.md`. A journey is a directory under `design/journeys/<name>/`: its brief in
`JOURNEY.md`, one file per screen, a variant is a `<id>--<variant>.<ext>` file, a state is a
`?state=` parameter, and a link is a `data-go="<screen>"` attribute whose value is always a string
literal. Run `node design/lint.mjs` and `node design/contrast.mjs` before you say a journey is
ready; the designer's eyes are the acceptance, and their feedback arrives as a numbered round
file — the one the turn names — that you answer item by item.
