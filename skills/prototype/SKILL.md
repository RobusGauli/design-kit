---
name: prototype
description: Build and iterate a clickable user journey in design/ — screens as files, variants as files, states as URL parameters, links as data-go attributes, shots as evidence — and answer the designer's numbered feedback rounds. Use whenever someone asks for screens, a flow, a prototype, a journey or a variation.
---

# The prototype

A journey is a directory of screens a person can click through. It is **hi-fi and interactive
enough to portray the message, and no further**: `data-go` and the four states are the whole
vocabulary. A prototype that needs to validate a form is a product feature — say so and stop.

Read `.agents/skills/design-system/SKILL.md` first. **Build from the system ONLY**; if the system
does not exist yet, laying it is the work that comes before this one.

## 1. A journey is a directory

```
design/journeys/<name>/
  JOURNEY.md             the brief, the targets, and two lines per screen — the studio opens on it
  journey.json           title, entry, and per screen an optional title and route — NOTHING ELSE
  cart.html              a SCREEN is a file.  <main data-screen="cart" data-states="empty ready">
  payment.tsx            …in whatever the stack is: .html .tsx .svelte .vue
  payment--dense.tsx     a VARIANT is a file:  <id>--<variant>.<ext>
  targets/               the references: Figma exports, a photo of a whiteboard
```

Its PICTURES are NOT in the journey: `design/.shots/<name>/<id>[--<variant>].<state>.<theme>.png`,
git-ignored. `shots.mjs` writes them; you never commit one, and a shot is never part of the turn's
work. Nor is a review round: when one arrives, the turn names its file (§6).

`journey.json` holds **only what the files cannot say**:

```json
{ "title": "Checkout", "entry": "cart",
  "screens": { "cart": { "title": "Cart" }, "payment": { "title": "Payment" } } }
```

**Never list screens, variants, states or links in it.** Screens are the files; variants are the
`--` suffixes; states are declared on the screen's own root; links are `data-go`. A manifest that
listed those would be stale the moment you added a button, with no way to tell.

## 2. Variants are FILES; dimensions are PARAMETERS

| | | |
|---|---|---|
| **alternative** | layout A vs layout B; the designer picks ONE | a FILE: `payment--dense.tsx` |
| **dimension** | state, theme, density, viewport; every alternative must pass ALL of them | a URL parameter: `?state=error&theme=dark` |

`--` and not `.` because a dot collides with an extension. When a variant wins, it is RENAMED to
the base name and the document records why.

## 3. Links are `data-go`, and the value is always a string literal

```html
<button data-go="payment" ...>Continue</button>
<a data-go="payment?variant=dense&state=error" ...>…</a>
<button data-go="back" ...>Back</button>          <!-- history.back() -->
<button data-go="#confirm" ...>What now?</button> <!-- an overlay: <dialog id="confirm"> -->
<button data-go="../onboarding/welcome" ...>…</button>
```

**`data-go={expr}`, `:data-go`, `v-bind:data-go` and any other bound form are REFUSED by the
lint**, and that is not pedantry: the flow map is derived from the source by a grep, so a value
that is not in the source is an edge nobody can see.

## 4. The bridge does the rest, and you never edit it

`design/studio-bridge.js` is included as a **classic `<script src>` in `<head>`** — no `defer`, no
`type="module"` — so `?state`, `?variant` and `?theme` land on `<html>` before first paint. A
framework entry that imports it instead flashes the other theme in every screenshot. The
framework imports nothing; it READS the attributes:

- vanilla: `html[data-state="empty"] [data-when~="empty"] { display: revert-layer }`
- a framework: a ten-line hook over `useSyncExternalStore` and the `studio:state` event

It also mirrors every NAMED form control into `sessionStorage` and fills any `data-bind="<name>"`
from it, so the name typed on screen one appears on screen three. A `type="password"` control and
any name starting with `_` are never stored.

## 5. Build it

**RUN THE DESIGN SCRIPTS FROM THE REPO ROOT, ONE COMMAND EACH.** Never
`node design/lint.mjs && node design/verify.mjs`, never a `for` loop over them, and no `cd` —
you are already at the repo root.

A RULE MATCHES THE COMMAND FROM ITS FIRST CHARACTER, so anything you put IN FRONT of the script
or AFTER it breaks the match:

| this asks | this does not |
|---|---|
| `NODE_PATH=/x node design/shots.mjs cart` | `node design/shots.mjs cart` (or `bun design/shots.mjs cart`) |
| `node design/shots.mjs cart 2>&1 \| tail -40` | `node design/shots.mjs cart` |
| `node design/lint.mjs && node design/verify.mjs` | two commands, two calls |
| `export NODE_PATH=/x && node -e …` | `export` on its own, then the command |

All four are measured, not folklore. A CHAIN IS ONLY AS ALLOWED AS ITS LEAST-ALLOWED PART — with
`node design/lint.mjs` pre-approved, `node design/lint.mjs && node design/verify.mjs` is REFUSED
outright, because every subcommand is checked on its own. An ENV PREFIX and a PIPE are the two
that catch everybody: both were spent on a real walk, and the script's whole output is already on
stdout, so the `| tail` bought nothing. If the environment needs a variable, `export` it as its
own command first. (`cd x && …` happens to run on a current CLI — `cd` is in its built-in safe
set — but an older one has no such set, and a `cd` you did not need is a subcommand you are
betting on.)

**AND READ THE TREE WITH `ls` AND `find` ON THEIR OWN.** Both are on the safe list; neither is
when it is chained. Measured on a real walk: every one of eight prompts was the same shape —
`cd docs/… && echo "==" && cat …`, `find … | xargs -I{} echo {} && echo "---" && cat …`. The
`echo` banners and the `cd` bought nothing and cost a click each. `ls <dir>`, then `cat <file>`.

One prompt the designer has to click for a read-only check is one too many; fifteen of them in
one journey is what this rule exists to stop.

1. Write the journey's `JOURNEY.md` FIRST — `design/journeys/<name>/JOURNEY.md`, its sections in
   `references/journey-anatomy.md` — with the brief in the person's words. Then read
   `design/DESIGN.md` and anything under `targets/`. A target is a
   REFERENCE: map its structure to the system's components and SAY WHICH. Never copy raw values.
2. Write `journey.json` and one file per screen. Every root: `data-screen` and `data-states`.
3. **Build every state you declared.** A state a screen genuinely cannot show is DELETED from
   `data-states` with a reason in the document — never declared and left unbuilt.
4. **A component the system has not got goes under `**Not in the system yet:**` in the journey's
   `JOURNEY.md` and you STOP there for that component.** Extending the system is its own decision, and it is
   the designer's.
5. **TAKE THE PICTURES** — run `bun design/shots.mjs <name>` (or `node`, see below) — **the
   journey's name is required**; every screen × variant × state × theme of THAT journey, into
   `design/.shots/<name>/`. Without it the script refuses and says which names are real: shooting
   every journey re-writes PNGs nobody asked for. If the script says the environment already
   takes the pictures, believe it and move on. The person browses the journeys, the flow and the
   pictures with `node design/studio.mjs --open` (read-only).
   **Prefer `bun design/shots.mjs <name>` when `bun` is on PATH, and `node design/shots.mjs <name>`
   otherwise — both are allowed, and both take the same arguments.** Under bun the script shoots
   through the system WebKit with nothing installed (1.5 s for 24 shots); under node it needs a
   global playwright (2.4 s). It also SKIPS shots whose inputs have not moved, so a round that
   edits one screen costs six shots and says `· 18 unchanged`. `--all` overrides that.
   **Never start, stop or kill the preview server. If `preview.origin` answers, shoot through it;
   if it does not, `shots.mjs` starts and stops its own on a free port.** A designer is looking at
   that server in a browser tab; `kill` on its pid leaves them staring at *the preview stopped*
   over something you started instead. The script says which door it took on its first line, and
   it REFUSES a 404 or a document with no `[data-screen]` root rather than photographing it.
   **Never open a shot to look at it**: they exist for the designer's eyes, not yours. Reading one
   back costs a round and tells you nothing the checks did not.
6. `node design/verify.mjs`, then the repo's own tests. `verify.mjs` also refuses a shot that is
   blank and two screens whose shots are byte-identical — if it does, the shots were taken against
   something that was not serving the screens, and re-shooting is the fix.
7. Fill the journey's `JOURNEY.md`: under `## Screens`, one `### <id> — <title>` per screen with
   its `**Composed from:**` line and, when it needed one, its `**Not in the system yet:**` line.
8. **COMMIT IT.** `git add design/journeys/<name> && git commit` — the screens and `JOURNEY.md`,
   in one commit (the pictures are git-ignored; never force one in). What the designer reviews is what is IN GIT: an untracked
   directory is a document pointing at files nobody else can read (the studio says
   `not committed yet` in amber over one, and that is this step missing).
9. Stop and say **what to look at first**: which screen, which state, which viewport,
   and what to compare it against. You cannot see the running screens; the designer's eyes are
   the acceptance. COUNT what you can count (`ls design/.shots/<name> | wc -l`) and say
   nothing you did not count.

   **THE CLOSING SENTENCE REPORTS THE PICTURES, AND IT ASKS FOR NOTHING.** End with the count you
   took, in these words or as near as makes no difference:

   > `<n>` screens are ready, with `<count>` pictures; browse them with
   > `node design/studio.mjs --open`.

   **If `shots.mjs` said the environment takes the pictures itself, say that instead of a count,
   and name no command**: the designer is already looking at the screens where they are.

   Never claim pictures you did not count: zero is a number, and `verify.mjs` says `shots SKIP —
   none taken` over it.

   **Never ask the designer to type anything** — not *reply "continue"*, not *let me know*, not
   a question they have to answer in the chat. The one command the closing sentence names is how
   they look; what they say next is theirs. The signature, where there is one, is the person's,
   never yours.

## 6. Answering a round

A round is ONE file, written by the review tool the designer uses, and the turn that arrives
names it by its absolute path: *Answer review round 2 of checkout: read `<path>` and follow its
header.* (`references/rounds.md` quotes the whole turn.) Read it where the turn says it is, and
never commit it: the round is iteration, the prototype is the product, so
you commit what you changed and never the round file. One numbered item per pin: the designer's
note is the item, and the line under it names the screen's file, then the screen, the variant,
the state, the theme, the viewport, the component path, a selector and the rect. It arrives as ONE
instruction and you answer it as one piece of work:

```markdown
1. [x] full-width at 700, and lose the ghost Back → full-width under the md breakpoint, Back removed; re-shot.
   screen · `design/journeys/checkout/payment.html` · payment · default · ready · dark · 1440 — 'payment › card › card-footer › button "Pay now"' · selector: '…' · rect: 612,540 88×36
```

- Read the file. Change the prototype. **Tick the box** and write ONE line after the arrow.
- Re-shoot what moved, and commit the screens you changed —
  never the round file, never a picture.
- **Never start, stop or kill the preview server. If `preview.origin` answers, shoot through it;
  if it does not, `shots.mjs` starts and stops its own on a free port.** The designer is watching
  that tab while you work; a `ps` and a `kill` on it is the one thing that breaks the round.
- **A general note is an item and is ticked like any other.** It is always the LAST item, as
  `<n>. [ ] general — <the note>`; it counts toward the round and it wants the same box, the same
  one line, and the same re-shoot.
- **Never argue with taste in the file.** Do it, or say in one line why not — "that needs a
  component the system has not got, which is its own piece of work" is a complete answer.
- A request to promote a variant (`promote payment--dense to payment`) is a RENAME plus a line in
  the document saying why the other one lost.

## 7. What a prototype is not

- Not production code. It is deleted or ignored by the production build, and the lint proves it.
- Not a place for real data, real validation, or real branching. Two buttons with two `data-go`s
  is the branch.
- Not a place to invent a token, a colour, a font size or a component.
- Not signed by you. **The signature, where there is one, is the person's**;
  never send them to a terminal for it, never ask them to type.
