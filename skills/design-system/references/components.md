# The component floor — anatomy, states, and the ARIA pattern

Six primitives, in this order, and **no further until a journey asks for one**. Each is one file,
each has a fixture, and **each root carries `data-slot="<name>"`**.

Every one of them has: a rest state, `:hover`, `:focus-visible`, `:active` and a disabled state
spelled twice (`:disabled` AND `[aria-disabled="true"]`, because a link-shaped button has no
`:disabled`). Every one reads only tokens.

---

## 1. Button — `data-slot="button"`

**Anatomy:** an optional leading glyph · the label · an optional trailing glyph.
**Variants:** `primary` (the accent fill) · `secondary` (a surface with a hairline) · `ghost`
(no fill until hover) · `danger` (the solid destructive fill, with its own on-colour).
**Sizes:** three, plus an icon-only square that drops the horizontal padding and keeps the height.
**APG:** the native `<button>`. Give it a `type` — the default is `submit`, which submits any form
it is inside. An icon-only button takes an `aria-label`; without one it is an unnamed control.
**Traps:** a disabled button must lose `pointer-events` AND any hover transform, or it still moves
under the cursor. A `<button>` rendered as an `<a>` must not carry `type`.

## 2. Field + Input — `data-slot="field"` / `"field-label"` / `"field-hint"` / `"field-error"` / `"input"`

**Anatomy:** the label, the control, an optional hint, an optional error.
**The Field owns the ids.** The label's `for` points at the control's `id`, and
`aria-describedby` names the hint and the error. A caller must never have to wire those by hand.
Two ways to be named, because `for` only reaches a labelable element: a control that is one takes
`id`; a GROUP (radiogroup, toggle group, slider) takes `aria-labelledby` instead. Never both.
**Invalid** rides on `aria-invalid="true"`, so a caller who sets it by hand gets the same
treatment as one inside an errored Field.
**Traps:** the error message ADDS to the hint, it does not replace it. **Colour is never the only
signal** — the red ring needs the words beside it. A focused invalid control shows both the red
inset AND the focus ring; the ring is the one that must not be deleted.

## 3. Card — `data-slot="card"` / `"card-header"` / `"card-title"` / `"card-description"` / `"card-footer"`

**Anatomy:** an optional header (title over description), the body, an optional footer of actions.
**Surfaces:** `raised` · `flat` · `interactive`.
**APG:** a card is not a pattern. A card whose whole face is one navigation is an `<a>` — and then
it must not underline the heading and the paragraph inside it.
**Traps:** the header STACKS by default. A header that is a row `[title block][action]` is the
uncommon case and says so at the call site; making it the default puts the description flush right
on every screen while the catalogue (which wraps them in a div) looks correct — the one
arrangement no reviewer catches. **On a near-black ground the resting shadow is invisible**, so
the raised surface is a TOKEN with a mode override that trades the shadow for a 1px edge in dark.

## 4. Badge — `data-slot="badge"` / `"badge-dot"`

**Anatomy:** a dot (or a glyph, never both), then a word.
**Tones:** neutral · success · warn · danger, each a `-dim` surface with its own `-fg` ink.
**APG:** it is not a status region. A badge that ANNOUNCES a change needs `role="status"` on a
wrapper, or a live region elsewhere.
**Traps:** `width: fit-content` — a badge is a flex item as often as not, and a flex item is
blockified, so without it the pill stretches the whole column. **The word is the signal and the
colour is the reinforcement**, never the other way round.

## 5. Empty — `data-slot="empty"` / `"empty-title"` / `"empty-description"`

**Anatomy:** an optional glyph, a title, a sentence, and **the one thing you would do next**.
**Traps:** it is said ON the surface the something would have used, so the page does not visibly
collapse when a list empties. Cap the sentence at about 38ch — a centred paragraph stops being
readable past that. Watch the heading LEVEL: an `h4` under the page's `h1` tells a screen-reader
user that two whole sections are missing. Override `aria-level` rather than changing the tag,
because the SIZE is right and the tag changes every empty state at once.

## 6. Skeleton — `data-slot="skeleton"`

**Anatomy:** a box, shaped like the thing that is still loading.
**Traps:** `aria-hidden="true"` — it is decoration, and a screen reader announcing three grey
boxes is worse than silence. It must carry the RADIUS of the thing it stands in for, or the page
jumps when the real thing arrives. `display: block`, not an inline span, so a width set at the
call site is honoured outside a flex row. And it must stop moving under
`prefers-reduced-motion: reduce`.

---

## What comes after the six, when a journey asks

Follow the ARIA APG pattern by name and do the keyboard and focus management the pattern
specifies — dialog, tabs, disclosure, combobox, listbox, menu, tooltip, switch, radio group,
slider. Unstyled-and-correct first, styled second. If the repo already has a headless primitive
library, use it; this skill does not ship one and should not.

## The fixture

Every component has one, beside it, naming its states the way you would say them out loud, and
covering the ones that are easy to get wrong: disabled, error, empty, overflowing, icon-only, and
a `className`/attribute override proving the caller's own value wins. The fixtures ARE the prop
documentation and the catalogue is built from them — that is why there is no Storybook here and no
generated prop table.
