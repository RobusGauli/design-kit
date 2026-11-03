# Rounds — the designer's feedback, and how to answer it

A round is one file, numbered `round-<n>.md`, written by the review tool the designer uses:
**the round file the turn names**, by its absolute path. Read it where the turn says it is. The
journey is the product and goes into git; a round is the designer and you iterating on it, and
never does. Commit the screens you change; never commit the round file, and never a picture
(`design/.shots/<name>/` is git-ignored).

## The turn that brings it

When the designer sends a round, ONE turn arrives in the conversation, in these
words (the number, the journey and the path change; nothing else does):

> Answer review round 2 of checkout: read `/abs/path/to/round-2.md`
> and follow its header. Revise only the documents it names. Tick each item with one line after
> the arrow; where you did not change something, leave the box open and say why after the arrow.
> Commit the documents you revised; the round file is ignored by git and stays uncommitted. Never
> approve or sign. That is mine.

That turn IS the round: read the file it names and answer it below. A later turn may say the round
*still has items unanswered* (answer them) or that it was *withdrawn* (do nothing for it).

## What arrives in the file

```markdown
# Review round 2 — checkout — 2026-09-16
For each item: change what it asks, then tick it — `[ ]` → `[x]` — and write
one line after an arrow on the same line saying what you changed. Where you did not change it,
leave the box open and say why after the arrow. Revise only the documents named here and commit
them; this file is ignored by git and is never committed. Never approve or sign anything.

1. [ ] full-width at 700, and lose the ghost Back
   screen · `design/journeys/checkout/payment.html` · payment · default · ready · dark · 1440 — 'payment › card › card-footer › button "Pay now"' · selector: 'main[data-screen="payment"] [data-slot="card-footer"] button:nth-of-type(2)' · rect: 612,540 88×36
2. [ ] too heavy — try a dense variant
   screen · `design/journeys/checkout/payment.html` · payment · default · ready · dark · 1440 — area 120,80 400×200 on payment · covers: payment › summary
3. [ ] general — keep the type; the spacing is what feels off
```

Each item is the designer's NOTE first; a note of several lines rides under it. The line under the
note names, in order: the screen's FILE (in backticks), then the screen, the variant, the state,
the theme, the viewport, then either a **component path** (the chain of `data-slot` attributes,
which is why every component root has one) with its `selector` and `rect`, or an **area** with the
paths it covers. The `selector` is for your grep; the path is what the human meant.

**The general note is an item too, always the last one** (`general — …`). Tick it, answer it and
re-shoot exactly as you would a pin.

An item the designer made by shaping the screen by hand points at a REFERENCE beside the round,
`round-<n>/intent/` in the round file's own folder — a picture of what they meant, never source to
paste; its own words say so.

## How to answer it

1. **Read the whole file before you change anything.** Two items often want the same change.
2. Change the prototype. Then edit the item IN PLACE: `[ ]` → `[x]`, and one line after a
   `→` saying what you did.
3. `bun design/shots.mjs <name>`, or `node design/shots.mjs <name>` when there is no bun — the
   journey's name is REQUIRED, and it is this journey's, never every journey in the directory.
   Bun opens the fast door (system WebKit, nothing installed); node needs a global playwright.
   The script re-shoots only the screens whose inputs moved and says how many it skipped, so a
   one-screen round is six shots rather than twenty-four; `--all` shoots everything anyway. Run it
   from the repo root as its own command: no `cd`, no `&&`. A chain is only as allowed as its
   least-allowed part, so joining two design scripts with `&&` is refused outright.
4. Commit the screens you changed. The round file and the pictures stay uncommitted.
5. Say, in the conversation, what you did NOT do and why. One line each.

```markdown
1. [x] full-width at 700, and lose the ghost Back → full-width under the md breakpoint, Back removed; re-shot both themes.
   screen · `design/journeys/checkout/payment.html` · payment · default · ready · dark · 1440 — 'payment › card › card-footer › button "Pay now"' · selector: '…' · rect: 612,540 88×36
2. [x] too heavy — try a dense variant → added payment--dense (flat surface, one row of chrome); the original is unchanged.
   screen · `design/journeys/checkout/payment.html` · payment · default · ready · dark · 1440 — area 120,80 400×200 on payment · covers: payment › summary
```

## The rules

- **Never argue with taste in the file.** Do it, or say in one line why not. "That needs a
  component the system has not got, which is its own piece of work" is a complete answer and the
  right one.
- **Never delete an item** and never rewrite the note. The round is the history.
- **A promotion is a rename.** *"Make this the default"* means `git mv payment--dense.tsx
  payment.tsx`, and a line in the document saying why the other one lost.
- **A round is feedback inside one piece of work.** A change to a journey that is already SIGNED
  is new work with its own document and its own signature — not a round on the locked one.
