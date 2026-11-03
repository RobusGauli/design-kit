/* studio-bridge — the ONE runtime a studio prototype includes. ES2020, zero dependencies.
 *
 * WRITTEN ONCE, NEVER EDITED BY AN AGENT. Every copy in this repo is byte-identical and a test
 * says so; if this file has to change, it changes in the skill and is copied out again.
 *
 * INCLUDE IT AS A CLASSIC SCRIPT IN <head> — no `defer`, no `type="module"`:
 *     <script src="/studio-bridge.js"></script>
 * The first thing it does is stamp `?state`, `?variant` and `?theme` onto <html> BEFORE FIRST
 * PAINT. A framework entry that `import`s it instead stamps after the bundle evaluates, which is
 * a flash of the other theme in every screenshot. The framework imports NOTHING; it reads the
 * attributes the tag already set.
 *
 * ---------------------------------------------------------------------------------------------
 * THE FROZEN CONTRACT — the only part of this file a SCREEN may depend on.
 *
 * A prototype in somebody's repo is written against these names and nothing else. They are
 * FROZEN: renaming or removing one silently breaks every screen ever written, in every repo,
 * with no error anywhere — a button that stops navigating looks like a design mistake, not a
 * runtime change. Everything else below is ours and may be rewritten freely, which is what makes
 * it safe for `design init` to refresh this file in place without asking.
 *
 *   READ FROM THE SCREEN          `data-go`  `data-screen`  `data-states`  `data-slot`
 *                                 `data-bind`  and a form control's own `name`
 *   READ FROM THE URL             `?state=`  `?variant=`  `?theme=`
 *   WRITTEN ONTO <html>           `data-state`  `data-variant`  `data-theme`   ← screens STYLE on these
 *   GIVEN TO SCREEN CODE          `window.studio.{go,data,path,selector,screen}`
 *                                 and the `studio:state` CustomEvent
 *
 * `designContract.test.ts` holds every line of this against the COMMITTED worked example, which
 * is real screens a person wrote — so a rename goes red on the way in rather than in somebody's
 * repo. Adding a name is ordinary work. Changing one is a breaking change to every prototype
 * that exists, and the day it is genuinely needed it needs a migration, not a bump.
 *
 * (The `@studio-bridge-version` below tracks THE FILE, not this contract. It moves whenever the
 * file does, including for a comment; the contract above is what does not move.)
 * ---------------------------------------------------------------------------------------------
 *
 * IT DOES NINE THINGS AND NOTHING ELSE.
 *
 * 1. URL → ATTRIBUTES. `?state=`, `?variant=`, `?theme=` become `data-state`, `data-variant`,
 *    `data-theme` on <html>, and a `studio:state` CustomEvent fires on every change. A screen NEVER
 *    parses the URL itself: a vanilla screen styles `html[data-state="empty"] …`, a framework
 *    screen reads the attribute through a ten-line hook.
 *
 * 2. `data-go` NAVIGATION. A click on `[data-go]`, or a submit of a form carrying it, resolves
 *    the destination against the journey this page is in and navigates:
 *       data-go="detail"                a sibling screen
 *       data-go="detail?state=error"    …with dimensions set
 *       data-go="../other/entry"        another journey
 *       data-go="back"                  history.back()
 *       data-go="#confirm"              an overlay: <dialog id="confirm"> opened in place
 *    THE VALUE IS ALWAYS A STRING LITERAL IN SOURCE (`lint.mjs` refuses `data-go={expr}`,
 *    `:data-go` and `v-bind:data-go`) — that is what lets the flow map be derived by a grep
 *    rather than by running anything.
 *    `theme` always rides along. The current `variant` rides along as a QUERY PARAMETER only —
 *    the bridge never rewrites a destination's FILE name to a `--variant` one it cannot know
 *    exists, because a 404 in a prototype reads as a broken design. Name the variant in the
 *    `data-go` when the destination has one: `data-go="detail?variant=dense"`.
 *    Links are ordinary navigation, so a prototype opened in a plain tab still clicks through —
 *    the studio is never the only way to walk a journey.
 *
 *    INSIDE THE STUDIO THE JOURNEY HAS ITS OWN HISTORY, AND NEVER THE BROWSER'S. A frame shares
 *    its session history with the page that holds it, so `history.back()` in here traverses the
 *    JOINT history and can walk the STUDIO backwards instead of the prototype — measured
 *    2026-09-17 in WebKit, which is what the desktop window runs: a `data-go="back"` on the first
 *    screen moved the page from `/design` to `/` and left the frame exactly where it
 *    was. (Chromium blocks it with its cross-origin-iframe intervention, which is why the browser
 *    door looked fine and the app did not.) Equally, `location.assign` PUSHES onto that joint
 *    history, so clicking through a journey ate the app's own Back button, one press per screen.
 *    So with a `studio` parameter the bridge keeps its OWN trail in `sessionStorage` and every
 *    move is a `location.replace`: the joint history never grows and `back` pops the trail. With
 *    no `studio` parameter nothing changes — a plain tab gets `assign` and `history.back()`,
 *    because there the browser's Back button IS the journey's.
 *
 *    THE SESSION BAG is GOV.UK's one trick, client-side: every NAMED form control is mirrored
 *    into `sessionStorage["studio.data"]` on change, and any element with `data-bind="<name>"` is
 *    filled from it on load — so the name typed on screen one appears on screen three. A control
 *    whose type is `password`, and any name starting with `_`, is NEVER stored (GOV.UK's own
 *    rule). There is no branching logic: two buttons with two `data-go`s is the branch.
 *
 * 3. THE STUDIO PROTOCOL, over postMessage, trusting NOTHING it was not told twice. The bridge
 *    reads `?studio=<origin>` from its own URL and accepts it ONLY if it is `http://127.0.0.1:<port>`
 *    or `http://localhost:<port>`. It answers only messages whose `event.origin` is that origin
 *    AND whose `event.source === window.parent`; it posts only to that origin. With no `studio`
 *    parameter it never listens and never posts — a prototype opened outside the studio is mute.
 *
 * 4. PICK MODE. Hover outlines the element under the pointer with its path label; a click freezes
 *    it and posts `studio:picked`. The PATH is the chain of `data-screen` / `data-slot` attributes
 *    plus the text — `payment › card › card-footer › button "Pay now"` — which is how a comment
 *    names a COMPONENT rather than a pixel.
 *
 *    AIMING FREEZES THE PROTOTYPE, WHOLE. Comment and Area are a MODE: while one is on, every
 *    pointer, click, key and submit is swallowed at `window` in the capture phase, so the screen
 *    cannot act on a click meant to describe it. It used to swallow `data-go` and nothing else,
 *    which left every other interactive element live — measured 2026-09-17, with pick mode on:
 *    an `<a href>` navigated, a `<form>` submitted, `<details>` opened, a checkbox toggled and an
 *    `onclick` handler ran, all while the designer was trying to leave a note. `Escape` is the
 *    one key that is not merely eaten: it posts `studio:escape` so the studio can drop the mode,
 *    because the page cannot hear a key pressed inside this frame.
 *
 * 5. DRAW MODE. A rectangle dragged over the screen posts `studio:drawn` with the rect, the paths
 *    it covers, and an ANCHOR — the deepest element that contains the rect, plus the offset into
 *    it — so an area follows its own scroller instead of hanging in the viewport.
 *
 * 6. EDIT MODE. `studio:edit` hands over a VOCABULARY — the slots the repo's own stylesheet styles
 *    and the `data-*` modifiers it declares for them — and the designer then works on the screen
 *    the way they would in Figma or Webflow: a hover outline and a name chip, click to select,
 *    shift-click and a marquee for several, Enter/⇧Enter/Tab through the tree, eight handles,
 *    drag to reorder anywhere with a ghost and a caret, ⌘-drag to move freely along smart
 *    guides, ⌥-hover to measure, arrows to nudge, double-click to retype, and every verb a design
 *    tool has — duplicate, delete, hide, wrap, unwrap, copy, cut, paste, insert, reorder, swap,
 *    align, distribute. Every committed change posts `studio:edited` with the screen root's
 *    `outerHTML`, one human line saying what happened, EVERY line so far (`ops`) and whether it
 *    came from a free tool (`free`); every change of selection posts `studio:selected` with each
 *    member's traits, box, inline style and computed style; every change posts `studio:tree`, the
 *    screen as a layers tree; a right-click posts `studio:menu`. The studio's own controls come
 *    back as `studio:act` — the same functions the keys call, so panel, menu and keyboard are three
 *    doors onto one set of verbs — and `studio:editopt` sets the scale and the switches.
 *
 *    THE DESIGNER IS NEVER REFUSED, AND THAT IS THE 2026-09-18 REVERSAL. This mode used to offer
 *    the vocabulary and nothing else, and a blind usability review and the owner landed on the
 *    same verdict: HTML internals wearing a design tool's clothes. So the model is FREE
 *    MANIPULATION, RECONCILED AFTERWARDS. A change the design system can express — a modifier, a
 *    move, a duplicate, a word — is written to the screen's source as it always was. A change it
 *    cannot — an explicit width, a nudge, a margin — is carried as an inline `style`, which is
 *    not a defect here but a MESSAGE: the studio routes it into an intent the agent reads as
 *    *this is what I meant, match it as closely as the system allows and where you cannot, add
 *    the component*. It is the designer manipulating the real thing instead of pasting a
 *    screenshot of it.
 *
 *    SO THERE ARE TWO WAYS TO CHANGE ONE THING, AND BOTH ARE FIRST-CLASS. The trait controls are
 *    the FAST path: system-legal by construction, instant, exact, and gated by `writable()` so a
 *    malformed vocabulary cannot make them write `class` or `id`. The free tools are the
 *    EXPRESSIVE path, and they write `style` deliberately.
 *
 *    Our own chrome is one element outside the `[data-screen]` root, marked `data-studio-edit`,
 *    every box and handle and the stylesheet that draws them inside it, and OFF MEANS OFF —
 *    every listener, every node and every attribute of ours is gone, because the studio
 *    screenshots this document and an artifact left behind is an artifact committed.
 *
 *    THE HISTORY OUTLIVES THE DOCUMENT (v12, plan 66). Every step on the undo stack has an id, and
 *    `studio:editable` / `studio:edited` carry the stack's shape (`history`) and the step now
 *    current, so the studio keeps a copy of it per FILE. A new document of the same file — the
 *    frame reloaded behind the one on screen, the screen left and come back to, the mode left and
 *    re-entered — is armed with that copy (`studio:edit {seed}`), vetted here like any other
 *    markup that arrived over postMessage, and the designer's undo is where they left it.
 *    `studio:flush {hold}` commits what is pending (the words being typed, a run of nudges) and
 *    then holds the editor still while the studio swaps a new document in, so nothing made in
 *    the old one can be lost. The words being typed end on Enter, Escape (which puts them back),
 *    a click away or a lost focus, and on nothing else; Escape in the middle of a resize or a
 *    free move puts the element back exactly as it was.
 *
 *    THE WORDS ARE SAID, AND THE FOCUS IS TAKEN (v13, plan 66 review 1). `studio:text {on}` says
 *    when the words open and when they end, so the studio never swaps a document out from under a
 *    designer mid-keystroke; a `studio:flush {hold}` that arrives while they are open commits
 *    nothing and answers `studio:flushed {held: false, text: true}` (only `force` ends them). A
 *    press on the screen while editing takes the keyboard focus into this document — the freeze
 *    cancels the `mousedown` that would have moved it — so the canvas keys a designer presses
 *    next are heard here and not by whichever studio control was focused before. And the
 *    `deselect` verb puts a live gesture back before it clears anything: the studio's Escape is
 *    this document's Escape.
 *
 * 7. THE SCROLL CROSSES THE SEAM. Every message carries where the document is scrolled
 *    (`scroll: [x, y]`), and `studio:scroll` puts it there. A frame the page reloads because the
 *    file under it changed is a NEW document at the top; the page loads it beside the old one, asks
 *    it to scroll where the old one was, and only then shows it — so a reload after an edit keeps
 *    the reader's place instead of throwing them back to the top. The page also uses it to bring a
 *    pin it was asked about into view. It is the document's own scroll, never an inner scroller's.
 *
 * 8. THE KEYS, THE POINTER AND THE REFUSED REQUESTS CROSS THE SEAM (v10). A key pressed with focus
 *    inside this frame never reaches the page, and nor does the pointer's movement, so the bridge
 *    is the only way the page hears either: `studio:key {key, shift, mod}` for a CLOSED list —
 *    Escape (always), C A V F J K and [, ⌘/Ctrl+Enter, ⌘⇧L, ⌘B — posted only when this document
 *    did not handle the key itself (`defaultPrevented`) and nothing editable has the focus, so the
 *    page keeps every key it uses; while aiming, from the capture phase, because the freeze eats
 *    the rest. `studio:active`, at most four a second, on movement, wheel and keys. And
 *    `studio:blocked {directive, host}`, once per host, for every request this document's policy
 *    refused — the page says which sites were not loaded. A picked element and a drawn area carry
 *    a READABLE NAME beside the structural path (`Button · Pay now`, `Area · The autumn edit`), an
 *    area's anchor is kept as FRACTIONS of its anchor's box so it follows a reflow at another
 *    width, and the pick hover is a thin ring and that name in a small tag, sized by the scale the
 *    page draws this frame at so both are screen-sized at every scale.
 *
 * 9. A PIN IS WHERE ITS ELEMENT IS, AND ONLY WHILE IT SHOWS (v19, plan 73). Every watched id is
 *    re-measured once per frame on ANY change — a scroll anywhere, a resize, a ResizeObserver on
 *    every watched element and its clipping ancestors, one MutationObserver on the document, a
 *    transition or an animation (every frame while one moves a watched element, v22), a load, the fonts — and posted only
 *    when something moved. Each carries WHETHER beside WHERE (`seen: {id: {state, rect, whole}}`):
 *    `shown`, `clipped` (an overflow ancestor cuts it; `rect` the visible part), `covered`
 *    (something else of the page is on top at its centre — a stacked slide, a modal), `hidden`
 *    (`display: none`, `visibility`, `opacity: 0`, `hidden`, `inert`, a zero box). Nothing found is
 *    absent. `studio:size {seq}` names the size the page just gave the frame, and every message
 *    echoes the last `seq`, so the page never reads a report made under an older size as a new one.
 *    The FREEZE IS WHOLE while pointing, drawing or HOLDING (`studio:hold`, a note card open): one
 *    window-capture listener per event type, registered before any of the page's, runs the
 *    bridge's own handler and then `stopImmediatePropagation` — a page listening on `window` in the
 *    capture phase, or on `wheel`, never hears a gesture meant for the review; the wheel still
 *    scrolls the page (item 13 routes it to the box under it). Held, a click is `studio:away {x, y, pick}` and acts on
 *    nothing. While aiming, `studio:aimed {rect, at}` (one a frame; `at` the pointer, v21) says what is pointed at, so the
 *    page can move its controls out of the way, and the hover tag flips below an element at the
 *    top. `studio:reveal {id}` scrolls each scroller that holds a pin (one a person could scroll),
 *    then the document, until it is in view. A box nobody can scroll (`overflow: hidden`) that cuts
 *    an element away wholly — a slide moved off its track — is `hidden`, not `clipped`.
 *
 * 10. AN ANCHOR SURVIVES THE AGENT, AND EVERY PAGE OF THE DOOR CAN TALK (v20, plan 73 D15, D16). A
 *    pick carries a FINGERPRINT beside its selector — the tag, the first 40 characters it says,
 *    the nearest heading's — and the click point as fractions of the element's box. A watched id
 *    `el:<tag>;<text>;<heading>|<selector>` is resolved by the selector and checked against the
 *    fingerprint: a positional selector that now names another element (the agent put a paragraph
 *    before it) is searched for again by what it said, and on one match re-anchors and says
 *    `moved`. v21 (plan 73 round 1): the fingerprint keeps where the element SAT too — its naming
 *    attributes, its classes, its id, the elements before and after it, its parent's shape, its
 *    place among its kind — and finding it again is a judgement with three honest answers: the
 *    same element, the same element edited in place, or gone (`fp:<json>|<selector>`; section 4's
 *    "the anchor"). It never keeps an element only because the selector names it. v22 (plan 73
 *    round 2): a parent is THE parent by what is said around the pin, or its place up the tree —
 *    never by its shape — so answering one of several look-alikes keeps the pin on it; two
 *    neighbours both rewritten, or a page translated, keep it at exactly its place; and a copy of
 *    its old words elsewhere never takes it from the element still in place. An element once
 *    found is kept while it is in the document AND says what it said — a node the page gives other
 *    words (a sort in place, a list keyed by index) is not the pin: its words are followed, and
 *    where nothing says them now it is not showing — and an id found nowhere is not looked for
 *    again until the document changes. Pointing and drawing answer the main button only, and
 *    select nothing. `studio:pickat {x, y}` is a pick at a point the page clicked over this frame;
 *    `studio:pickat {id}` (v22) is another note on what a watched id names (⌥ on a dot). An area held by nothing smaller than the page hangs off `html`, so every
 *    area has an anchor. `studio:ready` carries the FILE on screen (`file`), so a link followed
 *    inside the frame moves the page's address with it; and the studio's origin, once read off
 *    the first page's URL, is kept for the frame's session, so the page a plain link leads to
 *    talks too. `studio:scroll` is answered with `studio:scrolled` once the document is there (or as
 *    far as it goes), so a reloaded version is swapped in on that answer. `studio:rects` says what
 *    its measure cost (`ms`), for the performance check.
 *
 * 11. THE REVIEW'S MARKS ARE PAINTED HERE (v22, plan 73 round 2). `studio:marks` names what to
 *    mark — a watched id, its outline, its dot and where on its element the dot sits — and this
 *    document paints them in a layer of its own (`<studio-marks>`, a shadow root, a child of <html>,
 *    never counted by the anchors or the observer), in the same paint as their elements: a mark on
 *    something the document carries rides a layer in document coordinates and scrolls with it; one
 *    inside a fixed box rides a fixed layer; one on something a single translation animation
 *    slides rides a copy of that animation, started with it; one in an inner scroller, on a sticky
 *    box or on anything else that moves is put where its element is by the same measure, before
 *    the frame paints. A mark is drawn only while its element shows, every size is divided by the
 *    page's scale and every colour is the page's own. `studio:ready` says `marks: true`; a small
 *    element's entry in `seen` carries `room`, where its dot can sit without covering anything
 *    else. Nothing is drawn unless the page asks, and never over edit mode.
 *
 * 12. FROZEN, THE PAGE IS STILL (v23, the owner's ask of 2026-10-14). While pointing, drawing or
 *    holding a card nothing of the page moves on its own: its timers and frames (wrapped here,
 *    under a studio, before any script of the page's runs) come due and are HELD, an interval's at
 *    most once, and run after the release; its CSS animations, transitions and Web Animations are
 *    paused, and its playing media and SVG clocks; on release exactly what was stopped goes on.
 *    The bridge's own clock is the browser's, captured first, and never held.
 *
 * 13. FROZEN, WHAT WAS HOVERED STAYS AS IT WAS AND THE POINTER TOUCHES NOTHING (v23, the owner's
 *    call of 2026-10-14, which REVERSES item 9's v19 choice to let the moves reach the page so
 *    `:hover` showed what was pointed at). At the freeze every `:hover` rule gets a copy saying
 *    `[data-studio-hover]`, the hover chain is stamped with it, and one transparent shield of ours
 *    covers the viewport: a menu opened by hovering stays open and its items can be picked, and
 *    moving the pointer changes nothing of the page — only the bridge's ring and tag follow it. The
 *    wheel scrolls the scroller under the pointer (the document natively). Release takes the copies,
 *    the stamps and the shield away, and the engine's `:hover` resumes from where the pointer is.
 *
 * 14. THE PAGE CANNOT TALK THE BRIDGE OUT OF ITS JOB (v24, the adversarial pass of 2026-10-14). What
 *    the freeze calls (`preventDefault`, `stopPropagation`, `stopImmediatePropagation`, and
 *    `Function.prototype.apply`, which every handler of ours runs through) is the browser's own,
 *    captured before any script of the page's runs, and so are the observers, `JSON` and
 *    `CSS.escape`. The DOM's own methods are probed instead: `studio:ready` says `broken` — the
 *    first the page made answer wrongly — and the page turns Comment off saying so; every field of
 *    `studio:ready` is computed on its own, so a broken one never silences the message. And a
 *    document leaving for another file says where (`studio:leaving {file}`), so a frame that went
 *    on to `data.json` — which carries no bridge and says nothing — is named on the stage.
 *    `studio:ready`'s `file` is the page's to forge (its script can post anything this file can),
 *    so the page moves its address only on `studio:here {nonce, file}`, this file's answer to
 *    `studio:who {nonce}`: the message listener is the first in the capture phase and stops every
 *    message from the studio, so no script of the page's hears the secret it is asked with.
 *    A page that takes no pointer (`pointer-events: none` on its root or body) is pointed at all
 *    the same: a hit test that lands on the root is asked again with the pointer given back for
 *    that one question; a pick that is still only the root is `studio:missed {x, y}`, never a note
 *    on nothing, and `selector` is never "". A page that keeps taking the marks' layer out of its
 *    root (item 11's three put-ins) is answered with `studio:evicted`, once, and the page draws the
 *    marks over the frame itself.
 *
 * 15. THE PLACE CROSSES THE SEAM, NOT ONLY THE SCROLL (v26, plan 77). A deck that flips slides
 *    with `#` in the URL, or whose scroller is an element, was thrown back to slide 1 by every
 *    reload: the document's `scrollX/Y` is not where such a reader is. So every message also carries
 *    `where` (`location.hash` exactly as the browser gives it, "" or `#…`, at most 256 characters)
 *    and, when any element that scrolls inside the page has been scrolled, `inner: [[selector, x,
 *    y], …]` (at most 8; the selectors are the ones a pin carries). `studio:scroll {x, y, where,
 *    inner}` puts all of it back: the fragment first (a fragment-only `location.replace`, then the
 *    page's own `hashchange` handler and ONE of our frames to lay the slide out), then each inner
 *    scroller, then the window, then `studio:scrolled`. A second `studio:scroll` or `studio:go`
 *    supersedes a first still waiting. `studio:go {where}` is the fragment alone, then a fresh
 *    report. `studio:rects {ids, wheres}` names, per watched id, the fragment its pin was made on:
 *    on another fragment the selector alone is tried, and an element that does not show there is
 *    reported `elsewhere: true` — never found again by its fingerprint or its area's anchor, which
 *    is the guess a deck made. v27 (round 1): on another fragment a pin is believed only when its
 *    selector names an element that shows AND says the pin's words (tag, text, heading — a
 *    fingerprint with neither proves nothing; an area is held by its holder's fingerprint, and one
 *    without is elsewhere). `studio:go {where, seq}` is answered `studio:went {seq, where}` once the
 *    move has run. The wait for the fragment is one permanent `hashchange` listener and one task of
 *    our own — never a frame; a place restored on a document still loading also waits for `load`.
 *    A watched entry carries `moved: "<where>"` (a string, beside the boolean of a fingerprint's
 *    find) when its pin's element, proved by `provesSame`, sits on a deck slide whose fragment
 *    differs from the pin's `where`. v37 (plan 77 §30): `studio:print` is answered `studio:print
 *    {slide: {words}}` — the text of the slide on screen, when a deck's evidence holds (three or
 *    more siblings of a tag, exactly one showing, the others hidden on purpose); no `slide` on a
 *    page with none, the message still carrying the place every message carries — and `studio:scroll {slide}` brings it back: after the fragment is put back, if the
 *    slide now showing does not say it and exactly ONE sibling does, the bridge lands on that one
 *    (the same replace and wait) before `studio:scrolled`. What changed in a version is NOT read
 *    here any more (v26–v36 diffed the document and its source; the page says only that it was
 *    updated, and when). v38 (plan 77 §32): A `#` THAT NAMES AN ELEMENT OF THIS DOCUMENT THAT SHOWS
 *    (and is no slide of a deck) is a PLACE ON THE PAGE, not a route (`anchorHash`): the place says
 *    `anchor: true` and the page loads the next version WITHOUT the fragment (the scroll is the place
 *    — no browser jump to wait for); a pick or an area made there carries no `where`; a pin whose own
 *    `where` names such an element is judged by its selector and its words, never elsewhere for that;
 *    a landing sets the document's `scroll-behavior` aside (instant) until `scrolled` is said; and
 *    `moved` takes the address as a slide only when it is `#`+the slide's id or a number.
 *
 * 16. THE PAGE CAN ASK TO ANSWER (v39, plan 79). THIS FILE DEFINES NOTHING ON `window`: a page that
 *    has never heard of Harbor can collide with nothing of ours. A page that wants to answer ASKS,
 *    and is answered by an event:
 *      addEventListener("harbor:answers", (e) => { e.detail = { on, answer } });
 *      dispatchEvent(new Event("harbor:hello"));
 *    Under a studio this file listens for `harbor:hello` (registered before any script of the
 *    page's, in the capture phase) and answers it SYNCHRONOUSLY with `harbor:answers`, whose
 *    `detail` is frozen: `on` (the page that holds this frame accepts answers from it — said by
 *    `studio:answers {on}`, false until then) and `answer(value, {name, label})`. The event is
 *    dispatched again on every CHANGE of `on`, and only then. With no studio nothing listens, so a
 *    plain tab never answers a hello. `answer` returns a boolean and never throws, and posts
 *    `studio:answer {id, name, label, value}` only for a plain-JSON value inside the limits below,
 *    after a trusted click of the last 5 s ON THIS PAGE: BOTH `navigator.userActivation.isActive`
 *    (where the engine has it) AND this file's own record of a trusted `click` or `pointerup` in
 *    this document — a keyboard press of a control makes a trusted `click`, typing makes none, and
 *    a press made in Harbor's chrome fires no event here, so the activation an engine hands a
 *    frame that was loading while the PARENT got a key press is not a press in the page. Never a
 *    press meant for the review (pointing, drawing, editing). THAT IS A COURTESY, NEVER THE LOCK — a page can post
 *    any `studio:*` message itself; what keeps an answer from the agent is the card the page draws
 *    and its Send. The value is COPIED while it is checked and the copy is what is posted (a getter
 *    cannot answer twice). Limits, which `webview/src/model.ts` holds too: depth 8, 2000 values, a
 *    string 4000 characters, a key 200, 16384 characters of JSON — over a limit is refused, never
 *    clipped, and a value is refused at the first character past the last limit, not after it has
 *    been serialised whole; a label is 120 characters with every control, format and line- or
 *    paragraph-separator character (Unicode Cc, Cf, Zl, Zp: the bidi overrides, zero-width
 *    characters, U+2028/9) stripped and every `"`, `“` and `”` written as `'` (the card quotes a
 *    label, and it cannot close its own quote); a name is `[A-Za-z0-9._-]{1,64}`. What became of an answer
 *    comes back as the `harbor:answered` event `{id, state: sent|discarded|replaced|failed}`.
 *
 * Rects are in this frame's own CSS pixels. The page divides by whatever scale it applied. */

/* @studio-bridge-version 39
 *
 * BUMP IT WHENEVER THIS FILE CHANGES, and nothing else needs a version. `design init` reads this
 * number out of the repo's copy, compares it with its own, and REFRESHES the repo's in place —
 * this file is OURS, never the repo's, so the overwrite rule that protects a repo's own work does
 * not apply to it. Measured 2026-09-17, which is why the number exists at all: a bridge fix
 * shipped in the template, the human ran `design init --force`, and the binary faithfully rewrote
 * its OWN embedded copy — the old one, because a binary freezes the templates at compile time
 * (`designTemplate.ts`). Nothing in the file said which was which, so a correct fix and a correct
 * command produced an unchanged bug and no way to see why. */

(() => {
  /* THE CLOCK THIS FILE RUNS ON IS THE BROWSER'S OWN (v23, item 12). The page's timers and frames
     are held while it is frozen, and the bridge's are never: every timer and frame below is one of
     these, captured before anything of the page's can run and before item 12 wraps the page's. */
  const setTimeout = window.setTimeout.bind(window);
  const clearTimeout = window.clearTimeout.bind(window);
  const setInterval = window.setInterval.bind(window);
  const clearInterval = window.clearInterval.bind(window);
  const requestAnimationFrame = window.requestAnimationFrame.bind(window);
  const cancelAnimationFrame = window.cancelAnimationFrame.bind(window);
  const addListener = EventTarget.prototype.addEventListener;
  const removeListener = EventTarget.prototype.removeEventListener;
  /* AND THE EVENT'S OWN VERBS ARE THE BROWSER'S (v24): the freeze cancels and stops through these,
     captured before any script of the page's runs, so a page that rewrites
     `Event.prototype.stopImmediatePropagation` (or `stopPropagation`, `preventDefault`, or
     `Function.prototype.apply`, which every handler of ours is called through) cannot un-freeze
     itself — measured, a deck that did advanced on the Comment click. */
  const apply = Reflect.apply;
  const eventVerbs = {
    cancel: Event.prototype.preventDefault,
    stop: Event.prototype.stopPropagation,
    stopNow: Event.prototype.stopImmediatePropagation,
  };
  const evCancel = (event) => apply(eventVerbs.cancel, event, []);
  const evStop = (event) => apply(eventVerbs.stop, event, []);
  const evStopNow = (event) => apply(eventVerbs.stopNow, event, []);
  /* THE PAGE THAT HOLDS THIS FRAME, AND WHAT A MESSAGE FROM IT SAYS, as the browser has them
     (v24, H2): `window.parent` is replaceable, so a page could hand us a parent of its own and read
     every word we post; and a page that rewrote a MessageEvent getter would read every word the
     studio posts us. So both are the browser's, captured before the page runs. */
  const parentWin = window.parent;
  const decodeNative = window.decodeURIComponent;
  const hasOwn = Object.hasOwn;
  const messageGetters = (() => {
    const proto = typeof MessageEvent === "function" ? MessageEvent.prototype : null;
    const get = (key) => {
      const d = proto === null ? undefined : Object.getOwnPropertyDescriptor(proto, key);
      return d ? d.get : undefined;
    };
    return { data: get("data"), origin: get("origin"), source: get("source") };
  })();
  /** A message's field through the browser's own getter (an event the engine made has no field
   *  of its own — one a test made may). */
  const fieldOfMessage = (event, key) =>
    hasOwn(event, key) || messageGetters[key] === undefined
      ? event[key]
      : apply(messageGetters[key], event, []);
  /* AND THE FEW GLOBALS A PAGE HAS NO REASON TO REPLACE AND EVERY MEASURE NEEDS (v24): the
     observers, `JSON` and `CSS.escape` — the browser's, as they were before the page ran. What a
     page does to the DOM's own methods is probed instead (`brokenNative`). */
  const MutationObserver = window.MutationObserver;
  const ResizeObserver = window.ResizeObserver;
  const IntersectionObserver = window.IntersectionObserver;
  const json = { stringify: window.JSON.stringify, parse: window.JSON.parse };
  const CSS = (() => {
    const native = window.CSS;
    const escapeOf = native && typeof native.escape === "function" ? native.escape : null;
    return {
      escape: (value) => {
        if (escapeOf === null) throw new Error("no CSS.escape");
        return apply(escapeOf, native, [value]);
      },
    };
  })();
  const DIMENSIONS = ["state", "variant", "theme"];
  const BAG = "studio.data";
  /** Where the journey's own back stack lives while the studio is framing it. */
  const TRAIL = "studio.trail";
  /** Below this, in BOTH axes, a drag is a click and there is no area to talk about. */
  const MIN_DRAG = 4;
  const LOOPBACK = /^http:\/\/(127\.0\.0\.1|localhost):\d{2,5}$/;
  const html = document.documentElement;
  const here = new URL(document.currentScript ? document.currentScript.src : location.href);

  /* ---------------------------------------------------------------- 1. URL → attributes */

  /** Stamp the three dimensions from a search string. Returns true when anything moved. */
  function stamp(search) {
    const q = new URLSearchParams(search);
    let moved = false;
    for (const key of DIMENSIONS) {
      const value = q.get(key);
      const had = html.dataset[key];
      if (value === null || value === "") {
        if (key === "variant" && fileVariant() !== null) {
          if (had !== fileVariant()) {
            html.dataset[key] = fileVariant();
            moved = true;
          }
          continue;
        }
        if (had !== undefined && key !== "theme") {
          delete html.dataset[key];
          moved = true;
        }
        continue;
      }
      if (had !== value) {
        html.dataset[key] = value;
        moved = true;
      }
    }
    if (html.dataset.state === undefined) html.dataset.state = "ready";
    return moved;
  }

  /** `…/detail--dense.html` → `dense`. In a static journey the variant IS the file. */
  function fileVariant() {
    const file = location.pathname.split("/").pop() || "";
    const bare = file.replace(/\.[a-z0-9]+$/i, "");
    const at = bare.indexOf("--");
    return at === -1 ? null : bare.slice(at + 2) || null;
  }

  /** The screen id: the root's own `data-screen` when the DOM is up, the file name before it. */
  /* ONCE PER DOCUMENT GENERATION (plan 73 round 4, U4): a selector over the whole document on every
     report was a walk of every element in every scroll frame on a page with no `[data-screen]` */
  let screenAt = { gen: -1, id: "" };
  function screenId() {
    if (screenAt.gen === generation) return screenAt.id;
    const root = document.querySelector("[data-screen]");
    let id;
    if (root !== null) id = root.getAttribute("data-screen") || "";
    else {
      const file = location.pathname.split("/").pop() || "";
      id = file.replace(/\.[a-z0-9]+$/i, "").split("--")[0];
    }
    screenAt = { gen: generation, id };
    return id;
  }

  function announce() {
    window.dispatchEvent(
      new CustomEvent("studio:state", {
        detail: {
          state: html.dataset.state,
          variant: html.dataset.variant,
          theme: html.dataset.theme,
        },
      }),
    );
  }

  stamp(location.search);

  /* ---------------------------------------------------------------- 2. data-go */

  const isStatic = () => /\.[a-z0-9]+$/i.test(location.pathname.split("/").pop() || "");

  /** A `data-go` value → the URL to go to, or null for `back` / an overlay handled in place. */
  function destination(raw) {
    const value = String(raw || "").trim();
    if (value === "" || value === "back") return null;
    if (value.startsWith("#")) return null;
    const [target, query = ""] = value.split("?");
    const wanted = new URLSearchParams(query);
    const dir = location.pathname.replace(/[^/]*$/, "");
    let path;
    let id = target;
    if (target.includes("/")) {
      const parts = target.split("/");
      id = parts[parts.length - 1];
      path = new URL(parts.join("/"), location.origin + dir).pathname;
    } else {
      path = dir + id;
    }
    if (isStatic()) {
      const variant = wanted.get("variant");
      path = `${path.replace(/\.[a-z0-9]+$/i, "")}${variant ? `--${variant}` : ""}.html`;
    }
    const out = new URLSearchParams();
    for (const key of DIMENSIONS) {
      const named = wanted.get(key);
      if (named !== null && named !== "") out.set(key, named);
      else if (key !== "state" && html.dataset[key]) out.set(key, html.dataset[key]);
    }
    /* AND `studio` RIDES ALONG, or the studio goes deaf the moment somebody clicks. A `data-go`
       is an ordinary navigation: the next document runs this script again, reads `?studio=` off
       ITS OWN url, and finds nothing — so it never posts `studio:ready`, the page never learns
       where the prototype went, and the breadcrumb, the pins and the state chips are all about a
       screen that is no longer on the other side of the frame (measured 2026-09-16: the frame
       showed `done` while the page still said `detail`). It is carried verbatim and re-vetted by
       the next page's own LOOPBACK check, which is the check that matters. */
    const from = new URLSearchParams(location.search).get("studio");
    if (from !== null && from !== "") out.set("studio", from);
    const search = out.toString();
    return path + (search === "" ? "" : `?${search}`);
  }

  function overlay(id) {
    const el = document.getElementById(id.slice(1));
    if (el === null) return false;
    if (typeof el.showModal === "function") el.showModal();
    else el.setAttribute("open", "");
    return true;
  }

  /* THE TRAIL — the journey's own back stack, and ONLY while the studio is framing this page.
     It is a list of `{from, to}` because the studio can re-point the frame at any screen it
     likes, and a trail whose last `to` is not the page we are actually on belongs to a journey
     nobody is walking any more: `start()` drops it rather than offering a Back that leaves. */
  const hereUrl = () => location.pathname + location.search;

  const trail = () => {
    try {
      const v = json.parse(sessionStorage.getItem(TRAIL) || "[]");
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  };

  function setTrail(list) {
    try {
      sessionStorage.setItem(TRAIL, json.stringify(list.slice(-50)));
    } catch {
      /* a private window with no storage still walks forwards */
    }
  }

  /** Back INSIDE the frame. Never `history.back()` under the studio — see the header, item 2. */
  function goBack() {
    if (studio === null) {
      history.back();
      return;
    }
    const list = trail();
    const last = list.pop();
    if (last === undefined || typeof last.from !== "string") return;
    setTrail(list);
    location.replace(last.from);
  }

  function go(raw) {
    const value = String(raw || "").trim();
    if (value === "back") {
      goBack();
      return;
    }
    if (value.startsWith("#") && overlay(value)) return;
    const url = destination(value);
    if (url === null) return;
    if (studio === null) {
      location.assign(url);
      return;
    }
    setTrail([...trail(), { from: hereUrl(), to: url }]);
    location.replace(url);
  }

  function nearestGo(node) {
    let el = node instanceof Element ? node : null;
    while (el !== null && !el.hasAttribute("data-go")) el = el.parentElement;
    return el;
  }

  document.addEventListener(
    "click",
    (event) => {
      const el = nearestGo(event.target);
      if (el === null) return;
      /* Belt and braces: the aim freeze below already swallows this click at `window`, one phase
         earlier. This is the guard that does not depend on that one having been installed. */
      if (aimingNow()) {
        evCancel(event);
        evStop(event);
        return;
      }
      evCancel(event);
      go(el.getAttribute("data-go"));
    },
    true,
  );

  document.addEventListener("submit", (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.hasAttribute("data-go")) return;
    evCancel(event);
    store(form);
    go(form.getAttribute("data-go"));
  });

  /* the session bag */

  const bag = () => {
    try {
      return json.parse(sessionStorage.getItem(BAG) || "{}");
    } catch {
      return {};
    }
  };

  const keepable = (el) =>
    el.name && !el.name.startsWith("_") && el.type !== "password" && el.type !== "file";

  function store(scope) {
    const data = bag();
    for (const el of scope.querySelectorAll("input[name], select[name], textarea[name]")) {
      if (!keepable(el)) continue;
      if (el.type === "checkbox" || el.type === "radio") {
        if (el.checked) data[el.name] = el.value;
      } else data[el.name] = el.value;
    }
    try {
      sessionStorage.setItem(BAG, json.stringify(data));
    } catch {
      /* a private window with no storage is still a working prototype */
    }
  }

  function fill() {
    const data = bag();
    for (const el of document.querySelectorAll("[data-bind]")) {
      const value = data[el.getAttribute("data-bind")];
      if (value === undefined) continue;
      if ("value" in el && el.tagName !== "DIV") el.value = value;
      else el.textContent = value;
    }
  }

  document.addEventListener("change", (event) => {
    const el = event.target;
    if (el instanceof Element && el.hasAttribute("name")) store(el.form || document);
  });

  /* ---------------------------------------------------------------- 3. the studio protocol */

  /* THE STUDIO'S ORIGIN, AND IT OUTLIVES A LINK (v20, plan 73 D16). Read off this script's URL or
     the page's, and kept in this frame's session — so a plain `<a href>` to another page of the
     same door, which carries no `?studio=`, still talks: measured before it, Comment stayed lit
     and dead on the page a link led to. Only a FRAMED document reads the kept one, and it is
     vetted like the parameter: loopback, http, a port. */
  const STUDIO_KEY = "studio.origin";
  const studioParam =
    here.searchParams.get("studio") ||
    new URLSearchParams(location.search).get("studio") ||
    (() => {
      try {
        return window.parent !== window ? sessionStorage.getItem(STUDIO_KEY) : null;
      } catch {
        return null;
      }
    })();
  const studio = studioParam !== null && LOOPBACK.test(studioParam) ? studioParam : null;
  if (studio !== null)
    try {
      sessionStorage.setItem(STUDIO_KEY, studio);
    } catch {
      /* a frame with no storage still talks on the page it was opened at */
    }

  /* ---------------------------------------------------------- 12. the page held still (v23)

     WHILE THE PAGE IS FROZEN NOTHING OF IT MOVES ON ITS OWN (the owner's ask of 2026-10-14: "make
     sure starting a comment freezes the html completely so that we can start to select just like
     how selector should work"). Pointing, drawing or holding a card, the page is a still picture:

       - its TIMERS and FRAMES are held. `setTimeout`, `setInterval` and `requestAnimationFrame` are
         the page's through a thin wrapper, installed here, before any script of the page's runs
         (this file is the first thing in <head>), and only under a studio. A callback that comes
         due while frozen is kept, not run — at most ONE pending tick per interval, never a pile —
         and runs after the release, in the order it came due; `clearTimeout`, `clearInterval` and
         `cancelAnimationFrame` still cancel it. Ids, `this` and the arguments are the page's own.
         A carousel on an interval, a counter on frames, a typewriter on timeouts: all stop where
         they are. What is NOT held: microtasks, the network's callbacks, a message from the parent,
         a worker, and an event the freeze does not swallow (`load`, a media element's own). Not
         under a studio, nothing is wrapped at all.
       - its MOTION is paused: every CSS animation by one sheet of ours (`animation-play-state:
         paused !important`, so the page's own play state is back untouched on release — an
         `Animation.pause()` would pin it for good, CSS Animations 2's sticky play state), and every
         transition and Web Animation running at the freeze by `pause()`, each one resumed by
         `play()` on release only if it is still paused there. One a message or the network starts
         while frozen is paused as it starts.
       - its MEDIA is paused: each playing `<video>`/`<audio>`, and each `<svg>`'s SMIL clock,
         resumed on release, exactly those.

     A transition paused here never sends its `transitionend` while frozen, and nothing waits on it:
     the marks' loop asks `playState === "running"` (§9), so a paused one keeps nothing measuring,
     and the count of what has started only overstates until the release lets it end. */
  const still = {
    on: false,
    /** page timer id → the callback that came due while frozen (an interval's tick at most once) */
    due: new Map(),
    /** page frame id → the frame callback that came due while frozen */
    frames: new Map(),
    anims: [],
    /** the elements whose CSS animations one rule of ours pauses */
    stamped: [],
    media: [],
    svgs: [],
    sheet: null,
  };
  if (studio !== null) {
    const W = window;
    const wrapped = {
      setTimeout(fn, ms, ...args) {
        if (typeof fn !== "function") return setTimeout(fn, ms, ...args);
        const id = setTimeout(function due() {
          if (still.on) still.due.set(id, () => apply(fn, this, args));
          else apply(fn, this, args);
        }, ms);
        return id;
      },
      setInterval(fn, ms, ...args) {
        if (typeof fn !== "function") return setInterval(fn, ms, ...args);
        const id = setInterval(function due() {
          if (still.on) still.due.set(id, () => apply(fn, this, args));
          else apply(fn, this, args);
        }, ms);
        return id;
      },
      clearTimeout(id) {
        still.due.delete(id);
        clearTimeout(id);
      },
      clearInterval(id) {
        still.due.delete(id);
        clearInterval(id);
      },
      requestAnimationFrame(fn) {
        if (typeof fn !== "function") return requestAnimationFrame(fn);
        const id = requestAnimationFrame(function due(t) {
          if (still.on) still.frames.set(id, fn);
          else apply(fn, this, [t]);
        });
        return id;
      },
      cancelAnimationFrame(id) {
        still.frames.delete(id);
        cancelAnimationFrame(id);
      },
    };
    for (const name of Object.keys(wrapped)) W[name] = wrapped[name];
    /* A Web Animation started while frozen (a message, the network) is paused as it starts; one of
       ours never is */
    const animateOf = typeof Element === "function" ? Element.prototype.animate : undefined;
    if (typeof animateOf === "function")
      Element.prototype.animate = function animate(...args) {
        const a = apply(animateOf, this, args);
        if (still.on && !oursDeep(this)) quietly(hush)(a);
        return a;
      };
  }

  /** Is this node ours, through any shadow root it sits in (the marks' layer is one)? */
  function oursDeep(node) {
    for (let n = node; n instanceof Node; ) {
      if (ours(n)) return true;
      const root = n.getRootNode();
      n = root instanceof ShadowRoot ? root.host : null;
    }
    return false;
  }
  /** Pause one animation the page has running; kept to be played again on release. A CSS
   *  animation is paused by CSS — its element stamped, one rule of ours — never by `pause()`, which
   *  would pin its play state for good (CSS Animations 2: after `pause()` or `play()` the page's own
   *  `animation-play-state` is ignored, so a carousel that pauses on `:hover` never would again). */
  function hush(a) {
    if (a === null || typeof a !== "object" || a.playState !== "running") return;
    const t = a.effect?.target;
    if (t instanceof Node && oursDeep(t)) return;
    if (typeof a.animationName === "string" && t instanceof Element) {
      if (!t.hasAttribute(STILL_ATTR)) {
        t.setAttribute(STILL_ATTR, "");
        still.stamped.push(t);
      }
      return;
    }
    a.pause();
    still.anims.push(a);
  }
  /** Every animation of the document's, and of each open shadow root's where it can be reached. */
  function animationsNow(roots) {
    const all = new Set();
    for (const root of roots)
      if (typeof root.getAnimations === "function")
        for (const a of root.getAnimations()) all.add(a);
    return [...all];
  }
  /* AN ATTRIBUTE, NEVER `*` (measured, a 4,000-element page): a universal rule restyles every
     element and pseudo-element of the page, 7 ms of Chromium's 12 at the freeze; a rule on an
     attribute restyles only what carries it */
  const STILL_ATTR = "data-studio-still";
  const STILL_CSS = `[${STILL_ATTR}],[${STILL_ATTR}]::before,[${STILL_ATTR}]::after,[${STILL_ATTR}]::marker{animation-play-state:paused!important}\n`;
  /** One sheet of ours, adopted (no node the page's observers see), else a `<style>` in our layer. */
  function ownSheet(css) {
    if (typeof CSSStyleSheet === "function" && Array.isArray(document.adoptedStyleSheets)) {
      try {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(css);
        document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
        return sheet;
      } catch {
        /* no constructable sheets: a <style> of ours */
      }
    }
    const el = document.createElement("style");
    el.textContent = css;
    layer.appendChild(el);
    return el;
  }
  function dropSheet(sheet) {
    if (sheet === null) return;
    if (sheet instanceof Element) sheet.remove();
    else document.adoptedStyleSheets = document.adoptedStyleSheets.filter((s) => s !== sheet);
  }
  /** Stop everything of the page that moves: its CSS animations, its transitions and Web
   *  Animations, its media, its SVG clocks. Its timers and frames are held by the wrappers. */
  function hushAll(moving, extra) {
    /* EVERY STYLE CHANGE OF THE FREEZE BEFORE ANYTHING READS ONE, so the page restyles once: what
       moves was listed before any change (`settle`), the copies and the stamps of item 13 are in,
       and here the stamps of what animates, the one sheet of ours, and only then the shield, the
       first thing that reads a box */
    for (const a of moving) quietly(hush)(a);
    still.sheet = quietly(ownSheet)(STILL_CSS + extra) ?? null;
    shield();
    for (const m of document.querySelectorAll("video, audio")) {
      if (m.paused || m.ended || ours(m)) continue;
      quietly(() => {
        m.pause();
        still.media.push(m);
      })();
    }
    for (const svg of document.querySelectorAll("svg")) {
      if (svg.ownerSVGElement !== null || typeof svg.pauseAnimations !== "function") continue;
      quietly(() => {
        if (svg.animationsPaused()) return;
        svg.pauseAnimations();
        still.svgs.push(svg);
      })();
    }
  }
  /** Everything stopped, started again exactly; every held callback run, in the order it came due. */
  function wakeAll() {
    quietly(dropSheet)(still.sheet);
    still.sheet = null;
    for (const el of still.stamped.splice(0)) el.removeAttribute(STILL_ATTR);
    for (const a of still.anims.splice(0))
      quietly(() => {
        if (a.playState === "paused") a.play();
      })();
    for (const m of still.media.splice(0))
      quietly(() => {
        if (m.isConnected && m.paused) m.play()?.catch?.(() => {});
      })();
    for (const svg of still.svgs.splice(0))
      quietly(() => {
        if (svg.animationsPaused()) svg.unpauseAnimations();
      })();
    /* each in a task of its own, as it would have run: one that throws stops none after it */
    for (const id of still.due.keys())
      setTimeout(() => {
        const run = still.due.get(id);
        if (run === undefined || still.on) return;
        still.due.delete(id);
        run();
      }, 0);
    for (const id of still.frames.keys())
      requestAnimationFrame((t) => {
        const run = still.frames.get(id);
        if (run === undefined || still.on) return;
        still.frames.delete(id);
        apply(run, window, [t]);
      });
  }
  /** The page is still exactly while a mode freezes it — asked after every change of mode. */
  function settle() {
    const want = frozenNow();
    if (want === still.on) return;
    still.on = want;
    if (want) {
      /* what is hovered is held BEFORE the shield takes the pointer, in the same task: no paint
         between them shows the page without it */
      const roots = openRoots();
      const moving = quietly(animationsNow)(roots) ?? [];
      hushAll(moving, quietly(holdHover)(roots) ?? "");
      router(true);
    } else {
      router(false);
      wakeAll();
      shield();
      quietly(dropHover)();
    }
  }
  /* A TRANSITION OR AN ANIMATION THAT STARTS WHILE FROZEN — a class a message or the network put
     on — is paused as it starts. */
  for (const type of ["transitionrun", "animationstart"])
    addEventListener(
      type,
      quietly((event) => {
        if (!still.on || !(event.target instanceof Element)) return;
        if (typeof event.target.getAnimations === "function")
          for (const a of event.target.getAnimations()) hush(a);
      }),
      { capture: true, passive: true },
    );
  /* LEFT FOR ANOTHER DOCUMENT, NOTHING IS LEFT HELD: a page kept in the back-forward cache comes
     back moving, and is stilled again only if a mode still freezes it */
  addEventListener("pagehide", () => {
    if (!still.on) return;
    still.on = false;
    router(false);
    wakeAll();
    quietly(dropHover)();
  });
  addEventListener("pageshow", () => settle());

  /* ---------------------------------------------------------- 13. what is open stays open (v23)

     FROZEN, THE POINTER NO LONGER TOUCHES THE PAGE — AND WHAT IT HAD OPENED STAYS OPEN. This
     REVERSES the v19 rule (plan 73 D4) that the moves reach the page "so `:hover` still shows what
     is pointed at", on purpose: the owner's call of 2026-10-14, "freezes the html completely so
     that we can start to select just like how selector should work" — a DevTools picker, where
     moving over the page changes nothing of it. Kept from D4's reason: a menu opened by hovering
     stays commentable, because what was hovered when the page froze is HELD.

     At the freeze, in one task and so in one paint:
       1. the hover chain is read (`:hover`, in the document and each open shadow root);
       2. every rule of every readable sheet whose selector says `:hover` — inside `@media`,
          `@supports`, `@layer`, `@container`, a nested rule, an `@import`, an adopted sheet, an
          open shadow root's, inside `:is()`/`:where()`/`:not()`/`:has()`, before a `::after` — gets
          a COPY that says `[data-studio-hover]` where it said `:hover`: the same specificity. The
          original is never edited. A sheet from another origin cannot be read and is left alone —
          its `:hover` lets go as at any moment the pointer leaves;
       3. the chain is stamped with that attribute — so it looks exactly as it did;
       4. ONE TRANSPARENT SHIELD of ours covers the viewport, the topmost thing under the pointer,
          so the engine's own `:hover` and `:active` leave the page and never come back while it is
          frozen. Nothing of the page's is entered, left or hovered; only the bridge's ring and tag
          follow the pointer. A pick is found BY THE POINT (`under`), through the shield — an item
          of the held-open menu included.
     On release the copies, the stamps and the shield go, and the engine's `:hover` resumes from
     wherever the pointer is. A menu opened by a CLICK (a class, `<details>`, a popover,
     `:focus-within`) is the page's state, not the pointer's, and was never touched. The stamps are
     attribute changes a page's own MutationObserver can see, and the copies are rules a script
     reading `cssRules` can see while frozen; this file's observer counts neither.

     WHERE A COPY GOES IS A PRICE, MEASURED (Playwright's Chromium and WebKit, a 5,000-rule sheet
     with 500 `:hover` rules, 2026-10-14). Right after its original, in the page's own sheet, it
     wins and loses exactly where the original did — but an engine rebuilds a sheet it is told
     changed, whole: 14 ms of restyle in Chromium and 30 in WebKit, against 5 and 9 for the same
     500 copies in one sheet of ours. So a sheet of up to `IN_PLACE` rules takes its copies in
     place, and a bigger one's go into ONE sheet of ours — adopted, with the conditions and the
     layer each original sat in written around it, and the sheet that stills the motion (§12) in
     the same adoption, so the freeze restyles the page ONCE. What that costs, and only on such a
     page: a copy there comes after every rule of the page's, so a later rule of exactly the same
     specificity that the original lost to is now beaten (a hovered `.btn:disabled` written after
     `.btn:hover` shows its hover colour). Stated here rather than hidden.

     AND THE SHEETS ARE READ AHEAD, NOT AT THE PRESS. Reading a rule's `selectorText` serialises
     it: 14 ms in Chromium and 22 ms in WebKit over that page. So what each sheet holds of
     `:hover` is found once while the page is idle, kept by sheet, and read again only when its
     count of rules has changed. */
  const HOVER_ATTR = "data-studio-hover";
  const HOVER_RE = /:hover(?![\w-])/gi;
  const SAYS_HOVER = /:hover(?![\w-])/i;
  const IN_PLACE = 1500;
  const hover = { on: false, els: [], copies: [], skipped: 0 };
  /** sheet → `{n, size, hits}`: its count of top-level rules when read, of every rule, and each
   *  `:hover` rule with its copy (`text`) and the copy wrapped in its groups (`wrapped`) */
  const hoverRead = new WeakMap();
  let full = null;
  /** The document and every open shadow root under it — the trees a page's styles live in. */
  function openRoots() {
    const roots = [document];
    for (let i = 0; i < roots.length; i++)
      for (const el of roots[i].querySelectorAll("*"))
        if (el.shadowRoot && !ours(el)) roots.push(el.shadowRoot);
    return roots;
  }
  const asHeld = (text) => text.replace(HOVER_RE, `[${HOVER_ATTR}]`);
  /** What a group says before its `{` — `@media …`, `@layer x`, a nesting rule's selector. */
  const prelude = (rule) => {
    const text = rule.cssText;
    const at = text.indexOf("{");
    return at < 0 ? "" : asHeld(text.slice(0, at).trim());
  };
  /** Every `:hover` rule under `rules` — groups, nests and imports — with its copy's text. */
  function hoverScan(rules, around, read) {
    for (const rule of rules) {
      read.size += 1;
      if (rule.styleSheet) {
        try {
          hoverScan(rule.styleSheet.cssRules, around, read);
        } catch {
          hover.skipped += 1;
        }
      }
      const sel = rule.selectorText;
      if (typeof sel === "string" && SAYS_HOVER.test(sel)) {
        /* a rule with rules nested in it is copied whole, their `:hover` said the same way */
        const text =
          rule.cssRules && rule.cssRules.length > 0
            ? asHeld(rule.cssText)
            : `${asHeld(sel)}{${rule.style.cssText}}`;
        let wrapped = text;
        for (let i = around.length - 1; i >= 0; i--) wrapped = `${around[i]}{${wrapped}}`;
        read.hits.push({ rule, text, wrapped });
      }
      if (rule.cssRules && rule.cssRules.length > 0)
        hoverScan(rule.cssRules, [...around, prelude(rule)], read);
    }
  }
  /** What `sheet` holds of `:hover`, read again only when its count of rules has changed. */
  function hoverHits(sheet) {
    if (sheet === null || sheet === still.sheet) return null;
    let rules;
    try {
      rules = sheet.cssRules;
    } catch {
      /* another origin's sheet: unreadable, left alone */
      hover.skipped += 1;
      return null;
    }
    const kept = hoverRead.get(sheet);
    if (kept !== undefined && kept.n === rules.length) return kept;
    const read = { n: rules.length, size: 0, hits: [] };
    hoverScan(rules, [], read);
    hoverRead.set(sheet, read);
    return read;
  }
  const sheetsOf = (roots) => {
    const out = [];
    for (const root of roots) {
      for (const sheet of root.styleSheets ?? []) out.push(sheet);
      for (const sheet of root.adoptedStyleSheets ?? []) out.push(sheet);
    }
    return out;
  };
  /** Read every sheet ahead of the press, once the page is idle (under a studio only). */
  function readAhead() {
    if (hover.on) return;
    for (const sheet of sheetsOf(openRoots())) quietly(hoverHits)(sheet);
  }
  if (studio !== null) {
    const idle = () =>
      typeof window.requestIdleCallback === "function"
        ? window.requestIdleCallback(quietly(readAhead), { timeout: 2000 })
        : setTimeout(quietly(readAhead), 200);
    if (document.readyState === "complete") idle();
    else addEventListener("load", idle, { once: true });
  }
  /** Hold what is hovered: the chain read, the copies put in place, the stamps on. Returns the
   *  copies of the big sheets' rules, for the one sheet of ours (`hushAll`). */
  function holdHover(roots) {
    hover.on = true;
    hover.skipped = 0;
    for (const root of roots)
      for (const el of root.querySelectorAll(":hover")) if (!ours(el)) hover.els.push(el);
    /* in place: grouped by the list they go into, each right after its original — from the last
       place up, so every index read before the first insert is still right */
    const by = new Map();
    let extra = "";
    /* NOTHING HOVERED, NOTHING TO HOLD: the pointer was outside this document — on the page's own
       Comment button, the common case — and no rule is copied at all */
    const sheets = hover.els.length === 0 ? [] : sheetsOf(roots);
    for (const sheet of sheets) {
      const read = quietly(hoverHits)(sheet);
      if (read === null || read === undefined || read.hits.length === 0) continue;
      if (read.size > IN_PLACE) {
        for (const hit of read.hits) extra += `${hit.wrapped}\n`;
        continue;
      }
      for (const hit of read.hits) {
        const into = hit.rule.parentRule ?? hit.rule.parentStyleSheet;
        if (into === null || typeof into.insertRule !== "function") continue;
        if (!by.has(into)) by.set(into, []);
        by.get(into).push(hit);
      }
    }
    for (const [into, hits] of by) {
      const at = new Map();
      const list = into.cssRules;
      for (let i = 0; i < list.length; i++) at.set(list[i], i);
      const places = hits
        .map((hit) => ({ hit, i: at.get(hit.rule) }))
        .filter((p) => p.i !== undefined)
        .sort((a, b) => b.i - a.i);
      for (const { hit, i } of places)
        quietly(() => {
          into.insertRule(hit.text, i + 1);
          hover.copies.push({ into, rule: into.cssRules[i + 1] });
        })();
    }
    for (const el of hover.els) el.setAttribute(HOVER_ATTR, "");
    return extra;
  }
  function dropHover() {
    if (!hover.on) return;
    hover.on = false;
    const by = new Map();
    for (const { into, rule } of hover.copies.splice(0)) {
      if (!by.has(into)) by.set(into, new Set());
      by.get(into).add(rule);
    }
    for (const [into, copies] of by)
      quietly(() => {
        const list = into.cssRules;
        for (let i = list.length - 1; i >= 0; i--) if (copies.has(list[i])) into.deleteRule(i);
      })();
    for (const el of hover.els.splice(0)) el.removeAttribute(HOVER_ATTR);
    /* the engine's own `:hover` takes over from where the pointer is: a box may have opened or
       closed with no record of it */
    restyled();
  }

  /* THE WHEEL STILL SCROLLS WHAT IS UNDER IT. Over the shield the engine's own scroll starts at the
     shield, whose only scroller is the viewport — so the document scrolls natively, and an inner
     scroller (a panel, a list, a horizontal strip) would not scroll at all. So, frozen, the scroller
     the pointer is over is found BY THE POINT, the way the engine would chain: per axis, the
     innermost box under it that the person could scroll that way (`overflow: auto | scroll`, room
     left in that direction), stopping where an `overscroll-behavior` keeps the wheel in. When that
     is the viewport for both axes the wheel keeps its default and the document scrolls natively,
     momentum and smoothing included; otherwise the default is cancelled and that box is scrolled
     by the wheel's own delta. A scroller that snaps is scrolled once per gesture, to its next snap
     point that way, as the engine's own wheel would. */
  const snapAt = new WeakMap();
  /* NON-PASSIVE ONLY WHILE FROZEN. A non-passive `wheel` listener on `window` makes every scroll of
     the page wait for this document's main thread — Browse with 200 notes fell under the T9 bar
     with one there always. So the router is added at the freeze and taken away at the release, and
     while nothing is frozen every wheel listener of ours is passive. */
  const routing = quietly((event) => {
    routeWheel(event);
    evStopNow(event);
  });
  let routed = false;
  function router(on) {
    if (on === routed) return;
    routed = on;
    apply(on ? addListener : removeListener, window, [
      "wheel",
      routing,
      { capture: true, passive: false },
    ]);
  }
  function routeWheel(event) {
    if (!hover.on || !event.cancelable || event.defaultPrevented) return;
    let dx = event.deltaX;
    let dy = event.deltaY;
    if (event.deltaMode === 1) {
      dx *= 16;
      dy *= 16;
    } else if (event.deltaMode === 2) {
      dx *= window.innerWidth;
      dy *= window.innerHeight;
    }
    if (event.shiftKey && dx === 0) {
      dx = dy;
      dy = 0;
    }
    const start = pageAt(event.clientX, event.clientY);
    if (start === null) return;
    const tx = dx === 0 ? null : scrollerFor(start, "x", dx);
    const ty = dy === 0 ? null : scrollerFor(start, "y", dy);
    const root = document.scrollingElement ?? document.documentElement;
    const inner = (t) => t !== null && t !== "stop" && t !== root && t !== document.body;
    if (!inner(tx) && !inner(ty) && tx !== "stop" && ty !== "stop") return;
    evCancel(event);
    const by = (t, left, top) => {
      if (t === null || t === "stop") return;
      if (!inner(t)) {
        window.scrollBy({ left, top, behavior: "instant" });
        return;
      }
      if (getComputedStyle(t).scrollSnapType.startsWith("none") === false) {
        const now = Date.now();
        if (now - (snapAt.get(t) ?? 0) < 400) {
          snapAt.set(t, now);
          return;
        }
        snapAt.set(t, now);
        t.scrollBy({
          left: Math.sign(left) * t.clientWidth * 0.5,
          top: Math.sign(top) * t.clientHeight * 0.5,
        });
        return;
      }
      t.scrollBy({ left, top, behavior: "instant" });
    };
    if (tx === ty) by(tx, dx, dy);
    else {
      by(tx, dx, 0);
      by(ty, 0, dy);
    }
  }
  /** The box a wheel at `start` scrolls along `axis` by `d`: the element, the viewport (`root`),
   *  "stop" where an overscroll boundary keeps it in, or null when nothing can move. */
  function scrollerFor(start, axis, d) {
    const root = document.scrollingElement ?? document.documentElement;
    for (let el = start; el instanceof Element; ) {
      if (el === root || el === document.body || el === document.documentElement) break;
      const cs = getComputedStyle(el);
      const ov = axis === "x" ? cs.overflowX : cs.overflowY;
      if (ov === "auto" || ov === "scroll" || ov === "overlay") {
        const pos = axis === "x" ? el.scrollLeft : el.scrollTop;
        const max =
          axis === "x" ? el.scrollWidth - el.clientWidth : el.scrollHeight - el.clientHeight;
        if (max > 0 && (d > 0 ? pos < max - 0.5 : pos > 0.5)) return el;
        const ob = axis === "x" ? cs.overscrollBehaviorX : cs.overscrollBehaviorY;
        if (max > 0 && ob !== undefined && ob !== "" && ob !== "auto") return "stop";
      }
      const r = el.getRootNode();
      el = el.assignedSlot ?? el.parentElement ?? (r instanceof ShadowRoot ? r.host : null);
    }
    const pos = axis === "x" ? window.scrollX : window.scrollY;
    const max =
      axis === "x" ? root.scrollWidth - window.innerWidth : root.scrollHeight - window.innerHeight;
    return d > 0 ? (pos < max - 0.5 ? root : null) : pos > 0.5 ? root : null;
  }

  /* EVERY MESSAGE CARRIES THE WIDTH THIS DOCUMENT WAS ACTUALLY LAID OUT AT, and the studio's pins
     are placed with it. It is not the width the studio asked for.

     The studio frames a screen at `width: <viewport>px` and draws each pin at `rect * k` in ITS
     own CSS pixels, which is right only while the framed document's viewport IS that width.
     WebKit makes it the frame's DEVICE width instead: a CSS `zoom` on the studio's <html> — which
     is exactly what Settings > Appearance's zoom sets — multiplies the viewport of every document
     inside it. Measured 2026-09-17, one 1440-px frame under `zoom: 1.2`:

                              Safari 18.2    Chrome 153
       window.innerWidth         1728           1440     <- what this document was given
       devicePixelRatio             1            1.2
       an element's rect.x        584            440     <- the SAME element

     Both are self-consistent: Safari enlarged the viewport and paints it 1:1 with device pixels,
     Chrome kept 1440 and paints each CSS pixel as 1.2. But the coordinates differ, and a studio
     that assumes 1440 puts every pin `zoom` times too far from the frame's top-left corner and
     draws it `zoom` times too big. That is the misplaced comment box: it is right in the browser
     (`bun run up` is Chrome) and wrong in the app's own window, which is WKWebView on macOS and
     WebKitGTK on Linux.

     `innerWidth` and not `documentElement.clientWidth`: both engines agree on it, and it counts a
     classic scrollbar the same way the frame's own box does, so the ratio stays exact on a screen
     that scrolls. Everything INSIDE this file stays in the document's own coordinates — hit
     testing, `data-states` and the outline all speak them; only the studio needs the ratio. */
  /* THE SIZE THE PAGE LAST GAVE THIS FRAME (v19, plan 73 D7): `studio:size {seq}`, echoed on
     every message. A report the page reads is one it can tie to the size it asked for: two reports
     in flight across a change used to be read as a 2x zoom, and the frame was laid out at 3368 px
     for a frame on the way to 1600. */
  const size = { seq: 0 };

  /** `now`: the widths and the scroll read already — a measure reads them before it paints the
   *  marks, so nothing it posts reads layout after a write (§11). */
  const viewNow = () => {
    const inner = innerNow();
    return {
      width: window.innerWidth,
      layout: layoutWidth(),
      scroll: [Math.round(window.scrollX), Math.round(window.scrollY)],
      where: whereNow(),
      ...(inner.length === 0 ? {} : { inner }),
      ...(anchorEl() === null ? {} : { anchor: true }),
    };
  };
  /* THE PLACE (v26, plan 77 D1-D3). `where` is the fragment as the browser gives it — a deck routed
     by `#` is at its slide through it — and a longer one is no fragment (the page drops it too). */
  const WHERE_MAX = 256;
  const whereNow = () => {
    const h = location.hash;
    return h.length > WHERE_MAX ? "" : h;
  };
  /* AN IN-PAGE ANCHOR (v38, plan 77 §32): `#faq` on a long page is where the reader is on THIS
     page — the element it names, when that element SHOWS (v25's test) and is no slide of a deck (a
     slide's id is a route: the fragment is the deck's position). Then the scroll position says where
     the reader is, and the fragment is carried by nothing. `fragment` is any `#…`; null for none. */
  const anchorEl = (fragment = location.hash) => {
    if (fragment.length < 2 || fragment.length > WHERE_MAX) return null;
    let el = null;
    try {
      el = document.getElementById(decodeURIComponent(fragment.slice(1)));
    } catch {
      return null;
    }
    if (el === null || ours(el) || !showsEl(el)) return null;
    const p = el.parentElement;
    return p !== null && isDeck(p, el) ? null : el;
  };
  /* The elements that scroll INSIDE the page, remembered by their scroll events: at most eight,
     the latest last; one scrolled back to its origin, one gone from the document and one of ours
     is dropped. The selector is `selectorOf`'s — the one a pin is found by — kept per element for
     as long as the document is the generation it was made in. */
  const INNER_MAX = 8;
  const scrollers = [];
  const innerSel = new WeakMap();
  const noteScroller = (el) => {
    const at = scrollers.indexOf(el);
    if (at !== -1) scrollers.splice(at, 1);
    if (el.scrollLeft === 0 && el.scrollTop === 0) return;
    scrollers.push(el);
    if (scrollers.length > INNER_MAX) scrollers.shift();
  };
  const innerNow = () => {
    const out = [];
    for (let i = scrollers.length - 1; i >= 0; i--) {
      const el = scrollers[i];
      if (!el.isConnected) {
        scrollers.splice(i, 1);
        continue;
      }
      const x = Math.round(el.scrollLeft);
      const y = Math.round(el.scrollTop);
      if (x === 0 && y === 0) {
        scrollers.splice(i, 1);
        continue;
      }
      let sel = "";
      try {
        const kept = innerSel.get(el);
        if (kept !== undefined && kept.gen === generationOf()) sel = kept.sel;
        else {
          sel = selectorOf(el);
          innerSel.set(el, { gen: generationOf(), sel });
        }
      } catch {
        sel = "";
      }
      if (sel !== "" && sel.length <= 512) out.unshift([sel, x, y]);
    }
    return out;
  };
  /* `generation` is declared further down (the anchors'); a message posted before it exists reads 0 */
  const generationOf = () => {
    try {
      return generation;
    } catch {
      return 0;
    }
  };
  /* NOTHING OF OURS IS THROWN INTO THE PAGE (plan 73 round 3, T4). This file runs in somebody
     else's document, on code paths the page drives — its animations, its zoom, its DOM — and an
     error escaping one of our listeners or callbacks is an error in THEIR page: their `onerror`,
     their console, their error tracker, and a paint stopped half way (a scroll-driven reveal threw
     a TypeError and every mark after it stayed where it was). So every entry point the page can
     reach — a message, a listener, an observer, an animation frame — runs `quietly`: a fault is
     said once on the console, as ours, and swallowed. */
  const faults = new Set();
  function quietly(fn) {
    return function run(...args) {
      try {
        return apply(fn, this, args);
      } catch (error) {
        const said = String(error?.message ?? error).slice(0, 160);
        if (faults.has(said) || faults.size >= 8) return undefined;
        faults.add(said);
        try {
          console.warn(`studio-bridge: ${said}`);
        } catch {
          /* no console */
        }
        return undefined;
      }
    };
  }

  function post(type, detail, now = null) {
    if (studio === null) return false;
    try {
      const view = now ?? viewNow();
      const msg = {
        type,
        ...view,
        seq: size.seq,
        ...detail,
      };
      /* A PICK OR AN AREA AT AN IN-PAGE ANCHOR names no fragment (v38, plan 77 §32 Q1): its pin
         would be judged "on another route" the moment the reader clicked another anchor */
      if (view.anchor === true && (type === "studio:picked" || type === "studio:drawn"))
        delete msg.where;
      parentWin.postMessage(msg, studio);
      return true;
    } catch {
      /* the parent went away mid-navigation */
      return false;
    }
  }

  /**
   * The width this document's LAYOUT happened in — what `@media (max-width: …)` was answered
   * against, which is not always `width` above and not always what the studio framed us at.
   *
   * TWO NUMBERS BECAUSE THERE ARE TWO QUESTIONS, and one number answered them both wrongly.
   * `width` (the VISUAL viewport) is how the frame is PAINTED, and it is what puts a pin on the
   * thing you clicked. This is how the frame is LAID OUT, and it is what decides which breakpoint
   * a designer is actually looking at. Under a studio `zoom: 1.2` the two engines disagree about
   * both, and they disagree differently:
   *
   *                                  Safari 18.2   Safari 26     Chrome 153
   *     window.innerWidth               1728          1440          1440
   *     documentElement.clientWidth     1728          1728          1440
   *     `(max-width: 1440px)` matched    no            no            YES
   *
   * BOTH WebKits lay a 1440-px frame out at 1728 — the zoom leaks in, and Safari 26 has not
   * fixed it, it has only stopped saying so in `innerWidth`. That is the trap: a repro that reads
   * `innerWidth` on a newer WebKit reports a viewport that is correct and a layout that is not.
   * The studio divides what it asked for by this and re-frames, so the breakpoint is the one on
   * the caption.
   *
   * `Math.max` of the two: `clientWidth` is the layout viewport but drops a CLASSIC scrollbar's
   * width, and `innerWidth` keeps it. macOS and GTK both use overlay scrollbars, so they agree
   * there; the max is what keeps a host with classic ones from shrinking the frame every time a
   * screen grows tall enough to scroll.
   */
  function layoutWidth() {
    const de = document.documentElement;
    return Math.max(de === null ? 0 : de.clientWidth, window.innerWidth);
  }

  /** Every `data-go` the DOM actually carries — the RUNTIME edge set, which the studio draws in
   *  amber where the source scan did not see it. */
  const links = () =>
    [...document.querySelectorAll("[data-go]")].map((el) => ({
      to: el.getAttribute("data-go"),
      text: (el.textContent || "").trim().slice(0, 60),
      path: pathOf(el),
    }));

  /* WHAT THE PAGE BROKE THAT POINTING NEEDS (v24). The DOM's own methods are not captured — a
     page may wrap them and a harmless wrapper is not a fault — so each is ASKED, once, a question
     with a known answer, after the page's first scripts have run. The first that answers wrongly
     or throws is named on `studio:ready` (`broken`), and the page turns Comment off with that
     name, where it used to stay lit and do nothing (fixtures/overrides.html). */
  function brokenNative() {
    const probes = [
      ["Array.prototype.map", () => [1, 2].map((x) => x * 2)[1] === 4],
      ["Array.prototype.filter", () => [1, 2].filter((x) => x > 1).length === 1],
      ["Array.prototype.find", () => [1, 2].find((x) => x > 1) === 2],
      ["Array.prototype.some", () => [1, 2].some((x) => x > 1) === true],
      ["Array.prototype.includes", () => [1, 2].includes(2) === true],
      ["Array iteration", () => [...[1, 2]].length === 2],
      ["querySelectorAll", () => document.querySelectorAll(":root")[0] === html],
      ["querySelector", () => document.querySelector("html") === html],
      ["Element.querySelectorAll", () => html.querySelectorAll("html").length === 0],
      ["getComputedStyle", () => typeof getComputedStyle(html).display === "string"],
      [
        "getBoundingClientRect",
        () => {
          const r = html.getBoundingClientRect();
          return Number.isFinite(r.width) && r.width >= 0 && Number.isFinite(r.top);
        },
      ],
      [
        "elementsFromPoint",
        () =>
          typeof document.elementsFromPoint !== "function" ||
          Array.isArray(document.elementsFromPoint(0, 0)),
      ],
    ];
    for (let i = 0; i < probes.length; i++) {
      const probe = probes[i];
      try {
        if (probe[1]() !== true) return probe[0];
      } catch {
        return probe[0];
      }
    }
    return "";
  }

  /** Each field of `studio:ready` on its own: a page that broke one never silences the rest. */
  const fieldOf = (fn, otherwise) => {
    try {
      return fn();
    } catch {
      return otherwise;
    }
  };

  function ready() {
    const root = fieldOf(() => document.querySelector("[data-screen]"), null);
    post("studio:ready", {
      screen: fieldOf(screenId, ""),
      /* THE FILE ON SCREEN (v20, D16): a link followed in here moves the page's address with it. */
      file: (() => {
        try {
          return decodeURIComponent(location.pathname);
        } catch {
          return location.pathname;
        }
      })(),
      states: fieldOf(
        () => (root?.getAttribute("data-states") || "").split(/\s+/).filter(Boolean),
        [],
      ),
      variant: html.dataset.variant || null,
      state: html.dataset.state || null,
      theme: html.dataset.theme || null,
      links: fieldOf(links, []),
      broken: brokenNative(),
      /* THIS BRIDGE PAINTS THE REVIEW'S MARKS ITSELF (v22, §11): a page that hears it sends
         `studio:marks` and keeps only its click targets; one that does not draws as before */
      marks: true,
    });
  }

  /** The file this document shows, from its own `location` (unforgeable) — `studio:here`. */
  const fileHere = () => {
    try {
      return apply(decodeNative, window, [location.pathname]);
    } catch {
      return location.pathname;
    }
  };

  /* ---------------------------------------------------------- 16. the page can ask to answer (v39, plan 79)

     A HANDSHAKE, NOT A GLOBAL: nothing is defined on `window`. A page dispatches `harbor:hello` and
     is answered, synchronously, by `harbor:answers` with a frozen `{on, answer}`; the same event
     comes again on every change of `on`. Only under a studio. See the header's item 16 for what it
     is and what it is not (a lock). Everything it leans on is the browser's own, captured now. */
  const ANSWER = {
    depth: 8,
    nodes: 2000,
    string: 4000,
    key: 200,
    json: 16384,
    label: 120,
    activation: 5000,
  };
  const ANSWER_NAME = /^[A-Za-z0-9._-]{1,64}$/;
  const ANSWER_ID = /^a[0-9a-z]{10}$/;
  /* WHAT A LABEL NEVER KEEPS (plan 79 A5): every control (Cc), format (Cf — the bidi overrides and
     isolates, zero-width characters, the BOM) and line or paragraph separator (Zl, Zp: U+2028/9).
     None is visible, and several reorder or break the text around them, so the card and the turn
     would read as words nobody typed. `webview/src/model.ts` has the same expression. */
  const LABEL_STRIP = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu;
  /* A LABEL CANNOT CLOSE THE QUOTE IT IS PUT IN (plan 79 B9): the card and the turn quote it with
     “…”; each quotation mark in it is an apostrophe. `webview/src/model.ts` has the same expression. */
  const LABEL_QUOTES = /["\u201C\u201D]/g;
  const ObjectProto = Object.prototype;
  const ArrayProto = Array.prototype;
  const protoOf = Object.getPrototypeOf;
  const keysOf = Object.keys;
  const isArray = Array.isArray;
  const defineOwn = Object.defineProperty;
  const isFiniteNumber = Number.isFinite;
  const dateNow = Date.now.bind(Date);
  const Uint8 = window.Uint8Array;
  const NativeCustomEvent = window.CustomEvent;
  const nativeDispatch = EventTarget.prototype.dispatchEvent;
  const nativeCrypto = window.crypto;
  const randomBytes =
    nativeCrypto && typeof nativeCrypto.getRandomValues === "function"
      ? nativeCrypto.getRandomValues
      : null;
  const userActivation = (() => {
    try {
      return window.navigator.userActivation || null;
    } catch {
      return null;
    }
  })();
  let answersOn = false;
  let lastGesture = -Infinity;

  /* A PRESS IN THIS PAGE, RECORDED (plan 79 B5): a trusted `click` or `pointerup` heard here, before
     any of the page's listeners. A keyboard press of a control makes a trusted `click`; typing in a
     field makes none, so it never counts. A press made in Harbor's chrome fires nothing in this
     document — which is the point: an engine's own activation flag is shared with the frame by a
     key pressed in the PARENT while the frame was still loading (measured, Chromium), and that is
     no press in the page. Never for a press meant for the review (pointing, drawing, holding,
     editing: the page never saw it). */
  for (const type of ["pointerup", "click"])
    window.addEventListener(
      type,
      quietly((event) => {
        if (event.isTrusted !== true || aimingNow()) return;
        lastGesture = dateNow();
      }),
      { capture: true, passive: true },
    );

  /** Did the person press something in THIS page a moment ago? The engine's own activation (where it
   *  has one) AND this file's record of a click here: either alone is not enough. */
  function activated() {
    if (userActivation !== null && typeof userActivation.isActive === "boolean")
      if (!userActivation.isActive) return false;
    return dateNow() - lastGesture < ANSWER.activation;
  }

  /** A label as a card shows it: control, format and separator characters stripped, every quotation
   *  mark an apostrophe, at most 120 characters, never a surrogate pair cut in half.
   *  `webview/src/model.ts` has the same rule. */
  function tidyLabel(raw) {
    const s = raw.replace(LABEL_STRIP, "").replace(LABEL_QUOTES, "'");
    if (s.length <= ANSWER.label) return s;
    const cut = s.slice(0, ANSWER.label);
    const last = cut.charCodeAt(cut.length - 1);
    return last >= 0xd800 && last <= 0xdbff ? cut.slice(0, -1) : cut;
  }

  /** A string that JSON writes as itself between two quotes: no quote, backslash, control character
   *  or surrogate (a pair is fine in JSON, a lone half is escaped — either way the slow path's). */
  // biome-ignore lint/suspicious/noControlCharactersInRegex: the control characters are what is looked for
  const JSON_BARE = /^[^"\\\u0000-\u001f\ud800-\udfff]*$/;
  const testBare = RegExp.prototype.test;
  /** `JSON.stringify(s).length`, without encoding the common string at all. */
  const quoted = (s) => (apply(testBare, JSON_BARE, [s]) ? s.length + 2 : json.stringify(s).length);

  /** Why a value is refused: a sentence, thrown by `plainValue`'s walk and caught by it. */
  function Refusal(why) {
    this.why = why;
  }

  /**
   * A PLAIN-JSON COPY OF `value`, or why not (D2). The copy is made WHILE it is checked and is what
   * is posted, so a getter, a proxy or a mutation between the check and the post cannot send
   * something else. Allowed: null, a boolean, a finite number, a string, an array, an object whose
   * prototype is `Object.prototype` or null. Everything else — undefined, NaN, ±Infinity, bigint,
   * function, symbol, a Date, a Map, a typed array, a class instance, a cycle — is refused.
   *
   * REFUSED EARLY (plan 79 A8): the walk keeps a running count of what the value's compact JSON
   * would be, byte for byte (`[`, `,`, `"key":` and each scalar as `JSON.stringify` writes it), and
   * stops at the first character past 16384 — a value is never serialised whole to find out it is
   * too big. A string is at most 4000 characters before it is ever encoded, so the encoding that is
   * done is bounded.
   */
  function plainValue(value) {
    const seen = [];
    let nodes = 0;
    let spent = 0;
    const plain = () => new Refusal("not plain data");
    const spend = (n) => {
      spent += n;
      if (spent > ANSWER.json) throw new Refusal(`too large (more than ${ANSWER.json / 1024} KB)`);
    };
    const walk = (v, depth) => {
      nodes += 1;
      if (nodes > ANSWER.nodes) throw new Refusal(`too large (more than ${ANSWER.nodes} values)`);
      if (v === null || typeof v === "boolean") {
        spend(v === null || v ? 4 : 5);
        return v;
      }
      if (typeof v === "number") {
        if (!isFiniteNumber(v)) throw plain();
        spend(`${v}`.length);
        return v;
      }
      if (typeof v === "string") {
        if (v.length > ANSWER.string)
          throw new Refusal(`too large (a text of more than ${ANSWER.string} characters)`);
        spend(quoted(v));
        return v;
      }
      if (typeof v !== "object") throw plain();
      if (depth >= ANSWER.depth) throw new Refusal("nested too deeply");
      for (let i = 0; i < seen.length; i++) if (seen[i] === v) throw plain();
      const proto = protoOf(v);
      let out;
      seen.push(v);
      spend(2);
      if (isArray(v)) {
        if (proto !== ArrayProto) throw plain();
        const n = v.length;
        if (n > ANSWER.nodes) throw new Refusal(`too large (more than ${ANSWER.nodes} values)`);
        out = [];
        for (let i = 0; i < n; i++) {
          if (i > 0) spend(1);
          out.push(walk(v[i], depth + 1));
        }
      } else {
        if (proto !== ObjectProto && proto !== null) throw plain();
        out = {};
        const names = keysOf(v);
        for (let i = 0; i < names.length; i++) {
          const key = names[i];
          if (key.length > ANSWER.key)
            throw new Refusal(`too large (a name of more than ${ANSWER.key} characters)`);
          if (i > 0) spend(1);
          spend(quoted(key) + 1);
          /* DEFINED, never assigned: a key called `__proto__` is data here, not a prototype */
          defineOwn(out, key, {
            value: walk(v[key], depth + 1),
            enumerable: true,
            writable: true,
            configurable: true,
          });
        }
      }
      seen.pop();
      return out;
    };
    try {
      return { ok: true, value: walk(value, 0) };
    } catch (error) {
      return { ok: false, why: error instanceof Refusal ? error.why : "not plain data" };
    }
  }

  /** `a` and ten base36 characters, uniformly (a byte past 251 is dropped, not wrapped), or "". */
  function freshId() {
    if (randomBytes === null || Uint8 === undefined) return "";
    let out = "a";
    for (let tries = 0; out.length < 11 && tries < 16; tries++) {
      const bytes = apply(randomBytes, nativeCrypto, [new Uint8(16)]);
      for (let i = 0; i < bytes.length && out.length < 11; i++)
        if (bytes[i] < 252) out += (bytes[i] % 36).toString(36);
    }
    return out.length === 11 ? out : "";
  }

  /** One word on the console, ours, and `false`. */
  function declined(reason) {
    try {
      console.warn(`harbor.answer: ${reason}`);
    } catch {
      /* no console */
    }
    return false;
  }

  /** `harbor.answer(value, {name, label})` — a boolean, never a throw. */
  function answer(value, opts) {
    try {
      if (!answersOn) return declined("this page cannot send an answer here");
      if (!activated()) return declined("an answer needs a click on the page first");
      const checked = plainValue(value);
      if (!checked.ok) return declined(`the answer is ${checked.why}`);
      let name = "";
      let label = "";
      if (opts !== undefined && opts !== null) {
        if (typeof opts !== "object") return declined("the options must be an object");
        const named = opts.name;
        if (named !== undefined) {
          if (typeof named !== "string" || !ANSWER_NAME.test(named))
            return declined("name must be 1 to 64 letters, digits, dots, dashes or underscores");
          name = named;
        }
        const said = opts.label;
        if (said !== undefined) {
          if (typeof said !== "string") return declined("label must be a string");
          label = tidyLabel(said);
        }
      }
      const id = freshId();
      if (id === "") return declined("no source of random numbers");
      return post("studio:answer", { id, name, label, value: checked.value });
    } catch (error) {
      /* a getter of the page's own that threw, a browser without what this leans on: said, not thrown */
      return declined(
        `could not read the answer (${String(error?.message ?? error).slice(0, 120)})`,
      );
    }
  }

  /** An event on `window`, made and sent with the browser's own. */
  function tell(type, detail) {
    apply(nativeDispatch, window, [new NativeCustomEvent(type, { detail })]);
  }

  /** What `harbor:answers` carries: whether the page that holds this frame accepts answers from it,
   *  and the function that gives one. Frozen, and made fresh for each event. */
  const answersDetail = () => Object.freeze({ on: answersOn, answer });

  /** `studio:answers {on}` — whether answering is on; the event goes out on a change only. */
  function answersFrom(msg) {
    if (typeof msg.on !== "boolean" || msg.on === answersOn) return;
    answersOn = msg.on;
    tell("harbor:answers", answersDetail());
  }

  /** `studio:answered {id, state}` — what became of an answer, as an event the page may hear. */
  function answeredFrom(msg) {
    const state = msg.state;
    if (typeof msg.id !== "string" || !ANSWER_ID.test(msg.id)) return;
    if (state !== "sent" && state !== "discarded" && state !== "replaced" && state !== "failed")
      return;
    tell("harbor:answered", { id: msg.id, state });
  }

  /* THE HANDSHAKE (plan 79 A4): a page says `harbor:hello` and is answered, at once, in the same
     task, by `harbor:answers`. Registered here — before any script of the page's runs, in the
     capture phase — so a hello is heard wherever the page sent it, and the answer is ready by the
     time `dispatchEvent` returns. With no studio there is nobody to answer for, and nothing listens. */
  if (studio !== null)
    window.addEventListener(
      "harbor:hello",
      quietly(() => tell("harbor:answers", answersDetail())),
      true,
    );

  if (studio !== null) {
    /* FIRST, IN THE CAPTURE PHASE, AND ALONE (v24, H2): this listener is registered before any of
       the page's, and a message from the studio is stopped here, so no listener of the page's —
       on `window`, capturing or not, or `onmessage` — ever hears what the studio says to us. That
       is what lets `studio:who`'s secret prove the answer is ours. */
    window.addEventListener(
      "message",
      quietly((event) => {
        if (
          fieldOfMessage(event, "origin") !== studio ||
          fieldOfMessage(event, "source") !== parentWin
        )
          return;
        evStopNow(event);
        const msg = fieldOfMessage(event, "data");
        if (msg === null || typeof msg !== "object") return;
        if (msg.type === "studio:who") {
          const nonce = typeof msg.nonce === "string" ? msg.nonce.slice(0, 128) : "";
          if (nonce !== "") post("studio:here", { nonce, file: fileHere() });
          return;
        }
        if (msg.type === "studio:set") {
          const q = new URLSearchParams(location.search);
          for (const key of DIMENSIONS)
            if (msg[key] !== undefined && msg[key] !== null) q.set(key, msg[key]);
          if (stamp(`?${q}`)) {
            history.replaceState(null, "", `${location.pathname}?${q}`);
            announce();
          }
          return;
        }
        if (msg.type === "studio:pick") setPick(Boolean(msg.on), msg);
        else if (msg.type === "studio:edit") setEdit(Boolean(msg.on), msg.vocab ?? null, msg.seed);
        else if (msg.type === "studio:flush") flushFrom(msg);
        else if (msg.type === "studio:editopt") setOpts(msg);
        else if (msg.type === "studio:draw") setDraw(Boolean(msg.on), msg);
        else if (msg.type === "studio:flash") flash(String(msg.path || ""));
        else if (msg.type === "studio:rects") {
          delta = msg.delta === true;
          wheresFrom(msg.wheres);
          watch(Array.isArray(msg.ids) ? msg.ids : []);
        } else if (msg.type === "studio:size") sizeFrom(msg);
        else if (msg.type === "studio:hold") setHold(Boolean(msg.on));
        else if (msg.type === "studio:reveal") reveal(typeof msg.id === "string" ? msg.id : "");
        else if (msg.type === "studio:trait") fromRail(msg, () => applyTrait(msg.attr, msg.value));
        else if (msg.type === "studio:act") act(msg);
        else if (msg.type === "studio:select") selectFrom(msg);
        else if (msg.type === "studio:hover") hoverFrom(msg);
        else if (msg.type === "studio:scroll") scrollFrom(msg);
        else if (msg.type === "studio:go") goFrom(msg);
        else if (msg.type === "studio:print") slidePrintFrom();
        else if (msg.type === "studio:pickat") pickAt(msg);
        else if (msg.type === "studio:marks") marksFrom(msg);
        else if (msg.type === "studio:answers") answersFrom(msg);
        else if (msg.type === "studio:answered") answeredFrom(msg);
      }),
      true,
    );
  }

  /** Is this a fragment the page may send us — "" or `#…`, at most 256 characters, no control
   *  character? (`bridge.ts`'s `validWhere`, the other end of the seam.) */
  const validWhere = (v) => {
    if (typeof v !== "string" || v.length > WHERE_MAX) return false;
    if (v === "") return true;
    if (v[0] !== "#") return false;
    for (let i = 0; i < v.length; i++) if (v.charCodeAt(i) < 0x20) return false;
    return true;
  };
  /* A SEQUENCE NUMBER ON EVERY ASK TO MOVE (plan 77 D4): a second `studio:scroll` or `studio:go`
     while the first still waits on its `hashchange` or its frame supersedes it — the stale one does
     nothing and posts nothing. */
  let moveSeq = 0;
  /* THE WAIT FOR A FRAGMENT IS ONE PERMANENT LISTENER AND NO FRAME (v27, plan 77 F1). A listener
     added per move and a `requestAnimationFrame` after it stalled in a window that was not
     painting — a hidden pane, a frame behind the one on screen — and the swap waited on it for
     ever. So ONE `hashchange` listener is registered when this file starts (the first child of
     `<head>`: before any script of the page can add its router), in the capture phase, and a move
     only registers its continuation with it. The continuation runs as ONE TASK of our own
     (`MessageChannel`), so every other `hashchange` listener — the deck's router — has run first;
     a task, never a frame and never a timer. */
  const NativeChannel = window.MessageChannel;
  /** Run `fn` as a task of its own, after everything already queued. No channel: at once. */
  function afterTask(fn) {
    try {
      const mc = new NativeChannel();
      mc.port1.onmessage = quietly(() => {
        mc.port1.onmessage = null;
        mc.port1.close();
        fn();
      });
      mc.port2.postMessage(0);
    } catch {
      fn();
    }
  }
  let arriving = null;
  /* THE READER MOVES: one permanent `hashchange` listener, in capture, registered before the page's
     own (F1) — it runs the continuation a move registered as ONE TASK of ours, after every other
     listener (the deck's router) has had its say, and, for the pins, marks the page unsettled until
     it has had its first frame after the event (a hidden document has none coming: the task
     alone). A later `hashchange` supersedes a settling still waiting. */
  let settling = 0;
  const recountSoon = () => {
    const mine = ++settling;
    const close = () =>
      afterTask(
        quietly(() => {
          if (mine === settling) {
            hashSettling = false;
            if (watched.length > 0) measureSoon();
          }
        }),
      );
    if (document.visibilityState === "hidden") close();
    else requestAnimationFrame(quietly(close));
  };
  addListener.call(
    window,
    "hashchange",
    quietly(() => {
      /* v36, O2: a pin's slide is not derived until the page has laid this fragment out */
      if (wheres.size > 0) {
        hashSettling = true;
        recountSoon();
      }
      const next = arriving;
      arriving = null;
      if (next !== null) afterTask(quietly(next));
    }),
    true,
  );
  /** Go to a fragment and call `then` once the page has had its say: a fragment-only
   *  `location.replace` (no history entry; `hashchange` fires), then the permanent listener's task,
   *  so the deck's `hashchange` handler has laid the slide out. Already there, not a fragment, or an
   *  address that did not change (no event is coming): `then` at once. A newer move replaces a
   *  continuation still waiting (the stale one has its own sequence check and does nothing). */
  function goTo(where, then) {
    if (!validWhere(where) || where === location.hash) {
      then();
      return;
    }
    const before = location.hash;
    arriving = null;
    try {
      /* "#" for none: the same address without a fragment would be a full navigation */
      location.replace(`${location.pathname}${location.search}${where === "" ? "#" : where}`);
    } catch {
      then();
      return;
    }
    if (location.hash === before) {
      then();
      return;
    }
    arriving = then;
  }
  /* A LANDING IS INSTANT, WHATEVER THE DOCUMENT'S `scroll-behavior` SAYS (v38, plan 77 §32 Q2): a
     fragment's own jump on a page with `scroll-behavior: smooth` is an animation that was still
     running after `load`, a frame and a task, and carried the window on from where it was put (the
     creep: TRAPS §60). So the root's inline value is set aside before a move starts and put back
     once `studio:scrolled` is said — or by the move that took its place. */
  let smoothSaved = null;
  const instantly = () => {
    const root = document.documentElement;
    if (root === null || smoothSaved !== null) return;
    try {
      smoothSaved = {
        value: root.style.getPropertyValue("scroll-behavior"),
        priority: root.style.getPropertyPriority("scroll-behavior"),
      };
      root.style.setProperty("scroll-behavior", "auto", "important");
    } catch {
      smoothSaved = null;
    }
  };
  const smoothBack = () => {
    const root = document.documentElement;
    if (smoothSaved === null || root === null) return;
    const was = smoothSaved;
    smoothSaved = null;
    try {
      if (was.value === "") root.style.removeProperty("scroll-behavior");
      else root.style.setProperty("scroll-behavior", was.value, was.priority);
    } catch {
      /* the page's own style */
    }
  };
  /** `studio:scroll` — the document goes to the place the page says (§7, §15): the fragment, the
   *  elements that scroll inside it, then the window. Numbers or nothing: a value that is not a
   *  finite number moves nothing, and the scroll that follows re-posts the rects through the
   *  listener every scroll already has. */
  function scrollFrom(msg) {
    const x = Number(msg.x);
    const y = Number(msg.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const mine = ++moveSeq;
    instantly();
    /* A FRAGMENT IS THE PLACE (the one we replaced to, or the one the document's own address
       carried: a deck that lays its slide out on `load` has not, yet) on a document still loading
       (v27, plan 77 F5): its images and fonts are not laid out, so the place would be put back on
       the wrong height. The restore also waits
       for `load` — an event — and one task after it. The CEILING is the page's: if `scrolled` has
       not come within its MUTE_MS of this document's `ready`, it swaps anyway, so a hung image can
       never keep the old version on screen. */
    const moving = validWhere(msg.where) && msg.where !== "";
    const finish = () => {
      /* EACH INNER SCROLLER by the selector pins use: one that throws or finds nothing is skipped,
         and so is one of ours */
      if (Array.isArray(msg.inner))
        for (const t of msg.inner.slice(0, INNER_MAX)) {
          if (!Array.isArray(t) || typeof t[0] !== "string" || t[0].length > 512) continue;
          const ix = Number(t[1]);
          const iy = Number(t[2]);
          if (!Number.isFinite(ix) || !Number.isFinite(iy)) continue;
          let el = null;
          try {
            el = document.querySelector(t[0]);
          } catch {
            el = null;
          }
          if (el === null || ours(el)) continue;
          try {
            el.scrollTo({ left: Math.max(0, ix), top: Math.max(0, iy), behavior: "instant" });
          } catch {
            el.scrollLeft = Math.max(0, ix);
            el.scrollTop = Math.max(0, iy);
          }
          noteScroller(el);
        }
      /* AT ONCE, whatever the page's own `scroll-behavior` says, and then SAID (v20, plan 73 D17):
         `studio:scrolled` carries where the document came to rest — as far as it could go — so the
         page swaps a reloaded version in on that answer, never on a timer's guess. */
      try {
        window.scrollTo({ left: Math.max(0, x), top: Math.max(0, y), behavior: "instant" });
      } catch {
        window.scrollTo(Math.max(0, x), Math.max(0, y));
      }
      post("studio:scrolled", { screen: screenId() });
      smoothBack();
    };
    /* THE READER STAYS ON THE CONTENT (v36, O3): the slide that shows is not the one the old document
       showed, and exactly one sibling says what it said — land on that one, once, the way the
       fragment was put back (the same replace, the same permanent listener, a frame, a task) */
    const restore = () => {
      const print = msg.slide !== null && typeof msg.slide === "object" ? msg.slide.words : null;
      const drift =
        typeof print === "string" && print.length <= SLIDE_WORDS ? slideDrift(print) : null;
      if (drift === null) {
        finish();
        return;
      }
      goTo(drift.where, () => {
        if (mine !== moveSeq) return;
        const done = () =>
          afterTask(
            quietly(() => {
              if (mine !== moveSeq) return;
              restDeck(drift.parent);
              finish();
            }),
          );
        if (document.visibilityState === "hidden") done();
        else requestAnimationFrame(quietly(done));
      });
    };
    goTo(msg.where, () => {
      if (mine !== moveSeq) return;
      /* A FRAME OF OURS, then a task (v30, I3): `load` is not a layout the deck has had its say in
         — a deck that lays out in a frame it asked for on `load` has not drawn yet, and a document
         that is already `complete` when the place arrives is in the same case (measured: the page's
         own frame was still pending in 4 reloads of 10). A document that is hidden has no frame
         coming — the task alone. */
      const land = () =>
        afterTask(
          quietly(() => {
            if (mine === moveSeq) restore();
          }),
        );
      const afterFrame = () => {
        if (document.visibilityState === "hidden") land();
        else requestAnimationFrame(quietly(land));
      };
      if (!moving) restore();
      else if (document.readyState !== "complete")
        addListener.call(window, "load", quietly(afterFrame), { once: true });
      else afterFrame();
    });
  }

  /* ---------------------------------------------------------------- 16. the slide the reader is on (v37, plan 77 P3) */

  /** `studio:print` — which slide the reader is on, as its text: asked of the version on screen when
   *  a new one starts loading, answered `studio:print {slide: {words}}`; on a page with no deck's
   *  evidence the answer has no `slide` — it is still a message, and EVERY message carries the place
   *  (item 15): the page learns an inner scroller's position from it, which no other message would
   *  say on a page with no pins. It rides back in `studio:scroll {slide}` (the landing, O3). */
  function slidePrintFrom() {
    const at = currentSlide();
    post("studio:print", at === null ? {} : { slide: { words: slideText(at.V) } });
  }
  /** A slide's text as the landing compares it (v36, O3): its subtree's text, whitespace folded,
   *  the first 2,000 characters. */
  const SLIDE_WORDS = 2000;
  const DECK_MAX = 300;
  const slideText = (el) =>
    (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, SLIDE_WORDS);
  /** The slide showing and the container it is in, when D9's deck evidence holds for some parent of
   *  the document: three or more siblings of a tag, exactly one showing, the others hidden on
   *  purpose. The first such deck in document order; `null` on a page that is none. */
  function currentSlide() {
    const done = new Set();
    deckMemo = new Map();
    try {
      for (const el of document.body.querySelectorAll("*")) {
        const p = el.parentElement;
        if (p === null || done.has(p) || ours(el) || ours(p)) continue;
        done.add(p);
        const byTag = new Map();
        for (const c of p.children) {
          if (ours(c) || NOT_RENDERED.has(c.localName)) continue;
          byTag.set(c.localName, (byTag.get(c.localName) ?? 0) + 1);
        }
        for (const [tag, n] of byTag) {
          /* a deck has slides, not thousands of rows: a list that long is none (and costs a read each) */
          if (n < 3 || n > DECK_MAX) continue;
          const V = [...p.children].find((c) => c.localName === tag && !ours(c) && showsEl(c));
          if (V !== undefined && isDeck(p, V)) return { V, parent: p };
        }
      }
      return null;
    } finally {
      deckMemo = null;
    }
  }
  /** THE READER STAYS ON THE CONTENT (v36, O3): after the fragment has been put back, the slide
   *  that shows is not the one the old document showed (its text) while exactly ONE of its siblings
   *  says it — the fragment of that one; else null (none, or several: never a guess). */
  function slideDrift(print) {
    if (typeof print !== "string" || print === "") return null;
    const at = currentSlide();
    if (at === null || slideText(at.V) === print) return null;
    let found = null;
    for (const c of at.parent.children) {
      if (c === at.V || c.localName !== at.V.localName || ours(c)) continue;
      if (slideText(c) !== print) continue;
      if (found !== null) return null;
      found = c;
    }
    if (found === null) return null;
    const w = slideWhere(found, at.V);
    return w !== "" && w !== location.hash ? { where: w, parent: at.parent } : null;
  }
  /** The deck's transitions run to their end (v36, O3): the slide just landed on fades in, and a page
   *  held for Comment would keep it where the freeze found it — a slide at opacity 0. The landing
   *  lands, as the first one does by loading at its fragment: no transition is left half-way. */
  function restDeck(parent) {
    if (typeof document.getAnimations !== "function") return;
    try {
      for (const a of document.getAnimations()) {
        const t = a.effect?.target;
        if (typeof a.transitionProperty === "string" && t instanceof Element && parent.contains(t))
          a.finish();
      }
    } catch {
      /* a transition that will not finish is the page's own */
    }
  }
  /** Does it show — by the test a pick and an area use (plan 77's v25): a box, and not hidden,
   *  faded, inert or under something that is. */
  const showsEl = (el) => {
    if (!el.isConnected) return false;
    const b = seenBox(el);
    return !hiddenEl(el, b);
  };
  const indexAmong = (parent, tag, el) => {
    let n = 0;
    for (const c of parent.children) {
      if (c.localName !== tag || ours(c)) continue;
      if (c === el) return n;
      n++;
    }
    return -1;
  };
  /** A DECK'S EVIDENCE (v29, H4): three or more siblings of V's tag, exactly one shows (V), every
   *  other one is hidden on purpose. */
  let deckMemo = null;
  function isDeck(parent, V) {
    if (deckMemo !== null) {
      const known = deckMemo.get(V);
      if (known !== undefined) return known;
    }
    const answer = isDeckNow(parent, V);
    deckMemo?.set(V, answer);
    return answer;
  }
  function isDeckNow(parent, V) {
    const kin = [...parent.children].filter((c) => c.localName === V.localName && !ours(c));
    if (kin.length < 3) return false;
    for (const c of kin) if (c !== V && (showsEl(c) || !unseenEl(c))) return false;
    return showsEl(V);
  }
  /** The deck slide this shown element is on — the one that shows (v30, I2) — or null. */
  function slideOn(el) {
    for (
      let S = el;
      S !== null && S !== document.body && S.parentElement !== null;
      S = S.parentElement
    )
      if (isDeck(S.parentElement, S)) return S;
    return null;
  }
  /** A slide target's fragment, DERIVED from what the page shows now and never guessed (D9): by
   *  the id of the slide on screen (`#id` → the other's id), or by the number in `#<n>`. "" when
   *  there is no evidence. */
  function slideWhere(S, V) {
    const hash = location.hash;
    if (V.id !== "" && S.id !== "" && hash === `#${V.id}`) return `#${S.id}`;
    const m = /^#(\d{1,9})$/.exec(hash);
    const parent = S.parentElement;
    if (m !== null && parent !== null && S.localName === V.localName) {
      /* the number scheme needs a deck's evidence (v29, H4) */
      if (!isDeck(parent, V)) return "";
      const iv = indexAmong(parent, V.localName, V);
      const is = indexAmong(parent, S.localName, S);
      const n = Number(m[1]) - iv + is;
      if (iv >= 0 && is >= 0 && n >= 0) return `#${n}`;
    }
    return "";
  }
  /** Elements that are never a slide of a deck. */
  const NOT_RENDERED = new Set([
    "script",
    "style",
    "template",
    "link",
    "meta",
    "noscript",
    "title",
    "head",
  ]);
  /** `studio:go {where}` (v26, plan 77 D8) — the page brings a pin's slide up: the fragment, then
   *  a fresh measure of everything watched, which reports under the new `where`. */
  function goFrom(msg) {
    if (!validWhere(msg.where)) return;
    const mine = ++moveSeq;
    const asked = Number.isSafeInteger(msg.seq) ? msg.seq : null;
    instantly();
    goTo(msg.where, () => {
      if (mine !== moveSeq) return;
      measure(true);
      smoothBack();
      /* ANSWERED (v27, plan 77 F8): whatever the page did to the fragment, the ask is over, and the
         page resolves its locate by `seq` — never by a guess that a report is the one it waited for */
      if (asked !== null) post("studio:went", { seq: asked, where: location.hash });
    });
  }

  /* ---------------------------------------------------------------- 4. pick, and the identity */

  /** `payment › card › card-footer › button "Pay now"` — slots first, the tag last. */
  function pathOf(el) {
    const chain = [];
    for (let node = el; node !== null; node = node.parentElement) {
      const slot = node.getAttribute("data-slot") || node.getAttribute("data-screen");
      if (slot) chain.unshift(slot);
    }
    const text = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40);
    const tail = `${el.tagName.toLowerCase()}${text === "" ? "" : ` "${text}"`}`;
    return [...chain, tail].join(" › ");
  }

  /** A unique CSS selector for the agent's grep: ids, then data-* attributes, then nth-of-type. */
  function selectorOf(el) {
    if (el.id !== "" && document.querySelectorAll(`#${CSS.escape(el.id)}`).length === 1) {
      return `#${CSS.escape(el.id)}`;
    }
    const parts = [];
    for (let node = el; node !== null && node.tagName !== "HTML"; node = node.parentElement) {
      let part = node.tagName.toLowerCase();
      for (const attr of ["data-screen", "data-slot", "data-go", "name"]) {
        const value = node.getAttribute(attr);
        if (value) {
          part += `[${attr}="${CSS.escape(value)}"]`;
          break;
        }
      }
      const siblings = [...(node.parentElement?.children || [])].filter(
        (s) => s.tagName === node.tagName,
      );
      if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(node) + 1})`;
      parts.unshift(part);
      const candidate = parts.join(" > ");
      if (document.querySelectorAll(candidate).length === 1) return candidate;
    }
    /* NEVER EMPTY (v24, H3): the root itself is `html`, and "" named nothing */
    return parts.length === 0 ? "html" : parts.join(" > ");
  }

  /* A NAME A PERSON WOULD SAY (v10): what the element is — its role, or its tag as a word — and
     the first line of what it says, whitespace collapsed, at most 40 characters: `Button · Pay
     now`, `Row · Trail shoes`, `Section · Order summary`. Beside the structural path, never instead
     of it: the path is what the round prints and the agent greps. */
  const KINDS = {
    a: "Link",
    button: "Button",
    input: "Field",
    textarea: "Field",
    select: "Menu",
    img: "Image",
    svg: "Image",
    video: "Video",
    h1: "Heading",
    h2: "Heading",
    h3: "Heading",
    h4: "Heading",
    h5: "Heading",
    h6: "Heading",
    p: "Text",
    li: "Row",
    tr: "Row",
    nav: "Navigation",
    header: "Header",
    footer: "Footer",
    form: "Form",
    section: "Section",
    aside: "Section",
    article: "Section",
    main: "Page",
    table: "Table",
    label: "Label",
    summary: "Disclosure",
    details: "Disclosure",
    dialog: "Dialog",
  };
  const INPUTS = { checkbox: "Checkbox", radio: "Option", range: "Slider", submit: "Button" };
  const SVG_NS = "http://www.w3.org/2000/svg";
  const SHAPES = {
    circle: "Circle",
    ellipse: "Ellipse",
    rect: "Rectangle",
    line: "Line",
    polyline: "Line",
    text: "Text",
    tspan: "Text",
    g: "Group",
    image: "Image",
  };
  /** The first words a component's own (open) shadow tree shows — what a person reads on a custom
   *  element whose light children say nothing: `Card · Plan`. Styles and scripts are not words. */
  function shadowLine(el) {
    const root = el.shadowRoot;
    if (root === null || root === undefined) return "";
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: (n) =>
        n.nodeType === 1 && UNSEEN.has(n.tagName)
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT,
    });
    for (let n = walk.nextNode(); n !== null; n = walk.nextNode()) {
      if (n.nodeType !== 3) continue;
      const s = n.data.replace(/\s+/g, " ").trim();
      if (s !== "") return s.length > 40 ? `${s.slice(0, 39)}…` : s;
    }
    return "";
  }
  function kindOf(el) {
    const role = (el.getAttribute("role") || "").trim();
    if (role !== "") return role.charAt(0).toUpperCase() + role.slice(1);
    const tag = el.tagName.toLowerCase();
    if (tag === "input") return INPUTS[(el.getAttribute("type") || "").toLowerCase()] || "Field";
    /* A SHAPE INSIDE A DRAWING is named as a person names it — `Circle`, never `Element` (round 3,
       T14: the review's card read *Element · 1000* for an SVG circle and rect) */
    if (el.namespaceURI === SVG_NS && tag !== "svg") return SHAPES[tag] || "Shape";
    if (KINDS[tag]) return KINDS[tag];
    /* A PAGE'S OWN COMPONENT is named by its tag in words, less a short prefix: `x-card` → `Card`,
       `sl-button` → `Button`, `product-tile` → `Product tile` */
    if (tag.includes("-")) {
      const parts = tag.split("-").filter(Boolean);
      const words = parts.length > 1 && parts[0].length <= 3 ? parts.slice(1) : parts;
      const name = words.join(" ");
      return name.charAt(0).toUpperCase() + name.slice(1);
    }
    if (el.querySelector("h1,h2,h3,h4,h5,h6") !== null) return "Section";
    let cs = null;
    try {
      cs = getComputedStyle(el);
    } catch {
      cs = null;
    }
    if (cs && /flex|grid/.test(cs.display) && el.children.length > 1) {
      if (cs.display.includes("grid") || !String(cs.flexDirection).startsWith("column"))
        return "Row";
    }
    return "Element";
  }
  function firstLine(el) {
    const raw =
      typeof el.innerText === "string" && el.innerText !== "" ? el.innerText : el.textContent || "";
    const line =
      raw
        .split("\n")
        .map((l) => l.replace(/\s+/g, " ").trim())
        .find((l) => l !== "") || "";
    return line.length > 40 ? `${line.slice(0, 39)}…` : line;
  }
  function readableName(el) {
    const text = firstLine(el);
    /* A FIELD SAYS NOTHING OF ITS OWN: its label does (`Checkbox · Gift wrap`). */
    const label = el.labels && el.labels.length > 0 ? firstLine(el.labels[0]) : "";
    const alt =
      el.getAttribute("aria-label") ||
      el.getAttribute("alt") ||
      label ||
      el.getAttribute("placeholder") ||
      "";
    const said =
      text !== "" ? text : alt.replace(/\s+/g, " ").trim().slice(0, 40) || shadowLine(el);
    return said === "" ? kindOf(el) : `${kindOf(el)} · ${said}`;
  }
  /** An area is named by its ANCHOR — the deepest element that holds it — or, when nothing does,
   *  by the nearest element under its middle that says something. */
  function areaName(rect) {
    const held = areaHolder(rect);
    const own = held === null ? "" : firstLine(held);
    if (own !== "") return `Area · ${own}`;
    let node = hitAt(rect.x + rect.w / 2, rect.y + rect.h / 2);
    for (; node !== null && node !== document.documentElement; node = node.parentElement) {
      if (ours(node)) continue;
      const line = firstLine(node);
      if (line !== "") return `Area · ${line}`;
    }
    return "Area";
  }

  /* TO A HUNDREDTH OF A FRAME PIXEL, not a whole one (v22, plan 73 round 2): the marks are painted
     in this document from these boxes and the page puts its click targets where they are, and a
     whole pixel was up to 0.38 screen px between the two at 76 %. */
  const r2 = (v) => Math.round(v * 100) / 100;
  const box = (el) => {
    const r = el.getBoundingClientRect();
    return { x: r2(r.left), y: r2(r.top), w: r2(r.width), h: r2(r.height) };
  };

  /* WHERE AN ELEMENT IS ON SCREEN UNDER CSS `zoom` (plan 73 round 3, T5) — measured in WebKit 26
     and Chromium (TRAPS §42). A deck that fits itself to the window with `zoom` on <html> or
     <body>, or one box zoomed, is ordinary. The pointer, `elementsFromPoint`, `innerWidth` and the
     window's scroll all speak the frame's own (visual) pixels in both engines. But WebKit's
     `getBoundingClientRect` is LEGACY: it divides the element's box by its effective zoom and only
     then subtracts the window's scroll, so a paragraph at visual (50, 70) under `html{zoom:1.25}`
     reads (40, 56), and a box zoomed 2 inside it reads at 1/2.5 of where it is. Every mark was
     painted, and every rect reported, in those unzoomed numbers: rings 164–191 px off their
     elements, dots above them, the page's click targets elsewhere. Chromium's standardized zoom
     answers on-screen boxes already and says so with `currentCSSZoom`. So the review's geometry
     reads `seenBox`, which undoes WebKit's arithmetic exactly — `(r + scroll) × zoom − scroll` —
     and a length the element measures in its own px (`clientLeft`, `scrollTop`, a computed
     `top`) is multiplied by its true zoom (`cssZoom`) in either engine. Edit mode's chrome keeps
     `box`: it draws in the document's own px (§6). */
  const STANDARD_ZOOM = typeof Element === "function" && "currentCSSZoom" in Element.prototype;
  const zooms = new WeakMap();
  /** An element's effective zoom: the product of every computed `zoom` from it to the root. */
  function cssZoom(el) {
    if (STANDARD_ZOOM) {
      const z = el.currentCSSZoom;
      return typeof z === "number" && z > 0 ? z : 1;
    }
    /* read once per document generation and viewport (a media query can change a zoom); each
       ancestor's answer is kept too, so siblings share their parents' */
    const key = `${generation}|${window.innerWidth}x${window.innerHeight}`;
    const was = zooms.get(el);
    if (was !== undefined && was.key === key) return was.z;
    const up = el.parentElement ?? el.parentNode?.host ?? null;
    const own = Number.parseFloat(getComputedStyle(el).zoom);
    const z = (Number.isFinite(own) && own > 0 ? own : 1) * (up === null ? 1 : cssZoom(up));
    zooms.set(el, { key, z });
    return z;
  }
  /** What `getBoundingClientRect` must be multiplied by to be on screen: 1 where the engine already
   *  answers on-screen boxes. */
  const rectZoom = (el) => (STANDARD_ZOOM ? 1 : cssZoom(el));
  /** A client rect (`left`, `top`, `width`, `height`) of something under zoom `z`, on screen. */
  function onScreen(r, z) {
    if (z === 1) return { x: r2(r.left), y: r2(r.top), w: r2(r.width), h: r2(r.height) };
    const sx = window.scrollX;
    const sy = window.scrollY;
    return {
      x: r2((r.left + sx) * z - sx),
      y: r2((r.top + sy) * z - sy),
      w: r2(r.width * z),
      h: r2(r.height * z),
    };
  }
  /** An element's border box where it is on screen, in the frame's own px, under any zoom. */
  const seenBox = (el) => onScreen(el.getBoundingClientRect(), rectZoom(el));

  const layer = document.createElement("div");
  /* MARKED AS OURS, and not with edit mode's own `data-studio-edit` — the studio's teardown check
     counts THAT name and must find nothing when edit mode is off, while this layer outlives the
     mode that built it. `screenHtml()` strips both, which is what a body-rooted screen needs. */
  layer.setAttribute("data-studio-aim", "");
  layer.style.cssText =
    "position:fixed;inset:0;z-index:2147483647;pointer-events:none;display:none;font:12px/1.2 ui-monospace,monospace";
  const outline = document.createElement("div");
  outline.style.cssText = "position:absolute;box-sizing:border-box;pointer-events:none";
  const label = document.createElement("div");
  label.style.cssText =
    "position:absolute;white-space:nowrap;max-width:90vw;overflow:hidden;text-overflow:ellipsis;pointer-events:none";
  layer.append(outline, label);
  /* THE LOOK THE PAGE ASKED FOR (v10, `studio:pick` / `studio:draw`): its accent, the ink on it,
     and the scale it draws this frame at — every size below is divided by it, so the ring and the
     tag are screen-sized at every scale. Defaults are the look a page that says nothing gets. */
  const aim = { scale: 1, accent: "#0af", ink: "#fff" };
  function setLook(msg) {
    if (msg === null || typeof msg !== "object") return;
    if (typeof msg.scale === "number" && Number.isFinite(msg.scale) && msg.scale > 0)
      aim.scale = Math.min(8, Math.max(0.05, msg.scale));
    /* A COLOUR, NOT CSS: one token of letters, digits, `#`, `%`, `.`, `,`, `/`, `(`, `)` and spaces,
       so a value cannot close the declaration it is written into. */
    const colour = (v) => typeof v === "string" && /^[#a-z0-9%.,/() -]{1,64}$/i.test(v);
    if (colour(msg.accent)) aim.accent = msg.accent;
    if (colour(msg.ink)) aim.ink = msg.ink;
  }
  const px = (n) => `${n / aim.scale}px`;
  const attach = () => {
    if (document.body !== null && !layer.isConnected) document.body.appendChild(layer);
    /* AT ZOOM 1 ON SCREEN (T5): the ring is drawn in the frame's own px, whatever `zoom` the page
       puts on <html> or <body> */
    if (document.body !== null) {
      const z = cssZoom(document.body);
      const want = z === 1 ? "" : String(1 / z);
      if (layer.style.zoom !== want) layer.style.zoom = want;
    }
  };

  const pick = { on: false };
  const draw = { on: false, from: null, rect: null };
  /* HELD (v19, plan 73 D5): a note card is open on the page. The page stays frozen — the card is
     about the page as it was clicked, so nothing may move under it — with no hover ring and no
     pick; a click is `studio:away` and acts on nothing. */
  const hold = { on: false };
  /** Edit mode's whole world — §6 builds it, and `exitEdit()` puts every field back. */
  const edit = {
    on: false,
    vocab: null,
    /** The selection, in the order it was made; the LAST is the primary. */
    sel: [],
    /** The element being retyped, and what it said before. */
    text: null,
    from: "",
    /** Our chrome: the one element, and the nodes inside it by name. */
    chrome: null,
    n: null,
    ro: null,
    raf: 0,
    /** A live gesture: a move, a free move or a marquee; a handle drag. */
    drag: null,
    size: null,
    /** What was last PRESSED, for click-again-selects-parent. */
    lastEl: null,
    /** The element ⌥ is measuring to, or null. */
    measure: null,
    pend: null,
    pendTimer: 0,
    /** Every step: `{id, html, summary, path, free, sel, kind}`. Index 0 is the oldest kept. */
    stack: [],
    at: -1,
    /** The lines of steps the cap pushed off the stack — still done, still in `ops` (v12). */
    gone: [],
    /** This document's own prefix for the ids it mints, so a seeded step's id never collides. */
    tag: Math.random().toString(36).slice(2, 8),
    serial: 0,
    /** Held still while the studio swaps a new document in (`studio:flush {hold}`, v12). */
    held: false,
    holdTimer: 0,
    /** When the pointer last pressed the screen (v13): a selection posted just after it is the
     *  designer's click, and the studio moves its keys to the canvas for it. */
    pressAt: 0,
    /* THE SELECTORS WE LAST TOLD THE STUDIO ABOUT, joined, or "". `studio:act` and `studio:trait`
       are checked against THIS and never against a fresh `selectorOf` — a duplicate or a delete
       shifts an `:nth-of-type` under a panel that has not been told yet, and a change aimed at
       the thing a designer is looking at would land on its sibling. */
    sent: "",
    /** Every selector in the tree we last posted: what `studio:select` and `studio:hover` may name. */
    known: new Set(),
    /** Our clipboard: the outerHTML of what was last copied or cut. */
    clip: null,
    /** What the studio asked for: the scale its stage draws us at, and the switches. */
    opts: { scale: 1, spacing: false, grid: false, gridStep: 8, guides: true, snap: true },
  };

  /* Is a mode on? The one question the aim freeze and the `data-go` guard both ask — and EDIT IS
     ONE OF THEM, for the same reason pick is: a click meant to select a button cannot also be a
     click that navigates away from the screen being edited. */
  const aimingNow = () => pick.on || draw.on || edit.on || hold.on;

  /* THE FRAME'S OWN EDGES. A press that leaves the iframe keeps pointer capture, so `clientX`
     runs on past the viewport and an 80-px drag released over the page reported a 1204 × 824
     "area" (measured 2026-09-17). Every coordinate the drag uses is clamped to the page. */
  const clampX = (v) => Math.max(0, Math.min(v, document.documentElement.clientWidth));
  const clampY = (v) => Math.max(0, Math.min(v, document.documentElement.clientHeight));

  /** Nothing half-drawn survives a mode change or a lost button. */
  function cancelDrag() {
    draw.from = null;
    draw.rect = null;
    hideOutline();
  }

  function setPick(on, msg) {
    setLook(msg);
    pick.on = on;
    attach();
    if (!on) hideOutline();
    if (!on && !draw.on) aimed(null);
    if (document.body !== null) document.body.style.cursor = on ? "crosshair" : "";
    shield();
    settle();
  }

  function setDraw(on, msg) {
    setLook(msg);
    draw.on = on;
    cancelDrag();
    if (!on && !pick.on) aimed(null);
    attach();
    if (document.body !== null) document.body.style.cursor = on ? "crosshair" : "";
    shield();
    settle();
  }

  function setHold(on) {
    hold.on = on;
    if (on) {
      cancelDrag();
      aimed(null);
    }
    shield();
    settle();
  }

  /* A SHIELD OVER EVERYTHING WITH EVENTS OF ITS OWN (plan 73 round 3, T6). The freeze is a set of
     listeners on THIS window, and a nested browsing context — an `iframe`, an `embed` or an
     `object` (a player, a map, a demo) — gets its own events: in Comment a click on an embedded
     demo pressed its button and opened no card (measured). So while pointing, drawing or holding,
     each one has a transparent box of ours over it, in the ring's layer, the only thing of ours
     that takes the pointer: the press is ours, and what it picks is still found by the point
     (`under` skips our own nodes), so the note is on the `iframe` element itself. A `<video>`'s or
     `<audio>`'s controls and a `<select>` are this document's own, and the freeze already holds
     them (measured: a card, no play, no focus). Kept where they are by every scroll, resize, change
     of the document and move of the pointer, at most once a frame; gone the moment no mode holds
     the page, and never there with Comment off. */
  const NESTED = "iframe, embed, object, frame";
  const shields = [];
  let shieldFrame = 0;
  function shield() {
    const want = frozenNow() && document.body !== null;
    const els = want ? [...document.querySelectorAll(NESTED)].filter((el) => !ours(el)) : [];
    const boxes = [];
    for (const el of els) {
      const b = seenBox(el);
      if (b.w > 0 && b.h > 0) boxes.push(b);
    }
    while (shields.length > boxes.length) shields.pop().remove();
    if (boxes.length > 0) attach();
    for (let i = 0; i < boxes.length; i++) {
      let s = shields[i];
      if (s === undefined) {
        s = document.createElement("div");
        s.setAttribute("data-studio-shield", "");
        s.style.cssText = "position:absolute;pointer-events:auto;background:transparent";
        layer.appendChild(s);
        shields.push(s);
      }
      const b = boxes[i];
      s.style.left = `${b.x}px`;
      s.style.top = `${b.y}px`;
      s.style.width = `${b.w}px`;
      s.style.height = `${b.h}px`;
    }
    /* THE WHOLE VIEWPORT, while what was hovered is held (item 13): the page's own `:hover` leaves
       it, and only the bridge answers the pointer */
    const whole = want && hover.on;
    if (whole && full === null) {
      attach();
      full = document.createElement("div");
      full.setAttribute("data-studio-veil", "");
      full.style.cssText = "position:absolute;inset:0;pointer-events:auto;background:transparent";
      layer.appendChild(full);
    } else if (!whole && full !== null) {
      full.remove();
      full = null;
    }
    if (full !== null) full.style.cursor = pick.on || draw.on ? "crosshair" : "default";
    layer.style.display =
      pick.on || draw.on || shields.length > 0 || full !== null ? "block" : "none";
  }
  function shieldSoon() {
    if (shieldFrame !== 0 || (!frozenNow() && shields.length === 0)) return;
    shieldFrame = requestAnimationFrame(
      quietly(() => {
        shieldFrame = 0;
        shield();
      }),
    );
  }
  for (const type of ["scroll", "resize", "pointermove"])
    addEventListener(type, shieldSoon, { capture: true, passive: true });

  /* ---------------------------------------------------------- the aim freeze (header, item 4) */

  /* TWO LISTS, BECAUSE POINTER EVENTS ARE NOT MOUSE EVENTS. A `preventDefault` on `pointerdown`
     suppresses the compatibility `mousedown`/`mouseup` the drag itself is built on, so pointer
     and touch events are only silenced, never cancelled; everything else is cancelled outright.

     SINCE v21 EDIT MODE USES THE WHOLE FREEZE TOO (the review's R9): it used to install its own
     listeners on `window` in the capture phase AFTER the page's and stop propagation, never the
     immediate kind — so a deck listening on `window` in the capture phase advanced under an
     edit-mode click, and the wheel was never frozen at all. Its handlers for these types now run
     INSIDE the freeze's one listener (`editOwn`), as pointing's do. `FROZEN` is the cancelled list. */
  const FROZEN = [
    "mousedown",
    "mouseup",
    "click",
    "dblclick",
    "auxclick",
    "contextmenu",
    "submit",
    "keydown",
    "keypress",
    "keyup",
    "dragstart",
    /* v21 (the review's R11): a press that starts a selection — a right-click selects the word under
       it on macOS — selects nothing of the page while it is frozen */
    "selectstart",
  ];

  /* ESCAPE IS THE WAY OUT, and it has to travel: a key pressed with focus inside this frame never
     reaches the page, so the studio's own `Esc` cannot hear it. Registered BEFORE the freeze
     below — same target, same phase, so `stopPropagation` there does not stop this one. */
  window.addEventListener(
    "keydown",
    (event) => {
      if (!aimingNow() || event.key !== "Escape") return;
      /* IN EDIT MODE ESCAPE HAS SOMEWHERE NEARER TO GO — out of the words, then out of the
         selection — and only when it has neither is it the studio's to hear. */
      if (edit.on && editEscape()) return;
      post("studio:escape", { screen: screenId() });
    },
    true,
  );

  /* THE PAGE'S KEYS, FROM IN HERE (v10, item 8). A CLOSED LIST — the page re-checks every one
     against its own — and never edit mode's, whose keys are its verbs. */
  const BARE = new Set(["escape", "c", "a", "v", "f", "j", "k", "["]);
  function forwardable(event) {
    const k = String(event.key || "").toLowerCase();
    const mod = event.metaKey || event.ctrlKey;
    if (mod && !event.altKey) {
      if (k === "enter" && !event.shiftKey) return true;
      if (k === "l" && event.shiftKey) return true;
      if (k === "b" && !event.shiftKey) return true;
      return false;
    }
    return !event.altKey && BARE.has(k);
  }
  const editable = (t) =>
    t instanceof Element &&
    (t.closest("input, textarea, select") !== null ||
      (t instanceof HTMLElement && t.isContentEditable));
  const forward = (event) =>
    post("studio:key", {
      key: event.key,
      shift: event.shiftKey,
      mod: event.metaKey || event.ctrlKey,
    });
  /* WHILE AIMING, FROM THE CAPTURE PHASE: the freeze below eats every key before it bubbles. */
  window.addEventListener(
    "keydown",
    (event) => {
      if (!aimingNow() || edit.on || !forwardable(event) || editable(event.target)) return;
      forward(event);
    },
    true,
  );
  /* OTHERWISE FROM THE BUBBLE PHASE, and only a key this document did not handle itself: a page
     that uses `f` or Escape keeps it. AFTER THE DISPATCH, not during it: this listener is on
     `window` and was added before any of the page's own (the bridge is the first thing in
     `<head>`), so a page listening on `window` too would hear the key AFTER this one — and its
     `preventDefault` would come too late to be seen (measured, plan 48 review). */
  window.addEventListener("keydown", (event) => {
    if (aimingNow() || !forwardable(event) || editable(event.target)) return;
    setTimeout(() => {
      if (!event.defaultPrevented) forward(event);
    }, 0);
  });

  /* THE POINTER MOVED IN HERE (v10) — at most four times a second, never per pixel. */
  let activeAt = 0;
  const active = () => {
    const now = Date.now();
    if (now - activeAt < 250) return;
    activeAt = now;
    post("studio:active", {});
  };
  for (const type of ["pointermove", "wheel", "keydown"])
    window.addEventListener(type, active, { capture: true, passive: true });

  /* A REQUEST THIS DOCUMENT'S POLICY REFUSED (v10): once per host, so the page can say which
     sites were not loaded. Only a request for somewhere — an inline or `eval` refusal names no
     site. */
  const refused = new Set();
  document.addEventListener("securitypolicyviolation", (event) => {
    let host = "";
    try {
      host = new URL(event.blockedURI).host;
    } catch {
      host = "";
    }
    if (host === "" || refused.has(host)) return;
    refused.add(host);
    post("studio:blocked", {
      screen: screenId(),
      directive: event.effectiveDirective || event.violatedDirective || "",
      host,
    });
  });

  /* A FORM POSTED TO ANOTHER SITE STAYS HERE (v10, plan 48 review). The door's policy refuses it
     anyway (`form-action 'self'`), and a refused navigation leaves the browser's own error page in
     the frame — the page gone until a reload, the bridge with it. So, under a studio, it is
     cancelled before it goes and reported like any other refused request; the page keeps its
     place. A submit the page cancels itself is the page's, and `form.submit()` (which fires no
     event) is held to the same rule. */
  function awayHost(form, submitter) {
    const by = submitter?.getAttribute ? submitter.getAttribute("formaction") : null;
    if ((form.getAttribute("method") || "").toLowerCase() === "dialog") return "";
    try {
      const to = new URL(by || form.getAttribute("action") || location.href, location.href);
      return /^(https?|wss?):$/.test(to.protocol) && to.origin !== location.origin ? to.host : "";
    } catch {
      return "";
    }
  }
  function stayHere(form, submitter) {
    const host = studio === null ? "" : awayHost(form, submitter);
    if (host === "") return false;
    if (!refused.has(host)) {
      refused.add(host);
      post("studio:blocked", { screen: screenId(), directive: "form-action", host });
    }
    return true;
  }
  window.addEventListener("submit", (event) => {
    const form = event.target;
    if (event.defaultPrevented || !(form instanceof HTMLFormElement)) return;
    if (stayHere(form, event.submitter)) evCancel(event);
  });
  const submitOf = HTMLFormElement.prototype.submit;
  HTMLFormElement.prototype.submit = function submit() {
    if (stayHere(this)) return;
    return apply(submitOf, this, []);
  };

  /* THE FREEZE HAS EXACTLY TWO HOLES, AND BOTH ARE EDIT MODE'S. Our own handles are pressed, and
     a `contenteditable` whose keydowns are cancelled is a word nobody can type. Everything else
     — the prototype's own clicks, submits and keys — stays frozen while edit mode is on, for
     pick mode's reason: a click meant to describe or to move a thing must not also be a click
     that thing acts on. */
  const passes = (event) =>
    edit.on &&
    (ours(event.target) ||
      (edit.text !== null && event.target instanceof Node && edit.text.contains(event.target)));

  /* THE WHOLE FREEZE (v19, plan 73 D4) — measured 2026-10-13 with two holes in the one before it.
     `stopPropagation` at `window` does not stop ANOTHER listener on the same target in the same
     phase, and a slide deck that advances on `window.addEventListener("click", next, true)` is
     exactly that: the Comment click moved the deck AND opened the card, so the note described a
     slide that had slid away. And `wheel` was not frozen at all, so turning it over a deck went to
     the next slide. So while pointing, drawing or holding, ONE window-capture listener per type —
     registered here, before any of the page's (this file is the first thing in <head>) — runs the
     bridge's own handler and then `stopImmediatePropagation`: no listener of the page's hears the
     event, wherever it listens. CANCELLED types also lose their default (a link, a submit, a
     focus, a selection); SILENCED ones keep it — pointer and touch for the reason above, the wheel
     so the page still scrolls (natively, or routed to the box under it: item 13). v19 also kept
     the moves "so `:hover` still shows what is pointed at"; since v23 the moves land on the
     bridge's shield and the page's `:hover` is HELD as it was at the freeze — the owner's call of
     2026-10-14, item 13. */
  const SILENCED = [
    "pointerdown",
    "pointerup",
    "pointercancel",
    "pointermove",
    "pointerover",
    "pointerout",
    "pointerenter",
    "pointerleave",
    "gotpointercapture",
    "lostpointercapture",
    "touchstart",
    "touchend",
    "touchmove",
    "touchcancel",
    "mousemove",
    "mouseover",
    "mouseout",
    "mouseenter",
    "mouseleave",
    "wheel",
    "focusin",
  ];
  const CANCELLED = [...FROZEN, "keypress"].filter((t, i, all) => all.indexOf(t) === i);
  const frozenNow = () => pick.on || draw.on || hold.on;

  /* A STYLE THE DOCUMENT MAKES NO RECORD OF (plan 73 round 4, U1): the pointer over something new
     (`:hover`), a focus (`:focus-within`), a checkbox or a field (`:checked`,
     `:placeholder-shown`) — each measured again, so a box near the screen that moved, showed or hid
     is painted as it is now; and the top layer opening or closing (a popover, a dialog, the
     fullscreen element), after which what lies over each mark is asked again. Registered BEFORE
     the freeze below, which silences these for every listener after it. Each asks again what
     lies over each mark too (round 5, V1) — and so does the address's fragment changing (round 5,
     V2): `:target` shows and hides with no record, and a fragment set by a script or by Back moves
     no pointer. */
  for (const type of [
    "mouseover",
    "mouseout",
    "focusin",
    "focusout",
    "change",
    "input",
    "toggle",
    "close",
    "fullscreenchange",
    "webkitfullscreenchange",
    "hashchange",
    "popstate",
  ])
    window.addEventListener(type, quietly(restyled), { capture: true, passive: true });

  for (const type of [...SILENCED, ...CANCELLED]) {
    const quiet = SILENCED.includes(type);
    window.addEventListener(
      type,
      (event) => {
        /* A PRESS ON A PAINTED DOT IS THE DOT'S, in every mode (round 3, T12): before the mode's
           own handlers, and no listener of the page's hears it */
        if (dotTaken(type, event) === true) {
          if (!quiet) evCancel(event);
          evStopNow(event);
          return;
        }
        ownQuietly(type, event);
        if (edit.on) {
          /* EDIT MODE'S OWN HANDLERS, then nothing of the page's — wherever it listens. Its two
             holes (our handles, the words being typed) keep their default, so a handle presses
             and a word types; no listener of the page's hears either. */
          for (const fn of editOwn[type] ?? []) quietly(fn)(event);
          if (!quiet && !passes(event)) evCancel(event);
          evStopNow(event);
          return;
        }
        if (!frozenNow()) return;
        if (!quiet) evCancel(event);
        /* THE WHEEL GOES ON, TO THE ROUTER, AND TO NOTHING OF THE PAGE'S (item 13): the router is
           the one listener that may cancel a wheel, so it exists only while frozen — added then,
           after the page's own window-capture listeners, which are held mute while frozen
           (`muteWheel`); stopping here would stop the router too. Every other target is stopped. */
        if (type === "wheel") evStop(event);
        else evStopNow(event);
      },
      { capture: true, passive: quiet },
    );
  }

  const ownQuietly = (type, event) => quietly(own)(type, event);

  /* THE PAINTED DOT TAKES ITS OWN PRESS (plan 73 round 3, T12). The page kept a transparent click
     target over each dot, placed from the last report — a frame behind its element while the page
     moves: 17–22 px at a 30-px wheel step, more than the dot's radius, so a press in a scroll frame
     landed on the page under the dot (in Browse often a button: the dot sits at the note's click
     point). The press is taken HERE instead, where the dot is painted, in the same frame as its
     element: hit-tested by the dot's own box, in the first window-capture listener (before any of
     the page's), swallowed whole — down, up, click, double click, the moves between — and said as
     `studio:dot {key, alt, shift}` on the release over the same dot. In Comment and with Comment
     off alike. A dot under the pointer is said too (`studio:dothover {key}`, on a change only), so
     the page lights its row and shows its tooltip; the page's own target stays for the keyboard's
     focus and the dot's name, and takes no pointer. */
  let dotPress = null;
  let dotHover = null;
  function dotAt(x, y) {
    if (!marks.shown || marks.painted.length === 0) return null;
    const under = [];
    for (const key of marks.painted) {
      if (key === "making") continue;
      const n = marks.nodes.get(key);
      if (n === undefined || n.spot.style.display === "none") continue;
      const r = n.dot.getBoundingClientRect();
      if (r.width === 0 || x < r.left || x > r.right || y < r.top || y > r.bottom) continue;
      under.push({ key, n, d: Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2)) });
    }
    under.sort((a, b) => a.d - b.d);
    for (const u of under) if (dotOnTop(u.n, x, y)) return u.key;
    return null;
  }
  /* A DOT TAKES THE PRESS ONLY WHERE IT IS WHAT THE PERSON SEES (plan 73 round 4, U3). The marks'
     layer sits one z-index under the top, after <body> — but the top layer (an open popover, a
     dialog opened modal, the fullscreen element) is drawn above every z-index, and a page's own box
     at the top z-index above ours. A dot hit-tested by its box alone took the press meant for the
     popover's button drawn over it. So the engine is asked what is on top at the press, with this
     one dot taking the pointer for the length of that question: the page's element there means the
     page draws over the dot, and the press is the page's. Paint order is hit-test order, so the
     answer is what the person sees, whatever made it so.

     AND WHAT THE PAGE DRAWS OVER THE NOTE'S OWN ELEMENT, ASKED AT THE PRESS (round 5, V1). Our
     layer paints over every box of the page's below the top z-index, so the question above answers
     "the dot" over the page's own menu opened by `:hover` over the noted paragraph — and the press
     meant for the menu's link opened the note. "Covered" is `coveredDot`'s rule; the painting asks
     it when something can have changed, and a style the document makes no record of (`:hover`,
     `:focus-within`, `:checked`, `:target`, a stylesheet rule a script edits, an animation that
     reveals a box) can leave that answer stale until the next measure. So the press never reads
     it: the same rule is asked here, fresh — the dot's painted centre inside what shows of its
     element NOW, with anything else of the page's on top there, makes the press the page's. */
  function dotOnTop(n, x, y) {
    if (typeof document.elementFromPoint !== "function") return true;
    const was = n.dot.style.pointerEvents;
    n.dot.style.pointerEvents = "auto";
    let top = null;
    try {
      top = document.elementFromPoint(x, y);
    } finally {
      n.dot.style.pointerEvents = was;
    }
    if (!(top === null || ours(top))) return false;
    return !overElement(n);
  }
  /** Does the page draw something else over the dot's element where the dot is painted — its
   *  centre inside what shows of the element now (`coveredDot`'s rule on the element, asked fresh)? */
  function overElement(n) {
    const v = n.id === undefined ? undefined : lastLive.get(n.id);
    if (v === undefined || !v.el.isConnected) return false;
    let vis = v.vis;
    if (v.area) {
      const at = resolve(n.id);
      if (at === null || at.unshown) return false;
      vis = at.rect;
    } else {
      /* where it shows, moved by however far its element moved since the last measure */
      const b = seenBox(v.el);
      vis = { x: vis.x + b.x - v.whole.x, y: vis.y + b.y - v.whole.y, w: vis.w, h: vis.h };
    }
    const r = n.dot.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    if (!(cx > vis.x + 1 && cx < vis.x + vis.w - 1 && cy > vis.y + 1 && cy < vis.y + vis.h - 1))
      return false;
    const top = pageAt(cx, cy);
    return !(top === null || top === v.el || v.el.contains(top) || top.contains(v.el));
  }
  const pointOf = (event) => {
    const t = event.changedTouches?.[0] ?? event;
    return { x: t.clientX, y: t.clientY };
  };
  function hoverDot(key) {
    if (key === dotHover) return;
    dotHover = key;
    post("studio:dothover", { key });
  }
  const dotTaken = quietly((type, event) => {
    if (type === "mousemove") {
      hoverDot(dotAt(event.clientX, event.clientY));
      return dotPress !== null && !dotPress.up;
    }
    if (type === "mouseout" && event.relatedTarget === null) hoverDot(null);
    if (type === "keydown") dotPress = null;
    const down = type === "pointerdown" || type === "touchstart";
    if (down || type === "mousedown") {
      /* the mouse's own down after a pointer's down this gesture already claimed */
      if (type === "mousedown" && dotPress?.via === "pointerdown" && !dotPress.mouse) {
        dotPress.mouse = true;
        return true;
      }
      const at = pointOf(event);
      const key = event.button > 0 ? null : dotAt(at.x, at.y);
      dotPress = key === null ? null : { key, via: type, mouse: type === "mousedown", up: false };
      return dotPress !== null;
    }
    if (dotPress === null) return false;
    if (type === "mouseup") {
      dotPress.up = true;
      if (dotAt(event.clientX, event.clientY) === dotPress.key)
        post("studio:dot", { key: dotPress.key, alt: event.altKey, shift: event.shiftKey });
      return true;
    }
    /* everything else of the gesture: the up, the click, a double click, the moves */
    return (
      type === "pointerup" ||
      type === "pointercancel" ||
      type === "click" ||
      type === "dblclick" ||
      type === "auxclick" ||
      type === "contextmenu" ||
      type === "touchend" ||
      type === "touchmove" ||
      type === "touchcancel" ||
      type === "selectstart" ||
      type === "dragstart" ||
      ((type === "pointermove" || type === "mousemove") && !dotPress.up)
    );
  });
  /** The bridge's own part of a frozen event, run inside the freeze's listener so nothing the
   *  freeze stops can silence it. Each part asks its own mode. */
  function own(type, event) {
    if (type === "mousemove") ownMove(event);
    else if (type === "mousedown") ownDown(event);
    else if (type === "mouseup") ownUp(event);
    else if (type === "mouseout" && event.relatedTarget === null && (pick.on || draw.on)) {
      /* THE POINTER LEFT THE FRAME: the ring goes with it, and the page's controls come back. */
      if (draw.from === null) hideOutline();
      aimed(null);
    }
  }

  /* A drag whose button was released somewhere this document never hears about. */
  window.addEventListener("blur", cancelDrag);

  function hideOutline() {
    outline.style.width = "0px";
    outline.style.height = "0px";
    outline.style.boxShadow = "none";
    outline.style.border = "0";
    label.textContent = "";
    label.style.display = "none";
  }

  /* POINTING: a 1.5-px ring in the accent and a soft halo, never a fill over what it points at,
     and the element's readable name in a small accent tag above it. DRAWING: a 1.5-px edge and the
     size. Both screen-sized (`px`). */
  function showOutline(rect, text, kind) {
    attach();
    const ring = kind === "draw" ? 0 : 2;
    outline.style.left = `${rect.x - ring / aim.scale}px`;
    outline.style.top = `${rect.y - ring / aim.scale}px`;
    outline.style.width = `${rect.w + (2 * ring) / aim.scale}px`;
    outline.style.height = `${rect.h + (2 * ring) / aim.scale}px`;
    outline.style.borderRadius = px(4);
    if (kind === "draw") {
      outline.style.boxShadow = "none";
      outline.style.border = `${px(1.5)} solid ${aim.accent}`;
    } else {
      outline.style.border = "0";
      outline.style.boxShadow = `0 0 0 ${px(1.5)} ${aim.accent}, 0 0 0 ${px(4)} color-mix(in srgb, ${aim.accent} 22%, transparent)`;
    }
    label.textContent = text;
    label.style.display = text === "" ? "none" : "block";
    label.style.background = aim.accent;
    label.style.color = aim.ink;
    label.style.font = `500 ${px(11)}/1 ui-monospace, SFMono-Regular, Menlo, monospace`;
    label.style.padding = `${px(4)} ${px(6)}`;
    label.style.borderRadius = px(4);
    label.style.left = `${rect.x - ring / aim.scale}px`;
    /* ABOVE THE ELEMENT, OR BELOW IT WHEN THERE IS NO ROOM ABOVE (v19, plan 73 D8): a link at the
       page's top had its tag cut off at y = 0. */
    const tag = 19 / aim.scale + 4 / aim.scale;
    const above = rect.y - ring / aim.scale - tag;
    label.style.top = `${above >= 0 ? above : rect.y + rect.h + ring / aim.scale + 4 / aim.scale}px`;
  }

  /* WHAT A PRESS IS ON: the engine's own answer — the event's target — when the person pressed
     (round 3, T5: measured to be the element under the pointer under any CSS `zoom`, in WebKit and
     Chromium alike), else the point: a press on a shield of ours (T6), or one a script made. */
  const under = (event) => {
    const t = event.isTrusted ? event.target : null;
    if (
      t instanceof Element &&
      t !== document.documentElement &&
      t !== document.body &&
      !ours(t) &&
      t.isConnected &&
      !quietly(unseenEl)(t)
    )
      return t;
    return hitAt(event.clientX, event.clientY);
  };

  /* A PAGE THAT TAKES NO POINTER (v24, H3): `pointer-events: none` on the page's root or body —
     a whole page of it, measured — and the engine's hit test answers `<html>` wherever the pointer
     is, so every pick was the root and lost at once. Then, and only when the test lands on the root
     or the body, it is asked again with one rule of ours that gives every element of the page the
     pointer back, taken away in the same task. Never always: a page's own pass-through overlay
     (a toast region, a gradient) would take every pick. */
  const REACH_CSS =
    ":not([data-studio-aim]):not([data-studio-aim] *):not(studio-marks):not([data-studio-edit]):not([data-studio-edit] *){pointer-events:auto!important}";
  let ignoring = { gen: -1, none: false };
  function ignoresPointer() {
    if (ignoring.gen === generation) return ignoring.none;
    const none = (el) => el !== null && getComputedStyle(el).pointerEvents === "none";
    ignoring = { gen: generation, none: none(html) || none(document.body) };
    return ignoring.none;
  }
  /* WHAT A PERSON SEES AT A POINT, NEVER WHAT IS STACKED THERE UNSEEN (slides and reloads,
     2026-10-14). A deck that fades its slides keeps every slide in the same place, the ones not
     showing at `opacity: 0` — and the engine's hit test answers an opacity-0 element like any
     other, so with the hidden slides later in the document a pick on slide 2's title was slide 3's
     (measured in Chromium and WebKit: `elementsFromPoint` lists the transparent one first). The
     first element of the page's own at the point that is not `unseenEl` is the one meant. */
  const shownOf = (list) => {
    for (const el of list) {
      if (ours(el)) continue;
      if (el === html || el === document.body || !quietly(unseenEl)(el)) return el;
    }
    return null;
  };
  function hitAt(x, y) {
    const found = shownOf(document.elementsFromPoint(x, y));
    if (found !== null && found !== html && found !== document.body) return found;
    if (!quietly(ignoresPointer)()) return found;
    const sheet = quietly(ownSheet)(REACH_CSS) ?? null;
    if (sheet === null) return found;
    try {
      return shownOf(document.elementsFromPoint(x, y)) ?? found;
    } finally {
      quietly(dropSheet)(sheet);
    }
  }

  /* WHAT IS POINTED AT, FOR THE PAGE'S CONTROLS (v19, plan 73 D8): the hovered element's box, or
     the band being drawn, at most once a frame, `null` when the pointer leaves or the mode ends —
     the page fades a control it would cover, so the whole page stays reachable while aiming. */
  let aimedAt = null;
  let aimedPoint = null;
  let aimedSent = "null";
  let aimedFrame = 0;
  /* AND WHERE THE POINTER IS (v21, the review's R8): a control the pointer is over has stood aside
     at once, before the pointer ever reached the page; it comes back when the pointer is clear of
     it, and only the pointer's own place can say so. */
  function aimed(rect, at = null) {
    aimedAt = rect;
    aimedPoint = rect === null ? null : at;
    if (aimedFrame !== 0) return;
    aimedFrame = requestAnimationFrame(() => {
      aimedFrame = 0;
      const said = json.stringify([aimedAt, aimedPoint]);
      if (said === aimedSent) return;
      aimedSent = said;
      post("studio:aimed", { screen: screenId(), rect: aimedAt, at: aimedPoint });
    });
  }

  function ownMove(event) {
    if (draw.on && draw.from !== null) {
      const to = { x: clampX(event.clientX), y: clampY(event.clientY) };
      const r = {
        x: Math.min(draw.from.x, to.x),
        y: Math.min(draw.from.y, to.y),
        w: Math.abs(to.x - draw.from.x),
        h: Math.abs(to.y - draw.from.y),
      };
      draw.rect = r;
      showOutline(r, `${r.w}×${r.h}`, "draw");
      aimed(r, { x: to.x, y: to.y });
      return;
    }
    if (!pick.on && !draw.on) return;
    /* over a painted dot, a press opens its note: nothing of the page is pointed at (T12) */
    if (dotHover !== null) {
      hideOutline();
      aimed(null);
      return;
    }
    const el = under(event);
    if (el === null) return;
    /* THE ROOT IS NOT OFFERED (H3): a press there is `studio:missed`, so no ring promises a note */
    if (pick.on && el === html) {
      hideOutline();
      aimed(null);
      return;
    }
    const b = seenBox(el);
    if (pick.on) showOutline(b, readableName(el), "pick");
    aimed(b, { x: Math.round(event.clientX), y: Math.round(event.clientY) });
  }

  /* ON `window`, IN THE CAPTURE PHASE, INSIDE THE FREEZE'S OWN LISTENER (v19): nothing the freeze
     stops can silence the bridge's own gesture. */
  function ownDown(event) {
    if (!draw.on || event.button !== 0) return;
    draw.from = { x: clampX(event.clientX), y: clampY(event.clientY) };
    evCancel(event);
  }

  /** What an element said, as its fingerprint keeps it (v20, D15): its text, whitespace folded, the
   *  first `n` characters. `textContent`, never `innerText`, which lays the page out to answer. */
  const saysOf = (el, n = 40) => (el?.textContent || "").replace(/\s+/g, " ").trim().slice(0, n);
  const HEADINGS = "h1,h2,h3,h4,h5,h6";
  /** The nearest heading before `el` in the document, or holding it — what a section is called. */
  function headingOf(el) {
    let near = null;
    for (const h of document.querySelectorAll(HEADINGS)) {
      if (h === el) continue;
      const pos = h.compareDocumentPosition(el);
      if (pos & Node.DOCUMENT_POSITION_FOLLOWING || h.contains(el)) near = h;
      else break;
    }
    return near;
  }

  /* ---------------------------------------------------------- the anchor (v22, plan 73 round 2)

     A PIN NEVER OUTLINES A STRANGER. v20 kept a pin on whatever its positional selector named when
     nothing else said the old words, and judged "the same" by a tag and 40 characters of text, so
     every text-less element of a tag was every other one. Measured 2026-10-13 (the review's R1):
     the pinned paragraph deleted, the pin outlined the one after it; the pinned paragraph reworded
     with a new one put before it, the pin outlined the new one; the second of two swatches pinned
     and a swatch put first, the pin moved to the first. So a pick records WHERE THE ELEMENT SITS as
     well as what it says, and finding it again is a judgement with three honest answers: the same
     element, the same element edited in place, or gone. Never the nearest guess.

     AND ITS PARENT IS THE PARENT, NOT A SHAPE (v22, the review's round 2). v21 placed a few words
     "by the parent" when the parent had the same TAG and classes, so every row of a table and
     every card of a grid was the parent: Bob's *Done* answered as *Blocked* moved the pin to
     Alice's *Done*, the second card's *Learn more* reworded moved it to the first card's (S1). A
     sort that rewrote each item's text in place took the pin with the node (S4). Two neighbours
     both rewritten, or a page translated, lost every pin (S6). A heading renamed while a copy of
     its old words went into the footer jumped to the footer (S7).

     THE FINGERPRINT: the tag; what it says (40 characters); the attributes that NAME a thing (what
     it shows, where it goes, what it is called); its classes; its id; its inline style (its
     "look"); the element before it and the one after it (each by what names it: its id, else its
     first 30 characters, else its classes and look); its parent's shape (tag, id, classes — never
     its words, which change with every child's); its place among the siblings of its tag, from
     the start and from the end; how many elements of its tag said the same words when it was
     picked (`twins`), and how many of those sat between the same two neighbours (`peers`); the
     heading; and, since v22, WHERE ITS PARENT SITS — each ancestor's place among its own kind, up
     to four levels (`up`) — and WHAT IS SAID AROUND IT: every word of its nearest ancestor that
     says anything besides it, less its own, as an order-free sum (`around`), with how many
     elements of its tag had those same words around them (`arounds`).

     THE PARENT ("home"). A candidate's parent is THE parent when the words around it are the
     words that were around the pin — and those were unique to it — or, when no candidate anywhere
     still has those words around it, when its parent has the same shape and every ancestor holds
     its place among its kind (from the start or from the end). An edge — no element before it, or
     none after it — counts as a neighbour only in THE parent: being first in SOME box says nothing.

     THE JUDGEMENT, in order — the first rule anything answers decides, and two answers equally good
     under that rule are no answer (the pin is not drawn):
       1. its id, when it had one and the document still has it on an element of its tag;
       2. the element the selector names, when it says the same and sits in place — THE parent, both
          neighbours — no search at all;
       3. ITS WORDS, STILL IN THE PARENT: an element that says the same, in THE parent, backed by
          words that were unique, a neighbour, or the same place among its kind (a sort, a reorder,
          a page that re-renders);
       4. ITS WORDS, MOVED WITH BOTH NEIGHBOURS: words that were unique, between the same two named
          neighbours, in another parent (a card carried to another column);
       5. EDITED IN PLACE: an element in THE parent between both of the pin's neighbours that says
          something else — the agent answered the note. The element that used to sit before or
          after it never counts: it says what a neighbour said, so it IS that neighbour, moved into
          the gap. This beats rule 6 on purpose: a whole place outranks words that left the parent
          without their neighbours (a copy of them added elsewhere is new content, never the pin);
       6. ITS WORDS ELSEWHERE: an element that says the same in another parent, backed by words that
          were unique, or by a named neighbour when no other element had those words between those
          neighbours;
       7. REWORDED, ONE NEIGHBOUR KEPT: in THE parent, beside one of its neighbours, keeping at least
          half its words;
       8. REWRITTEN WHERE IT WAS: when nothing in the document says the old words any more — two
          neighbours both rewritten, a page translated — the element at exactly its place: the same
          parent shape, every ancestor at the same place among the same number of its kind, and it
          at the same place among the same number of its kind;
       9. otherwise it is gone, and the page says so.
     AND EVERY RULE THAT EXPLAINS AN ELEMENT SAYING SOMETHING ELSE (5, 7, 8) ASKS FIRST WHETHER IT
     STANDS WHERE THE PIN STOOD (round 3, T1 — the review's "delete this one, reword that one, add
     one" put the deleted element's pin on its reworded neighbour, 6 of 6 variants). It does not
     when it says at least half of what the sibling on one side of the pin said, and no less of it
     than of the pin, while that sibling is not beside it on that side — it IS that neighbour,
     reworded into the gap; nor when the first sibling found on one side that sat within three
     places of the pin sits nearer than it sat — something between was taken out, which catches a
     neighbour rewritten wholly. THE parent by place asks the same of the box the pin's words sat
     in (its row, its card). A fingerprint written before round 3 (no `near`) has nothing to ask
     with, and is never judged by rules 7 or 8: lost there, never found on a stranger.
     Nothing to read at all (a swatch, an icon, an empty box) is the same by its look and its place
     only: THE parent and both neighbours — or one, with something NEW on the other side (an
     insertion explains it; a neighbour gone does not) — and edited in place only at the same place
     among the same number of its kind.

     AND WHILE THE DOCUMENT LIVES, THE PAGE MOVES IT (S4). Rules 5, 7 and 8 explain the AGENT's edit,
     which always arrives as a new document. Once a pin is found in this document, a change the
     page makes itself is a state, not an answer: when its node says something else (a sort that
     rewrites each item in place, a list keyed by index), the words are looked for again by rules 3,
     4 and 6 only, against the element as it was found; a node whose words changed in their numbers
     only is the same thing counting (a price, a clock) while what is around it still names the
     same thing (round 3, T3: `contextOf`, `holds`) — else the one element that counts it now with
     that around it is followed (a score after a re-sort); and where nothing says them now the pin
     is not showing now — it comes back when its words do. An element found and unchanged is never
     searched for again. */

  /** The attributes that NAME a thing: what it shows, where it goes, what it is called. */
  const NAMING = ["src", "href", "alt", "aria-label", "title", "name", "for", "placeholder"];
  /** Elements that are never a neighbour a person sees. */
  const UNSEEN = new Set(["SCRIPT", "STYLE", "TEMPLATE", "LINK", "META", "NOSCRIPT"]);
  const kin = (n) => n !== null && !UNSEEN.has(n.tagName) && !ours(n);
  function prevKin(el) {
    let n = el.previousElementSibling;
    while (n !== null && !kin(n)) n = n.previousElementSibling;
    return n;
  }
  function nextKin(el) {
    let n = el.nextElementSibling;
    while (n !== null && !kin(n)) n = n.nextElementSibling;
    return n;
  }
  const classesOf = (el) =>
    [...el.classList]
      .filter((c) => c.length <= 40)
      .sort()
      .slice(0, 8);
  /** An element's shape: its tag, its id, its first three classes. */
  const shapeOf = (el) =>
    el === null
      ? ""
      : `${el.tagName.toLowerCase()}${el.id === "" ? "" : `#${el.id.slice(0, 80)}`}${classesOf(el)
          .slice(0, 3)
          .map((c) => `.${c}`)
          .join("")}`;
  /** Its own inline style, folded — all a text-less swatch may have to tell it from the next. */
  const lookOf = (el) => (el.getAttribute("style") || "").replace(/\s+/g, " ").trim().slice(0, 60);
  /** A neighbour as the fingerprint keeps it, by what NAMES it: its id when it has one; else its
   *  first 30 characters; else, with nothing to read, its classes and its look. Never a class next
   *  to an id or words: a page toggles those as it is used (a coupon box `open`, a tab `active`),
   *  and a neighbour that changed state is the same neighbour. "" for none. */
  const sigOf = (el) => {
    if (el === null) return "";
    const tag = el.tagName.toLowerCase();
    if (el.id !== "") return `${tag}#${el.id.slice(0, 80)}`;
    const text = saysOf(el, 30);
    if (text !== "") return `${tag}:${text}`;
    const look = lookOf(el);
    return `${tag}${classesOf(el)
      .slice(0, 3)
      .map((c) => `.${c}`)
      .join("")}${look === "" ? "" : `[${look}]`}:`;
  };
  /** The fingerprint's own element as `sigOf` would say it. */
  const selfSig = (fp) => {
    if (fp.id !== "") return `${fp.tag}#${fp.id}`;
    if (fp.text !== "") return `${fp.tag}:${fp.text.slice(0, 30)}`;
    return `${fp.tag}${fp.cls
      .slice(0, 3)
      .map((c) => `.${c}`)
      .join("")}${fp.look === "" ? "" : `[${fp.look}]`}:`;
  };
  /** Its place among its parent's children of its tag: `nth` from the start, `of` them. While a
   *  search runs, each parent's children are counted once (`places`), never once per candidate —
   *  12,000 siblings made that 144 million steps. */
  let places = null;
  function placeIn(el) {
    const p = el.parentElement;
    if (p === null) return { nth: 0, of: 1 };
    const key = `${el.tagName}`;
    let byTag = places?.get(p);
    if (byTag?.has(key)) return byTag.get(key).get(el) ?? { nth: 0, of: 1 };
    const at = new Map();
    let of = 0;
    for (const c of p.children) {
      if (c.tagName !== el.tagName || !kin(c)) continue;
      at.set(c, of);
      of += 1;
    }
    const out = new Map([...at].map(([c, nth]) => [c, { nth, of }]));
    if (places !== null) {
      if (byTag === undefined) {
        byTag = new Map();
        places.set(p, byTag);
      }
      byTag.set(key, out);
    }
    return out.get(el) ?? { nth: 0, of: 1 };
  }
  function namingOf(el) {
    const out = {};
    for (const a of NAMING) {
      const v = el.getAttribute(a);
      if (v !== null && v !== "") out[a] = v.slice(0, 120);
    }
    return out;
  }
  /** Every element of a tag that is the page's, not ours. */
  const allOf = (tag) => [...document.getElementsByTagName(tag)].filter((c) => !ours(c));

  /* ---- v22: what is said around it, and where its parent sits ---- */
  const WORDS = /[^\p{L}\p{N}]+/u;
  /** A word's 32-bit FNV-1a hash. */
  function hashWord(w) {
    let h = 0x811c9dc5;
    for (let i = 0; i < w.length; i++) {
      h ^= w.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }
  const DIGIT = /\p{N}/u;
  /** Every word an element says, as an ORDER-FREE sum — `[sum of the words' hashes, how many, each
   *  word's hash → how many times, the hashes of the words with a digit in them]` — so a list sorted, or a row whose cells swapped, says the same.
   *  What is never seen, and ours, is skipped. While a search runs each element is read once. */
  let sums = null;
  function sumOf(el) {
    const kept = sums?.get(el);
    if (kept !== undefined) return kept;
    let sum = 0;
    let n = 0;
    const each = new Map();
    const nums = new Set();
    const walk = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: (node) =>
        node.nodeType === 1 && (UNSEEN.has(node.tagName) || ours(node))
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT,
    });
    for (let node = walk.nextNode(); node !== null; node = walk.nextNode()) {
      if (node.nodeType !== 3) continue;
      for (const w of node.data.toLowerCase().split(WORDS)) {
        if (w === "") continue;
        const h = hashWord(w);
        sum = (sum + h) >>> 0;
        n += 1;
        each.set(h, (each.get(h) ?? 0) + 1);
        if (DIGIT.test(w)) nums.add(h);
      }
    }
    const out = [sum, n, each, nums];
    sums?.set(el, out);
    return out;
  }
  /** How many of the words around it are kept: at most RING of them, the ones whose hashes are the
   *  smallest (a bottom-k sketch — exact for a row or a card, a fair sample of a long page). */
  const RING = 16;
  function ringAt(el, k) {
    const a = upFrom(el, k);
    if (a === null) return [];
    const mine = sumOf(el)[2];
    const out = [];
    for (const [h, n] of sumOf(a)[2]) if (n > (mine.get(h) ?? 0)) out.push(h);
    return out
      .sort((x, y) => x - y)
      .slice(0, RING)
      .map((h) => h.toString(36));
  }
  /** Are at least half the words that were around the pin still around `c` at level `k` — of the
   *  sketch the pin kept, how many `c`'s ancestor still says besides `c`? Words ADDED around it
   *  never count against it (a paragraph put beside it); words taken away do (a row that is
   *  another row). */
  function keptAround(ring, c, k) {
    if (ring.length === 0) return true;
    const a = upFrom(c, k);
    if (a === null) return false;
    const mine = sumOf(c)[2];
    const theirs = sumOf(a)[2];
    let kept = 0;
    for (const h of ring) {
      const n = Number.parseInt(h, 36);
      if ((theirs.get(n) ?? 0) > (mine.get(n) ?? 0)) kept += 1;
    }
    return kept * 2 >= ring.length;
  }
  /** The ancestor `k` levels up (1 is the parent), never past `<body>`; null where there is none. */
  function upFrom(el, k) {
    let a = el;
    for (let i = 0; i < k; i++) {
      if (a === document.body || a === html) return null;
      a = a.parentElement;
      if (a === null || a === html) return null;
    }
    return a;
  }
  /** The words around `el` at level `k`: its ancestor's words less its own, `k:sum:count`. */
  function aroundAt(el, k) {
    const a = upFrom(el, k);
    if (a === null) return "";
    const [as, an] = sumOf(a);
    const [os, on] = sumOf(el);
    return `${k}:${(as - os) >>> 0}:${an - on}`;
  }
  /** What is said around it: at its nearest ancestor (four levels at most) that says anything
   *  besides it — a table cell's row, a card button's card. "" when nothing near says anything. */
  function aroundOf(el) {
    const own = sumOf(el)[1];
    for (let k = 1; k <= 4; k++) {
      const a = upFrom(el, k);
      if (a === null) return "";
      if (sumOf(a)[1] > own) return aroundAt(el, k);
    }
    return "";
  }
  /** Its parent as `sigOf` names it, between the parent's own neighbours: `[before, it, after]`. */
  const besideOf = (p) =>
    p === null || p === document.body || p === html
      ? ["", "", ""]
      : [sigOf(prevKin(p)), sigOf(p), sigOf(nextKin(p))];
  /** Where its parent sits: each ancestor's place among its own kind, parent first, up to four
   *  levels, `<body>` not counted — `tag:nth:of`. */
  function upOf(el) {
    const out = [];
    for (let a = el.parentElement; out.length < 4; a = a.parentElement) {
      if (a === null || a === document.body || a === html) break;
      const at = placeIn(a);
      out.push(`${a.tagName.toLowerCase()}:${at.nth}:${at.of}`);
    }
    return out;
  }
  /** Does `c`'s parent hold the pin's parent's place: the same shape, and each recorded ancestor
   *  the same tag at the same place among the same number of its kind — or, where that number
   *  GREW, at the same place from the start or from the end (something was put before it, or
   *  after). Never where the number shrank: when the parent itself is taken out, the box after it
   *  takes its place from the start and the box before it from the end, and neither is it.
   *  `strict`: no growth either, the chain ending where it ended, and `c` itself at the pin's place
   *  among the same number. A v21 fingerprint recorded no chain, and has no place. */
  function placeHeld(c, fp, strict) {
    if (fp.up === null || shapeOf(c.parentElement) !== fp.parent) return false;
    let a = c.parentElement;
    /* A PARENT THAT SAYS WHAT THE PIN'S PARENT'S NEIGHBOUR SAID IS THAT NEIGHBOUR, moved into the
       gap — the row after a deleted row, with a row added at the end so every count is as it was */
    const [was, self, after] = fp.beside;
    const sig = sigOf(a);
    if (sig !== self && ((was !== "" && sig === was) || (after !== "" && sig === after)))
      return false;
    for (const u of fp.up) {
      if (a === null || a === document.body || a === html) return false;
      const [tag, n, o] = u.split(":");
      if (a.tagName.toLowerCase() !== tag) return false;
      const at = placeIn(a);
      const nth = Number(n);
      const of = Number(o);
      const same = at.nth === nth && at.of === of;
      const grown = at.of > of && (at.nth === nth || at.of - at.nth === of - nth);
      if (!same && (strict || !grown)) return false;
      a = a.parentElement;
    }
    /* AND THE BOX THE PIN'S WORDS SAT IN — its row, its card — IS NOT ITS NEIGHBOUR MOVED INTO THE
       GAP, reworded or not (round 3, T1) */
    if (fp.near?.unit) {
      const u = upFrom(c, fp.near.k);
      if (u === null || !standsIn(u, fp.near.unit, likeWords(u, unitWordsOf(fp)))) return false;
    }
    if (!strict) return true;
    if (fp.up.length < 4 && a !== null && a !== document.body && a !== html) return false;
    const at = placeIn(c);
    return at.nth === fp.nth && at.of === fp.of;
  }

  /* ---- round 3 (T1): what each neighbour SAID, and how far what survived around it sits ----

     v22 knew a neighbour by its first 30 characters only, and vetoed a candidate only when it said
     exactly that. The ordinary three-note round — delete this one, reword that one, add one — put
     the deleted element's pin on its reworded neighbour (the review's round 3, 6 of 6 variants),
     because the neighbour moved into the gap no longer said exactly what it said. So the
     fingerprint keeps what each neighbour said (a sketch of its words) and which siblings sat up to
     three places away on each side, for the element and for the box its words sat in (`near`). */
  const SKETCH = 8;
  /** An element's words as `near` keeps a neighbour's: how many distinct words, then the smallest
   *  eight of their hashes — `n.h.h…`; "" for none or nothing said. Exact for a line, a cell or a
   *  row; a fair sample of a long paragraph. */
  function sketchOf(el) {
    if (el === null) return "";
    const each = sumOf(el)[2];
    if (each.size === 0) return "";
    const hs = [...each.keys()].sort((x, y) => x - y).slice(0, SKETCH);
    return `${each.size}.${hs.map((h) => h.toString(36)).join(".")}`;
  }
  /** How alike an element's words are to a sketch (`{n, hs}`): twice the words they share over the
   *  words they have, 0–1 — what `alike` says of two texts, the shared count read off the sketch. */
  function likeSketch(el, s) {
    const mine = sumOf(el)[2];
    if (s === null || mine.size === 0) return 0;
    let both = 0;
    for (const h of s.hs) if (mine.has(h)) both += 1;
    return (2 * ((both * s.n) / s.hs.length)) / (s.n + mine.size);
  }
  /** How alike an element's words are to a set of word hashes, 0–1. */
  function likeWords(el, hs) {
    const mine = sumOf(el)[2];
    if (hs.size === 0 || mine.size === 0) return 0;
    let both = 0;
    for (const h of hs) if (mine.has(h)) both += 1;
    return (2 * both) / (hs.size + mine.size);
  }
  /** The words the pin's box said, as well as the fingerprint has them: the words around it (its
   *  ring) and its own. */
  function unitWordsOf(fp) {
    const out = new Set(fp.ring.map((h) => Number.parseInt(h, 36)));
    for (const w of fp.text.toLowerCase().split(WORDS)) if (w !== "") out.add(hashWord(w));
    return out;
  }
  /** A sibling as `near` keeps one: the hash of what names it (`sigOf`); "" for none. */
  const sigHash = (el) => (el === null ? "" : hashWord(sigOf(el)).toString(36));
  /** The siblings `from` to 3 places away on one side (`step`), each by `sigHash`, dot-joined. */
  function farOf(el, step, from) {
    const out = [];
    let n = el;
    for (let i = 1; i <= 3; i++) {
      n = n === null ? null : step(n);
      if (i >= from) out.push(sigHash(n));
    }
    return out.join(".");
  }
  /** What `near` records about `el`: the level of the box its words sat in (0 for none, or the
   *  page), what its neighbours said, its siblings two and three away; and the same of the box. */
  function nearOf(el, k) {
    const u = k === 0 ? null : upFrom(el, k);
    const box = u === null || u === document.body || u === html ? null : u;
    return [
      box === null ? 0 : k,
      sketchOf(prevKin(el)),
      sketchOf(nextKin(el)),
      farOf(el, prevKin, 2),
      farOf(el, nextKin, 2),
      box === null ? "" : sketchOf(prevKin(box)),
      box === null ? "" : sketchOf(nextKin(box)),
      box === null ? ".." : farOf(box, prevKin, 1),
      box === null ? ".." : farOf(box, nextKin, 1),
    ].join("~");
  }
  /** Does `x` stand where the pin stood among its siblings, as `side` recorded them
   *  (`{prev, next, before, after}`: the two neighbours' words, the siblings 1–3 away)? `own` is how
   *  alike `x` is to the pin itself. Two ways it does not:
   *   - IT IS A NEIGHBOUR, REWORDED: it says at least half of what the sibling on one side said —
   *     and no less of it than it says of the pin — while that sibling is not beside it on that
   *     side. A deletion moves the next element into the gap; rewording it does not make it the pin.
   *   - SOMETHING BETWEEN IT AND WHAT SURVIVED WAS TAKEN OUT: of the siblings that sat within three
   *     places of the pin on one side, the first one found on that side of `x` sits NEARER than it
   *     sat. (Further is fine: something was put between.) This catches the neighbour rewritten
   *     wholly, which says nothing of what it said.
   *  …EXCEPT WHEN `x` IS RECOGNISABLY THE PIN AND ONLY THE NEIGHBOUR WAS TAKEN OUT (round 4, U2):
   *  `x` says at least half of what the pin said, and right beside it is the sibling that sat two
   *  places off. Then the one sibling missing between them is the neighbour, whose words `near`
   *  kept, so the first test has already asked whether `x` is that neighbour reworded; `x` says
   *  more of the pin, and it is the pin, edited as asked while its neighbour was deleted. A gap of
   *  two or more, or a stranger between, still refuses: `x` could then be a farther sibling
   *  reworded, and `near` keeps no words for those. */
  function standsIn(x, side, own) {
    for (const [s, was, step] of [
      [side.prev, side.before, prevKin],
      [side.next, side.after, nextKin],
    ]) {
      if (s !== null && sigHash(step(x)) !== was[0]) {
        const like = likeSketch(x, s);
        if (like >= 0.5 && like >= own) return false;
      }
      let n = x;
      for (let i = 0; i < 3; i++) {
        n = step(n);
        if (n === null) break;
        const h = sigHash(n);
        if (was[i] === h) break;
        const j = was.indexOf(h);
        if (j === -1) continue;
        if (j > i && !(own >= 0.5 && i === 0 && j === 1 && s !== null)) return false;
        break;
      }
    }
    return true;
  }
  /** `standsIn` for the element itself (rules 5, 7 and 8). */
  const besideHolds = (x, fp) =>
    fp.near === null || standsIn(x, fp.near, alike(saysOf(x), fp.text));

  /** The fingerprint a pick is found again by (v22). */
  function fingerprintOf(el) {
    const mine = places === null;
    if (mine) {
      places = new Map();
      sums = new Map();
    }
    try {
      const tag = el.tagName.toLowerCase();
      const text = saysOf(el);
      const at = placeIn(el);
      const prev = sigOf(prevKin(el));
      const next = sigOf(nextKin(el));
      const around = aroundOf(el);
      const k = around === "" ? 0 : Number(around.split(":")[0]);
      const ring = k === 0 ? null : (upFrom(el, k)?.tagName ?? null);
      let twins = 0;
      let peers = 0;
      let arounds = 0;
      for (const c of allOf(tag)) {
        if (saysOf(c) === text) {
          twins += 1;
          if (sigOf(prevKin(c)) === prev && sigOf(nextKin(c)) === next) peers += 1;
        }
        if (ring !== null && upFrom(c, k)?.tagName === ring && aroundAt(c, k) === around)
          arounds += 1;
      }
      return {
        tag,
        text,
        heading: saysOf(headingOf(el)),
        id: el.id.slice(0, 80),
        attrs: namingOf(el),
        cls: classesOf(el),
        look: lookOf(el),
        prev,
        next,
        parent: shapeOf(el.parentElement),
        nth: at.nth,
        of: at.of,
        twins,
        peers,
        up: upOf(el),
        around,
        arounds,
        ring: k === 0 ? [] : ringAt(el, k),
        beside: besideOf(el.parentElement),
        near: nearOf(el, k),
      };
    } finally {
      if (mine) {
        places = null;
        sums = null;
      }
    }
  }

  /** What a pick says about an element — the card's words, the round's line, the agent's grep.
   *  `event` is the click, when there was one: where on the element it landed (v20). */
  function pickOf(el, event) {
    const b = seenBox(el);
    const point =
      event && b.w > 0 && b.h > 0
        ? {
            fx: Math.min(1, Math.max(0, frac((event.clientX - b.x) / b.w))),
            fy: Math.min(1, Math.max(0, frac((event.clientY - b.y) / b.h))),
          }
        : null;
    return {
      screen: screenId(),
      path: pathOf(el),
      selector: selectorOf(el),
      fingerprint: fingerprintOf(el),
      point,
      rect: b,
      text: (el.textContent || "").trim().slice(0, 80),
      name: readableName(el),
      tag: el.tagName.toLowerCase(),
      state: html.dataset.state || null,
      variant: html.dataset.variant || null,
      theme: html.dataset.theme || null,
    };
  }

  function ownUp(event) {
    if (draw.on && draw.from !== null) {
      /* THE GESTURE ENDS HERE, AND SO DOES EVERYTHING IT LEFT BEHIND. `draw.rect` used to
         outlive the drag, so the next press — a plain click, which produces no `mousemove` —
         re-posted the PREVIOUS drag's rectangle, and the band stayed painted over the screen in
         between. Measured 2026-09-17: a click at 900,700 reported the box drawn at 98,98. */
      const rect = draw.rect;
      draw.from = null;
      draw.rect = null;
      hideOutline();
      /* A CLICK IS NOT AN AREA: below the threshold there is no rectangle to talk about, and a
         6-px pin with an empty note is a glitch rather than a comment. */
      if (rect === null || (rect.w < MIN_DRAG && rect.h < MIN_DRAG)) return;
      post("studio:drawn", drawnOf(rect));
      return;
    }
    /* HELD: the click is the page's to answer — the card keeps its words, or an empty one gives
       way to the next pick in the same gesture, which is why the pick rides along. */
    if (hold.on) {
      if (event.button !== 0) return;
      const el = under(event);
      post("studio:away", {
        screen: screenId(),
        x: Math.round(event.clientX),
        y: Math.round(event.clientY),
        pick: el === null || el === html ? null : pickOf(el, event),
      });
      return;
    }
    /* THE MAIN BUTTON ONLY (v21, the review's R11): a right-click made a pick, and its menu was
       a note nobody meant. */
    if (!pick.on || event.button !== 0) return;
    pickOrMiss(under(event), event);
  }

  /* NOTHING BUT THE ROOT UNDER THE POINTER IS NOT A PICK (v24, H3): a note on `<html>` names the
     whole document and is found nowhere — the page says so where the person clicked
     (`studio:missed {x, y}`), and an area or the whole-page note is the way to talk about it all. */
  function pickOrMiss(el, at) {
    if (el === null || el === html) {
      post("studio:missed", { x: Math.round(at.clientX), y: Math.round(at.clientY) });
      return;
    }
    post("studio:picked", pickOf(el, at));
  }

  /** What `studio:drawn` says of an area: its rect, the components it covers, its anchor, its name
   *  — and the fingerprint of the element that holds it (issue #98, #7), so the area is found again
   *  by what that element says and where it sits, as a pick is, never by its selector alone. */
  function drawnOf(rect) {
    const node = areaHolder(rect) ?? document.documentElement;
    const covers = [...document.querySelectorAll("[data-slot],[data-screen]")]
      .filter((el) => {
        const b = seenBox(el);
        return (
          b.x < rect.x + rect.w && b.x + b.w > rect.x && b.y < rect.y + rect.h && b.y + b.h > rect.y
        );
      })
      .map(pathOf)
      .slice(0, 12);
    return {
      screen: screenId(),
      rect,
      covers,
      anchor: anchorFor(rect, node),
      fingerprint: node === document.documentElement ? null : fingerprintOf(node),
      name: areaName(rect),
    };
  }

  /* `studio:pickat {x, y}` (v21, the review's R6): the page's own click at a point of this frame is
     the pick there, as a click on the page would have been: a card while pointing, the card's
     answer while held.

     `studio:pickat {id, fx, fy}` (v22, the review's S9): ⌥ ON A DOT IS ANOTHER NOTE ON WHAT THAT DOT
     MARKS — its own element, or its own area — and never on whatever happens to be under the dot.
     v21 picked at the dot's point, and a small element's dot sits OUTSIDE it (R6), so ⌥ on the
     dot of a chip made a note on the whole page. The id is one the page already watches; the pick
     lands on the element's box at `fx, fy` (the first note's click point), and an area is drawn
     again where it is. In any mode but edit mode: a person asks for it by name, not by pointing. */
  function pickAt(msg) {
    if (typeof msg.id === "string" && msg.id !== "") {
      if (edit.on || !watched.includes(msg.id)) return;
      const at = resolve(msg.id);
      if (at === null || at.unshown) return;
      if (at.area) {
        post("studio:drawn", drawnOf(at.rect));
        return;
      }
      const b = seenBox(at.el);
      const fx = finite(msg.fx, 0, 1) ? msg.fx : 0.5;
      const fy = finite(msg.fy, 0, 1) ? msg.fy : 0.5;
      post("studio:picked", pickOf(at.el, { clientX: b.x + fx * b.w, clientY: b.y + fy * b.h }));
      return;
    }
    const x = Number(msg.x);
    const y = Number(msg.y);
    if (!Number.isFinite(x) || !Number.isFinite(y) || (!pick.on && !hold.on)) return;
    const el = hitAt(clampX(x), clampY(y));
    const at = { clientX: x, clientY: y };
    if (hold.on)
      post("studio:away", {
        screen: screenId(),
        x: Math.round(x),
        y: Math.round(y),
        pick: el === null || el === html ? null : pickOf(el, at),
      });
    else pickOrMiss(el, at);
  }

  function flash(path) {
    const el = [...document.querySelectorAll("*")].find((node) => pathOf(node) === path);
    if (el === undefined) return;
    attach();
    layer.style.display = "block";
    showOutline(seenBox(el), readableName(el), "pick");
    setTimeout(() => {
      if (!pick.on && !draw.on) layer.style.display = "none";
      hideOutline();
    }, 900);
  }

  /* ---------------------------------------------------------- the anchor an area hangs off */

  /* AN AREA IS ALSO ANCHORED TO AN ELEMENT, or it hangs in the viewport while the screen moves
     under it. A drawn rect used to be a frozen pair of viewport coordinates with no selector, so
     it was never in `watched` and never followed anything: scroll the screen and the box marks
     different content, while the ELEMENT pins beside it move correctly. That mix — some pins
     following, one staying — is what reads as a pin jumping to a weird position.

     The anchor is the deepest element whose own box CONTAINS the rect, plus the offset into it
     and the size. All of that goes in the id, so the bridge needs no memory of its own and an
     anchor still resolves after a reload.

     THE OFFSET IS INTO THE ANCHOR'S CONTENT, NOT ITS BORDER BOX, and that difference is the
     whole fix. An area drawn across two cards is held by no card — the deepest element that
     contains it is the SCROLLER, whose own box does not move when you scroll it. Measured
     2026-09-17: anchored to `#scroller`, the pin sat at y = 99 before and after a 400-px scroll,
     while the element pins beside it moved correctly. Adding `scrollTop`/`scrollLeft` on the way
     in and taking it off again on the way out makes the offset a position in the CONTENT, which
     is what moves. An element that does not scroll has both at 0, so there is one formula. */
  const AREA = /^area:(-?\d+),(-?\d+),(\d+),(\d+)\|([\s\S]+)$/;
  /* v10: THE SAME ANCHOR AS FRACTIONS OF ITS ANCHOR'S BOX — its content box when it scrolls — so an
     area drawn at one width covers the same thing at another, where a pixel offset drifts off it.
     A pixel anchor already stored still reads (`AREA`). */
  const AREA_F = /^area:f(-?[\d.]+),(-?[\d.]+),([\d.]+),([\d.]+)\|([\s\S]+)$/;
  /** The box an anchor's fractions are of: its content when it scrolls, else its own box. */
  function extent(node, b) {
    /* in screen px, like `b`: a scroll length is the element's own px, times its zoom (T5) */
    const z = cssZoom(node);
    const w = node.scrollWidth > node.clientWidth + 1 ? node.scrollWidth * z : b.w;
    const h = node.scrollHeight > node.clientHeight + 1 ? node.scrollHeight * z : b.h;
    return { w: w > 0 ? w : 1, h: h > 0 ? h : 1 };
  }
  /** How far a box is scrolled, in screen px. */
  const scrolledBy = (node) => {
    const z = cssZoom(node);
    return { x: node.scrollLeft * z, y: node.scrollTop * z };
  };
  const frac = (v) => Math.round(v * 100000) / 100000;

  /** The deepest element whose own box CONTAINS the rect, or null. */
  /* FROM WHAT THE PERSON SEES UNDER ITS MIDDLE, THROUGH OUR OWN SHIELD (slides and reloads,
     2026-10-14). It asked `elementFromPoint`, which since v23's whole freeze answers the shield
     that covers the viewport while anything was hovered at the freeze — ours, so the walk started
     nowhere and EVERY such area hung off `<html>`: on a deck that changes slides without scrolling,
     an area drawn on slide 12 was drawn on every slide, its line named no element, and the agent
     was handed fractions of the whole document. `hitAt` skips our nodes and what does not show. */
  function areaHolder(rect) {
    let start = hitAt(rect.x + rect.w / 2, rect.y + rect.h / 2);
    if (start !== null && ours(start)) start = null;
    for (let node = start; node !== null; node = node.parentElement) {
      const b = seenBox(node);
      if (
        b.x <= rect.x &&
        b.y <= rect.y &&
        b.x + b.w >= rect.x + rect.w &&
        b.y + b.h >= rect.y + rect.h
      )
        return node;
    }
    return null;
  }

  function anchorFor(rect, held = areaHolder(rect)) {
    const node = held ?? document.documentElement;
    const b = seenBox(node);
    /* `selectorOf` walks up to <html> and stops, so the root itself names nothing — and an area
       held by nothing smaller than the page is anchored to the page (v20, plan 73): before it, it
       had no anchor at all, was never drawn, and its line said nothing anyone could read back. */
    const sel = node === document.documentElement ? "html" : selectorOf(node);
    if (sel === "") return "";
    const e = extent(node, b);
    const by = scrolledBy(node);
    const fx = frac((rect.x - b.x + by.x) / e.w);
    const fy = frac((rect.y - b.y + by.y) / e.h);
    return `area:f${fx},${fy},${frac(rect.w / e.w)},${frac(rect.h / e.h)}|${sel}`;
  }

  /* A PICK'S ID WITH ITS FINGERPRINT. v21 and v22: `fp:<the fingerprint as JSON, URI-encoded>|<selector>`.
     v20's `el:<tag>;<text>;<heading>|<selector>` (each part URI-encoded) still reads: it knows
     what the element said and nothing of where it sat, so it is judged by its words alone. */
  const PRINTED = /^fp:([^|]*)\|([\s\S]+)$/;
  const FINGER = /^el:([^;|]*);([^;|]*);([^;|]*)\|([\s\S]+)$/;
  const decode = (v) => {
    try {
      return decodeURIComponent(v);
    } catch {
      return null;
    }
  };
  const TAG = /^[a-z][a-z0-9-]{0,31}$/;
  const str = (v, max) => (typeof v === "string" && v.length <= max ? v : null);
  const whole = (v) => (Number.isSafeInteger(v) && v >= 0 && v <= 100000 ? v : null);
  /** A v21 or v22 fingerprint off a watched id — the page's words, so every field is checked — or
   *  null. */
  function printFrom(raw) {
    let f = null;
    try {
      f = json.parse(raw);
    } catch {
      return null;
    }
    if (f === null || typeof f !== "object" || typeof f.tag !== "string" || !TAG.test(f.tag))
      return null;
    const fp = {
      tag: f.tag,
      text: str(f.text, 40),
      heading: str(f.heading, 40),
      id: str(f.id, 80),
      attrs: {},
      cls: Array.isArray(f.cls) && f.cls.length <= 8 ? f.cls.map((c) => str(c, 40)) : null,
      look: str(f.look, 60),
      prev: str(f.prev, 300),
      next: str(f.next, 300),
      parent: str(f.parent, 300),
      nth: whole(f.nth),
      of: whole(f.of),
      twins: whole(f.twins),
    };
    for (const k of Object.keys(fp)) if (fp[k] === null) return null;
    if (fp.cls.includes(null)) return null;
    if (f.attrs === null || typeof f.attrs !== "object") return null;
    for (const [k, v] of Object.entries(f.attrs)) {
      if (!NAMING.includes(k) || str(v, 120) === null) return null;
      fp.attrs[k] = v;
    }
    /* v22's six, taken whole or not at all. A v21 fingerprint has none of them: it knows no
       ancestor's place and nothing said around it, so no parent is ever THE parent for it — its
       words need a named neighbour, or to have been unique — and its peers are its twins. */
    const v22 = ["up", "around", "arounds", "peers", "ring", "beside"];
    fp.near = null;
    if (v22.every((k) => f[k] === undefined)) {
      fp.up = null;
      fp.around = "";
      fp.arounds = 0;
      fp.peers = fp.twins;
      fp.ring = [];
      fp.beside = ["", "", ""];
      return fp;
    }
    fp.beside =
      Array.isArray(f.beside) &&
      f.beside.length === 3 &&
      f.beside.every((s) => str(s, 300) !== null)
        ? f.beside
        : null;
    const strings = (v, max, re) =>
      Array.isArray(v) && v.length <= max && v.every((u) => typeof u === "string" && re.test(u))
        ? v
        : null;
    fp.peers = whole(f.peers);
    fp.arounds = whole(f.arounds);
    fp.around = typeof f.around === "string" && AROUND.test(f.around) ? f.around : null;
    fp.up = strings(f.up, 4, UP);
    fp.ring = strings(f.ring, RING, HASH);
    for (const k of v22) if (fp[k] === null) return null;
    /* ROUND 3's `near`, when it has one: a v22 fingerprint written before it has none, and is never
       judged by rules 7 or 8 — the two that a neighbour reworded into the gap could answer */
    if (f.near !== undefined) {
      fp.near = nearFrom(f.near, fp);
      if (fp.near === null) return null;
    }
    return fp;
  }
  const SK = "(?:\\d{1,6}(?:\\.[0-9a-z]{1,7}){1,8})?";
  const H = "[0-9a-z]{0,7}";
  const NEAR = new RegExp(
    `^([0-4])~(${SK})~(${SK})~(${H}\\.${H})~(${H}\\.${H})~(${SK})~(${SK})~(${H}\\.${H}\\.${H})~(${H}\\.${H}\\.${H})$`,
  );
  /** A sketch off `near` — `{n, hs}` — or null for none. */
  function sketchFrom(s) {
    if (s === "") return null;
    const [n, ...hs] = s.split(".");
    return { n: Math.max(Number(n), hs.length), hs: hs.map((h) => Number.parseInt(h, 36)) };
  }
  /** `near` off the page's words, checked whole, or null. */
  function nearFrom(raw, fp) {
    if (typeof raw !== "string") return null;
    const m = NEAR.exec(raw);
    if (m === null) return null;
    const own = (sig) => (sig === "" ? "" : hashWord(sig).toString(36));
    const k = Number(m[1]);
    return {
      k,
      prev: sketchFrom(m[2]),
      next: sketchFrom(m[3]),
      before: [own(fp.prev), ...m[4].split(".")],
      after: [own(fp.next), ...m[5].split(".")],
      unit:
        k === 0
          ? null
          : {
              prev: sketchFrom(m[6]),
              next: sketchFrom(m[7]),
              before: m[8].split("."),
              after: m[9].split("."),
            },
    };
  }
  const AROUND = /^(?:[1-4]:\d{1,10}:\d{1,7})?$/;
  const UP = /^[a-z][a-z0-9-]{0,31}:\d{1,6}:\d{1,6}$/;
  const HASH = /^[0-9a-z]{1,7}$/;

  /** Words as a set, for how many of them an edit kept. */
  const wordsOf = (s) =>
    new Set(
      s
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter(Boolean),
    );
  /** How alike two texts are: twice the words they share over the words they have (0–1). */
  function alike(a, b) {
    const A = wordsOf(a);
    const B = wordsOf(b);
    if (A.size === 0 || B.size === 0) return 0;
    let both = 0;
    for (const w of A) if (B.has(w)) both += 1;
    return (2 * both) / (A.size + B.size);
  }
  /** Do two class lists name the same kind of thing — half of them shared, or both empty? */
  function sameKind(a, b) {
    if (a.length === 0 && b.length === 0) return true;
    const B = new Set(b);
    const both = a.filter((c) => B.has(c)).length;
    return both / (a.length + b.length - both) >= 0.5;
  }

  /** Nothing of its own to read — no words, no naming attribute: a swatch, an icon, an empty box.
   *  Its look is all it says, and only its place can tell it from its kind. */
  const bareOf = (fp) => fp.text === "" && Object.keys(fp.attrs ?? {}).length === 0;
  /** Words that were unique when it was picked: 12 characters or a naming attribute, no twin. */
  const uniqueOf = (fp) =>
    (fp.text.length >= 12 || Object.keys(fp.attrs).length > 0) && fp.twins <= 1;

  /** What one element holds of a fingerprint (v22) — the facts every rule is read from — or null
   *  when it neither says it nor sits by either old neighbour, which is where a search over a page
   *  of thousands stops for nearly all of them. THE PARENT is decided after, over every candidate. */
  function evidence(c, fp) {
    const naming = NAMING.every(
      (k) => (c.getAttribute(k) || "").slice(0, 120) === (fp.attrs[k] || ""),
    );
    const text = saysOf(c);
    const bare = bareOf(fp);
    const says =
      text === fp.text &&
      naming &&
      sameKind(classesOf(c), fp.cls) &&
      (!bare || lookOf(c) === fp.look);
    const before = prevKin(c);
    const after = nextKin(c);
    const atPrev = sigOf(before) === fp.prev;
    const atNext = sigOf(after) === fp.next;
    if (!says && !atPrev && !atNext) return null;
    const k = fp.around === "" ? 0 : Number(fp.around.split(":")[0]);
    /* THE WORDS AROUND IT ARE THE WORDS THAT WERE AROUND THE PIN, and those were its own */
    const words = k > 0 && fp.arounds <= 1 && aroundAt(c, k) === fp.around;
    /* ITS PARENT HOLDS THE PIN'S PARENT'S PLACE, and half the words that were around it still are */
    const place = placeHeld(c, fp, false) && (k === 0 || keptAround(fp.ring, c, k));
    const at = placeIn(c);
    return {
      el: c,
      text,
      says,
      before,
      after,
      atPrev,
      atNext,
      words,
      place,
      parent: shapeOf(c.parentElement) === fp.parent,
      nth: at.nth === fp.nth,
      fromEnd: at.of - at.nth === fp.of - fp.nth,
      of: at.of === fp.of,
    };
  }

  /** Which rule (3–7, the comment above) answers for one candidate, 0 for none, given whether its
   *  parent is THE parent; and its score among the others the same rule answers for. */
  function standing(e, fp, home) {
    const bare = bareOf(fp);
    /* A NEIGHBOUR counts by what named it; an EDGE (none before, none after) only in THE parent */
    const prev = e.atPrev && (fp.prev !== "" || home);
    const next = e.atNext && (fp.next !== "" || home);
    const namedPrev = e.atPrev && fp.prev !== "";
    const namedNext = e.atNext && fp.next !== "";
    const score =
      (e.words ? 8 : 0) +
      (e.place ? 2 : 0) +
      (prev ? 4 : 0) +
      (next ? 4 : 0) +
      (e.parent ? 2 : 0) +
      (e.nth ? 2 : 0) +
      (e.fromEnd ? 2 : 0);
    const self = selfSig(fp);
    if (bare) {
      /* SOMETHING NEW SITS ON THAT SIDE — present, not the neighbour it had, not one like it: an
         insertion explains the neighbour that changed. A neighbour gone explains nothing: it, or
         the element itself, was taken out, and the page left is the same either way. */
      const fresh = (n, was) => n !== null && sigOf(n) !== was && sigOf(n) !== self;
      const placed =
        home &&
        ((prev && next) || (prev && fresh(e.after, fp.next)) || (next && fresh(e.before, fp.prev)));
      if (e.says && placed) return { rule: 3, score };
      if (
        !e.says &&
        home &&
        prev &&
        next &&
        e.nth &&
        e.of &&
        sameKind(classesOf(e.el), fp.cls) &&
        besideHolds(e.el, fp)
      )
        return { rule: 5, score };
      return { rule: 0, score };
    }
    const unique = uniqueOf(fp);
    if (e.says) {
      if (home && (unique || prev || next || e.nth)) return { rule: 3, score };
      if (unique && namedPrev && namedNext) return { rule: 4, score };
      if (unique || ((namedPrev || namedNext) && fp.peers <= 1)) return { rule: 6, score };
      return { rule: 0, score };
    }
    /* IT SAYS WHAT THE ELEMENT BEFORE OR AFTER IT SAID: it is that neighbour, moved into the gap. */
    const sig = sigOf(e.el);
    if (sig !== self && (sig === fp.prev || sig === fp.next)) return { rule: 0, score };
    if (!home) return { rule: 0, score };
    /* NOR A NEIGHBOUR REWORDED INTO THE GAP, NOR ONE WITH SOMETHING TAKEN OUT BESIDE IT (round 3) */
    if (!besideHolds(e.el, fp)) return { rule: 0, score };
    if (prev && next) return { rule: 5, score };
    /* a fingerprint without `near` cannot tell a reworded neighbour: no rule 7 for it */
    if ((prev || next) && fp.near !== null && alike(e.text, fp.text) >= 0.5)
      return { rule: 7, score };
    return { rule: 0, score };
  }

  /** The one best of several under one rule by how much of where it sat still holds, the heading
   *  over it breaking a tie — or null when the best two are still equal. */
  function best(list, fp) {
    if (list.length === 0) return null;
    if (list.length === 1) return list[0].el;
    const top = Math.max(...list.map((x) => x.score));
    const first = list.filter((x) => x.score === top);
    if (first.length === 1) return first[0].el;
    if (fp.heading === "") return null;
    const under = first.filter((x) => saysOf(headingOf(x.el)) === fp.heading);
    return under.length === 1 ? under[0].el : null;
  }

  /** The element a v22 fingerprint names now: the same one, the same one edited, or null.
   *  `live`: the page changed the document it was found in — its words are looked for, by rules
   *  3, 4 and 6, and nothing else (the comment above). */
  function anchorOf(fp, selector, live = false) {
    let named = null;
    try {
      named = document.querySelector(selector);
    } catch {
      named = null;
    }
    if (named !== null && (ours(named) || named.tagName.toLowerCase() !== fp.tag)) named = null;
    /* 1. ITS ID */
    if (fp.id !== "") {
      const el = document.getElementById(fp.id);
      if (el !== null && !ours(el) && el.tagName.toLowerCase() === fp.tag) return el;
    }
    places = new Map();
    sums = new Map();
    try {
      /* 2. WHERE THE SELECTOR SAYS, AND EVERYTHING AGREES */
      if (named !== null) {
        const e = evidence(named, fp);
        if (e?.says && e.atPrev && e.atNext && (e.words || e.place)) return named;
      }
      /* 3–7. THE DOCUMENT */
      const all = [];
      for (const el of allOf(fp.tag)) {
        const e = evidence(el, fp);
        if (e !== null) all.push(e);
      }
      /* THE PARENT: the one still saying what was around the pin, when one does; else the one
         holding its place */
      const elsewhere = all.some((e) => e.words);
      const rules = new Map();
      for (const e of all) {
        const s = standing(e, fp, e.words || (e.place && !elsewhere));
        if (s.rule === 0 || (live && !e.says)) continue;
        if (!rules.has(s.rule)) rules.set(s.rule, []);
        rules.get(s.rule).push({ el: e.el, score: s.score });
      }
      for (const rule of [3, 4, 5, 6, 7]) if (rules.has(rule)) return best(rules.get(rule), fp);
      if (live || fp.near === null) return null;
      /* 8. REWRITTEN WHERE IT WAS: nothing answered by its words or beside a neighbour — the
         element at exactly its place, never one that says what a neighbour said */
      const self = selfSig(fp);
      const exact = [];
      for (const el of allOf(fp.tag)) {
        if (!placeHeld(el, fp, true)) continue;
        const sig = sigOf(el);
        if (sig !== self && (sig === fp.prev || sig === fp.next)) continue;
        if (bareOf(fp) && !sameKind(classesOf(el), fp.cls)) continue;
        if (!besideHolds(el, fp)) continue;
        exact.push({ el, score: 0 });
      }
      return best(exact, fp);
    } finally {
      places = null;
      sums = null;
    }
  }

  /** A v20 id's element: judged by its words alone, since it knows nothing of where it sat. */
  function anchorOfOld(fp, selector) {
    let named = null;
    try {
      named = document.querySelector(selector);
    } catch {
      named = null;
    }
    if (named !== null && (ours(named) || named.tagName.toLowerCase() !== fp.tag)) named = null;
    const says = (c) => saysOf(c) === fp.text;
    /* nothing it said to find it by: the selector's element, as before v20 */
    if (fp.text === "") return named !== null && says(named) ? named : null;
    if (named !== null && says(named)) return named;
    let hits = allOf(fp.tag).filter(says);
    if (hits.length > 1 && fp.heading !== "")
      hits = hits.filter((c) => saysOf(headingOf(c)) === fp.heading);
    return hits.length === 1 && fp.text.length >= 12 ? hits[0] : null;
  }

  /* THE ELEMENT EACH ID WAS LAST FOUND AT in this document, and the element as it was found: its
     words (`seen`), its fingerprint then (`fp`), and the document's generation it was last looked
     at in (`gen`). Nothing is searched for again while the document does not change, nor while the
     element still says what it said when it was found (v22, the review's S4): a node the page
     kept and gave other words — a sort that rewrites each item in place, a list keyed by index —
     is not the pin any more. `el` null: it was found here once, and nothing says its words now. */
  const found = new Map();
  /** An element as `found` compares it: its words and its naming attributes — never its classes or
   *  its style, which a page changes as it is used — and, for a thing with nothing to read, its
   *  look. */
  const seenAs = (el, fp) =>
    `${saysOf(el)}\u0001${json.stringify(namingOf(el))}${bareOf(fp) ? `\u0001${lookOf(el)}` : ""}`;
  /** Did only its numbers change — a price, a count, a clock: the same thing, counting? */
  const counting = (was, now) => {
    const [a, ...ra] = was.split("\u0001");
    const [b, ...rb] = now.split("\u0001");
    const digits = /\p{N}/u;
    const skeleton = (s) => s.replace(/\p{N}+/gu, "#");
    return (
      ra.join("\u0001") === rb.join("\u0001") &&
      digits.test(a) &&
      digits.test(b) &&
      skeleton(a) === skeleton(b)
    );
  };
  /* WHAT SETS A COUNTED THING APART (round 3, T3). v22 kept a found node whose words changed in
     their digits only as "the same thing counting" — so a price cell a page reused for the next
     page's product, or Bob's score cell after a leaderboard re-sorted by index, kept the pin: the
     review measured *Widget B*'s $18.50 pin on *Gadget F*'s $9.99, Bob's 90 pts on Alice's 120. A
     number is the same thing counting only while what is said AROUND it still names the same
     thing. `contextOf` reads that when the element is found; `holds` asks it again. */
  /** The words around `el` in `box`, less its own: `[names, nums]` — those with a digit apart. */
  function aroundWords(el, box) {
    const [, , theirs, digits] = sumOf(box);
    const mine = sumOf(el)[2];
    const names = [];
    const nums = [];
    for (const [h, n] of theirs) if (n > (mine.get(h) ?? 0)) (digits.has(h) ? nums : names).push(h);
    return [names, nums];
  }
  /** What sets a found element's place apart: the level `k` of its nearest ancestor that says
   *  anything besides it (its row, its card — 0 for none); the words there that no other such box
   *  of its kind said (`marks`: *Widget B*'s *B*, Bob's name beside his score — every word there
   *  when no other box is of its kind); and the numbers there (`nums`), which are all a look-alike
   *  row has to name it by (*Server 1*, *Order 1234*). */
  function contextOf(el) {
    const own = sumOf(el)[1];
    let k = 0;
    for (let i = 1; i <= 4 && k === 0; i++) {
      const a = upFrom(el, i);
      if (a === null) break;
      if (sumOf(a)[1] > own) k = i;
    }
    if (k === 0) return { k: 0, marks: [], nums: [] };
    const box = upFrom(el, k);
    const [names, nums] = aroundWords(el, box);
    const elsewhere = new Set();
    const seen = new Set([box]);
    for (const c of allOf(el.tagName)) {
      const b = upFrom(c, k);
      if (b === null || seen.has(b) || b.tagName !== box.tagName) continue;
      seen.add(b);
      if (b.contains(box) || box.contains(b)) continue;
      for (const h of sumOf(b)[2].keys()) elsewhere.add(h);
    }
    return { k, marks: names.filter((h) => !elsewhere.has(h)), nums };
  }
  /** Does what is around `el` now still name what was around the pin (`ctx`)? Every mark is still
   *  there — words ADDED around it never count against it (a toast, a note); and where nothing set
   *  it apart but its numbers, half of them are. Nothing around it at all: its own words are all
   *  it has, and they only counted. */
  function holds(ctx, el) {
    if (ctx.k === 0) return true;
    const box = upFrom(el, ctx.k);
    if (box === null) return false;
    const [names, nums] = aroundWords(el, box);
    if (ctx.marks.length > 0) {
      const now = new Set(names);
      return ctx.marks.every((h) => now.has(h));
    }
    if (ctx.nums.length === 0) return true;
    const now = new Set(nums);
    return ctx.nums.filter((h) => now.has(h)).length * 2 >= ctx.nums.length;
  }
  /** One session of the search's caches around `fn`, or the one already open. */
  function measured(fn) {
    const mine = places === null;
    if (mine) {
      places = new Map();
      sums = new Map();
    }
    try {
      return fn();
    } finally {
      if (mine) {
        places = null;
        sums = null;
      }
    }
  }
  /** The fingerprint of an element found in this document, read as a watched id's is. */
  const refound = (el) => printFrom(json.stringify(fingerprintOf(el)));
  /** What `findPrinted` answers for a pin found in this document whose words nothing says now. */
  const UNSHOWN = { el: null, moved: false, unshown: true };
  const NOWHERE = { x: 0, y: 0, w: 0, h: 0 };
  /* AND EACH ID FOUND NOWHERE, with the document's generation it was looked for in (v21, the
     review's R4): a lost pin on a page of 12,000 elements re-searched them on every scroll frame
     (12–18 ms a measure). Nothing in the document changed, so nothing can have come back: the
     answer is kept until the document's observer says something did. */
  const lostAt = new Map();
  let generation = 0;

  /** The element a fingerprinted id names now, and whether it had to be found again (D15) — or
   *  `UNSHOWN` (v22, S4), or null when it is not on the page. */
  function findPrinted(id, fp, selector, old) {
    const named = () => {
      try {
        return document.querySelector(selector);
      } catch {
        return null;
      }
    };
    const was = found.get(id);
    if (was !== undefined) {
      if (was.gen === generation) return was.el === null ? UNSHOWN : was;
      was.gen = generation;
      /* THE DOCUMENT CHANGED: unchanged, it is still the pin — one comparison, no search */
      const live = was.el?.isConnected === true && !ours(was.el);
      const now = live ? seenAs(was.el, was.fp) : null;
      if (now !== null && now === was.seen) return was;
      /* ITS NODE SAYS SOMETHING ELSE, OR IS GONE: the page moved it — its words, and nothing else */
      const el = old ? anchorOfOld(was.fp, selector) : anchorOf(was.fp, selector, true);
      /* ITS NUMBERS CHANGED, AND ONLY THEM, AND WHAT IS AROUND IT STILL NAMES THE SAME THING: the
         same thing, counting — in place (a total after a coupon, a badge, a clock), or, when the
         page moved it, the one element that counts it now (Bob's score after the re-sort) */
      const counted =
        el !== null
          ? el
          : measured(() => {
              if (now !== null && counting(was.seen, now) && holds(was.ctx, was.el)) return was.el;
              const hits = allOf(was.fp.tag).filter(
                (c) => c !== was.el && counting(was.seen, seenAs(c, was.fp)) && holds(was.ctx, c),
              );
              return hits.length === 1 ? hits[0] : null;
            });
      if (counted !== null) {
        was.el = counted;
        was.moved = counted !== named();
        was.seen = seenAs(counted, was.fp);
        measured(() => {
          if (!old) was.fp = refound(counted);
          was.ctx = contextOf(counted);
        });
        return was;
      }
      /* NOTHING SAYS ITS WORDS NOW, AND NOTHING COUNTS IT: not showing — until they come back */
      was.el = null;
      return UNSHOWN;
    }
    if (lostAt.get(id) === generation) return null;
    const el = old ? anchorOfOld(fp, selector) : anchorOf(fp, selector);
    if (el === null) {
      lostAt.set(id, generation);
      return null;
    }
    const [live, ctx] = measured(() => [old ? fp : refound(el), contextOf(el)]);
    const out = {
      el,
      moved: el !== named(),
      gen: generation,
      seen: seenAs(el, live),
      fp: live,
      ctx,
    };
    found.set(id, out);
    return out;
  }

  /** What a watched id names NOW: its element (an area's anchor), and where it is — the element's
   *  box, or the area's box translated off its anchor. Null when nothing matches. */
  /* AN ID'S FINGERPRINT, READ ONCE (round 3, T9): an id never changes what it says, and decoding and
     believing it again for every id on every scroll frame was a large part of the measure's cost */
  const prints = new Map();
  function resolve(id) {
    const v21 = PRINTED.exec(id);
    if (v21 !== null) {
      let fp = prints.get(id);
      if (fp === undefined) {
        const raw = decode(v21[1]);
        fp = raw === null ? null : printFrom(raw);
        prints.set(id, fp);
      }
      if (fp === null) return null;
      const at = findPrinted(id, fp, v21[2], false);
      if (at === null || at.unshown) return at;
      return { el: at.el, area: false, rect: seenBox(at.el), moved: at.moved };
    }
    const printed = FINGER.exec(id);
    if (printed !== null) {
      const fp = { tag: decode(printed[1]), text: decode(printed[2]), heading: decode(printed[3]) };
      if (fp.tag === null || fp.text === null || fp.heading === null || !TAG.test(fp.tag))
        return null;
      const at = findPrinted(id, fp, printed[4], true);
      if (at === null || at.unshown) return at;
      return { el: at.el, area: false, rect: seenBox(at.el), moved: at.moved };
    }
    const fparts = AREA_F.exec(id);
    const parts = fparts === null ? AREA.exec(id) : null;
    const selector = fparts !== null ? fparts[5] : parts === null ? id : parts[5];
    let el = null;
    let moved = false;
    /* AN AREA WITH ITS HOLDER'S FINGERPRINT — `area:f<x>,<y>,<w>,<h>|fp:<json>|<selector>` (issue
       #98, #7): its holder is found again the way a pick is, so the agent's edit that puts a
       sibling before it, rewords it or deletes it moves the area with it, or loses it — where the
       selector alone moved it onto the neighbour, and a deleted holder's area sat on the next one. */
    const held = fparts === null ? null : PRINTED.exec(fparts[5]);
    if (held !== null) {
      let fp = prints.get(id);
      if (fp === undefined) {
        const raw = decode(held[1]);
        fp = raw === null ? null : printFrom(raw);
        prints.set(id, fp);
      }
      if (fp === null) return null;
      const at = findPrinted(id, fp, held[2], false);
      if (at === null || at.unshown) return at;
      el = at.el;
      moved = at.moved;
    } else {
      try {
        el = document.querySelector(selector);
      } catch {
        /* a selector this document cannot parse is a pin from another screen, not an error */
        return null;
      }
    }
    if (el === null) return null;
    const b = seenBox(el);
    if (fparts !== null) {
      const e = extent(el, b);
      const by = scrolledBy(el);
      return {
        el,
        area: true,
        rect: {
          x: r2(b.x + Number(fparts[1]) * e.w - by.x),
          y: r2(b.y + Number(fparts[2]) * e.h - by.y),
          w: r2(Number(fparts[3]) * e.w),
          h: r2(Number(fparts[4]) * e.h),
        },
        moved,
      };
    }
    if (parts === null) return { el, area: false, rect: b };
    return {
      el,
      area: true,
      rect: {
        x: b.x + Number(parts[1]) - el.scrollLeft,
        y: b.y + Number(parts[2]) - el.scrollTop,
        w: Number(parts[3]),
        h: Number(parts[4]),
      },
    };
  }

  /* ---------------------------------------------------------- whether it shows (v19, plan 73 D2) */

  /* WHERE WITHOUT WHETHER IS WHAT PUT SLIDE ONE'S PIN ON SLIDE TWO (measured 2026-10-13): a title on
     an opacity-0 slide reported its box 0.2 px from the title of the slide on top, a
     `display: none` slide's heading reported 0 × 0 at (0, 0), and an item scrolled out of its own
     scroller reported where it would be, below the scroller's edge. So each watched id says what a
     person would see there. A computed value an engine leaves empty is the initial one. */
  const isOpen = (v) => v === undefined || v === "" || v === "visible";
  const clipsOwn = (cs) =>
    !isOpen(cs.overflowX) ||
    !isOpen(cs.overflowY) ||
    /\b(paint|strict|content)\b/.test(cs.contain || "");
  const holdsFixed = (cs) =>
    (cs.transform !== undefined && cs.transform !== "" && cs.transform !== "none") ||
    (cs.perspective !== undefined && cs.perspective !== "" && cs.perspective !== "none") ||
    (cs.filter !== undefined && cs.filter !== "" && cs.filter !== "none") ||
    /\b(paint|layout|strict|content)\b/.test(cs.contain || "");
  const positionOf = (cs) => cs.position || "static";
  /** Can a person scroll this box — is its overflow `auto` or `scroll` on either axis? */
  const scrollable = (a) => {
    const cs = getComputedStyle(a);
    return /^(auto|scroll)$/.test(cs.overflowX) || /^(auto|scroll)$/.test(cs.overflowY);
  };

  /** `display: none` on it or above it, `visibility`, `opacity: 0` on it or above it, `hidden`,
   *  `inert`, or a box with no area. */
  function hiddenEl(el, b) {
    if (b.w === 0 || b.h === 0) return true;
    return unseenEl(el);
  }
  /** `hiddenEl` without the box: what a person cannot see whatever its size — what a pick, an
   *  area's holder and the question "what is on top here" pass over (slides and reloads). */
  function unseenEl(el) {
    if (el.closest("[inert]") !== null) return true;
    if (typeof el.checkVisibility === "function")
      return !el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
    for (let n = el; n !== null; n = n.parentElement) {
      if (n.hasAttribute("hidden")) return true;
      const cs = getComputedStyle(n);
      if (cs.display === "none" || Number.parseFloat(cs.opacity) === 0) return true;
    }
    const v = getComputedStyle(el).visibility;
    return v === "hidden" || v === "collapse";
  }

  /** The elements whose overflow cuts `el` — each one in its CONTAINING-BLOCK chain, so an
   *  absolutely placed child escapes a static scroller and a fixed one escapes everything but a
   *  transformed ancestor — with `el` itself first when it is an area's anchor (the area is in its
   *  content). The viewport is the page's to judge, so neither <html> nor a <body> whose overflow
   *  is the viewport's is one. */
  /* READ ONCE PER DOCUMENT GENERATION AND VIEWPORT (round 3, T9): which boxes clip an element is a
     matter of styles and of the tree, and neither moves while the page only scrolls — two hundred
     ids walked their ancestors' computed styles on every scroll frame. */
  const clipped = new WeakMap();
  function clippers(el, self) {
    const key = `${generation}|${window.innerWidth}x${window.innerHeight}|${self ? 1 : 0}`;
    const was = clipped.get(el);
    if (was !== undefined && was.key === key) return was.out;
    const out = clippersNow(el, self);
    clipped.set(el, { key, out });
    return out;
  }
  function clippersNow(el, self) {
    const out = [];
    const root = document.documentElement;
    const rootCs = getComputedStyle(root);
    const bodyIsViewport = isOpen(rootCs.overflowX) && isOpen(rootCs.overflowY);
    const own = getComputedStyle(el);
    if (self && clipsOwn(own)) out.push(el);
    let pos = positionOf(own);
    for (let a = el.parentElement; a !== null && a !== root; a = a.parentElement) {
      if (a === document.body && bodyIsViewport) break;
      const cs = getComputedStyle(a);
      const holds =
        pos === "fixed"
          ? holdsFixed(cs)
          : pos === "absolute"
            ? positionOf(cs) !== "static" || holdsFixed(cs)
            : true;
      if (!holds) continue;
      if (clipsOwn(cs)) out.push(a);
      pos = positionOf(cs);
    }
    return out;
  }

  /** An element's padding box on screen — what its overflow clips to. */
  function clientBox(a) {
    const b = seenBox(a);
    const z = cssZoom(a);
    return {
      x: r2(b.x + a.clientLeft * z),
      y: r2(b.y + a.clientTop * z),
      w: r2(a.clientWidth * z),
      h: r2(a.clientHeight * z),
    };
  }

  function meet(a, b) {
    const x = Math.max(a.x, b.x);
    const y = Math.max(a.y, b.y);
    return {
      x,
      y,
      w: Math.max(0, Math.min(a.x + a.w, b.x + b.w) - x),
      h: Math.max(0, Math.min(a.y + a.h, b.y + b.h) - y),
    };
  }

  const viewport = () =>
    held ?? {
      w: document.documentElement.clientWidth || window.innerWidth,
      h: document.documentElement.clientHeight || window.innerHeight,
    };
  /* THE VIEWPORT, READ ONCE A MEASURE (round 4, U4): each read is a call into the engine, and a
     scroll frame asked it a dozen times a mark — every dot's clamp, every judgement of near and far */
  let held = null;
  let heldWide = null;
  const viewW = () => heldWide?.w ?? window.innerWidth;
  const viewH = () => heldWide?.h ?? window.innerHeight;

  /** Is something ELSE of the page on top of `el` at the centre of what is visible of it? Its own
   *  descendants and its ancestors are not something else. Off screen there is nothing to ask. */
  function coveredEl(el, vis) {
    const v = viewport();
    const at = meet(vis, { x: 0, y: 0, w: v.w, h: v.h });
    if (at.w <= 0 || at.h <= 0) return false;
    /* THE TOP OF THE STACK ONLY (round 3, T9): every layer of ours but a shield takes no pointer, so
       `elementFromPoint` answers with the page's own; the whole stack is asked only past a shield */
    const top = pageAt(at.x + at.w / 2, at.y + at.h / 2);
    if (top === null) return false;
    return !(top === el || el.contains(top) || top.contains(el));
  }
  /** The page's own topmost element at a point — never one of ours. */
  /* AND NEVER ONE THAT DOES NOT SHOW (slides and reloads): an opacity-0 slide stacked over the one
     showing covers nothing a person sees — answered as the top, every pin on the visible slide was
     `covered` and not drawn. Asked only of the first answer, so a page with nothing stacked pays
     one `checkVisibility` a call. */
  function pageAt(x, y) {
    let top =
      typeof document.elementFromPoint === "function" ? document.elementFromPoint(x, y) : null;
    if (top === null || ours(top) || (top !== html && quietly(unseenEl)(top) === true))
      top =
        typeof document.elementsFromPoint === "function"
          ? shownOf(document.elementsFromPoint(x, y))
          : null;
    return top;
  }

  /* IS SOMETHING OF THE PAGE'S OVER THE DOT'S OWN SPOT? (plan 73 round 4, U3) "Covered" was asked
     at the centre of what shows of the element, and a popover the page opened over the note's
     corner — never over the centre — left the dot painted, unseen under it, and taking the press
     meant for the popover's own button. So each dot's spot is asked too. On the element (a click
     point inside its box) anything else of the page's there lies over the element where its dot
     is; beside the element (a side, a corner, its edge) the page's own neighbours are what a dot
     sits over by design, and only what is drawn ABOVE the marks' layer hides it: the top layer (an
     open popover, a modal dialog, the fullscreen element) or a box at the top z-index. */
  function coveredDot(id, el, vis, whole) {
    const dots = marks.on ? marks.dots.get(id) : undefined;
    if (dots === undefined) return false;
    const v = viewport();
    const shows = meet(vis, { x: 0, y: 0, w: v.w, h: v.h });
    if (shows.w <= 0 || shows.h <= 0) return false;
    const z = 1 / marks.scale;
    for (const d of dots) {
      const at = dotSpot(d, vis, whole, z);
      const top = pageAt(at.x, at.y);
      if (top === null || top === el || el.contains(top) || top.contains(el)) continue;
      const inside =
        at.x > vis.x + 1 &&
        at.x < vis.x + vis.w - 1 &&
        at.y > vis.y + 1 &&
        at.y < vis.y + vis.h - 1;
      if (inside || aboveMarks(top)) return true;
    }
    return false;
  }
  /** Is `n` drawn above the marks' layer — in the top layer, or in a box at the top z-index? */
  function aboveMarks(n) {
    for (const sel of [":popover-open", ":modal", ":fullscreen"])
      try {
        if (n.closest(sel) !== null) return true;
      } catch {
        /* an engine without that selector has no such layer */
      }
    for (let a = n; a !== null; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (positionOf(cs) !== "static" && Number(cs.zIndex) > MARKS_Z) return true;
    }
    return false;
  }

  /** One watched id as the page draws it: `{state, rect, whole}`, and the elements whose size
   *  moves it (for the observer). Null when nothing matches. */
  function seenFor(id) {
    /* LOOKED FOR IN THIS VERY DOCUMENT AND NOT THERE: nothing to do (v21, R4). */
    if (lostAt.get(id) === generation) return null;
    const at = resolve(id);
    if (at === null) {
      lostAt.set(id, generation);
      return null;
    }
    if (at.unshown) return at;
    const s = seenOf(at, id);
    if (at.moved === true) s.moved = true;
    return s;
  }

  function seenOf(at, id) {
    const whole = at.rect;
    const els = [at.el];
    if (hiddenEl(at.el, at.area ? seenBox(at.el) : whole) || whole.w <= 0 || whole.h <= 0)
      return { state: "hidden", rect: whole, whole, els };
    let vis = whole;
    let cut = false;
    for (const a of clippers(at.el, at.area)) {
      els.push(a);
      const next = meet(vis, clientBox(a));
      if (next.w < vis.w || next.h < vis.h) cut = true;
      vis = next;
      /* CUT AWAY BY A BOX NOBODY CAN SCROLL (`overflow: hidden`, `clip`) — a slide moved off a
         track, a collapsed panel — it is not showing, and no scroll of ours would honestly bring
         it back: the page did not mean it to be scrolled. */
      if ((vis.w <= 0 || vis.h <= 0) && !scrollable(a))
        return { state: "hidden", rect: vis, whole, els };
    }
    if (vis.w <= 0 || vis.h <= 0)
      return { state: "clipped", rect: { x: vis.x, y: vis.y, w: 0, h: 0 }, whole, els };
    if (coveredEl(at.el, vis) || (id !== undefined && coveredDot(id, at.el, vis, whole)))
      return { state: "covered", rect: vis, whole, els };
    return { state: cut ? "clipped" : "shown", rect: vis, whole, els };
  }

  /* ------------------------------------------- 11. the review's marks, painted here (v22, S5) */

  /* THE MARKS ARE PAINTED IN THIS DOCUMENT, IN THE SAME PAINT AS THEIR ELEMENTS (plan 73 round 2,
     S5). Until v22 the page drew every outline and dot over this frame from `studio:rects`, and a
     page cannot measure a cross-origin frame inside its own rendering frame: it hears a report after
     the frame it was measured in has painted and draws it in the next, so during every scroll a pin
     trailed its element by one frame — 5.9 px at an 8-px wheel step, 22.6 px at 30 (the review's
     `lag.cjs`) — and R12's lead (a box moving a steady step reported one step on) was a guess that
     overshot on every reversal and stop. So the page tells this document WHAT to mark, and this
     document paints it, where it already measures:

       · ONE LAYER OF OUR OWN, `<studio-marks>`, a child of <html> after <body> — never inside the
         page's own tree — with an open shadow root, so no rule of the page reaches a mark and no
         `querySelectorAll` of the page finds one. `pointer-events: none`, above everything but the
         pick ring, 0 × 0, `overflow: visible`. `ours()` knows it, so the anchors' neighbours, their
         place among their kind, their parent's children and the observer's generation never count
         it. An outline is an `outline` and a dot sits inside the stage's inset, so nothing of ours
         adds to the document's scrollable size.
       · WHAT RIDES WHAT: a mark whose element moves with the document is in a layer absolutely
         placed in DOCUMENT coordinates, so the compositor scrolls it with the content — it is not
         moved per frame at all; one whose element is inside a `position: fixed` box (or a sticky one
         that is stuck to the viewport) is in a FIXED layer. Everything else that moves an element
         without moving the document — an inner scroller, a sticky box, a transform or an animation —
         is followed by this file's own measure, which runs in the frame's animation frame on the
         change (a scroll in the capture phase, an observer, every frame while an animation moves a
         watched element) and repositions the mark before that frame paints.
       · THE PAGE STILL SAYS WHERE A DOT GOES (`studio:marks`): which corner or side, or the click
         point as fractions of the element's box, and a nudge in screen px for a dot it moved aside
         in a crowd. The same rule, applied here to the element's live box, keeps the dot on its
         element in the same paint; the page puts its click target where the same rule says, from
         the last report — at rest the two are the same point, and while the element moves the
         target trails by the one frame (what it is for is a click, not a look).
       · SCREEN-SIZED: every size is divided by the scale the page draws this frame at (`--studio-z`),
         as edit mode's are; every colour is the page's own token, handed over, never one of ours.
       · DRAWN ONLY WHILE ITS ELEMENT SHOWS (plan 73 D1, D2, D9): `shown`, or `clipped` with a part
         left, and on the screen. Hidden, covered, scrolled out or lost, it is gone in the same
         frame as its element. An empty list, `on: false`, or edit mode, and nothing is drawn.

     Nothing here is drawn unless the page asks: the studio's frames and edit mode never send
     `studio:marks`, and a page that says nothing gets no layer at all. */

  /** A dot's diameter, and how far inside the stage its centre stays — the page's `PIN` and
   *  `PIN_INSET` (`model.ts`), in screen px. Smaller than three dots both ways, an element's dot
   *  sits outside it (`DOCK_UNDER`, round 1's R6). */
  const PIN = 22;
  const PIN_INSET = 14;
  const DOCK_UNDER = 3 * PIN;
  /** Where a dot may sit outside a small element: the four corners, then the four sides; the same
   *  eight a dot further out (`…2`, tied to its element by a short line). The page's `ROOM`. */
  const SIDES = {
    ne: [1, -1],
    se: [1, 1],
    nw: [-1, -1],
    sw: [-1, 1],
    e: [1, 0],
    w: [-1, 0],
    n: [0, -1],
    s: [0, 1],
  };
  const ROOM = [...Object.keys(SIDES), ...Object.keys(SIDES).map((k) => `${k}2`)];
  const AT = new Set(["point", "corner", "in", ...ROOM]);

  const marks = {
    on: false,
    /** The scale the page draws this frame at: screen px per frame px. */
    scale: 1,
    list: [],
    host: null,
    doc: null,
    fixed: null,
    tick: null,
    shown: false,
    nodes: new Map(),
    /** Each watched id's dots (round 4, U3), and what they were when last asked about. */
    dots: new Map(),
    dotsKey: "",
    /** The marks' keys, as last painted from. */
    keys: "",
    /** The scale and the switch every kept box was judged under (round 4, U4). */
    judged: "",
    /** The keys the last paint drew, said to the page with the rects (T7, T9, T12). */
    painted: [],
    /** Put back since the last paint that found it in (T7). */
    evicted: 0,
    saidEvicted: false,
  };

  /** Is a measured element one a mark is drawn on — showing, and on the screen? */
  function drawable(state, vis) {
    if (!(state === "shown" || (state === "clipped" && vis.w > 0 && vis.h > 0))) return false;
    return (
      vis.y + Math.max(vis.h, 1) > 0 &&
      vis.y < viewH() &&
      vis.x + Math.max(vis.w, 1) > 0 &&
      vis.x < viewW()
    );
  }

  /** Where a side's dot would be, in this document's px — the page's `sideSpot`. */
  function sideSpot(code, vis, z) {
    const far = code.endsWith("2");
    const [sx, sy] = SIDES[far ? code.slice(0, -1) : code];
    const off = (PIN / 2 + 1 + (far ? PIN : 0)) * z;
    return {
      x: sx > 0 ? vis.x + vis.w + off : sx < 0 ? vis.x - off : vis.x + vis.w / 2,
      y: sy > 0 ? vis.y + vis.h + off : sy < 0 ? vis.y - off : vis.y + vis.h / 2,
    };
  }

  /** Where a dot is, on the element's live box: the page's rule (`dotAt`), kept inside the stage,
   *  then its nudge, kept inside again. */
  function dotSpot(dot, vis, whole, z) {
    let p;
    if (dot.at === "point")
      p = {
        x: Math.min(Math.max(whole.x + dot.fx * whole.w, vis.x), vis.x + Math.max(vis.w, 0)),
        y: Math.min(Math.max(whole.y + dot.fy * whole.h, vis.y), vis.y + Math.max(vis.h, 0)),
      };
    else if (dot.at === "corner" || dot.at === "in") p = { x: vis.x + vis.w, y: vis.y };
    else p = sideSpot(dot.at, vis, z);
    const lo = PIN_INSET * z;
    const cx = (v) => Math.min(Math.max(v, lo), Math.max(lo, viewW() - lo));
    const cy = (v) => Math.min(Math.max(v, lo), Math.max(lo, viewH() - lo));
    return { x: cx(cx(p.x) + dot.nx * z), y: cy(cy(p.y) + dot.ny * z) };
  }

  /* WHERE A SMALL ELEMENT'S DOT HAS ROOM (v22, the review's S9). Round 1's R6 put a small thing's
     dot just outside its top-right corner so the whole of it stayed clickable — and on a row of
     chips under a heading that dot sat on the heading's letters and on the next chip. So each
     place a dot could go, in the page's order, is tried here, where what is under it can be asked:
     a place is CLEAR when nothing but the element's own ancestors is under the dot, and no
     character of theirs. The first clear place that fits on the stage is `room`; with none, a dot
     one further out tied by a line; with none of those, on the element's own corner (`in`). Asked
     again when the document changes or the frame is resized — never while it only scrolls, so a
     dot does not change sides under a moving page. */
  const rooms = new Map();
  function roomFor(id, el, vis) {
    if (!marks.on || typeof document.elementsFromPoint !== "function") return null;
    const z = 1 / marks.scale;
    if (!(vis.w < DOCK_UNDER * z && vis.h < DOCK_UNDER * z)) return null;
    const key = `${generation}|${viewW()}x${viewH()}|${marks.scale}`;
    const was = rooms.get(id);
    if (was !== undefined && was.key === key) return was.room;
    const lo = PIN_INSET * z;
    let room = "in";
    for (const code of ROOM) {
      const c = sideSpot(code, vis, z);
      if (c.x < lo || c.y < lo || c.x > window.innerWidth - lo || c.y > window.innerHeight - lo)
        continue;
      if (clearAt(c, (PIN / 2) * z, el)) {
        room = code;
        break;
      }
    }
    rooms.set(id, { key, room });
    return room;
  }

  /** Is a dot of radius `r` at `c` over nothing but `el`'s own ancestors' ground? Its centre and
   *  eight points round its edge are asked. */
  function clearAt(c, r, el) {
    for (let i = -1; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const x = i < 0 ? c.x : c.x + Math.cos(a) * r * 0.9;
      const y = i < 0 ? c.y : c.y + Math.sin(a) * r * 0.9;
      const top = document.elementsFromPoint(x, y).find((n) => !ours(n));
      if (top === undefined) continue;
      /* SOMETHING ELSE OF THE PAGE (the next chip), or the element itself */
      if (top === el || !top.contains(el)) return false;
      /* AN ANCESTOR'S OWN WORDS — the heading the dot would sit on */
      if (glyphAt(x, y, top)) return false;
    }
    return true;
  }

  /** Is a character of `scope`'s text drawn at (x, y)? */
  function glyphAt(x, y, scope) {
    let node = null;
    let offset = 0;
    try {
      if (typeof document.caretPositionFromPoint === "function") {
        const p = document.caretPositionFromPoint(x, y);
        if (p) {
          node = p.offsetNode;
          offset = p.offset;
        }
      } else if (typeof document.caretRangeFromPoint === "function") {
        const r = document.caretRangeFromPoint(x, y);
        if (r) {
          node = r.startContainer;
          offset = r.startOffset;
        }
      }
    } catch {
      return false;
    }
    if (node === null || node.nodeType !== 3 || !scope.contains(node)) return false;
    const range = document.createRange();
    const z = node.parentElement === null ? 1 : rectZoom(node.parentElement);
    for (const i of [offset - 1, offset]) {
      if (i < 0 || i >= node.length) continue;
      range.setStart(node, i);
      range.setEnd(node, i + 1);
      for (const r of range.getClientRects()) {
        const b = onScreen(r, z);
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return true;
      }
    }
    return false;
  }

  /* WHAT AN ELEMENT RIDES under the document's scroll: the document, or the viewport. Its chain of
     ancestors is read once per document generation; a sticky box's being stuck is read live. */
  const chains = new WeakMap();
  function chainOf(el) {
    const was = chains.get(el);
    if (was !== undefined && was.gen === generation) return was;
    const root = document.documentElement;
    const rootCs = getComputedStyle(root);
    const bodyIsViewport = isOpen(rootCs.overflowX) && isOpen(rootCs.overflowY);
    let fixed = false;
    let lastFixed = null;
    let sticky = null;
    for (let n = el; n !== null; n = n.parentElement) {
      const cs = getComputedStyle(n);
      /* a fixed box below this one is fixed to THIS one, which moves with the document — unless a
         fixed box further up says otherwise */
      if (fixed && n !== lastFixed && holdsFixed(cs)) fixed = false;
      const pos = positionOf(cs);
      if (pos === "fixed") {
        fixed = true;
        lastFixed = n;
      }
      /* a sticky box inside a box of its own that clips sticks to THAT box, which the document
         carries: only one whose scrollport is the viewport rides the viewport */
      if (pos === "sticky" && sticky === null) sticky = n;
      else if (
        sticky !== null &&
        n !== root &&
        !(n === document.body && bodyIsViewport) &&
        clipsOwn(cs)
      )
        sticky = null;
      if (n === root) break;
    }
    const out = { gen: generation, fixed, sticky };
    chains.set(el, out);
    return out;
  }
  function ridesViewport(el) {
    const c = chainOf(el);
    if (c.fixed) return true;
    if (c.sticky === null) return false;
    const cs = getComputedStyle(c.sticky);
    const b = seenBox(c.sticky);
    const z = cssZoom(c.sticky);
    const top = Number.parseFloat(cs.top) * z;
    const bottom = Number.parseFloat(cs.bottom) * z;
    return (
      (Number.isFinite(top) && Math.abs(b.y - top) < 0.5) ||
      (Number.isFinite(bottom) && Math.abs(window.innerHeight - (b.y + b.h) - bottom) < 0.5)
    );
  }

  /* THE LAYER, made once, on the first list with something in it. The host's own style is inline,
     so no rule of the page's outranks it; everything else is in the shadow root. */
  /* SCREEN-SIZED BY ARITHMETIC: every size is `n px × --studio-z` (1 / the page's scale), as edit
     mode's chrome is, and a shadow's lengths are scaled where it is set (`marksFrom`) — no dot needs
     a transform, or a layer, of its own. THE TWO LAYERS ARE EACH ONE COMPOSITED LAYER (`will-change`): the
     document's scrolls with the content it sits in, and its dots are drawn once, not again on every
     scroll — fifty dots with their soft lift redrawn each frame took Playwright's WebKit from 54 to
     37 frames a second; as one layer, 52 (`perf50.cjs`). `contain: layout` makes anything of ours
     past the document's edge ink, never scrollable size. */
  const zpx = (n) => `calc(${n}px * var(--studio-z,1))`;
  const MRING = "var(--studio-ring,#fafafa)";
  const MLIFT = "var(--studio-lift,0 1px 2px rgba(0,0,0,.28))";
  const MFOCUS = "var(--studio-focus,0 0 0 4px #0af)";
  const MARKS_CSS = `
.l,.f{position:absolute;left:0;top:0;width:0;height:0;contain:layout style;will-change:transform}
.f{position:fixed}
.m{position:absolute;left:0;top:0;width:0;height:0;--tc:var(--studio-accent,#0af)}
.m[data-state=out]{--tc:var(--studio-ink2,#555)}
.m[data-state=done]{--tc:var(--studio-ok,#2a7)}
.m[data-state=declined]{--tc:var(--studio-lamp,#4ad)}
.r{position:absolute;box-sizing:border-box;border-radius:${zpx(1)};outline:${zpx(1.5)} solid var(--tc);outline-offset:${zpx(3)};opacity:0;transition:opacity var(--studio-dur,120ms) var(--studio-ease,ease)}
.m[data-outline=on] .r{opacity:1}
.m[data-outline=none] .r{display:none}
.m[data-kind=draw] .r{outline:${zpx(1)} dashed var(--tc);opacity:.75}
.m[data-kind=draw][data-outline=on] .r{outline:${zpx(1.5)} solid var(--tc);opacity:1}
.ln{position:absolute;display:none;height:${zpx(1)};margin-top:${zpx(-0.5)};background:var(--tc);transform-origin:0 50%}
.p{position:absolute;left:0;top:0;width:0;height:0;will-change:transform}
.d{position:absolute;left:${zpx(-11)};top:${zpx(-11)};width:${zpx(22)};height:${zpx(22)};box-sizing:border-box;border-radius:50%;display:grid;place-items:center;font:600 ${zpx(11)}/1 var(--studio-font,system-ui,sans-serif);font-variant-numeric:tabular-nums;background:var(--studio-accent,#0af);color:var(--studio-accent-ink,#fff);box-shadow:0 0 0 ${zpx(2)} ${MRING},${MLIFT};transition:transform var(--studio-dur,120ms) var(--studio-ease,ease);white-space:nowrap}
.d[data-lit=yes]{transform:scale(1.12)}
.d[data-focus=yes]{box-shadow:0 0 0 ${zpx(2)} ${MRING},${MFOCUS}}
.d[data-state=out]{background:var(--studio-raised,#fff);color:var(--studio-ink,#111)}
.d[data-state=done]{background:var(--studio-pin-ok,#2a7);color:var(--studio-raised,#fff)}
.d[data-state=declined]{background:var(--studio-raised,#fff);color:var(--studio-ink,#111);box-shadow:0 0 0 ${zpx(2)} ${MRING},inset 0 0 0 ${zpx(1.5)} var(--studio-lamp,#4ad),${MLIFT}}
.d[data-shape=ring]{left:${zpx(-6)};top:${zpx(-6)};width:${zpx(12)};height:${zpx(12)};background:var(--studio-raised,#fff);box-shadow:0 0 0 ${zpx(1.5)} ${MRING},inset 0 0 0 ${zpx(2)} var(--studio-ink3,#888),${MLIFT}}
.d[data-shape=ring][data-state=done]{box-shadow:0 0 0 ${zpx(1.5)} ${MRING},inset 0 0 0 ${zpx(2)} var(--studio-pin-ok,#2a7),${MLIFT}}
.d[data-shape=ring][data-state=declined]{box-shadow:0 0 0 ${zpx(1.5)} ${MRING},inset 0 0 0 ${zpx(2)} var(--studio-lamp,#4ad),${MLIFT}}
.d[data-shape=ring][data-focus=yes]{box-shadow:0 0 0 ${zpx(1.5)} ${MRING},${MFOCUS}}
.d[data-shape=crowd]{width:auto;min-width:${zpx(22)};padding:0 ${zpx(7)};border-radius:999px;display:inline-flex;align-items:center;gap:${zpx(2)};background:var(--studio-raised,#fff);color:var(--studio-ink,#111);box-shadow:0 0 0 ${zpx(2)} ${MRING},${MLIFT}}
.d[data-shape=crowd][data-lit=yes]{transform:scale(1.06)}
.d[data-shape=crowd][data-focus=yes]{box-shadow:0 0 0 ${zpx(2)} ${MRING},${MFOCUS}}
.mo{color:var(--studio-ink3,#888);font-weight:500}
.t{position:absolute;left:0;top:0;width:1px;height:1px;visibility:hidden}
@media (prefers-reduced-motion: reduce){.d{transition:none}.r{transition:opacity 80ms linear}}
`;
  /** The marks' layer's z-index: one under the top, so the pick ring (at the top) stays above it. */
  const MARKS_Z = 2147483646;
  const HOST_CSS = `all:initial;display:none;position:absolute;left:0;top:0;width:0;height:0;overflow:visible;pointer-events:none;z-index:${MARKS_Z}`;
  function marksHost() {
    if (marks.host !== null) return;
    const host = document.createElement("studio-marks");
    /* ours, and stripped from any root edit mode serialises, as the pick ring is */
    host.setAttribute("data-studio-aim", "marks");
    host.setAttribute("aria-hidden", "true");
    host.style.cssText = HOST_CSS;
    const root = host.attachShadow({ mode: "open" });
    const sheet = document.createElement("style");
    sheet.textContent = MARKS_CSS;
    const doc = document.createElement("div");
    doc.className = "l";
    const fixed = document.createElement("div");
    fixed.className = "f";
    /* THE LAST STEP BEFORE THE FRAME PAINTS: a 1-px node of ours whose size the measure flips while
       an animation moves a watched element, so a ResizeObserver hands us that step (`repaint`) */
    const tick = document.createElement("div");
    tick.className = "t";
    root.append(sheet, doc, fixed, tick);
    marks.host = host;
    marks.doc = doc;
    marks.fixed = fixed;
    marks.tick = tick;
    marks.shown = false;
    /* put in the document by `hostIn`, only while it has something to paint (T7) */
    if (typeof ResizeObserver === "function") new ResizeObserver(quietly(repaint)).observe(tick);
  }

  /* `studio:marks` — WHAT TO MARK, believed one field at a time. A colour is one token of letters,
     digits and `#%.,/()-` and spaces, a shadow a few of them, a font a list of names — each set as
     a custom property, so nothing can close the declaration it is written into. An id is drawn
     only while it is one `studio:rects` watches: the page names nothing here it has not already
     asked to be measured. */
  const COLOUR = /^[#a-z0-9%.,/() -]{1,64}$/i;
  const SHADOW = /^[#a-z0-9%.,/() -]{1,240}$/i;
  const LOOK = {
    accent: ["--studio-accent", COLOUR],
    accentInk: ["--studio-accent-ink", COLOUR],
    raised: ["--studio-raised", COLOUR],
    ink: ["--studio-ink", COLOUR],
    ink2: ["--studio-ink2", COLOUR],
    ink3: ["--studio-ink3", COLOUR],
    ok: ["--studio-ok", COLOUR],
    pinOk: ["--studio-pin-ok", COLOUR],
    lamp: ["--studio-lamp", COLOUR],
    ring: ["--studio-ring", COLOUR],
    lift: ["--studio-lift", SHADOW],
    focus: ["--studio-focus", SHADOW],
    font: ["--studio-font", /^[\w\s,"'-]{1,200}$/],
    dur: ["--studio-dur", /^\d{1,4}(\.\d{1,3})?m?s$/],
    ease: [
      "--studio-ease",
      /^(ease|linear|ease-in|ease-out|ease-in-out|cubic-bezier\([\d., -]{1,60}\))$/,
    ],
  };
  const MARK_KEY = /^[\w.:|-]{1,200}$/;
  const MARK_STATES = new Set(["draft", "out", "done", "declined"]);
  const finite = (v, lo, hi) => typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi;
  function dotFrom(raw) {
    if (raw === null || typeof raw !== "object") return null;
    if (!["num", "ring", "crowd"].includes(raw.shape)) return null;
    if (typeof raw.at !== "string" || !AT.has(raw.at)) return null;
    const label = typeof raw.label === "string" && /^\d{0,4}$/.test(raw.label) ? raw.label : null;
    const more = raw.more === undefined ? "" : raw.more;
    if (label === null || typeof more !== "string" || !/^\+?\d{0,4}$/.test(more)) return null;
    if (raw.at === "point" && !(finite(raw.fx, 0, 1) && finite(raw.fy, 0, 1))) return null;
    const nx = raw.nx === undefined ? 0 : raw.nx;
    const ny = raw.ny === undefined ? 0 : raw.ny;
    if (!finite(nx, -10000, 10000) || !finite(ny, -10000, 10000)) return null;
    return {
      shape: raw.shape,
      at: raw.at,
      fx: raw.at === "point" ? raw.fx : 0,
      fy: raw.at === "point" ? raw.fy : 0,
      nx,
      ny,
      label,
      more,
      lit: raw.lit === true,
      focus: raw.focus === true,
    };
  }
  function markFrom(raw) {
    if (raw === null || typeof raw !== "object") return null;
    if (typeof raw.key !== "string" || !MARK_KEY.test(raw.key)) return null;
    if (typeof raw.id !== "string" || raw.id === "" || raw.id.length > 8000) return null;
    if (raw.kind !== "pick" && raw.kind !== "draw") return null;
    if (!MARK_STATES.has(raw.state)) return null;
    if (!["rest", "on", "none"].includes(raw.outline)) return null;
    const dot = raw.dot === null || raw.dot === undefined ? null : dotFrom(raw.dot);
    if (dot === null && raw.dot !== null && raw.dot !== undefined) return null;
    return {
      key: raw.key,
      id: raw.id,
      kind: raw.kind,
      state: raw.state,
      outline: raw.outline,
      dot,
    };
  }
  function marksFrom(msg) {
    if (finite(msg.scale, 0.05, 8)) marks.scale = msg.scale;
    marks.on = msg.on === true;
    marks.list = Array.isArray(msg.marks)
      ? msg.marks
          .slice(0, 500)
          .map(markFrom)
          .filter((m) => m !== null)
      : [];
    marks.evicted = 0;
    /* each id's dots, whose spots are asked whether the page covers them (round 4, U3) */
    marks.dots = new Map();
    for (const m of marks.list) {
      if (m.dot === null) continue;
      const at = marks.dots.get(m.id);
      if (at === undefined) marks.dots.set(m.id, [m.dot]);
      else at.push(m.dot);
    }
    if (marks.on && marks.list.length > 0) marksHost();
    if (marks.host !== null) {
      setVar(marks.host, "--studio-z", String(1 / marks.scale));
      const look = msg.look !== null && typeof msg.look === "object" ? msg.look : {};
      /* a shadow's lengths are the page's px: screen-sized here, like every other size */
      const z = 1 / marks.scale;
      const sized = (v) =>
        v.replace(/(-?\d*\.?\d+)px/g, (_, n) => `${Math.round(Number(n) * z * 1000) / 1000}px`);
      for (const [name, [prop, shape]] of Object.entries(LOOK))
        if (typeof look[name] === "string" && shape.test(look[name]))
          setVar(marks.host, prop, shape === SHADOW ? sized(look[name]) : look[name]);
      build();
    }
    /* WHAT TO MARK CHANGED — and a box's place, whether it shows and what lies over its centre do
       not depend on it (round 4, U4): the page sends its marks again whenever a dot comes on screen
       or leaves (its painted set changed), a third of the frames of a wheel over two hundred notes,
       and judging every kept box afresh each time was most of the scroll's cost. Only a new scale
       (a dot's reach) or the marks switched on or off judges everything again; new dots ask again
       what covers their spots. The report is sent only if something moved. */
    const judged = `${marks.scale}|${marks.on}`;
    let rejudge = false;
    if (judged !== marks.judged) {
      marks.judged = judged;
      farOff.clear();
      rejudge = true;
    }
    const keys = marks.list
      .map((m) => m.key)
      .sort()
      .join("\n");
    if (keys !== marks.keys) {
      /* a mark taken away is taken away now; one added is painted by the next frame's measure */
      const now = new Set(marks.list.map((m) => m.key));
      if (marks.keys === "" || marks.keys.split("\n").some((k) => k !== "" && !now.has(k)))
        rejudge = true;
      marks.keys = keys;
    }
    /* where each dot sits — not how it is drawn (a lit dot, a crowd's count) */
    const dotsKey = json.stringify(
      [...marks.dots]
        .map(([id, ds]) => [id, ds.map((d) => [d.at, d.fx, d.fy, d.nx, d.ny])])
        .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)),
    );
    if (dotsKey !== marks.dotsKey) {
      marks.dotsKey = dotsKey;
      coverEpoch += 1;
    }
    /* A NEW SCALE, THE SWITCH, A MARK TAKEN AWAY, OR NOTHING SHOWN YET: painted now. Anything else
       — a mark added as its pin comes on the stage, the same marks in another order, a dot lit or
       nudged — is painted by the next frame's measure, before that frame paints: a measure here,
       between two frames, lays the page out a second time in that frame (3.5 ms each in Chromium,
       a third of a wheel's frames over two hundred notes) */
    if (rejudge || !marks.shown || marks.host?.isConnected !== true) measure(false);
    else measureSoon();
  }

  /* WRITTEN ONLY WHEN IT CHANGED (round 4, U4): the page sends its marks again whenever a dot comes
     on screen or leaves, and an attribute or a custom property set to the value it already had
     still has the engine restyle the whole layer — read back as 1.7 ms at the next measure's first
     read, on average over a wheel's frames, in Chromium */
  const setAttr = (el, name, v) => {
    if (el.getAttribute(name) !== v) el.setAttribute(name, v);
  };
  const setVar = (el, name, v) => {
    if (el.style.getPropertyValue(name) !== v) el.style.setProperty(name, v);
  };

  /* ONE NODE PER MARK, KEPT BY ITS KEY: its outline, its dot (with its crowd's `+n`) and the line
     that ties a far dot to its element. A mark gone from the list is taken away. */
  function build() {
    const keep = new Set();
    for (const m of marks.list) {
      keep.add(m.key);
      let n = marks.nodes.get(m.key);
      if (n === undefined) {
        const wrap = document.createElement("div");
        wrap.className = "m";
        const ring = document.createElement("div");
        ring.className = "r";
        const line = document.createElement("div");
        line.className = "ln";
        const spot = document.createElement("div");
        spot.className = "p";
        const dot = document.createElement("div");
        dot.className = "d";
        const num = document.createElement("span");
        const more = document.createElement("span");
        more.className = "mo";
        dot.append(num, more);
        spot.append(dot);
        wrap.append(ring, line, spot);
        /* put in its layer by `paint`, only while it is drawn (T9) */
        n = { wrap, ring, line, spot, dot, num, more };
        marks.nodes.set(m.key, n);
      }
      /* the watched id it marks, whose element a press on its dot is judged against (round 5, V1) */
      n.id = m.id;
      setAttr(n.wrap, "data-key", m.key);
      setAttr(n.wrap, "data-kind", m.kind);
      setAttr(n.wrap, "data-state", m.state);
      setAttr(n.wrap, "data-outline", m.outline);
      const d = m.dot;
      if (n.spot.style.display !== (d === null ? "none" : ""))
        n.spot.style.display = d === null ? "none" : "";
      if (d !== null) {
        /* the rule it was placed by, readable by a measurement in this document */
        setAttr(n.spot, "data-at", d.at);
        setAttr(n.spot, "data-f", `${d.fx},${d.fy}`);
        setAttr(n.spot, "data-n", `${d.nx},${d.ny}`);
        setAttr(n.dot, "data-shape", d.shape);
        setAttr(n.dot, "data-state", d.shape === "crowd" ? "" : m.state);
        setAttr(n.dot, "data-lit", d.lit ? "yes" : "no");
        setAttr(n.dot, "data-focus", d.focus ? "yes" : "no");
        if (n.num.textContent !== d.label) n.num.textContent = d.label;
        if (n.more.textContent !== d.more) n.more.textContent = d.more;
      }
    }
    for (const [key, n] of [...marks.nodes]) {
      if (keep.has(key)) continue;
      n.wrap.remove();
      marks.nodes.delete(key);
    }
  }

  /** Set a style only when it changed: a mark that rides the document is written nothing while
   *  the document scrolls. */
  /* KEPT HERE, NOT READ BACK (round 4, U4): reading an inline style is the engine serialising it,
     eleven times a mark on every measure — and nothing but this function writes these */
  const written = new WeakMap();
  const restyle = (el, prop, value) => {
    let w = written.get(el);
    if (w === undefined) {
      w = {};
      written.set(el, w);
    }
    if (w[prop] === value) return;
    w[prop] = value;
    el.style[prop] = value;
  };
  const pxs = (v) => `${Math.round(v * 100) / 100}px`;

  /* A MARK ON SOMETHING AN ANIMATION SLIDES RIDES A COPY OF THAT ANIMATION. A transform animation
     is the compositor's: it moves its box on its own clock, and a script reads it at whatever
     moment it asks (TRAPS §41) — so a mark put where the box was read lags or leads it by however
     long the main thread took between that read and the frame, two pixels in a stalled frame of
     Playwright's WebKit. So when ONE animation moves the element — on it or on an ancestor — and
     that animation only TRANSLATES (every keyframe a 2D translation, nothing else of it animated),
     with no other transform on the way, the mark's node is placed where the box would be with no
     animation (its box now, less the translation now, read together), sized as the animated box,
     and given the SAME keyframes and timing with the same start time: the compositor moves both by
     one clock. Anything else — a rotation, a scale, two animations, a box something clips — is put
     where it is by the measure, as before. */
  const NONE = (v) => v === undefined || v === "" || v === "none";
  function shifted(cs) {
    if (!NONE(cs.translate) || !NONE(cs.rotate) || !NONE(cs.scale)) return null;
    const t = cs.transform;
    if (NONE(t)) return { x: 0, y: 0 };
    const m = /^matrix\(([^)]+)\)$/.exec(t);
    if (m === null) return null;
    const [a, b, c, d, e, f] = m[1].split(",").map(Number);
    return a === 1 && b === 0 && c === 0 && d === 1 && Number.isFinite(e + f)
      ? { x: e, y: f }
      : null;
  }
  function translatesOnly(anim) {
    if (typeof DOMMatrixReadOnly !== "function") return false;
    const props = animated(anim);
    if (!props.every((p) => p === "transform")) return false;
    try {
      for (const k of anim.effect.getKeyframes()) {
        if (NONE(k.transform)) continue;
        const m = new DOMMatrixReadOnly(k.transform);
        if (!m.is2D || m.a !== 1 || m.b !== 0 || m.c !== 0 || m.d !== 1) return false;
      }
    } catch {
      /* a length the matrix cannot read (a percentage) — not mirrored */
      return false;
    }
    return true;
  }
  /** The one translation animation that moves `el`, and where `el` and its animated box would be
   *  without it — or null. `running`: the document's running and paused animations. */
  function mirrorFor(el, running) {
    let mine = null;
    for (const a of running) {
      const t = a.effect?.target;
      if (!(t instanceof Element) || a.effect.pseudoElement) continue;
      const props = animated(a);
      if (props.every((p) => PAINT_ONLY.test(p))) continue;
      const layout = props.some((p) => p === "all" || (!PAINT_ONLY.test(p) && !CARRIES.test(p)));
      if (t.contains(el)) {
        if (mine !== null) return null;
        mine = a;
      } else if (layout && t.parentElement?.contains(el) === true) return null;
    }
    if (mine === null || !translatesOnly(mine)) return null;
    /* ONLY ON THE DOCUMENT'S OWN CLOCK (plan 73 round 3, T4). A reveal driven by the scroll
       (`animation-timeline: view()`) is a translation too, but its times are percentages of a
       scroll range: copied onto a document-timeline animation it has no duration (`auto`) and its
       start time cannot be set — the bridge threw a TypeError into the page and the mark sat
       790–830 px off mid-reveal. It moves only when the page scrolls, and every scroll is
       measured in the frame it happens, so such a mark is placed by the measure. */
    if (mine.timeline !== document.timeline) return null;
    const A = mine.effect.target;
    /* the copy's keyframes are in the animated box's own px; the marks' layer is at zoom 1 (T5) */
    if (cssZoom(A) !== 1) return null;
    /* no other transform on the way: none above the animated box, none between it and the element */
    const still = (n) => {
      const s = shifted(getComputedStyle(n));
      return s !== null && s.x === 0 && s.y === 0;
    };
    for (let n = A.parentElement; n !== null; n = n.parentElement) if (!still(n)) return null;
    for (let n = el; n !== A && n !== null; n = n.parentElement) if (!still(n)) return null;
    /* READ TOGETHER: the translation and both boxes, one after another */
    const t = shifted(getComputedStyle(A));
    if (t === null) return null;
    const ra = seenBox(A);
    const re = seenBox(el);
    return {
      anim: mine,
      at: { x: ra.x - t.x, y: ra.y - t.y },
      size: { w: A.offsetWidth, h: A.offsetHeight },
      rest: { x: re.x - t.x, y: re.y - t.y, w: re.w, h: re.h },
    };
  }
  /** Keep a node's copy of its element's animation in step with it — made once, re-timed when
   *  the original is paused, resumed or sped up; cancelled when it no longer moves the element.
   *  False when the copy could not be made or timed (T4): the mark is then placed by the measure,
   *  and nothing is thrown into the page. */
  function mirrorOn(n, mir) {
    const src = mir === null ? null : mir.anim;
    if (n.mirror !== undefined && n.mirror.src !== src) {
      try {
        n.mirror.copy.cancel();
      } catch {
        /* a copy the engine already let go of */
      }
      n.mirror = undefined;
    }
    if (src === null) return true;
    if (typeof n.wrap.animate !== "function") return false;
    try {
      if (n.mirror === undefined) {
        const copy = n.wrap.animate(src.effect.getKeyframes(), src.effect.getTiming());
        n.mirror = { src, copy };
      }
      const copy = n.mirror.copy;
      if (copy.playbackRate !== src.playbackRate) copy.playbackRate = src.playbackRate;
      if (src.playState === "paused") {
        if (copy.playState !== "paused") copy.pause();
        if (copy.currentTime !== src.currentTime) copy.currentTime = src.currentTime;
      } else if (copy.startTime !== src.startTime) copy.startTime = src.startTime;
      return true;
    } catch {
      if (n.mirror !== undefined) {
        try {
          n.mirror.copy.cancel();
        } catch {
          /* nothing to undo */
        }
        n.mirror = undefined;
      }
      return false;
    }
  }

  /* THE LAYER IS IN THE DOCUMENT ONLY WHILE IT HAS SOMETHING TO PAINT (plan 73 round 3, T7). A child
     of <html> is a node the page can see: `body:last-child` stops matching while it is there, a
     walker over `documentElement.children` counts one more. So it is put in when a mark is to be
     painted and taken out — not hidden — when the list is empty, the marks are off (*No marks*,
     *Done reviewing*, Review off) or edit mode is on. A page that takes it out itself (a root
     re-rendered, a framework that owns <html>) gets it back on the next measure — unless it takes it
     out again before three paints in a row: a page that fights for its root wins, nothing is
     painted, and the page is told so (`painted` is empty) until it next says what to mark. */
  const EVICTIONS = 3;
  function hostIn(want) {
    const host = marks.host;
    if (!want) {
      if (host.isConnected) host.remove();
      host.style.display = "none";
      marks.shown = false;
      return false;
    }
    if (!host.isConnected) {
      /* every put-in counts, and a paint that finds it still in clears the count: three put-ins
         with nothing painted between them is a page removing it each time */
      if (marks.evicted >= EVICTIONS) {
        /* AND SAID, ONCE A DOCUMENT (v24, H4): the page draws the marks over the frame itself, as
           it did before v22 — a page that fights for its root used to be left with no marks at all */
        if (!marks.saidEvicted) {
          marks.saidEvicted = true;
          post("studio:evicted", {});
        }
        return false;
      }
      marks.evicted += 1;
      document.documentElement.appendChild(host);
    } else marks.evicted = 0;
    /* THE LAYER IS AT ZOOM 1 ON SCREEN (T5): a page's `zoom` on <html> is undone on it, so a px
       written here is a px of the frame */
    const hz = cssZoom(document.documentElement);
    const want1 = hz === 1 ? "" : String(1 / hz);
    if (host.style.zoom !== want1) host.style.zoom = want1;
    return true;
  }

  /** Put every mark where its element is NOW — called at the end of each measure, in the frame's
   *  own animation frame, before that frame paints. EVERY READ FIRST, THEN EVERY WRITE: a read after
   *  a write (a sticky box's place, a computed style) lays the document out again inside the frame,
   *  so the places are worked out for every mark before one is moved. Says which marks it painted. */
  function paint(live) {
    marks.painted = [];
    if (marks.host === null) return;
    const show = marks.on && !edit.on && marks.list.length > 0;
    if (!hostIn(show)) {
      for (const n of marks.nodes.values()) mirrorOn(n, null);
      return;
    }
    /* shown again: the layers have no box until the host does, so it is shown before it is read */
    if (!marks.shown) {
      marks.host.style.display = "block";
      marks.shown = true;
    }
    const z = 1 / marks.scale;
    const docAt = marks.doc.getBoundingClientRect();
    const fixAt = marks.fixed.getBoundingClientRect();
    /* the animations that may move an element — asked only while one has started and not ended */
    let running = [];
    if (moving > 0 && typeof document.getAnimations === "function") {
      running = document
        .getAnimations()
        .filter((a) => a.playState === "running" || a.playState === "paused");
      /* THE COUNT CAN ONLY OVERSTATE (T14): an animation on an element the page removed never says
         it ended where `window` can hear it. Nothing running, nothing counted. */
      if (running.length === 0) moving = 0;
    }
    const plans = [];
    for (const m of marks.list) {
      const n = marks.nodes.get(m.key);
      if (n === undefined) continue;
      const v = live.get(m.id);
      if (v === undefined || !drawable(v.state, v.vis)) {
        plans.push({ n, hide: true });
        continue;
      }
      const viewport = ridesViewport(v.el);
      const o = viewport ? fixAt : docAt;
      const mir =
        running.length === 0 || v.area || v.clip.length > 0 || v.state !== "shown"
          ? null
          : mirrorFor(v.el, running);
      const plan = (mr) => {
        const box = mr === null ? v.vis : mr.rest;
        const whole = mr === null ? v.whole : mr.rest;
        return {
          n,
          m,
          mir: mr,
          box,
          layer: viewport ? marks.fixed : marks.doc,
          /* the node's own origin, in the layer: where the animated box rests, or the layer's own */
          ox: o.left + (mr === null ? 0 : mr.at.x - o.left),
          oy: o.top + (mr === null ? 0 : mr.at.y - o.top),
          base: mr === null ? { x: 0, y: 0 } : { x: mr.at.x - o.left, y: mr.at.y - o.top },
          at: m.dot === null ? null : dotSpot(m.dot, box, whole, z),
          /* where it goes if its animation cannot be copied (T4) */
          still: mr === null ? null : () => plan(null),
        };
      };
      plans.push(plan(mir));
    }
    for (let p of plans) {
      const n = p.n;
      if (p.hide) {
        restyle(n.wrap, "display", "none");
        /* AND OUT OF THE LAYER (T9): a layer holds only what it paints, however many notes there are */
        if (n.wrap.parentNode !== null) n.wrap.remove();
        mirrorOn(n, null);
        continue;
      }
      if (!mirrorOn(n, p.mir) && p.still !== null) {
        p = p.still();
        mirrorOn(n, null);
      }
      const { m, box, at, ox, oy } = p;
      restyle(n.wrap, "display", "");
      if (n.wrap.parentNode !== p.layer) p.layer.appendChild(n.wrap);
      restyle(n.wrap, "left", pxs(p.base.x));
      restyle(n.wrap, "top", pxs(p.base.y));
      restyle(n.wrap, "width", pxs(p.mir === null ? 0 : p.mir.size.w));
      restyle(n.wrap, "height", pxs(p.mir === null ? 0 : p.mir.size.h));
      restyle(n.ring, "left", pxs(box.x - ox));
      restyle(n.ring, "top", pxs(box.y - oy));
      restyle(n.ring, "width", pxs(Math.max(box.w, 4 * z)));
      restyle(n.ring, "height", pxs(Math.max(box.h, 4 * z)));
      marks.painted.push(m.key);
      if (at === null) continue;
      /* BY TRANSFORM, ON A LAYER OF ITS OWN (T9): a dot that moves (clamped at the screen's edge as its
         element leaves) is moved by the compositor, never laid out or painted again */
      restyle(n.spot, "transform", `translate(${pxs(at.x - ox)}, ${pxs(at.y - oy)})`);
      /* A DOT ONE FURTHER OUT IS TIED TO ITS ELEMENT by a line from the nearest point of the
         element to the dot's edge */
      const fx = Math.min(Math.max(at.x, box.x), box.x + box.w);
      const fy = Math.min(Math.max(at.y, box.y), box.y + box.h);
      const len = Math.hypot(at.x - fx, at.y - fy) - (PIN / 2) * z;
      if (!m.dot.at.endsWith("2") || len <= 0) {
        restyle(n.line, "display", "none");
        continue;
      }
      restyle(n.line, "display", "block");
      restyle(n.line, "left", pxs(fx - ox));
      restyle(n.line, "top", pxs(fy - oy));
      restyle(n.line, "width", pxs(len));
      restyle(
        n.line,
        "transform",
        `rotate(${Math.round(Math.atan2(at.y - fy, at.x - fx) * 1000) / 1000}rad)`,
      );
    }
  }

  /* ---------------------------------------------------------- measuring, once a frame (v19, D3) */

  /** The ids the page's pins hang off — what `studio:rects` last named; an empty list clears it. */
  let watched = [];
  let said = "";
  /* THE FRAGMENT EACH WATCHED PIN WAS MADE ON (v26, plan 77 D7): `studio:rects {ids, wheres}`, id →
     `where`, only for a pin that has one. Believed one entry at a time, at most 500. */
  const wheres = new Map();
  function wheresFrom(raw) {
    wheres.clear();
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return;
    for (const id of Object.keys(raw).slice(0, 500)) {
      const w = raw[id];
      if (typeof w === "string" && w !== "" && validWhere(w)) wheres.set(id, w);
    }
  }
  /** The selector alone a watched id names — the last step of every spelling of an id. */
  function selectorOfId(id) {
    const strip = (rest) => {
      const printed = PRINTED.exec(rest);
      return printed === null ? rest : printed[2];
    };
    const v21 = PRINTED.exec(id);
    if (v21 !== null) return v21[2];
    const v20 = FINGER.exec(id);
    if (v20 !== null) return v20[4];
    const af = AREA_F.exec(id);
    if (af !== null) return strip(af[5]);
    const a = AREA.exec(id);
    return a !== null ? a[5] : id;
  }
  /** The fingerprint a watched id carries — a pick's, or the holder's of an area drawn with one
   *  (the area records it at creation: `drawnOf`) — or null. Read once per id (`prints`). */
  function printOfId(id) {
    const v21 = PRINTED.exec(id);
    const af = AREA_F.exec(id);
    const held = v21 !== null ? v21 : af !== null ? PRINTED.exec(af[5]) : null;
    if (held !== null) {
      let fp = prints.get(id);
      if (fp === undefined) {
        const raw = decode(held[1]);
        fp = raw === null ? null : printFrom(raw);
        prints.set(id, fp);
      }
      return fp;
    }
    const old = FINGER.exec(id);
    if (old === null) return null;
    const fp = { tag: decode(old[1]), text: decode(old[2]), heading: decode(old[3]) };
    return fp.tag === null || fp.text === null || fp.heading === null || !TAG.test(fp.tag)
      ? null
      : fp;
  }
  /** Does this element SAY what the fingerprint said — the same tag, the same words, the same
   *  heading? Words are the proof: a fingerprint with no words and no heading proves nothing. */
  function provesSame(el, fp) {
    if (fp.text === "" && fp.heading === "") return false;
    return (
      el.localName === fp.tag && saysOf(el) === fp.text && saysOf(headingOf(el)) === fp.heading
    );
  }
  /** WHERE A PIN'S ELEMENT IS NOW (v36, O2): the fragment of the deck slide it sits on, or null.
   *  Only an element that PROVES it is the pin's (`provesSame`, F2's rule) — named by the selector,
   *  else found by the fingerprint — and only a fragment D9's rule derives (`slideWhere`; what shows
   *  now is on `location.hash`). It is kept per document generation, fragment and pin place, so a
   *  scroll asks nothing. */
  const movedMemo = new Map();
  function slideFragmentOf(el) {
    if (showsEl(el)) {
      /* the address is the slide only by the deck's own evidence — `#`+its id or a number (v38, Q4):
         a tab panel's last clicked anchor is no slide, and nothing is derived from it */
      const S = slideOn(el);
      const h = location.hash;
      return S !== null && h !== "" && ((S.id !== "" && h === `#${S.id}`) || /^#\d{1,9}$/.test(h))
        ? h
        : null;
    }
    for (
      let S = el;
      S !== null && S !== document.body && S.parentElement !== null;
      S = S.parentElement
    ) {
      if (!unseenEl(S)) continue;
      for (const V of S.parentElement.children) {
        if (V !== S && !ours(V) && !NOT_RENDERED.has(V.localName) && showsEl(V)) {
          const w = slideWhere(S, V);
          return w === "" ? null : w;
        }
      }
    }
    return null;
  }
  /* NOT WHILE THE PAGE IS MOVING: a deck lays its slide out after the `hashchange`, and fades one in
     while the other goes — mid-way two slides show, or the one that is leaving still does, and the
     fragment on screen is the new slide's with the old one's box. So nothing is derived until the
     document is complete, no transition runs, and the page has had its frame and task after the
     last `hashchange` (the same wait as the landing's); a later event measures again. */
  let hashSettling = false;
  const transitionsRun = () => {
    if (typeof document.getAnimations !== "function") return moving > 0;
    try {
      /* asking flushes the style, so a transition the last class change is about to start exists */
      return document
        .getAnimations()
        .some((a) => typeof a.transitionProperty === "string" && a.playState !== "finished");
    } catch {
      return moving > 0;
    }
  };
  const settledForMove = () =>
    document.readyState === "complete" && !hashSettling && !transitionsRun();
  function movedOf(id, w) {
    if (!settledForMove()) return null;
    const key = `${generation}|${location.hash}|${w}`;
    const was = movedMemo.get(id);
    if (was !== undefined && was.key === key) return was.to;
    let to = null;
    const fp = printOfId(id);
    if (fp !== null && !(fp.text === "" && fp.heading === "")) {
      const selector = selectorOfId(id);
      let el = null;
      try {
        el = document.querySelector(selector);
      } catch {
        el = null;
      }
      if (el === null || ours(el) || !provesSame(el, fp)) {
        el = null;
        try {
          const at = PRINTED.test(id) || AREA_F.test(id) ? anchorOf(fp, selector) : null;
          if (at !== null && !ours(at) && provesSame(at, fp)) el = at;
        } catch {
          el = null;
        }
      }
      if (el !== null) {
        const there = slideFragmentOf(el);
        if (there !== null && there !== w) to = there;
      }
    }
    movedMemo.set(id, { key, to });
    return to;
  }
  /** Is this pin on another fragment than the one showing, with nothing on this one that PROVES it
   *  is the same element? Then it is ELSEWHERE — and never found again by its fingerprint or its
   *  area's anchor, which is the guess a deck made (plan 77 D7). On another fragment its selector
   *  is believed only when the element it names shows AND says the pin's words (F2): position names
   *  whatever a router drew there now. An area is held by its holder's fingerprint, and one made
   *  without it (the page itself, a bridge before v22) is elsewhere. An in-page `#anchor` keeps its
   *  pins: the same element, the same words. */
  function elsewhereId(id) {
    const w = wheres.get(id);
    if (w === undefined || w === location.hash) return false;
    /* A PIN MADE AT AN ANCHOR OF THE PAGE (v38, plan 77 §32 Q1): its fragment names an element that
       shows — a place on this page, no route — so it is judged by its selector and its words below
       the normal way, never "on another fragment" for that */
    if (anchorEl(w) !== null) return false;
    let el = null;
    try {
      el = document.querySelector(selectorOfId(id));
    } catch {
      el = null;
    }
    if (el === null || ours(el) || unseenEl(el)) return true;
    const fp = printOfId(id);
    return fp === null || !provesSame(el, fp);
  }
  /* EACH WATCHED ELEMENT AND EVERY ELEMENT THAT CLIPS IT is observed for its size: a block that
     opens above a pin moves it without a scroll or a resize (measured: 30.3 px off after the page's
     own Toggle, back to 0.1 px only after a 1-px scroll).
     AND THE DOCUMENT'S OWN SIZE — <html> and <body> (plan 73 round 4, U1). A layout change the
     document makes no record of — a `content-visibility: auto` section rendered at its real size as
     it nears the screen, a CSS-only `:checked` accordion, a `details` panel — moves every box below
     it, and nothing else says so: the boxes kept far kept their old place, and a mark was missing
     with its element on the screen (thirty sections above a note: 0 painted). Any such change that
     moves a box in flow changes the document's height or width, so it starts a new epoch.
     MEASURED IN THE OBSERVER'S OWN CALLBACK, which runs after layout and before the frame paints —
     so the marks move in the very frame their elements did (a measure one frame later painted the
     accordion's two rings 178 / 228 px off for that frame). It adds no target there: a target
     observed for the first time inside a callback can be one the engine must skip, and a skipped
     observation is an error in the page's window — `observe` waits for the next frame. */
  let inObserver = false;
  const sizes =
    typeof ResizeObserver === "function"
      ? new ResizeObserver(
          quietly(() => {
            newEpoch();
            if (!marks.shown || marks.host === null || !marks.host.isConnected) {
              measureSoon();
              return;
            }
            inObserver = true;
            try {
              measure(false);
            } finally {
              inObserver = false;
            }
          }),
        )
      : null;
  let observed = new Set();
  function observe(els) {
    if (sizes === null) return;
    if (inObserver) {
      measureSoon();
      return;
    }
    if (els.size > 0) {
      els.add(document.documentElement);
      if (document.body !== null) els.add(document.body);
    }
    for (const el of observed) if (!els.has(el)) sizes.unobserve(el);
    for (const el of els) if (!observed.has(el)) sizes.observe(el);
    observed = els;
  }

  /**
   * Measure every watched id and post `studio:rects` — only when something a pin is drawn from
   * changed (a rect, a state, the scroll, the widths, the size it was given), or when `force`
   * says the page is waiting on it. `rects` is the border box of everything found, as it always
   * was (the studio draws from it); `seen` is v19's `{state, rect, whole}` per id.
   */
  /* ONLY WHAT IS NEAR THE SCREEN IS MEASURED (plan 73 round 3, T9). Two hundred notes on a long
     page cost 7 ms a measure at the median and 24 at most, every scroll frame, against a 2-ms budget
     — every id resolved, its box read and judged, on screen or not — and the page re-read and
     re-drew two hundred entries keyed by their long ids on every report: 27 frames a second where
     the same page with no note made 54. So:
       · A FAR ID IS NOT READ AT ALL while nothing can have moved it. A box that rides the document
         (no fixed or sticky box above it, nothing clipping it, not an area) and was beyond the
         screen and a dot's reach round it keeps its place in the DOCUMENT until the document
         changes (its observer's generation), the viewport is resized or an animation runs: where it
         is now is where it was, less the scroll since. Only when that puts it within reach is it
         read and judged again — in this measure, so a mark coming on screen is painted in the frame
         its element arrives in (D3), however far the page jumped. Its entry stays what it was when
         it went far: beyond the screen, the state it had.
       · A PAGE THAT ASKS (`studio:rects {ids, delta: true}`) is sent only what changed since the
         report before — the entries whose value moved, and the ids no longer found (`gone`); a
         size, a new list of ids or a page waiting on it gets the whole report. The studio does not
         ask, and is sent every entry as before. */
  const farOff = new Map();
  /* WHAT MOVES A BOX WITHOUT CHANGING THE DOCUMENT OR THE VIEWPORT: an image or a font arriving, a
     box that changed size (the observer), an animation or a transition ending. Each starts a new
     epoch, and every kept box is judged afresh. */
  let layoutEpoch = 0;
  const newEpoch = () => {
    layoutEpoch += 1;
  };

  /* NEAR BY THE ENGINE'S OWN WORD (plan 73 round 4, U1). A kept box is far by the scroll since it
     was judged — arithmetic, so a jump of any length paints a mark in the frame its element arrives
     in (D3). But the arithmetic is a prediction from where the box was, and a layout change no one
     announces moves it anyway; so an IntersectionObserver rooted at THIS document (its own viewport,
     with a dot's reach round it: a cross-origin frame's implicit root would ignore the margin) says
     which kept boxes are truly within reach, and one it calls near is read whatever the arithmetic
     says — at worst one frame after it arrives, never missing. */
  const nearSeen = new WeakMap();
  let nearIO = null;
  let nearReach = 0;
  let nearEls = new Set();
  function nearWatch(els) {
    if (typeof IntersectionObserver !== "function") return;
    const reach = Math.ceil((3 * PIN) / (marks.scale > 0 ? marks.scale : 1));
    if (nearIO === null || reach !== nearReach) {
      nearIO?.disconnect();
      nearEls = new Set();
      nearReach = reach;
      const opts = { root: document, rootMargin: `${reach}px` };
      const told = quietly((entries) => {
        let wake = false;
        for (const e of entries) {
          const was = nearSeen.get(e.target);
          nearSeen.set(e.target, e.isIntersecting);
          if (e.isIntersecting && was !== true) wake = true;
        }
        if (wake) measureSoon();
      });
      try {
        nearIO = new IntersectionObserver(told, opts);
      } catch {
        /* an engine that takes no document as a root: the viewport, with no margin */
        nearIO = new IntersectionObserver(told);
      }
    }
    for (const el of nearEls) if (!els.has(el)) nearIO.unobserve(el);
    for (const el of els) if (!nearEls.has(el)) nearIO.observe(el);
    nearEls = els;
  }

  /* WHAT IS ON TOP OF A KEPT BOX IS ASKED AGAIN ONLY WHERE A SCROLL CAN HAVE CHANGED IT (round 4,
     U4). A hit test is the dearest read there is — it walks the page's whole render tree: 26 µs a
     point on 1,500 elements, 252 µs on 15,000 (TRAPS §45) — and it was asked for every kept box on
     the screen on every scroll frame. While the document only scrolls, what lies over a box that
     rides it can change only where something does NOT ride it: a fixed or sticky box (the top layer
     is fixed too). So the answer is kept, and asked again when the box is not wholly on the screen
     (what shows of it, and so its centre, still moves), when it is within a dot's reach of
     something pinned to the viewport, when it was not asked since it came on screen, or when the
     page opened or closed something in the top layer (`coverEpoch`). */
  let coverEpoch = 0;
  /** This measure is one the page's scroll asked for, and nothing else (round 4, U4). */
  let scrolling = false;
  let coverDue = false;
  /** A near box was predicted, not read, while the page scrolled: read once it rests (round 5, V3). */
  let restDue = false;
  let lastScroll = [Number.NaN, Number.NaN];
  let pinnedList = { key: "", els: [] };
  /** Every element of the page's that the viewport carries — position fixed or sticky — found once
   *  per document generation and viewport, and only when a scroll needs it. */
  function pinnedEls() {
    const key = `${generation}|${window.innerWidth}x${window.innerHeight}`;
    if (pinnedList.key === key) return pinnedList.els;
    const out = [];
    const skip = (n) =>
      n === layer || n === marks.host || n === edit.chrome
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT;
    const walk = (root) => {
      const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, { acceptNode: skip });
      for (let n = w.nextNode(); n !== null; n = w.nextNode()) {
        const p = positionOf(getComputedStyle(n));
        if (p === "fixed" || p === "sticky") out.push(n);
        if (n.shadowRoot) walk(n.shadowRoot);
      }
    };
    walk(document.documentElement);
    pinnedList = { key, els: out };
    return out;
  }
  let pinnedBoxes = null;
  /** Is a box (or a dot within reach of it) over something the viewport carries? */
  function nearPinned(b) {
    if (pinnedBoxes === null) {
      pinnedBoxes = [];
      for (const el of pinnedEls()) {
        if (!el.isConnected) continue;
        const r = seenBox(el);
        const z = cssZoom(el);
        /* what hangs out of it (a header's open menu) is in its overflow */
        const w = Math.max(r.w, el.scrollWidth * z);
        const h = Math.max(r.h, el.scrollHeight * z);
        if (w > 0 && h > 0) pinnedBoxes.push({ x: r.x, y: r.y, w, h });
      }
    }
    const reach = (3 * PIN) / (marks.scale > 0 ? marks.scale : 1);
    for (const p of pinnedBoxes)
      if (
        b.x - reach < p.x + p.w &&
        b.x + b.w + reach > p.x &&
        b.y - reach < p.y + p.h &&
        b.y + b.h + reach > p.y
      )
        return true;
    return false;
  }
  /** Is a kept box covered — its centre or a dot's spot — asked again only when it can have
   *  changed. */
  function coverOf(id, f, b) {
    const c = f.cover;
    const at = coverShape(id, b);
    if (c !== null && c.epoch === coverEpoch && !nearPinned(b)) {
      if (at !== null && c.at === at) return c.covered;
      /* WHILE THE PAGE SCROLLS, what lies over a box that rides it can change only where the page's
         own content overlaps it (what the viewport carries is asked above, every frame) — part of
         it coming on screen, or its dot leaving the screen's edge. That is asked once the page
         rests, never in a scroll frame; a press on a dot is the engine's to answer whatever this
         says (`dotOnTop`) */
      if (scrolling) {
        coverDue = true;
        return c.covered;
      }
    }
    const covered = coveredEl(f.el, b) || coveredDot(id, f.el, b, b);
    f.cover = { covered, at, epoch: coverEpoch };
    return covered;
  }
  /** What a kept box's cover was asked about, relative to the box: its dots' spots, the top layer's
   *  epoch — null while some of it is off the screen (what shows of it, and its centre, still move
   *  with every scroll). Two answers asked about the same shape are the same answer while the page
   *  only scrolls. */
  function coverShape(id, b) {
    const v = viewport();
    if (b.x < 0 || b.y < 0 || b.x + b.w > v.w || b.y + b.h > v.h) return null;
    const z = 1 / marks.scale;
    let key = `${coverEpoch}|${b.w}x${b.h}`;
    /* a dot held at the screen's edge moves against its element as the page scrolls */
    if (marks.on)
      for (const d of marks.dots.get(id) ?? []) {
        const p = dotSpot(d, b, b, z);
        key += `|${r2(p.x - b.x)},${r2(p.y - b.y)}`;
      }
    return key;
  }
  let delta = false;
  /** Is a box beyond the screen and a dot's reach round it? */
  function afar(b) {
    const reach = (3 * PIN) / (marks.scale > 0 ? marks.scale : 1);
    return (
      b.x + b.w < -reach || b.y + b.h < -reach || b.x > viewW() + reach || b.y > viewH() + reach
    );
  }
  let sent = new Map();
  function measure(force) {
    if (heldWide !== null) return measureNow(force);
    heldWide = { w: window.innerWidth, h: window.innerHeight };
    held = {
      w: document.documentElement.clientWidth || heldWide.w,
      h: document.documentElement.clientHeight || heldWide.h,
    };
    try {
      return measureNow(force);
    } finally {
      held = null;
      heldWide = null;
    }
  }
  function measureNow(force) {
    const started = performance.now();
    const rects = {};
    const seen = {};
    const els = new Set();
    /* WHAT THE MARKS ARE PAINTED FROM, per id: this same measure, in this same frame (§11). */
    const live = new Map();
    const foundEls = [];
    /* a measure the page waits on (a size, a new list) judges everything afresh */
    if (force) farOff.clear();
    const farKey = `${generation}|${layoutEpoch}|${viewW()}x${viewH()}`;
    const sx = window.scrollX;
    const sy = window.scrollY;
    /* a kept box found where the scroll did not put it (round 4, U1) */
    let unsaid = false;
    scrolling = !force && !rereading && (sx !== lastScroll[0] || sy !== lastScroll[1]);
    lastScroll = [sx, sy];
    /* THE FIRST MEASURE AFTER THE SCROLL STOPPED reads every near box it predicted (round 5, V3) */
    const resting = restDue && !scrolling;
    if (resting) restDue = false;
    let predicted = false;
    coverDue = false;
    let judged = false;
    pinnedBoxes = null;
    /* v36, O2: a pin whose element now sits on the slide of another fragment is told it moved */
    const movedTo = new Map();
    for (const id of watched) {
      const pinned = wheres.size > 0 ? wheres.get(id) : undefined;
      if (pinned !== undefined) {
        const to = movedOf(id, pinned);
        if (to !== null) movedTo.set(id, to);
      }
      /* ON ANOTHER FRAGMENT AND NOT SHOWING HERE: elsewhere (v26, plan 77 D7). Judged afresh when
         its own fragment comes back. */
      if (wheres.size > 0 && elsewhereId(id)) {
        farOff.delete(id);
        seen[id] = { state: "hidden", rect: NOWHERE, whole: NOWHERE, elsewhere: true };
        continue;
      }
      const f = farOff.get(id);
      if (f !== undefined) {
        if (f.key === farKey && moving === 0 && f.el.isConnected) {
          const w = {
            x: r2(f.whole.x + f.sx - sx),
            y: r2(f.whole.y + f.sy - sy),
            w: f.whole.w,
            h: f.whole.h,
          };
          /* FAR — by the scroll since it was judged, AND by the engine's own word (round 4, U1): a
             box the IntersectionObserver says is within reach is near whatever the arithmetic says */
          if (afar(w) && nearSeen.get(f.el) !== true) {
            els.add(f.el);
            foundEls.push(f.el);
            f.near = false;
            /* the entry it had when it went far, unchanged */
            f.far ??= { state: f.state, rect: w, whole: w, ...(f.moved ? { moved: true } : {}) };
            rects[id] = f.far.whole;
            seen[id] = f.far;
            continue;
          }
          /* NEAR: READ WHEN IT COMES NEAR, NEVER PREDICTED THERE (round 4, U1) — a prediction from a
             place the document had since moved was a mark missing with its element on the screen —
             and read again whenever a style can have moved it with no record (a hover, a focus, a
             field, the top layer: `rereading`) or the engine's intersection disagrees with the
             arithmetic. In between, while the page only scrolls, the box rides the document as its
             mark does, and nothing of it is read (round 4, U4: a scroll frame asks nothing it can
             work out). A box that is not where the scroll put it was moved by something nothing
             announced, and every box kept is judged afresh.
             AND READ ONCE THE PAGE RESTS (round 5, V3): a script that edits a stylesheet rule on
             `scroll` (a parallax) moves the box with no record and no event, and the prediction
             left its ring 12–73 px off at rest. So a box predicted in a scroll frame is read in the
             first measure after the scroll stops — one box read each, once — and one not where it
             was predicted starts a new epoch, as above. No event says a CSSOM rule changed. */
          const read = f.near !== true || rereading || resting || nearSeen.get(f.el) === false;
          if (!read && scrolling) predicted = true;
          const b = read ? seenBox(f.el) : w;
          if (
            Math.abs(b.x - w.x) <= 0.5 &&
            Math.abs(b.y - w.y) <= 0.5 &&
            Math.abs(b.w - w.w) <= 0.5 &&
            Math.abs(b.h - w.h) <= 0.5
          ) {
            els.add(f.el);
            foundEls.push(f.el);
            f.far = null;
            f.near = true;
            /* whether it shows is a style a hover, a focus or a checkbox changes with no record */
            const shows = read ? !hiddenEl(f.el, b) : f.state !== "hidden";
            if (shows !== (f.state !== "hidden")) {
              f.state = shows ? "shown" : "hidden";
              f.cover = null;
            }
            const state = f.state === "hidden" ? "hidden" : coverOf(id, f, b) ? "covered" : "shown";
            rects[id] = b;
            /* IT RIDES THE DOCUMENT (round 4, U4): the page moves it with the scroll, and a report
               while the page only scrolls does not send it again */
            seen[id] = { state, rect: b, whole: b, ride: [sx, sy] };
            if (f.moved) seen[id].moved = true;
            const room = drawable(state, b) ? roomFor(id, f.el, b) : null;
            if (room !== null) seen[id].room = room;
            live.set(id, { state, vis: b, whole: b, el: f.el, clip: [], area: false });
            continue;
          }
          unsaid = true;
        }
        farOff.delete(id);
      }
      judged = true;
      const s = seenFor(id);
      if (s === null) continue;
      /* FOUND HERE ONCE, AND NOTHING SAYS ITS WORDS NOW (v22, S4): not showing — no box at all */
      if (s.unshown) {
        seen[id] = { state: "hidden", rect: NOWHERE, whole: NOWHERE };
        continue;
      }
      for (const el of s.els) els.add(el);
      foundEls.push(s.els[0]);
      rects[id] = s.whole;
      seen[id] = { state: s.state, rect: s.rect, whole: s.whole };
      if (s.moved === true) seen[id].moved = true;
      const area = AREA_F.test(id) || AREA.test(id);
      /* A BOX THAT RIDES THE DOCUMENT is judged once per generation: kept, with its state */
      if (
        !area &&
        s.els.length === 1 &&
        moving === 0 &&
        !chainOf(s.els[0]).fixed &&
        chainOf(s.els[0]).sticky === null
      ) {
        const far = afar(s.whole);
        farOff.set(id, {
          key: farKey,
          el: s.els[0],
          whole: s.whole,
          state: s.state === "covered" ? "shown" : s.state,
          /* what was on top of it, as `coverOf` keeps it */
          cover:
            s.state === "hidden"
              ? null
              : { covered: s.state === "covered", at: coverShape(id, s.whole), epoch: coverEpoch },
          moved: s.moved === true,
          far: far ? seen[id] : null,
          sx,
          sy,
        });
        if (far) continue;
        seen[id].ride = [sx, sy];
      }
      const room = drawable(s.state, s.rect) ? roomFor(id, s.els[0], s.rect) : null;
      if (room !== null) seen[id].room = room;
      live.set(id, {
        state: s.state,
        vis: s.rect,
        whole: s.whole,
        el: s.els[0],
        clip: s.els.slice(1),
        area,
      });
    }
    for (const [id, to] of movedTo)
      if (seen[id] !== undefined) seen[id] = { ...seen[id], moved: to };
    observe(els);
    if (!inObserver) {
      const kept = new Set();
      for (const f of farOff.values()) kept.add(f.el);
      nearWatch(kept);
    }
    /* WHAT THE VIEWPORT CARRIES is found in the measure that judged, once per document generation —
       never in a frame that only scrolls */
    if (judged && farOff.size > 0) pinnedEls();
    rereading = false;
    /* WHAT COVERS A BOX, ASKED ONCE THE PAGE RESTS: the next frame, if it did not scroll again */
    if (predicted) restDue = true;
    if (coverDue || predicted) measureSoon();
    /* SOMETHING MOVED THAT NOTHING ANNOUNCED: every kept box is judged afresh in the next frame */
    if (unsaid) {
      newEpoch();
      measureSoon();
    }
    /* every element found, near or far: an animation can bring a far one on screen */
    movers = foundEls;
    lastLive = live;
    /* EVERY READ BEFORE THE FIRST WRITE (§11): the widths and the scroll are read here, then the
       marks are painted, and nothing after the paint reads layout — a read after a write makes the
       engine lay the document out again inside this measure */
    const now = viewNow();
    paint(live);
    /* WHICH MARKS WERE PAINTED (round 3, T7/T9): the page keeps a click target, a focus stop and a
       name only for a mark that is on the screen here — never for one this document did not draw */
    const painted = marks.painted;
    /* WHAT CHANGED, entry by entry — never one string of every entry keyed by its long id */
    const next = new Map();
    const changed = {};
    const moved = {};
    let any = force;
    for (const id of Object.keys(seen)) {
      const e = seen[id];
      /* a riding entry is where it is in the DOCUMENT: the same while the page only scrolls */
      const ox = e.ride === undefined ? 0 : e.ride[0];
      const oy = e.ride === undefined ? 0 : e.ride[1];
      const k = `${e.state}|${r2(e.rect.x + ox)},${r2(e.rect.y + oy)},${e.rect.w},${e.rect.h}|${r2(e.whole.x + ox)},${r2(e.whole.y + oy)},${e.whole.w},${e.whole.h}|${e.moved === true ? 1 : typeof e.moved === "string" ? e.moved : 0}|${e.room ?? ""}|${e.ride === undefined ? 0 : 1}|${e.elsewhere === true ? 1 : 0}`;
      next.set(id, k);
      if (sent.get(id) !== k) {
        changed[id] = e;
        if (rects[id] !== undefined) moved[id] = rects[id];
        any = true;
      }
    }
    const gone = [...sent.keys()].filter((id) => !next.has(id));
    const key = json.stringify([now.width, now.layout, now.scroll, size.seq, painted]);
    if (!any && gone.length === 0 && key === said) return;
    said = key;
    const whole = force || !delta;
    sent = next;
    /* WHAT THE MEASURE COST, in ms (v20, plan 73 S5) — its painting included (v22): the
       performance check reads it — fifty pins measured under 2 ms — and the page ignores it. */
    const ms = Math.round((performance.now() - started) * 100) / 100;
    post(
      "studio:rects",
      whole
        ? { screen: screenId(), rects, seen, painted, ms, at: [sx, sy] }
        : {
            screen: screenId(),
            rects: moved,
            seen: changed,
            gone,
            delta: true,
            painted,
            ms,
            at: [sx, sy],
          },
      now,
    );
  }

  function watch(ids) {
    watched = ids.filter((id) => typeof id === "string" && id !== "").slice(0, 500);
    /* WHAT IS NO LONGER WATCHED IS NO LONGER KEPT. */
    for (const id of [...found.keys()]) if (!watched.includes(id)) found.delete(id);
    for (const id of [...lostAt.keys()]) if (!watched.includes(id)) lostAt.delete(id);
    for (const id of [...rooms.keys()]) if (!watched.includes(id)) rooms.delete(id);
    for (const id of [...prints.keys()]) if (!watched.includes(id)) prints.delete(id);
    for (const id of [...movedMemo.keys()]) if (!watched.includes(id)) movedMemo.delete(id);
    for (const id of [...farOff.keys()]) if (!watched.includes(id)) farOff.delete(id);
    measure(true);
    /* AN ELEMENT WATCHED WHILE SOMETHING ALREADY MOVES IT (an animation that started before the
       pin): its `animationstart` is long gone, so it is asked here */
    if (watched.length > 0 && movesWatched()) measureSoon();
  }

  /* `studio:size {seq}` — the page has just given this frame a size. The report goes back AT ONCE,
     tagged with it: reading the viewport here brings the page's own layout up to date first, so
     what is read is the size just given, in either order the resize and this message arrive. */
  function sizeFrom(msg) {
    const seq = msg.seq;
    if (typeof seq !== "number" || !Number.isSafeInteger(seq) || seq < 0) return;
    size.seq = seq;
    measure(true);
  }

  /* ONE FRAME BETWEEN A CHANGE AND THE MEASURE, and every frame WHILE SOMETHING MOVES A WATCHED
     ELEMENT: a slide's transition moves its title without one scroll, and a mark that waited for
     one would sit on the slide before it.

     ONLY WHILE IT MOVES ONE OF THEM (v22, plan 73 round 2, S11). Until v22 the loop ran every frame
     while ANY animation in the document ran — a spinner in a corner kept a page with a pin
     measuring sixty times a second for as long as it spun. Now an animation keeps the loop going
     only while it can move a watched element: one on the element or on an ancestor that animates
     anything but paint (a transform carries what is inside it), or one on a sibling of the element
     or of an ancestor that animates layout (a block growing above it pushes it down). Each
     `transitionrun` and `animationstart` asks again, so an animation that starts later is heard.
     Where the engine has no `getAnimations`, the count of those events stands in, as before.
     An animation a script starts with `Element.animate()` fires no event: it is heard at the next
     change the document makes, a scroll or a resize. */
  let pending = 0;
  let moving = 0;
  /** The elements the last measure found for the watched ids. */
  let movers = [];
  /** Properties that change how a thing is painted, and never where anything is. */
  const PAINT_ONLY =
    /^(opacity|color|background(-.*)?|border(-[a-z]+)?-color|box-shadow|text-shadow|outline(-.*)?|filter|backdrop-filter|visibility|clip-path|mask(-.*)?|fill(-.*)?|stroke(-.*)?|text-decoration(-.*)?|caret-color|accent-color|z-index|cursor|--.*)$/;
  /** Properties that move what is inside the element, and nothing beside it. */
  const CARRIES =
    /^(transform|translate|rotate|scale|transform-origin|perspective(-origin)?|offset(-.*)?)$/;
  const kebab = (p) => p.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
  /** What an animation animates: a transition's one property, an animation's keyframes' — `all`
   *  when it cannot say. */
  function animated(a) {
    if (typeof a.transitionProperty === "string") return [a.transitionProperty];
    const effect = a.effect;
    if (!effect || typeof effect.getKeyframes !== "function") return ["all"];
    const out = new Set();
    try {
      for (const frame of effect.getKeyframes())
        for (const p of Object.keys(frame))
          if (!["offset", "computedOffset", "easing", "composite"].includes(p)) out.add(kebab(p));
    } catch {
      return ["all"];
    }
    return out.size === 0 ? ["all"] : [...out];
  }
  function movesWatched() {
    if (typeof document.getAnimations !== "function") return moving > 0;
    if (movers.length === 0) return false;
    for (const a of document.getAnimations()) {
      if (a.playState !== "running") continue;
      const t = a.effect?.target;
      if (!(t instanceof Element)) continue;
      const props = animated(a);
      const layout = props.some((p) => p === "all" || (!PAINT_ONLY.test(p) && !CARRIES.test(p)));
      const carries = layout || props.some((p) => CARRIES.test(p));
      for (const el of movers) {
        if (carries && t.contains(el)) return true;
        if (layout && t.parentElement?.contains(el) === true) return true;
      }
    }
    return false;
  }
  /** A style changed with no record (round 4, U1): the boxes near the screen read again in the
   *  next frame. */
  let rereading = false;
  /* AND WHAT LIES OVER EACH OF THEM IS ASKED AGAIN (round 5, V1): the style that moves a box can
     open a box over another — a `:hover` menu over a noted paragraph — and a cover kept from before
     it left the dot painted on the menu. One hit test per near box, at most once a frame. */
  function restyled() {
    rereading = true;
    coverEpoch += 1;
    if (watched.length > 0) measureSoon();
  }
  function measureSoon() {
    if (pending !== 0) return;
    pending = requestAnimationFrame(
      quietly(() => {
        pending = 0;
        measure(false);
        if (watched.length > 0 && movesWatched()) {
          measureSoon();
          /* AND ONCE MORE AT THE LAST STEP BEFORE THE PAINT (§11): an animation the compositor runs
           — a transform — is read at the moment it is asked, not once a frame (Playwright's WebKit
           moved a sliding box 0.6 px between two reads 3 ms apart in one callback, TRAPS §41), so
           the marks it moves are put where it is as late as a script can see it */
          if (marks.tick !== null && marks.shown)
            marks.tick.style.width = marks.tick.style.width === "2px" ? "1px" : "2px";
        }
      }),
    );
  }

  /** The marks of the last measure, put where their elements are NOW — its states kept, only the
   *  boxes read again (§11, the last step before an animated frame paints). */
  let lastLive = new Map();
  function repaint() {
    if (!marks.shown || lastLive.size === 0) return;
    const live = new Map();
    for (const [id, v] of lastLive) {
      let whole;
      if (v.area) {
        const at = resolve(id);
        if (at === null || at.unshown) continue;
        whole = at.rect;
      } else {
        if (!v.el.isConnected) continue;
        whole = seenBox(v.el);
      }
      let vis = whole;
      for (const a of v.clip) vis = meet(vis, clientBox(a));
      live.set(id, { ...v, vis, whole });
    }
    paint(live);
  }

  /* IN THE CAPTURE PHASE, BECAUSE `scroll` DOES NOT BUBBLE (an inner scroller's scroll never
     reached a bubble listener on `window`: measured 2026-09-17, a pinned element's top moved
     262 → -138 and nothing was posted). A resize is reported whether or not anything is watched:
     the page re-sizes the frame off `layout` and has to hear what the frame became. */
  addEventListener("scroll", measureSoon, { capture: true, passive: true });
  /* AND WHICH ELEMENT SCROLLED, for the place (v26, plan 77 D3): a scroll whose target is an
     element, not the document, is remembered — the reload puts it back */
  addEventListener(
    "scroll",
    quietly((event) => {
      const t = event.target;
      if (t === document || t === window || t === null || t.nodeType !== 1 || ours(t)) return;
      noteScroller(t);
    }),
    { capture: true, passive: true },
  );
  addEventListener("resize", measureSoon);
  for (const type of ["transitionrun", "animationstart"])
    addEventListener(
      type,
      () => {
        moving++;
        /* what it animates may be a box coming over a mark — asked again (round 5, V1) */
        coverEpoch += 1;
        measureSoon();
      },
      true,
    );
  for (const type of ["transitionend", "transitioncancel", "animationend", "animationcancel"])
    addEventListener(
      type,
      () => {
        moving = Math.max(0, moving - 1);
        newEpoch();
        measureSoon();
      },
      true,
    );
  /* `load` of an image does not reach `window` (its path ends at the document). */
  const settled = () => {
    newEpoch();
    measureSoon();
  };
  document.addEventListener("load", settled, true);
  if (document.fonts !== undefined) {
    document.fonts.ready.then(settled, () => {});
    if (typeof document.fonts.addEventListener === "function")
      document.fonts.addEventListener("loadingdone", settled);
  }
  /* ONE OBSERVER FOR THE WHOLE DOCUMENT, not one per pin: it sees an ancestor's class change, and
     costs one frame per burst. Our own nodes change on every pointer move and are not news.
     EVERY ATTRIBUTE AND EVERY TEXT (v21): a lost pin's answer is kept until the document changes
     (`generation`), and the element it names may come back by a new id, a new class, a `data-*`
     the page styles on, or its words changing back — so any of those is a change. */
  if (typeof MutationObserver === "function") {
    /* A RECORD OF OURS is one inside our own nodes, or one that only put ours in or took ours out
       (the marks' layer is a child of <html>, so its arrival is <html>'s record, v22) */
    const oursRecord = (r) =>
      ours(r.target) ||
      (r.type === "attributes" &&
        (r.attributeName === HOVER_ATTR || r.attributeName === STILL_ATTR)) ||
      (r.type === "childList" &&
        r.addedNodes.length + r.removedNodes.length > 0 &&
        [...r.addedNodes, ...r.removedNodes].every((n) => ours(n)));
    new MutationObserver(
      quietly((records) => {
        /* A COPY OF OURS THE PAGE MADE (T7): a root re-rendered from its own HTML
           (`documentElement.innerHTML = …`, a body's) parses our layer's and our ring's markup
           back as inert elements of the page's — taken out, so nothing of ours is left behind */
        for (const r of records)
          for (const n of r.addedNodes) {
            if (!(n instanceof Element) || ours(n)) continue;
            const copies = n.matches("[data-studio-aim]") ? [n] : [];
            for (const c of n.querySelectorAll("[data-studio-aim]")) if (!ours(c)) copies.push(c);
            for (const c of copies) c.remove();
          }
        /* THE PAGE TOOK OUR LAYER OUT (T7): put back on the next measure, if it is still wanted */
        if (
          marks.host !== null &&
          !marks.host.isConnected &&
          marks.shown &&
          records.some((r) => [...r.removedNodes].includes(marks.host))
        ) {
          marks.shown = false;
          measureSoon();
        }
        if (records.every(oursRecord)) return;
        generation += 1;
        shieldSoon();
        if (watched.length === 0) return;
        measureSoon();
      }),
    ).observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });
  }

  /* `studio:reveal {id}` (v19, D9) — a pin the person asked for, brought into view: each scroller
     that holds it, innermost first, then the document, each only as far as it takes. Never
     `scrollIntoView`, which may scroll the page that frames this one. */
  function reveal(id) {
    const first = id === "" ? null : resolve(id);
    if (first === null || first.unshown) return;
    const now = () => {
      const at = resolve(id);
      return at === null || at.unshown ? null : at.rect;
    };
    const inside = (t, c) =>
      t.x >= c.x && t.y >= c.y && t.x + t.w <= c.x + c.w && t.y + t.h <= c.y + c.h;
    for (const a of clippers(first.el, first.area)) {
      /* only a box a person could scroll themselves: one the page keeps `overflow: hidden` is the
         page's to move, never ours */
      if (!scrollable(a)) continue;
      const t = now();
      if (t === null) return;
      const c = clientBox(a);
      if (inside(t, c)) continue;
      /* a box scrolls in its own px: the screen distance over its zoom (T5) */
      const z = cssZoom(a);
      a.scrollTop += (t.y + t.h / 2 - (c.y + c.h / 2)) / z;
      a.scrollLeft += (t.x + t.w / 2 - (c.x + c.w / 2)) / z;
    }
    const t = now();
    if (t === null) return;
    const v = viewport();
    if (inside(t, { x: 0, y: 0, w: v.w, h: v.h })) return;
    window.scrollBy(t.x + t.w / 2 - v.w / 2, t.y + t.h / 2 - v.h / 2);
  }

  /* ---------------------------------------------------------------- 6. edit mode */

  /* THE DESIGNER EDITS FREELY AND THE AGENT RECONCILES AFTERWARDS. Nothing below refuses a
     gesture. What the design system can say, it says — a modifier, a move, a duplicate, a word,
     all of it written straight back into the screen's source. What it cannot say is carried as an
     inline `style` and handed on as an INTENT: *this is what I meant; match it as closely as the
     system allows, and where you cannot, add the component.*

     v8 (2026-09-18) IS THE SAME MODEL WITH A DESIGN TOOL'S HANDS. v7 had one selection, three
     handles, a black toolbar of words floating over the design, and nothing that measured,
     snapped, aligned or listed. The owner's verdict on it was short and correct. So this is the
     surface a designer arriving from Figma, Webflow or Framer expects and nothing they would
     have to be taught:

       · SELECTION is a set, not an element: click, shift-click, a marquee over the ground,
         Enter/⇧Enter down and up the tree, Tab/⇧Tab across siblings, ⌘A for the siblings.
       · THE OVERLAY is drawn once in a <style> and positioned in frame pixels, with every
         DECORATIVE size — a border, a handle, the label's type — divided by the scale the studio
         reports, so an 8-px handle is 8 px on the designer's screen at every zoom (`studio:editopt`).
       · EIGHT HANDLES, and every edge means one thing a source file can hold: the right and
         bottom edges SIZE (width, height), the left and top edges give ROOM (margin-left,
         margin-top), a corner sizes both, ⇧ on a corner keeps the ratio, ⌥ on a sizing edge gives
         room on that side instead. The label under the pointer says which number is moving.
       · A DRAG REORDERS, with a ghost under the pointer, the receiving container outlined, a
         caret where it will land, and the frame scrolling itself near its edges. ⌥-drag drops a
         COPY. ⌘-drag is a FREE move (transform) with smart guides that snap to the siblings'
         edges and centres, which is the one gesture Figma has that flow layout does not, kept
         because it is how a designer says "a little to the left" without a number.
       · ⌥ HELD OVER ANOTHER ELEMENT MEASURES the distance from the selection to it, in red, the
         way Figma does — the fastest way a designer has ever had to say "this gap is wrong".
       · A BOX-MODEL SHADE (margin amber, padding green — DevTools' own colours), a grid, and the
         guides are each a switch the studio flips (`studio:editopt`).
       · THE TREE of the screen is posted on every change (`studio:tree`), so the studio can draw a
         layers panel, and a right-click posts where it happened (`studio:menu`) so the studio can
         open its own menu at that point — nothing is drawn in here that a page can draw better.
       · EVERY VERB IS A MESSAGE (`studio:act`): duplicate, delete, hide, wrap, unwrap, copy, cut,
         paste, insert, forward/backward/front/back, swap, align, distribute, style, reset,
         nudge, text, the four selects, undo and redo — the same functions the keys call, so the
         studio's panel, its context menu and this document's keyboard are three doors onto ONE
         set of verbs, and there is no verb a designer can reach one way and not another.

     THE TWO WRITE PATHS ARE UNCHANGED. `writable()` guards the trait controls: they write a
     `data-*` the vocabulary declared and can reach `style`, `class` and `id` under no spelling
     of that vocabulary. The free tools write `style` and only `style`, through `setStyle()`, and
     `free` on the message says which door a change came through. `hidden` is the one plain HTML
     attribute a verb writes, because "take this out for now" is a sentence a designer says and
     the file can hold it without a rule.

     THE FIVE RULES STILL HOLD, and every function below is one of them:

     1. `writable()` GUARDS THE TRAIT CONTROLS, NOT THE DESIGNER.
     2. OUR CHROME IS ONE ELEMENT, OUTSIDE THE ROOT, AND IT CARRIES `data-studio-edit`. Every box,
        handle, guide, label and the stylesheet that draws them is INSIDE it, `exitEdit()` removes
        it, and `screenHtml()` parks anything of ours out of what it serialises. The studio
        SCREENSHOTS this document.
     3. A DROP GOES ANYWHERE; the only refusals are physics — into itself, into its own
        descendant, outside the root.
     4. EVERY STEP IS ON THE MESSAGE. `ops` is the whole run so far, in sentences.
     5. THE VOCABULARY IS DATA THAT ARRIVED OVER postMessage, vetted like any other; and so is
        every selector a verb names, which is matched against what THIS document last posted and
        never run through `querySelector` on trust. */

  /** The five a SCREEN is written against (the frozen contract): structure, not modifiers. */
  const FROZEN_ATTR = new Set(["data-screen", "data-slot", "data-states", "data-bind", "data-go"]);
  /** A modifier value: one word the system's own selectors could have carried. */
  const VALUE = /^[A-Za-z0-9][\w.:-]{0,39}$/;
  /** Crude and correct: these documents are ~2 KB, so a snapshot is cheaper than a diff. */
  const MAX_UNDO = 80;
  /** The cap's lines kept one by one; older ones fold into a single "and n earlier" line (v13). */
  const MAX_GONE = 200;
  const EARLIER = /^\u2026 and (\d+) earlier changes?$/;
  /** The tree is posted whole; a screen with more nodes than this is not a prototype. */
  const MAX_TREE = 1500;
  /** The colours. Selection blue is Figma's, the guide red is Figma's, the box-model tints are
   *  DevTools' — three vocabularies every designer and every developer already reads. */
  const BLUE = "#0c8ce9";
  const RED = "#f24822";
  /** One definition of each decorative size, in SCREEN pixels; `--z` scales them into the frame. */
  const HANDLE = 8;
  /** Within this many SCREEN pixels a free move or a resize snaps to a guide (tldraw's 8). */
  const SNAP = 8;
  /** The frame scrolls itself when a drag comes within this many frame pixels of its edge. */
  const EDGE = 36;
  /** Below this a resize is a slip of the hand, not a width. */
  const MIN_SIZE = 8;
  /** Arrow keys: one pixel, and ten with shift — Figma's, Penpot's and tldraw's big nudge, which
   *  is the number a designer's thumb already knows. */
  const NUDGE = 1;
  const NUDGE_BIG = 10;
  /** The inline properties a `style` verb may set from the rail — the free tools' whole
   *  vocabulary, and nothing a screenshot could not have shown. */
  const STYLE_PROPS = new Set([
    "width",
    "height",
    "min-width",
    "max-width",
    "min-height",
    "max-height",
    "margin-top",
    "margin-right",
    "margin-bottom",
    "margin-left",
    "padding-top",
    "padding-right",
    "padding-bottom",
    "padding-left",
    "gap",
    "opacity",
    "transform",
    "flex",
    "align-self",
    "order",
    "text-align",
    "font-size",
    "font-weight",
    "line-height",
    "letter-spacing",
    "border-radius",
    "background",
    "background-color",
    "color",
    "display",
    "flex-direction",
    "justify-content",
    "align-items",
  ]);
  /** A style value: a length, a keyword, a colour — never a url(), never an expression. */
  const STYLE_VALUE = /^[\w#%.,()\s-]{1,80}$/;

  /* THE TRAIT GATE, AND IT IS ABOUT THE TRAIT CONTROLS AND NOTHING ELSE. */
  const writable = (attr) =>
    typeof attr === "string" && /^data-[a-z][a-z0-9-]*$/.test(attr) && !FROZEN_ATTR.has(attr);

  /* ---------------------------------------------------------- the free tools' one attribute */

  /* WRITTEN AS TEXT, NEVER THROUGH CSSOM, and that is a measured choice rather than a style.
     `el.style.transform = …` asks the host engine to parse and re-serialise the declaration, and
     an engine that does not implement a property DROPS IT SILENTLY — jsdom's cssstyle does
     exactly that, so a resize would be a no-op in the tests written to prove it and nothing would
     go red. Parsing the attribute ourselves also means the bytes the agent reads are the bytes we
     wrote, in the order we wrote them, on every host. */
  function styleList(el) {
    const out = [];
    for (const part of (el.getAttribute("style") || "").split(";")) {
      const at = part.indexOf(":");
      if (at === -1) continue;
      const name = part.slice(0, at).trim();
      const value = part.slice(at + 1).trim();
      if (name !== "" && value !== "") out.push([name, value]);
    }
    return out;
  }

  const styleOf = (el, prop) => {
    const found = styleList(el).find(([name]) => name === prop);
    return found === undefined ? "" : found[1];
  };

  /** That declaration's number, in px. Absent, empty or unparseable all mean 0. */
  const pxOf = (el, prop) => {
    const value = Number.parseFloat(styleOf(el, prop));
    return Number.isFinite(value) ? value : 0;
  };

  /* AN EMPTY VALUE REMOVES THE DECLARATION, AND AN EMPTY LIST REMOVES THE ATTRIBUTE. A nudge that
     nets back to zero has to leave the element exactly as it was found — `style=""` is a
     difference, and `exitEdit()` is asserted byte-for-byte against the document we arrived in. */
  function setStyle(el, prop, value) {
    const list = styleList(el).filter(([name]) => name !== prop);
    if (value !== "") list.push([prop, value]);
    if (list.length === 0) el.removeAttribute("style");
    else el.setAttribute("style", list.map(([name, v]) => `${name}:${v}`).join(";"));
  }

  /* A FLAG IS A VALUE LIST OF ONE `""` (#38) — `[data-block]` in the system's own selectors,
     which the vocabulary spells as `{"data-block": [""]}`. It passes where a word must match. */
  const vetValues = (raw) =>
    (Array.isArray(raw) ? raw : [])
      .filter((v) => typeof v === "string" && (v === "" || VALUE.test(v)))
      .slice(0, 40);
  /** A trait the system declares as present-or-absent, never as a word. */
  const isFlag = (values) => values.length === 1 && values[0] === "";
  /** What a flag's trait says while the attribute is there — any word turns it on. */
  const FLAG_ON = "on";

  /** `{attr: [value, …]}` with every name run past `writable` and every value past `VALUE`. */
  function vetAttrs(raw) {
    const out = {};
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return out;
    for (const [attr, values] of Object.entries(raw)) {
      if (!writable(attr)) continue;
      const list = vetValues(values);
      if (list.length > 0) out[attr] = list;
    }
    return out;
  }

  /** The vocabulary, as far as it can be believed. Null means structure only — never a throw. */
  function vetVocab(raw) {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return null;
    const slots = (Array.isArray(raw.slots) ? raw.slots : [])
      .filter((s) => typeof s === "string" && s !== "" && s.length <= 60)
      .slice(0, 400);
    const modifiers = vetAttrs(raw.modifiers);
    const perSlot = {};
    if (raw.perSlot !== null && typeof raw.perSlot === "object" && !Array.isArray(raw.perSlot)) {
      for (const [slot, attrs] of Object.entries(raw.perSlot)) {
        const vetted = vetAttrs(attrs);
        if (slot !== "" && Object.keys(vetted).length > 0) perSlot[slot] = vetted;
      }
    }
    const empty =
      slots.length === 0 &&
      Object.keys(modifiers).length === 0 &&
      Object.keys(perSlot).length === 0;
    return empty ? null : { slots, modifiers, perSlot };
  }

  /** What this element may carry: what the system says about ITS slot, or the shared modifiers. */
  function traitsFor(el) {
    const v = edit.vocab;
    if (v === null || el === null) return {};
    const slot = el.getAttribute("data-slot");
    if (slot !== null && v.perSlot[slot] !== undefined) return v.perSlot[slot];
    return v.modifiers;
  }

  /* ---------------------------------------------------------- the root, and what we post of it */

  const screenRoot = () => document.querySelector("[data-screen]");

  /* WHERE OUR CHROME HANGS: OUTSIDE THE ROOT, ALWAYS. A prototype that puts `data-screen` ON the
     body is legal and happens, and there `<body>` is INSIDE the root, so the chrome goes one
     further out onto `<html>`. Getting this wrong is our overlay inside the `outerHTML` the agent
     writes to the screen's source file. */
  function chromeHost() {
    const root = screenRoot();
    if (document.body === null) return document.documentElement;
    return root?.contains(document.body) === true ? document.documentElement : document.body;
  }

  /** Is this node ours — either mode's chrome, or the review's marks (§11)? Hit testing, sibling
   *  walks, the anchors and the document's observer all skip it. */
  const ours = (node) =>
    node instanceof Node &&
    (layer.contains(node) ||
      edit.chrome?.contains(node) === true ||
      marks.host?.contains(node) === true);

  /**
   * The root as the studio will read it, with every trace of us taken out of it.
   *
   * NOTHING IS CLONED, AND THE NODES THAT MOVE ARE OURS. `root.cloneNode(true)` on a body-rooted
   * screen is a second copy of the entire document, our chrome inside it, on every change; under
   * jsdom it never came back. Lifting our own nodes out for the length of one `outerHTML` costs
   * nothing and is checked rather than reasoned about.
   */
  function screenHtml() {
    const root = screenRoot();
    if (root === null) return "";
    const parked = [];
    for (const node of root.querySelectorAll("[data-studio-edit],[data-studio-aim]")) {
      parked.push([node, node.parentNode, node.nextSibling]);
      node.remove();
    }
    const typing = edit.text !== null && root.contains(edit.text) ? edit.text : null;
    const was = typing === null ? null : typing.getAttribute("contenteditable");
    if (typing !== null) typing.removeAttribute("contenteditable");
    /* A `style=""` anywhere is ours, and it goes: a screen's source has no empty style attribute
       in it and never wanted one, and the gate refuses a `style` whatever its value. */
    if (root.getAttribute("style") === "") root.removeAttribute("style");
    for (const el of root.querySelectorAll('[style=""]')) el.removeAttribute("style");
    const html = root.outerHTML;
    if (typing !== null && was !== null) typing.setAttribute("contenteditable", was);
    for (const [node, parent, next] of parked) parent.insertBefore(node, next);
    return html;
  }

  /* ---------------------------------------------------------- what a change is called */

  /** `"Back"` when it says something, else the component's own name — what a person would say. */
  function nameOf(el) {
    const text = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40);
    if (text !== "") return `"${text}"`;
    return (
      el.getAttribute("data-slot") || el.getAttribute("data-screen") || el.tagName.toLowerCase()
    );
  }

  /** `button "Back"` — the tag, because a trait is set on a TAG, plus whatever names it. */
  const labelOf = (el) => `${el.tagName.toLowerCase()} ${nameOf(el)}`.trim();

  /* WHAT A CONTAINER IS CALLED, and it is never its words: a two-button footer's `textContent`
     is `"Back Finish"`, which is a component nobody can find. Its own slot is the name. */
  const holderOf = (el) =>
    el.getAttribute("data-slot") || el.getAttribute("data-screen") || el.tagName.toLowerCase();

  /* THE CHIP SAYS THE KIND THE STUDIO SAYS (v15, UX review 3 M1): the slot in a person's words —
     "Badge dot" — and "Element" for an element no slot names, never its tag. The page's
     `crumbLabel` is the same transform. */
  const chipKind = (el) => {
    const slot = el.getAttribute("data-slot") || el.getAttribute("data-screen") || "";
    const words = slot.replace(/[-_]+/g, " ").trim();
    return words === "" ? "Element" : words.charAt(0).toUpperCase() + words.slice(1);
  };

  /** The identity the agent greps with. Both halves are the file's own, never a second pair. */
  /* AND ITS KIND (v16, UX review 4 M2): the element's OWN slot, or "" when no slot names it. The
     path cannot say which — its last slot is the element's when it has one and an ancestor's when
     it has none — and the studio's list of changes names the subject by it. ADDITIVE: it rides on
     the step only; the lines the round carries do not move. */
  const identOf = (el) => ({
    path: pathOf(el),
    selector: selectorOf(el),
    kind: el.getAttribute("data-slot") || "",
  });

  /** `3 components` / `button "Back"` — what a verb over a set says it acted on. */
  function namesOf(list) {
    if (list.length === 1) return labelOf(list[0]);
    const named = list.slice(0, 3).map(nameOf).join(", ");
    return `${list.length} components (${named}${list.length > 3 ? ", …" : ""})`;
  }

  /* ---------------------------------------------------------- the undo stack */

  /** A fresh id for a step this document records — never one a seed could already hold. */
  const stepId = () => {
    edit.serial += 1;
    return `${edit.tag}.${edit.serial}`;
  };

  function pushSnapshot(html, summary, path, free, kind) {
    edit.stack = edit.stack.slice(0, edit.at + 1);
    edit.stack.push({
      id: stepId(),
      html,
      summary,
      path,
      free: free === true,
      sel: edit.sel.map(selectorOf),
      kind: typeof kind === "string" ? kind : "",
    });
    /* THE CAP KEEPS ITS LINES (v12, plan 66 D14). The oldest snapshot goes — undo stops at the
       oldest one kept — but what that step DID is still done, so its line moves to `gone` and
       stays in `ops`: a long session's round says everything, not the last eighty things. */
    while (edit.stack.length > MAX_UNDO) {
      const out = edit.stack.shift();
      if (out !== undefined && out.summary !== "")
        edit.gone.push({ summary: out.summary, path: out.path });
    }
    edit.gone = foldGone(edit.gone);
    edit.at = edit.stack.length - 1;
  }

  /* THE LINES ARE BOUNDED TOO (v13): every one of them rides every `studio:edited`, so a session
     of a thousand steps would post a thousand lines a step. Past `MAX_GONE` the oldest fold into
     ONE line that still says how many there were — the round says everything was done, just not
     each thing by name. */
  function foldGone(gone) {
    if (gone.length <= MAX_GONE) return gone;
    let n = 0;
    const cut = gone.length - MAX_GONE + 1;
    for (const g of gone.slice(0, cut)) {
      const m = g.path === "" ? EARLIER.exec(g.summary) : null;
      n += m === null ? 1 : Number(m[1]);
    }
    const word = n === 1 ? "change" : "changes";
    return [{ summary: `\u2026 and ${n} earlier ${word}`, path: "" }, ...gone.slice(cut)];
  }

  /* `ops` — EVERY COMMITTED STEP SINCE THE SESSION BEGAN, OLDEST FIRST, up to where we are: a
     step that has been undone is not a thing anybody is asking for. The base snapshot is excluded
     by its empty summary, not by an index; a step the cap pushed off is in `gone`, ahead of the
     rest. */
  const opsNow = () => [
    ...edit.gone,
    ...edit.stack
      .slice(0, edit.at + 1)
      .filter((step) => step.summary !== "")
      .map((step) => ({ summary: step.summary, path: step.path })),
  ];

  /** One step as the studio records it — everything but the markup, which rides beside it. */
  const stepMeta = (step) => ({
    id: step.id,
    summary: step.summary,
    path: step.path,
    free: step.free === true,
    sel: step.sel,
    kind: typeof step.kind === "string" ? step.kind : "",
  });

  /** The stack's shape, for the studio's copy of it (v12): which steps, in order, and where. */
  const historyNow = () => ({
    ids: edit.stack.map((step) => step.id),
    at: edit.at,
    gone: edit.gone.slice(),
  });

  /* A SELECTOR IS RECOGNISED, NEVER TRUSTED (24 §2 rule 3) — and that holds for the ones that come
     back to us inside a seed as much as for a verb's echo. A string is honoured only when the
     element it finds is named by EXACTLY that string, which is what this document would have
     called it; anything else finds nothing. */
  function recognised(sels) {
    const out = [];
    const root = screenRoot();
    for (const sel of Array.isArray(sels) ? sels.slice(0, 200) : []) {
      if (typeof sel !== "string" || sel === "" || sel.length > 400) continue;
      let el = null;
      try {
        el = document.querySelector(sel);
      } catch {
        el = null;
      }
      if (el === null || (el !== root && within(el) === null)) continue;
      if (selectorOf(el) === sel && !out.includes(el)) out.push(el);
    }
    return out;
  }

  /* RESTORED ONTO THE LIVING ROOT, NOT IN PLACE OF IT. `root.outerHTML = …` replaces the node,
     which a `<body>` does not survive. Copying the attributes and the innerHTML across keeps one
     root for the whole session. The selection is put back by selector, best effort — an undo
     that dropped the selection was a small loss on every step. */
  function applySnapshot(html, sels) {
    const root = screenRoot();
    if (root === null) return;
    const parsed = new DOMParser()
      .parseFromString(html, "text/html")
      .querySelector("[data-screen]");
    if (parsed === null) return;
    for (const name of [...root.getAttributeNames()]) {
      if (!parsed.hasAttribute(name)) root.removeAttribute(name);
    }
    for (const name of parsed.getAttributeNames()) {
      root.setAttribute(name, parsed.getAttribute(name) || "");
    }
    root.innerHTML = parsed.innerHTML;
    select(recognised(sels).filter((el) => el !== root));
  }

  /** A change that IS the whole tree — undo, redo — names the root, because nothing else survived.
   *  `kind` says which (v12), and `moved` is the id of the step taken back or put back. */
  function report(summary, kind, free, moved) {
    const root = screenRoot();
    if (root === null) return;
    const step = edit.stack[edit.at];
    post("studio:edited", {
      screen: screenId(),
      html: screenHtml(),
      summary,
      path: pathOf(root),
      selector: selectorOf(root),
      ops: opsNow(),
      free: free === true,
      revert: kind === "undo",
      kind,
      moved,
      step: step === undefined ? null : stepMeta(step),
      history: historyNow(),
      canUndo: edit.at > 0,
      canRedo: edit.at < edit.stack.length - 1,
    });
    postTree();
  }

  /** Every committed mutation lands here, and nowhere else posts `studio:edited` with a snapshot. */
  function commit(summary, ident, free) {
    flushPend();
    const html = screenHtml();
    pushSnapshot(html, summary, ident.path, free, ident.kind);
    const step = edit.stack[edit.at];
    post("studio:edited", {
      screen: screenId(),
      html,
      summary,
      path: ident.path,
      selector: ident.selector,
      ops: opsNow(),
      free: free === true,
      kind: "commit",
      moved: step.id,
      step: stepMeta(step),
      history: historyNow(),
      canUndo: edit.at > 0,
      canRedo: false,
    });
    soon();
    postSelected();
    postTree();
  }

  /* A RUN OF NUDGES IS ONE CHANGE, for the reason a run of keystrokes is. The DOM moves on every
     press — a designer has to see what they are doing — and only the MESSAGE waits. */
  function pendSoon(summary, ident) {
    edit.pend = { summary, ident };
    if (edit.pendTimer !== 0) clearTimeout(edit.pendTimer);
    edit.pendTimer = setTimeout(flushPend, 400);
  }

  function flushPend() {
    if (edit.pendTimer !== 0) {
      clearTimeout(edit.pendTimer);
      edit.pendTimer = 0;
    }
    const held = edit.pend;
    if (held === null) return;
    edit.pend = null;
    commit(held.summary, held.ident, true);
  }

  /* AN UNDO IS A RETRACTION, AND IT IS FLAGGED AS ONE. The file is still written (the undo is
     real); `revert` is how the page knows to drop the line it is taking back rather than add one. */
  function undo() {
    flushPend();
    stopText(true);
    if (edit.at <= 0) return;
    const undone = edit.stack[edit.at];
    edit.at -= 1;
    /* THE SELECTION THE UNDONE STEP WAS MADE ON, not the one the snapshot before it had: taking
       back a change puts the designer's hand back on the thing they changed. */
    applySnapshot(edit.stack[edit.at].html, undone.sel);
    report(`undid ${undone.summary}`, "undo", undone.free, undone.id);
  }

  function redo() {
    flushPend();
    stopText(true);
    if (edit.at >= edit.stack.length - 1) return;
    edit.at += 1;
    const redone = edit.stack[edit.at];
    applySnapshot(redone.html, redone.sel);
    report(`redid ${redone.summary}`, "redo", redone.free, redone.id);
  }

  /* ---------------------------------------------------------- the seed (v12, plan 66 D1) */

  /** The ceiling on a seed: the cap's own number of steps, and no more markup than a page can
   *  reasonably hold of one screen's history. */
  const SEED_BYTES = 8 * 1024 * 1024;
  const SEED_ID = /^[\w.:-]{1,48}$/;

  /* A SEED IS MARKUP THAT ARRIVED OVER postMessage, AND IT IS VETTED LIKE ANY OTHER. It is the
     studio's copy of steps this bridge recorded in an earlier document of the same file — but a
     copy is what it is, and `applySnapshot` puts it in the DOM with `innerHTML`, where a handler
     attribute runs. So every step must parse to a root that names THIS screen, and it is cleaned
     on the way in of what no screen file may hold anyway (the write gate refuses a script, a
     handler and a frame; `insert`'s strip is the same idea). */
  function cleanRoot(html, name) {
    if (typeof html !== "string" || html === "") return null;
    let parsed = null;
    try {
      parsed = new DOMParser().parseFromString(html, "text/html").querySelector("[data-screen]");
    } catch {
      parsed = null;
    }
    if (parsed === null || parsed.getAttribute("data-screen") !== name) return null;
    for (const bad of parsed.querySelectorAll("script,iframe,frame,object,embed")) bad.remove();
    /* AN SVG ANIMATION CAN WRITE AN `href` THE SWEEP BELOW NEVER SEES (v13). */
    for (const anim of parsed.querySelectorAll("set,animate")) {
      if (/href/i.test(anim.getAttribute("attributeName") || "")) anim.remove();
    }
    for (const el of [parsed, ...parsed.querySelectorAll("*")]) {
      for (const attr of [...el.getAttributeNames()]) {
        /* AS THE URL PARSER READS IT: every C0 control and space gone, so `java&#9;script:` and a
           leading control are the scheme they are (v13). */
        let value = "";
        for (const c of el.getAttribute(attr) || "") if (c.charCodeAt(0) > 0x20) value += c;
        value = value.toLowerCase();
        if (
          attr.startsWith("on") ||
          attr === "contenteditable" ||
          attr.startsWith("data-studio-") ||
          (/^(href|src|action|formaction|xlink:href)$/.test(attr) &&
            value.startsWith("javascript:"))
        )
          el.removeAttribute(attr);
      }
    }
    return parsed.outerHTML;
  }

  /** Whitespace between tags is the file's indentation, not the screen — two serialisations of
   *  one root compare equal under this. */
  const sameRoot = (a, b) => {
    const flat = (s) => s.replace(/>\s+</g, "><").replace(/\s+/g, " ").trim();
    return flat(a) === flat(b);
  };

  /**
   * Take the studio's copy of this file's history and stand on it: the steps become the stack, the
   * current one goes on the DOM when the document does not already say it, and the selection the
   * studio last saw is put back where it is recognised. Answers whether the seed was taken — a
   * seed that fails any check is ignored whole, and the document keeps the fresh history it
   * armed with, which the studio reads back off `studio:editable` and follows.
   */
  function adoptSeed(seed) {
    const root = screenRoot();
    if (root === null || seed === null || typeof seed !== "object") return false;
    const name = root.getAttribute("data-screen") || "";
    const raw = Array.isArray(seed.steps) ? seed.steps : [];
    const at = Number(seed.at);
    if (raw.length === 0 || raw.length > MAX_UNDO) return false;
    if (!Number.isInteger(at) || at < 0 || at >= raw.length) return false;
    let bytes = 0;
    const steps = [];
    const seen = new Set();
    for (const s of raw) {
      if (s === null || typeof s !== "object") return false;
      const id = typeof s.id === "string" && SEED_ID.test(s.id) ? s.id : "";
      if (id === "" || seen.has(id)) return false;
      seen.add(id);
      bytes += typeof s.html === "string" ? s.html.length : 0;
      if (bytes > SEED_BYTES) return false;
      const html = cleanRoot(s.html, name);
      if (html === null) return false;
      const text = (v) => (typeof v === "string" ? v.slice(0, 400) : "");
      steps.push({
        id,
        html,
        summary: text(s.summary),
        path: text(s.path),
        free: s.free === true,
        kind: text(s.kind).slice(0, 64),
        sel: (Array.isArray(s.sel) ? s.sel : [])
          .filter((x) => typeof x === "string" && x.length <= 400)
          .slice(0, 50),
      });
    }
    const gone = (Array.isArray(seed.gone) ? seed.gone : [])
      .filter((g) => g !== null && typeof g === "object" && typeof g.summary === "string")
      .slice(-(MAX_GONE + 1))
      .map((g) => ({
        summary: g.summary.slice(0, 400),
        path: typeof g.path === "string" ? g.path.slice(0, 400) : "",
      }));
    flushPend();
    stopText(true);
    edit.stack = steps;
    edit.at = at;
    edit.gone = foldGone(gone);
    const want = steps[at].html;
    if (!sameRoot(want, screenHtml())) applySnapshot(want, seed.sel);
    else select(recognised(seed.sel).filter((el) => el !== root));
    return true;
  }

  /* ---------------------------------------------------------- the flush (v12, plan 66 D3) */

  /** How long a hold lasts if the studio never lets go — a swap that never happened must not
   *  leave the editor dead. */
  const HOLD_MS = 8000;

  function release() {
    edit.held = false;
    if (edit.holdTimer !== 0) {
      clearTimeout(edit.holdTimer);
      edit.holdTimer = 0;
    }
  }

  /**
   * `studio:flush {hold}` — the studio is about to put a new document of this file in our place.
   * What is pending is committed NOW (the words being typed, a run of nudges), a gesture in the
   * middle of itself is put back, and with `hold` nothing new may start until the swap: a change
   * made in a document that is about to be thrown away is a change lost. `studio:flushed` says
   * it is done — after every `studio:edited` the flush caused, because messages keep their order.
   */
  function flushFrom(msg) {
    const hold = msg !== null && typeof msg === "object" && msg.hold === true;
    const force = msg !== null && typeof msg === "object" && msg.force === true;
    /* NOT MID-KEYSTROKE (v13): the words being typed are the designer's until THEY end them. A
       hold asked for while they are open is refused, and the studio waits for `studio:text`. */
    if (edit.on && hold && !force && edit.text !== null) {
      post("studio:flushed", { screen: screenId(), held: false, text: true });
      return;
    }
    /* A RELEASE IS ONLY A RELEASE (v17, plan 66 review 5, MAJOR E): `{hold: false}` lets go of a
       hold and touches nothing else. It used to flush too — commit the words, put a gesture back —
       and a conflict's let-go, arriving while the designer typed in another element, closed their
       words under them, so the next Backspace deleted the element. */
    if (!hold) {
      release();
      post("studio:flushed", { screen: screenId(), held: false });
      return;
    }
    if (edit.on) {
      cancelGesture();
      flushPend();
      stopText(true);
      release();
      if (hold) {
        edit.held = true;
        edit.holdTimer = setTimeout(release, HOLD_MS);
        if (edit.n !== null) edit.n.hover.style.display = "none";
      }
    }
    post("studio:flushed", { screen: screenId(), held: edit.held });
  }

  /* ---------------------------------------------------------- the chrome */

  /* ONE STYLESHEET, INSIDE THE ONE CHROME ELEMENT. Every box below is positioned in FRAME pixels
     (that is what `getBoundingClientRect` speaks), and every decorative size is a screen size
     multiplied by `--z`, which the studio sets to 1/scale through `studio:editopt`. A 1-px hairline
     stays a hairline at k = 0.5 instead of vanishing, and an 8-px handle stays 8 px instead of
     becoming a 4-px target. The stylesheet goes with the chrome, so teardown is still one
     `remove()`. */
  const CHROME_CSS = `
[data-studio-edit="chrome"]{position:fixed;inset:0;z-index:2147483646;pointer-events:none;--z:1;font:calc(11px * var(--z))/1.2 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Inter,sans-serif;color:#fff;contain:strict}
[data-studio-edit="chrome"] *{box-sizing:border-box}
[data-studio-edit="hover"]{position:absolute;display:none;border:calc(1px * var(--z)) solid ${BLUE};pointer-events:none}
[data-studio-edit="outline"]{position:absolute;display:none;border:calc(2px * var(--z)) solid ${BLUE};pointer-events:none}
[data-studio-edit="outline"][data-many="yes"]{border-width:calc(1px * var(--z))}
[data-studio-edit="union"]{position:absolute;display:none;border:calc(1px * var(--z)) dashed ${BLUE};pointer-events:none}
[data-studio-edit="label"]{position:absolute;display:none;max-width:60vw;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;padding:calc(2px * var(--z)) calc(6px * var(--z));border-radius:calc(3px * var(--z));background:${BLUE};color:#fff;font-weight:500;letter-spacing:.01em;box-shadow:0 calc(1px * var(--z)) calc(3px * var(--z)) rgba(0,0,0,.25);pointer-events:none}
[data-studio-edit="label"] b{font-weight:400;opacity:.8;margin-left:calc(6px * var(--z))}
[data-studio-edit="handle"]{position:absolute;display:none;width:calc(${HANDLE}px * var(--z));height:calc(${HANDLE}px * var(--z));background:#fff;border:calc(1px * var(--z)) solid ${BLUE};border-radius:calc(1.5px * var(--z));box-shadow:0 0 0 calc(1px * var(--z)) rgba(255,255,255,.6);pointer-events:auto}
[data-studio-edit="handle"][data-dir="n"],[data-studio-edit="handle"][data-dir="s"]{cursor:ns-resize}
[data-studio-edit="handle"][data-dir="e"],[data-studio-edit="handle"][data-dir="w"]{cursor:ew-resize}
[data-studio-edit="handle"][data-dir="ne"],[data-studio-edit="handle"][data-dir="sw"]{cursor:nesw-resize}
[data-studio-edit="handle"][data-dir="nw"],[data-studio-edit="handle"][data-dir="se"]{cursor:nwse-resize}
[data-studio-edit="caret"]{position:absolute;display:none;background:${BLUE};border-radius:calc(2px * var(--z));pointer-events:none}
[data-studio-edit="caret"]::before,[data-studio-edit="caret"]::after{content:"";position:absolute;width:calc(7px * var(--z));height:calc(7px * var(--z));border-radius:50%;background:${BLUE}}
[data-studio-edit="caret"][data-axis="x"]::before{left:calc(-2.5px * var(--z));top:calc(-3.5px * var(--z))}
[data-studio-edit="caret"][data-axis="x"]::after{left:calc(-2.5px * var(--z));bottom:calc(-3.5px * var(--z))}
[data-studio-edit="caret"][data-axis="y"]::before{top:calc(-2.5px * var(--z));left:calc(-3.5px * var(--z))}
[data-studio-edit="caret"][data-axis="y"]::after{top:calc(-2.5px * var(--z));right:calc(-3.5px * var(--z))}
[data-studio-edit="target"]{position:absolute;display:none;border:calc(1px * var(--z)) dashed ${BLUE};background:rgba(12,140,233,.05);pointer-events:none}
[data-studio-edit="ghost"]{position:absolute;display:none;opacity:.55;outline:calc(1px * var(--z)) solid ${BLUE};outline-offset:calc(-1px * var(--z));background:rgba(255,255,255,.35);pointer-events:none;overflow:hidden;max-width:420px;max-height:320px;filter:drop-shadow(0 calc(4px * var(--z)) calc(12px * var(--z)) rgba(0,0,0,.25))}
[data-studio-edit="marquee"]{position:absolute;display:none;border:calc(1px * var(--z)) solid ${BLUE};background:rgba(12,140,233,.08);pointer-events:none}
[data-studio-edit="shade"]{position:absolute;display:none;pointer-events:none}
[data-studio-edit="shade"][data-part="margin"]{background:rgba(249,204,157,.45)}
[data-studio-edit="shade"][data-part="padding"]{background:rgba(147,196,125,.45)}
[data-studio-edit="guide"]{position:absolute;display:none;background:${RED};pointer-events:none}
[data-studio-edit="dist"]{position:absolute;display:none;transform:translate(-50%,-50%);padding:calc(1px * var(--z)) calc(4px * var(--z));border-radius:calc(2px * var(--z));background:${RED};color:#fff;font-size:calc(10px * var(--z));font-weight:600;white-space:nowrap;pointer-events:none}
[data-studio-edit="grid"]{position:absolute;inset:0;display:none;pointer-events:none;background-image:linear-gradient(to right,rgba(12,140,233,.12) 1px,transparent 1px),linear-gradient(to bottom,rgba(12,140,233,.12) 1px,transparent 1px);background-size:8px 8px}
[data-studio-edit="hint"]{position:absolute;display:none;transform:translate(-50%,0);padding:calc(2px * var(--z)) calc(6px * var(--z));border-radius:calc(3px * var(--z));background:#111;color:#fff;font-size:calc(10px * var(--z));white-space:nowrap;pointer-events:none;opacity:.92}
`;

  function makeEl(tag, mark, extra) {
    const node = document.createElement(tag);
    node.setAttribute("data-studio-edit", mark);
    if (extra) for (const [k, v] of Object.entries(extra)) node.setAttribute(k, v);
    return node;
  }

  const DIRS = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
  /** How many guide lines and distance labels the overlay keeps ready. */
  const GUIDES = 6;

  function buildChrome() {
    const c = makeEl("div", "chrome");
    const style = document.createElement("style");
    style.setAttribute("data-studio-edit", "style");
    style.textContent = CHROME_CSS;
    const n = {
      grid: makeEl("div", "grid"),
      shades: [
        "margin",
        "margin",
        "margin",
        "margin",
        "padding",
        "padding",
        "padding",
        "padding",
      ].map((part) => makeEl("div", "shade", { "data-part": part })),
      target: makeEl("div", "target"),
      hover: makeEl("div", "hover"),
      outlines: [],
      union: makeEl("div", "union"),
      handles: DIRS.map((dir) => makeEl("div", "handle", { "data-dir": dir })),
      caret: makeEl("div", "caret", { "data-axis": "y" }),
      ghost: makeEl("div", "ghost"),
      marquee: makeEl("div", "marquee"),
      guides: Array.from({ length: GUIDES }, () => makeEl("div", "guide")),
      dists: Array.from({ length: GUIDES }, () => makeEl("div", "dist")),
      label: makeEl("div", "label"),
      hint: makeEl("div", "hint"),
    };
    c.append(
      style,
      n.grid,
      ...n.shades,
      n.target,
      n.hover,
      n.union,
      ...n.handles,
      n.caret,
      n.ghost,
      n.marquee,
      ...n.guides,
      ...n.dists,
      n.label,
      n.hint,
    );
    edit.chrome = c;
    edit.n = n;
    applyOpts();
    chromeHost().appendChild(c);
  }

  /** A box, or nothing, onto one of our absolutely positioned nodes. */
  function place(node, b) {
    if (b === null) {
      node.style.display = "none";
      return;
    }
    node.style.display = "block";
    node.style.left = `${b.x}px`;
    node.style.top = `${b.y}px`;
    node.style.width = `${b.w}px`;
    node.style.height = `${b.h}px`;
  }

  /** One outline per selected element, made on demand and kept for the mode's life. */
  function outlineAt(i) {
    const list = edit.n.outlines;
    while (list.length <= i) {
      const node = makeEl("div", "outline");
      edit.n.label.before(node);
      list.push(node);
    }
    return list[i];
  }

  const union = (boxes) => {
    if (boxes.length === 0) return null;
    const x = Math.min(...boxes.map((b) => b.x));
    const y = Math.min(...boxes.map((b) => b.y));
    const r = Math.max(...boxes.map((b) => b.x + b.w));
    const btm = Math.max(...boxes.map((b) => b.y + b.h));
    return { x, y, w: r - x, h: btm - y };
  };

  /** Screen pixels → frame pixels, for a size that must LOOK constant. */
  const z = () => 1 / (edit.opts.scale > 0 ? edit.opts.scale : 1);

  /* THE LABEL SITS ABOVE THE BOX'S TOP-LEFT and drops inside it at the top of the viewport —
     Figma's rule, and the one that keeps the name readable on a hero that starts at y = 0. */
  function placeLabel(node, b, text) {
    if (b === null || text === "") {
      node.style.display = "none";
      return;
    }
    node.style.display = "block";
    node.textContent = "";
    const [name, size] = text;
    node.append(name);
    if (size) {
      const tail = document.createElement("b");
      tail.textContent = size;
      node.append(tail);
    }
    const h = node.offsetHeight || 16 * z();
    const above = b.y - h - 2 * z() >= 0;
    node.style.left = `${Math.max(0, b.x)}px`;
    node.style.top = `${above ? b.y - h - 2 * z() : b.y + 2 * z()}px`;
  }

  /** The eight handles on a box, half in and half out; hidden on a box that has none. */
  function placeHandles(b) {
    const half = (HANDLE / 2) * z();
    for (const node of edit.n.handles) {
      if (b === null) {
        node.style.display = "none";
        continue;
      }
      const dir = node.getAttribute("data-dir") || "";
      const x = dir.includes("e") ? b.x + b.w : dir.includes("w") ? b.x : b.x + b.w / 2;
      const y = dir.includes("s") ? b.y + b.h : dir.includes("n") ? b.y : b.y + b.h / 2;
      node.style.display = "block";
      node.style.left = `${x - half}px`;
      node.style.top = `${y - half}px`;
    }
  }

  /* THE BOX MODEL, SHADED THE WAY DEVTOOLS SHADES IT: margin amber outside the border box,
     padding green inside it. Read off the computed style, so a margin the stylesheet set and a
     margin a free tool set look the same — they ARE the same, to the layout. */
  function placeShades(el) {
    const on = edit.opts.spacing && el !== null;
    if (!on) {
      for (const node of edit.n.shades) node.style.display = "none";
      return;
    }
    const b = box(el);
    const cs = getComputedStyle(el);
    const px = (v) => {
      const n = Number.parseFloat(v);
      return Number.isFinite(n) ? n : 0;
    };
    const m = [cs.marginTop, cs.marginRight, cs.marginBottom, cs.marginLeft].map(px);
    const p = [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft].map(px);
    const bw = [
      cs.borderTopWidth,
      cs.borderRightWidth,
      cs.borderBottomWidth,
      cs.borderLeftWidth,
    ].map(px);
    const s = edit.n.shades;
    place(s[0], m[0] > 0 ? { x: b.x - m[3], y: b.y - m[0], w: b.w + m[1] + m[3], h: m[0] } : null);
    place(s[1], m[1] > 0 ? { x: b.x + b.w, y: b.y, w: m[1], h: b.h } : null);
    place(s[2], m[2] > 0 ? { x: b.x - m[3], y: b.y + b.h, w: b.w + m[1] + m[3], h: m[2] } : null);
    place(s[3], m[3] > 0 ? { x: b.x - m[3], y: b.y, w: m[3], h: b.h } : null);
    const ix = b.x + bw[3];
    const iy = b.y + bw[0];
    const iw = b.w - bw[1] - bw[3];
    const ih = b.h - bw[0] - bw[2];
    place(s[4], p[0] > 0 ? { x: ix, y: iy, w: iw, h: p[0] } : null);
    place(
      s[5],
      p[1] > 0 ? { x: ix + iw - p[1], y: iy + p[0], w: p[1], h: ih - p[0] - p[2] } : null,
    );
    place(s[6], p[2] > 0 ? { x: ix, y: iy + ih - p[2], w: iw, h: p[2] } : null);
    place(s[7], p[3] > 0 ? { x: ix, y: iy + p[0], w: p[3], h: ih - p[0] - p[2] } : null);
  }

  /** The size a designer reads: `240 × 48`, rounded. */
  const sizeOf = (b) => `${Math.round(b.w)} × ${Math.round(b.h)}`;

  /** Where the outline, the handles, the label and the shades sit NOW. Called on every commit,
   *  scroll and resize, coalesced to one per frame by `soon()`. */
  function frame() {
    if (!edit.on || edit.chrome === null) return;
    const n = edit.n;
    const live = edit.sel.filter((el) => el.isConnected);
    if (live.length !== edit.sel.length) edit.sel = live;
    const boxes = live.map(box);
    for (let i = 0; i < n.outlines.length; i += 1) {
      const node = n.outlines[i];
      if (i < boxes.length) {
        node.setAttribute("data-many", boxes.length > 1 ? "yes" : "no");
        place(node, boxes[i]);
      } else node.style.display = "none";
    }
    for (let i = n.outlines.length; i < boxes.length; i += 1) {
      const node = outlineAt(i);
      node.setAttribute("data-many", boxes.length > 1 ? "yes" : "no");
      place(node, boxes[i]);
    }
    const all = union(boxes);
    place(n.union, boxes.length > 1 ? all : null);
    /* HANDLES ON ONE THING ONLY. A handle on a union box would size what, exactly? Figma greys
       them out on a mixed selection; here they are simply not there. */
    placeHandles(boxes.length === 1 && edit.text === null ? boxes[0] : null);
    placeShades(live.length === 1 ? live[0] : null);
    if (boxes.length === 0) placeLabel(n.label, null, "");
    else if (boxes.length === 1)
      placeLabel(n.label, boxes[0], [chipKind(live[0]), sizeOf(boxes[0])]);
    else placeLabel(n.label, all, [`${boxes.length} elements`, sizeOf(all)]);
    if (edit.measure !== null) drawMeasure();
  }

  /** One frame() per animation frame, however many things ask for it. */
  function soon() {
    if (edit.raf !== 0 || typeof requestAnimationFrame !== "function") {
      if (edit.raf === 0) frame();
      return;
    }
    edit.raf = requestAnimationFrame(() => {
      edit.raf = 0;
      frame();
    });
  }

  /** The box under the pointer, named. Purely ours: nothing of it is inside the root. */
  function showHover(el) {
    const n = edit.n;
    if (n === null) return;
    if (el === null || edit.sel.includes(el) || edit.drag !== null || edit.size !== null) {
      n.hover.style.display = "none";
      if (edit.sel.length === 0) placeLabel(n.label, null, "");
      return;
    }
    const b = box(el);
    place(n.hover, b);
    /* THE HOVER LABEL ONLY WHILE NOTHING IS SELECTED: two chips at once is noise, and the
       selection's chip is the one that carries a number a designer is about to change. */
    if (edit.sel.length === 0) placeLabel(n.label, b, [chipKind(el), sizeOf(b)]);
  }

  /** The words under the pointer while a handle or a free move is live: `W 240`, `ML 16`. */
  function hint(text, x, y) {
    const node = edit.n?.hint;
    if (!node) return;
    if (text === "") {
      node.style.display = "none";
      return;
    }
    node.style.display = "block";
    node.textContent = text;
    node.style.left = `${x}px`;
    node.style.top = `${y + 16 * z()}px`;
  }

  /* ---------------------------------------------------------- the options the studio sets */

  function applyOpts() {
    if (edit.chrome === null) return;
    edit.chrome.style.setProperty("--z", String(z()));
    edit.n.grid.style.display = edit.opts.grid ? "block" : "none";
    edit.n.grid.style.backgroundSize = `${edit.opts.gridStep}px ${edit.opts.gridStep}px`;
  }

  /** `studio:editopt` — scale, and the three switches. Anything else on it is ignored. */
  function setOpts(raw) {
    if (raw === null || typeof raw !== "object") return;
    const o = edit.opts;
    if (typeof raw.scale === "number" && Number.isFinite(raw.scale) && raw.scale > 0) {
      o.scale = Math.min(8, Math.max(0.05, raw.scale));
    }
    for (const key of ["spacing", "grid", "guides", "snap"]) {
      if (typeof raw[key] === "boolean") o[key] = raw[key];
    }
    if (typeof raw.gridStep === "number" && raw.gridStep >= 2 && raw.gridStep <= 64) {
      o.gridStep = Math.round(raw.gridStep);
    }
    applyOpts();
    frame();
  }

  /* ---------------------------------------------------------- what the studio is told */

  /**
   * WHAT THIS ELEMENT CARRIES AND WHAT IT MAY CARRY, in one list the studio can draw without
   * knowing this document. The allowed values come from `traitsFor` — the same function
   * `applyTrait` consults before it writes. `data-go` is last and carries no values, which is
   * what marks it as free text.
   */
  function traitList(el) {
    const out = [];
    for (const [attr, values] of Object.entries(traitsFor(el))) {
      /* A flag's value is whether it is there (#38): `getAttribute` says `""` either way. */
      const value = isFlag(values)
        ? el.hasAttribute(attr)
          ? FLAG_ON
          : ""
        : el.getAttribute(attr) || "";
      out.push({ attr, value, values });
    }
    out.push({ attr: "data-go", value: el.getAttribute("data-go") || "", values: [] });
    return out;
  }

  /** The ancestry, outermost first, ending in the element itself; stops at the screen root. */
  function crumbOf(el) {
    const root = screenRoot();
    const chain = [];
    for (let node = el; node !== null && node !== root; node = node.parentElement) {
      chain.unshift({ label: holderOf(node), selector: selectorOf(node) });
    }
    if (root !== null) {
      chain.unshift({ label: holderOf(root), selector: selectorOf(root) });
    }
    return chain;
  }

  /** The computed facts an inspector shows: what the layout actually resolved to. Read only on
   *  selection and on commit — never on hover, which is where a getComputedStyle per mousemove
   *  would cost a frame. */
  const COMPUTED = [
    "display",
    "flexDirection",
    "gap",
    "alignItems",
    "justifyContent",
    "width",
    "height",
    "marginTop",
    "marginRight",
    "marginBottom",
    "marginLeft",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "fontFamily",
    "fontSize",
    "fontWeight",
    "lineHeight",
    "letterSpacing",
    "textAlign",
    "color",
    "backgroundColor",
    "borderRadius",
    "borderTopWidth",
    "borderTopColor",
    "opacity",
    "position",
  ];

  function computedOf(el) {
    const out = {};
    let cs = null;
    try {
      cs = getComputedStyle(el);
    } catch {
      return out;
    }
    for (const key of COMPUTED) {
      const v = cs[key];
      if (typeof v === "string" && v !== "") out[key] = v;
    }
    return out;
  }

  /** One selected element, said whole. */
  function itemOf(el) {
    const b = box(el);
    const parent = el.parentElement;
    const pb = parent === null ? b : box(parent);
    return {
      path: pathOf(el),
      selector: selectorOf(el),
      slot: el.getAttribute("data-slot") || "",
      tag: el.tagName.toLowerCase(),
      text: canText(el) ? (el.textContent || "").trim().slice(0, 200) : "",
      canText: canText(el),
      hidden: el.hasAttribute("hidden"),
      box: b,
      offset: { x: b.x - pb.x, y: b.y - pb.y },
      traits: traitList(el),
      style: styleList(el),
      computed: computedOf(el),
      go: el.getAttribute("data-go") || "",
      children: [...el.children].filter((k) => !ours(k)).length,
    };
  }

  /**
   * One selection, said out loud — including the one that is nothing.
   *
   * `path`, `selector`, `slot`, `traits` and `crumb` are the PRIMARY's (the last one selected),
   * so a studio that predates v8 keeps drawing exactly what it drew; `items` is every member,
   * and `selectors` is the join a verb has to echo back.
   */
  function postSelected() {
    if (!edit.on) return;
    const live = edit.sel.filter((el) => el.isConnected);
    const items = live.map(itemOf);
    const primary = items.length === 0 ? null : items[items.length - 1];
    edit.sent = items.map((i) => i.selector).join("\n");
    post("studio:selected", {
      screen: screenId(),
      path: primary === null ? "" : primary.path,
      selector: primary === null ? "" : primary.selector,
      slot: primary === null ? "" : primary.slot,
      traits: primary === null ? [] : primary.traits,
      crumb: live.length === 0 ? [] : crumbOf(live[live.length - 1]),
      items,
      selectors: items.map((i) => i.selector),
      canUndo: edit.at > 0,
      canRedo: edit.at < edit.stack.length - 1,
      press: Date.now() - edit.pressAt < 800,
    });
  }

  /** The screen as a tree, for a layers panel. Posted on arming and on every commit. */
  function treeOf(el, count) {
    const node = {
      label: holderOf(el),
      selector: selectorOf(el),
      tag: el.tagName.toLowerCase(),
      slot: el.getAttribute("data-slot") || "",
      text: canText(el) ? (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40) : "",
      hidden: el.hasAttribute("hidden"),
      children: [],
    };
    count.n += 1;
    for (const kid of el.children) {
      if (ours(kid) || count.n >= MAX_TREE) continue;
      node.children.push(treeOf(kid, count));
    }
    return node;
  }

  function postTree() {
    if (!edit.on) return;
    const root = screenRoot();
    if (root === null) return;
    const tree = treeOf(root, { n: 0 });
    edit.known = new Set();
    const walk = (node) => {
      edit.known.add(node.selector);
      for (const kid of node.children) walk(kid);
    };
    walk(tree);
    post("studio:tree", { screen: screenId(), tree });
  }

  /* ---------------------------------------------------------- selection */

  /** An element this mode may touch: inside the screen, and not the screen itself. */
  const within = (node) => {
    const root = screenRoot();
    return root !== null && node instanceof Element && node !== root && root.contains(node)
      ? node
      : null;
  };

  /** A set with no ancestor/descendant pairs: the outer one wins, as it does in Figma. THE ROOT
   *  MAY BE IN IT — the breadcrumb and the tree both offer it, and its traits and free styles are
   *  real — but only by name: a press on it is the ground (`onDown`), and no verb that moves,
   *  removes or wraps ever takes it (`movable`). */
  function normalise(list) {
    const out = [];
    const root = screenRoot();
    for (const el of list) {
      if ((el !== root && within(el) === null) || out.includes(el) || !(el instanceof Element))
        continue;
      if (out.some((other) => other.contains(el))) continue;
      for (let i = out.length - 1; i >= 0; i -= 1) if (el.contains(out[i])) out.splice(i, 1);
      out.push(el);
    }
    return out;
  }

  function select(list) {
    const next = normalise(Array.isArray(list) ? list : list === null ? [] : [list]);
    if (edit.text !== null && !next.includes(edit.text)) stopText(true);
    edit.sel = next;
    edit.measure = null;
    clearGuides();
    frame();
    postSelected();
  }

  /** The element a single verb acts on: the primary, or null. */
  const primary = () => {
    const live = edit.sel.filter((el) => el.isConnected);
    return live.length === 0 ? null : live[live.length - 1];
  };

  /** The members a structural verb may act on: inside the root, never the root itself. */
  const movable = () =>
    edit.sel.filter((el) => el.isConnected && within(el) !== null && el.parentElement !== null);

  const siblingsOf = (el) => [...(el.parentElement?.children || [])].filter((k) => !ours(k));

  function selectParent() {
    const el = primary();
    if (el === null) return;
    select(within(el.parentElement));
  }

  function selectChild() {
    const el = primary();
    if (el === null) return;
    const kid = [...el.children].find((k) => !ours(k));
    if (kid !== undefined) select(kid);
  }

  function selectSibling(by) {
    const el = primary();
    if (el === null || within(el) === null) return;
    const kin = siblingsOf(el);
    const at = kin.indexOf(el);
    if (at === -1 || kin.length < 2) return;
    select(kin[(at + by + kin.length) % kin.length]);
  }

  function selectAll() {
    const el = primary();
    const root = screenRoot();
    if (root === null) return;
    select(el === null ? [...root.children].filter((k) => !ours(k)) : siblingsOf(el));
  }

  /* ---------------------------------------------------------- moving: anywhere, into anything */

  /* THE VALID-PARENT TABLE IS GONE, AND ITS ABSENCE IS THE POINT (2026-09-18). A designer
     dragging a button somewhere the system has never put one is TELLING US SOMETHING. What is
     left refusing is physics: a node cannot be its own parent, cannot go inside its own
     descendant, and cannot leave the screen root. */
  function dropAllowed(dragged, parent) {
    const root = screenRoot();
    if (root === null || !(parent instanceof Element)) return false;
    for (const d of dragged) if (parent === d || d.contains(parent)) return false;
    return parent === root || root.contains(parent);
  }

  /** A row or a column? The computed direction where there is one, two children otherwise. */
  function horizontalRow(parent) {
    try {
      const cs = getComputedStyle(parent);
      if (cs.display === "flex" || cs.display === "inline-flex") {
        return !String(cs.flexDirection || "").startsWith("column");
      }
      if (cs.display === "grid" || cs.display === "inline-grid") return false;
    } catch {
      /* jsdom answers nothing here; the two-child test below decides */
    }
    const kids = [...parent.children].filter((k) => !ours(k));
    if (kids.length < 2) return false;
    const a = box(kids[0]);
    const b = box(kids[1]);
    return Math.abs(a.y - b.y) <= 2 && a.x !== b.x;
  }

  const nextReal = (node) => {
    let at = node;
    while (at !== null && ours(at)) at = at.nextElementSibling;
    return at;
  };

  /** Where a release here would put it: `{parent, before}`, or null when nothing accepts it. */
  function dropAt(event, dragged) {
    const root = screenRoot();
    if (root === null) return null;
    let node = under(event);
    while (node !== null && dragged.some((d) => node === d || d.contains(node))) {
      node = node.parentElement;
    }
    if (!(node instanceof Element) || (node !== root && !root.contains(node))) return null;
    /* AN EMPTY CONTAINER IS A DROP TARGET, not a sibling. EMPTY MEANS EMPTY OF WORDS TOO: a
       button that accepted a drop would swallow the thing being dragged into its own label. */
    if (
      node.children.length === 0 &&
      (node.textContent || "").trim() === "" &&
      dropAllowed(dragged, node)
    ) {
      return { parent: node, before: null };
    }
    for (let at = node; at !== null; at = at.parentElement) {
      if (at === root) return dropAllowed(dragged, root) ? { parent: root, before: null } : null;
      const parent = at.parentElement;
      if (parent === null) return null;
      if (dropAllowed(dragged, parent)) {
        const b = box(at);
        const horizontal = horizontalRow(parent);
        const middle = horizontal ? b.x + b.w / 2 : b.y + b.h / 2;
        const where = horizontal ? event.clientX : event.clientY;
        return { parent, before: where < middle ? at : nextReal(at.nextElementSibling) };
      }
    }
    return null;
  }

  function showCaret(drop) {
    const n = edit.n;
    if (n === null) return;
    if (drop === null) {
      n.caret.style.display = "none";
      n.target.style.display = "none";
      return;
    }
    const horizontal = horizontalRow(drop.parent);
    const kids = [...drop.parent.children].filter((k) => !ours(k) && !edit.drag?.els.includes(k));
    const anchorEl = drop.before !== null ? drop.before : (kids[kids.length - 1] ?? null);
    const b = anchorEl === null ? box(drop.parent) : box(anchorEl);
    const after = drop.before === null && anchorEl !== null;
    const thick = 2 * z();
    n.caret.style.display = "block";
    n.caret.setAttribute("data-axis", horizontal ? "x" : "y");
    if (horizontal) {
      n.caret.style.left = `${(after ? b.x + b.w : b.x) - thick / 2}px`;
      n.caret.style.top = `${b.y}px`;
      n.caret.style.width = `${thick}px`;
      n.caret.style.height = `${Math.max(b.h, 8)}px`;
    } else {
      n.caret.style.left = `${b.x}px`;
      n.caret.style.top = `${(after ? b.y + b.h : b.y) - thick / 2}px`;
      n.caret.style.width = `${Math.max(b.w, 8)}px`;
      n.caret.style.height = `${thick}px`;
    }
    place(n.target, drop.parent === screenRoot() ? null : box(drop.parent));
  }

  /** The ghost: a copy of what is being dragged, under the pointer, never in the root. */
  function showGhost(event) {
    const d = edit.drag;
    const n = edit.n;
    if (d === null || n === null) return;
    if (d.ghost === null) {
      const src = d.els[0];
      const b = box(src);
      const copy = src.cloneNode(true);
      /* THE COPY CANNOT BE FOUND AS THE ORIGINAL: `data-rect` is the test harness's, and a ghost
         answering `elementsFromPoint` would be a drop target for its own drag. */
      for (const el of [copy, ...copy.querySelectorAll("*")]) {
        el.removeAttribute("id");
        el.removeAttribute("data-rect");
        el.removeAttribute("contenteditable");
      }
      n.ghost.textContent = "";
      n.ghost.append(copy);
      n.ghost.style.width = `${Math.max(24, Math.min(b.w, 420))}px`;
      n.ghost.style.height = `${Math.max(16, Math.min(b.h, 320))}px`;
      d.ghost = { dx: Math.min(event.clientX - b.x, 200), dy: Math.min(event.clientY - b.y, 60) };
    }
    n.ghost.style.display = "block";
    n.ghost.style.left = `${event.clientX - d.ghost.dx}px`;
    n.ghost.style.top = `${event.clientY - d.ghost.dy}px`;
  }

  function hideGhost() {
    const n = edit.n;
    if (n === null) return;
    n.ghost.style.display = "none";
    n.ghost.textContent = "";
  }

  /* THE FRAME SCROLLS ITSELF NEAR ITS EDGES WHILE A DRAG IS LIVE. Without this a designer who
     wants to move a footer button into the header of a long screen has no way to get there; every
     tool that reorders does this and none of them mention it. The nearest scrollable ancestor of
     the point under the pointer scrolls first, the document second. */
  function autoScroll(event) {
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    let dx = 0;
    let dy = 0;
    if (event.clientY < EDGE) dy = -12;
    else if (event.clientY > vh - EDGE) dy = 12;
    if (event.clientX < EDGE) dx = -12;
    else if (event.clientX > vw - EDGE) dx = 12;
    if (dx === 0 && dy === 0) return;
    let target = under(event);
    while (target !== null && target !== document.documentElement) {
      const cs = getComputedStyle(target);
      const scrolls = /(auto|scroll)/.test(`${cs.overflowY}${cs.overflowX}`);
      if (
        scrolls &&
        (target.scrollHeight > target.clientHeight || target.scrollWidth > target.clientWidth)
      ) {
        target.scrollTop += dy;
        target.scrollLeft += dx;
        return;
      }
      target = target.parentElement;
    }
    window.scrollBy(dx, dy);
  }

  function applyDrop(dragged, drop, copying) {
    if (drop === null) return;
    const list = copying ? dragged.map((el) => el.cloneNode(true)) : dragged;
    if (!copying) {
      if (dragged.includes(drop.before)) return;
      if (
        list.length === 1 &&
        list[0].parentElement === drop.parent &&
        nextReal(list[0].nextElementSibling) === drop.before
      ) {
        return;
      }
    }
    const moved = dragged.length === 1 ? nameOf(dragged[0]) : namesOf(dragged);
    const before = drop.before;
    /* NAMED BEFORE THE MOVE, because the destination is what makes a reparent legible and
       `parentElement` is the destination one line later. */
    const into = list.every((el) => el.parentElement === drop.parent)
      ? null
      : holderOf(drop.parent);
    for (const el of list) drop.parent.insertBefore(el, before);
    const verb = copying ? "copied" : "moved";
    let said;
    if (into === null) {
      said =
        before === null
          ? `${verb} ${moved} to the end of ${holderOf(drop.parent)}`
          : `${verb} ${moved} before ${nameOf(before)}`;
    } else {
      said =
        before === null
          ? `${verb} ${moved} into ${into}`
          : `${verb} ${moved} into ${into}, before ${nameOf(before)}`;
    }
    select(list);
    /* A REPARENT IS A FREE MOVE and a reorder is not: a screen's source has a place for the
       second and may have none for the first. */
    commit(said, identOf(list[0]), into !== null && !copying);
  }

  /* ---------------------------------------------------------- guides, snapping, measuring */

  function clearGuides() {
    const n = edit.n;
    if (n === null) return;
    for (const g of n.guides) g.style.display = "none";
    for (const d of n.dists) d.style.display = "none";
  }

  /** A guide line: vertical at x from y1 to y2, or horizontal at y from x1 to x2. */
  function guideLine(i, axis, at, from, to) {
    const g = edit.n.guides[i];
    if (g === undefined) return;
    const thick = 1 * z();
    g.style.display = "block";
    if (axis === "x") {
      g.style.left = `${at - thick / 2}px`;
      g.style.top = `${Math.min(from, to)}px`;
      g.style.width = `${thick}px`;
      g.style.height = `${Math.max(1, Math.abs(to - from))}px`;
    } else {
      g.style.left = `${Math.min(from, to)}px`;
      g.style.top = `${at - thick / 2}px`;
      g.style.width = `${Math.max(1, Math.abs(to - from))}px`;
      g.style.height = `${thick}px`;
    }
  }

  function distLabel(i, x, y, text) {
    const d = edit.n.dists[i];
    if (d === undefined) return;
    d.style.display = "block";
    d.textContent = text;
    d.style.left = `${x}px`;
    d.style.top = `${y}px`;
  }

  /** The lines a free move may snap to: the siblings' and the parent's edges and centres. */
  function snapLines(el) {
    const xs = [];
    const ys = [];
    const push = (b) => {
      xs.push(b.x, b.x + b.w / 2, b.x + b.w);
      ys.push(b.y, b.y + b.h / 2, b.y + b.h);
    };
    const parent = el.parentElement;
    if (parent !== null) {
      push(box(parent));
      for (const kid of parent.children) if (kid !== el && !ours(kid)) push(box(kid));
    }
    return { xs, ys };
  }

  /* SNAPPED, AND SHOWN. The candidate closest to any of the moving box's three lines on each axis
     wins, within `SNAP` screen pixels; the returned delta is what the move is corrected by, and
     the guide is drawn through the line it snapped to so the designer sees WHY it stuck. */
  function snapTo(b, lines) {
    const tol = SNAP * z();
    const out = { dx: 0, dy: 0, gx: null, gy: null };
    if (!edit.opts.snap) return out;
    let best = tol + 1;
    for (const mine of [b.x, b.x + b.w / 2, b.x + b.w]) {
      for (const at of lines.xs) {
        const d = Math.abs(at - mine);
        if (d < best) {
          best = d;
          out.dx = at - mine;
          out.gx = at;
        }
      }
    }
    best = tol + 1;
    for (const mine of [b.y, b.y + b.h / 2, b.y + b.h]) {
      for (const at of lines.ys) {
        const d = Math.abs(at - mine);
        if (d < best) {
          best = d;
          out.dy = at - mine;
          out.gy = at;
        }
      }
    }
    return out;
  }

  function drawSnap(snap) {
    clearGuides();
    if (!edit.opts.guides) return;
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    if (snap.gx !== null) guideLine(0, "x", snap.gx, 0, vh);
    if (snap.gy !== null) guideLine(1, "y", snap.gy, 0, vw);
  }

  /* ⌥ OVER ANOTHER ELEMENT MEASURES FROM THE SELECTION TO IT, Figma's gesture exactly: the gap
     between the two boxes on each axis where they are apart, and the four insets where one holds
     the other. Red, because every designer already reads red lines as distances. */
  function drawMeasure() {
    clearGuides();
    const from = primary();
    const to = edit.measure;
    if (from === null || to === null || !to.isConnected) return;
    const a = box(from);
    const b = box(to);
    const r = (v) => `${Math.round(v)}`;
    let i = 0;
    const inside =
      (a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h) ||
      (b.x >= a.x && b.y >= a.y && b.x + b.w <= a.x + a.w && b.y + b.h <= a.y + a.h);
    if (inside) {
      const inner = a.w * a.h <= b.w * b.h ? a : b;
      const outer = inner === a ? b : a;
      const cx = inner.x + inner.w / 2;
      const cy = inner.y + inner.h / 2;
      const top = inner.y - outer.y;
      const left = inner.x - outer.x;
      const right = outer.x + outer.w - (inner.x + inner.w);
      const bottom = outer.y + outer.h - (inner.y + inner.h);
      if (top > 0) {
        guideLine(i, "x", cx, outer.y, inner.y);
        distLabel(i, cx, outer.y + top / 2, r(top));
        i += 1;
      }
      if (bottom > 0) {
        guideLine(i, "x", cx, inner.y + inner.h, outer.y + outer.h);
        distLabel(i, cx, inner.y + inner.h + bottom / 2, r(bottom));
        i += 1;
      }
      if (left > 0) {
        guideLine(i, "y", cy, outer.x, inner.x);
        distLabel(i, outer.x + left / 2, cy, r(left));
        i += 1;
      }
      if (right > 0) {
        guideLine(i, "y", cy, inner.x + inner.w, outer.x + outer.w);
        distLabel(i, inner.x + inner.w + right / 2, cy, r(right));
      }
      return;
    }
    const gapX = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w));
    const gapY = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h));
    if (gapX > 0) {
      const x1 = a.x + a.w <= b.x ? a.x + a.w : b.x + b.w;
      const x2 = a.x + a.w <= b.x ? b.x : a.x;
      const y = a.y + a.h / 2;
      guideLine(i, "y", y, x1, x2);
      distLabel(i, (x1 + x2) / 2, y, r(gapX));
      i += 1;
      /* AND THE DASHED REACH to the far box where the two do not overlap vertically — the line
         Figma draws so the number is seen to be about THAT box. */
      if (y < b.y || y > b.y + b.h) guideLine(i, "x", x2, y, y < b.y ? b.y : b.y + b.h);
      i += 1;
    }
    if (gapY > 0) {
      const y1 = a.y + a.h <= b.y ? a.y + a.h : b.y + b.h;
      const y2 = a.y + a.h <= b.y ? b.y : a.y;
      const x = a.x + a.w / 2;
      guideLine(i, "x", x, y1, y2);
      distLabel(i, x, (y1 + y2) / 2, r(gapY));
      i += 1;
      if (x < b.x || x > b.x + b.w) guideLine(i, "y", y2, x, x < b.x ? b.x : b.x + b.w);
    }
  }

  /* ---------------------------------------------------------- the free tools */

  /* THESE ARE THE ONLY PLACE A PROTOTYPE ELEMENT EVER GAINS A `style`, and every one of them is a
     MESSAGE rather than a defect: `POST /api/design/screen` still refuses a raw style, so none of
     this reaches the screen's source. The studio reads `free: true` off the message and routes
     the declaration into the agent's intent. */

  const ARROWS = new Map([
    ["ArrowLeft", [-1, 0]],
    ["ArrowRight", [1, 0]],
    ["ArrowUp", [0, -1]],
    ["ArrowDown", [0, 1]],
  ]);
  const OFFSET = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/;

  const offsetOf = (el) => {
    const found = OFFSET.exec(styleOf(el, "transform"));
    return found === null ? { x: 0, y: 0 } : { x: Number(found[1]), y: Number(found[2]) };
  };

  function setOffset(el, x, y) {
    setStyle(el, "transform", x === 0 && y === 0 ? "" : `translate(${x}px, ${y}px)`);
  }

  /** `moved button "Back" 8px right and 4px down`, from where the screen's own layout put it. */
  function offsetLine(el, x, y) {
    if (x === 0 && y === 0) return `put ${labelOf(el)} back where the layout had it`;
    const words = [];
    if (x !== 0) words.push(`${Math.abs(x)}px ${x < 0 ? "left" : "right"}`);
    if (y !== 0) words.push(`${Math.abs(y)}px ${y < 0 ? "up" : "down"}`);
    return `moved ${labelOf(el)} ${words.join(" and ")}`;
  }

  const SIDE_WORD = {
    "margin-top": "top",
    "margin-right": "right",
    "margin-bottom": "bottom",
    "margin-left": "left",
  };

  const spaceLine = (el, prop) => {
    const value = styleOf(el, prop);
    const side = SIDE_WORD[prop] || prop;
    return value === ""
      ? `cleared the ${side} margin of ${labelOf(el)}`
      : `set the ${side} margin of ${labelOf(el)} to ${value}`;
  };

  /** Add to one margin, and take the declaration away again when it nets back to none. */
  function space(el, prop, by) {
    const next = Math.round(pxOf(el, prop) + by);
    setStyle(el, prop, next === 0 ? "" : `${next}px`);
    pendSoon(spaceLine(el, prop), identOf(el));
  }

  /* THE ARROW ALWAYS MEANS "MOVE IT THAT WAY"; THE MODIFIER PICKS WHAT KIND OF MOVE. A plain
     nudge is a free offset (`transform: translate`), which disturbs nothing around it. Alt makes
     it a SPACING change on the same axis (`margin-left` / `margin-top`), which the design system
     has real answers for. Margin and not padding: the space AROUND a component is the thing a
     designer is arranging. Over a set, every member moves. */
  function nudge(els, dx, dy, spacing) {
    const list = els.filter((el) => el.isConnected && within(el) !== null);
    if (list.length === 0) return;
    for (const el of list) {
      if (spacing) {
        if (dx !== 0) space(el, "margin-left", dx);
        if (dy !== 0) space(el, "margin-top", dy);
      } else {
        const o = offsetOf(el);
        const x = Math.round(o.x + dx);
        const y = Math.round(o.y + dy);
        setOffset(el, x, y);
        const said = list.length === 1 ? offsetLine(el, x, y) : `nudged ${namesOf(list)}`;
        pendSoon(said, identOf(el));
      }
    }
    soon();
  }

  /** Is this now as wide as what holds it? `made X full width` is the sentence a designer says. */
  const fullWidth = (el) => {
    const parent = el.parentElement;
    return parent !== null && Math.abs(pxOf(el, "width") - box(parent).w) <= 2;
  };

  /** One line for a finished handle drag, in the words the gesture was about. */
  function sizeLine(drag) {
    const el = drag.el;
    const said = [];
    for (const prop of drag.props) {
      if (prop.startsWith("margin")) said.push(spaceLine(el, prop));
    }
    if (said.length > 0) return said.join(", and ");
    const w = styleOf(el, "width");
    const h = styleOf(el, "height");
    if (drag.props.includes("width") && drag.props.includes("height")) {
      return `resized ${labelOf(el)} to ${w} × ${h}`;
    }
    if (drag.props.includes("height")) return `made ${labelOf(el)} ${h} tall`;
    return fullWidth(el) ? `made ${labelOf(el)} full width` : `made ${labelOf(el)} ${w} wide`;
  }

  /* WHICH NUMBER A HANDLE MOVES. The right and bottom edges are SIZE; the left and top edges are
     ROOM (margin), because in flow layout an element's origin is not a thing its own source can
     hold and a handle that pretended otherwise would be the tool lying about what it does. Both
     kinds of edge follow the pointer, which is the whole point: dragging the left edge to the
     right pushes the element right, and dragging the right edge to the right widens it. ⌥ on a
     sizing edge makes it a room edge for that side. */
  function handleProps(dir, alt) {
    const props = [];
    if (dir.includes("e")) props.push(alt ? "margin-right" : "width");
    if (dir.includes("s")) props.push(alt ? "margin-bottom" : "height");
    if (dir.includes("w")) props.push("margin-left");
    if (dir.includes("n")) props.push("margin-top");
    return props;
  }

  function onHandleDown(event) {
    const node = event.target instanceof Element ? event.target.closest("[data-dir]") : null;
    const el = primary();
    if (node === null || el === null) return;
    evCancel(event);
    evStop(event);
    flushPend();
    const b = box(el);
    const dir = node.getAttribute("data-dir") || "";
    const props = handleProps(dir, event.altKey === true);
    const from = {};
    for (const prop of props)
      from[prop] = prop === "width" ? b.w : prop === "height" ? b.h : pxOf(el, prop);
    edit.size = {
      el,
      dir,
      props,
      from,
      x: event.clientX,
      y: event.clientY,
      ratio: b.h > 0 ? b.w / b.h : 1,
      keep: event.shiftKey === true && dir.length === 2,
      live: false,
      /* THE ATTRIBUTE AS IT WAS, byte for byte: Escape puts it back (v12, plan 66 D8). */
      was: el.getAttribute("style"),
    };
  }

  /* THE DECLARATION IS WRITTEN ON EVERY MOVE, not on the release: a resize a designer cannot see
     happening is a resize they cannot aim. Only the COMMIT waits for the release. Widths snap to
     the parent's width and to the siblings' widths — "as wide as the row" and "as wide as the one
     beside it" are the two widths a designer means most often — and the label says the number. */
  /** A width snapped to the two widths a designer means most often: as wide as the row, and as
   *  wide as the one beside it. The guide is drawn through the edge it stuck to. */
  function snapWidth(el, next) {
    if (!edit.opts.snap) return next;
    const parent = el.parentElement;
    const marks = [];
    if (parent !== null) {
      const pb = box(parent);
      let inner = pb.w;
      try {
        const cs = getComputedStyle(parent);
        inner -=
          (Number.parseFloat(cs.paddingLeft) || 0) + (Number.parseFloat(cs.paddingRight) || 0);
      } catch {
        /* no computed style, no padding to take off */
      }
      marks.push(inner);
      for (const kid of parent.children) if (kid !== el && !ours(kid)) marks.push(box(kid).w);
    }
    for (const mark of marks) {
      if (Math.abs(mark - next) <= SNAP * z()) {
        const b = box(el);
        if (edit.opts.guides) guideLine(0, "x", b.x + mark, b.y - 12 * z(), b.y + b.h + 12 * z());
        return Math.round(mark);
      }
    }
    return next;
  }

  const SHORT = {
    width: "W",
    height: "H",
    "margin-left": "ML",
    "margin-right": "MR",
    "margin-top": "MT",
    "margin-bottom": "MB",
  };
  const VERTICAL = new Set(["height", "margin-top", "margin-bottom"]);

  function onSizeMove(event) {
    const drag = edit.size;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.live && Math.abs(dx) < MIN_DRAG && Math.abs(dy) < MIN_DRAG) return;
    drag.live = true;
    const el = drag.el;
    const said = [];
    clearGuides();
    let keptW = null;
    for (const prop of drag.props) {
      let next = Math.round(drag.from[prop] + (VERTICAL.has(prop) ? dy : dx));
      /* ⇧ ON A CORNER KEEPS THE RATIO: the width leads and the height follows it. */
      if (drag.keep && prop === "width") {
        next = Math.round(drag.from.width + Math.max(dx, dy * drag.ratio));
        keptW = next;
      }
      if (drag.keep && prop === "height" && keptW !== null) next = Math.round(keptW / drag.ratio);
      if (prop === "width") next = snapWidth(el, next);
      const floor = prop === "width" || prop === "height" ? MIN_SIZE : -400;
      next = Math.max(floor, next);
      setStyle(el, prop, next === 0 && prop.startsWith("margin") ? "" : `${next}px`);
      said.push(`${SHORT[prop]} ${next}`);
    }
    hint(said.join("  "), event.clientX, event.clientY);
    frame();
  }

  function onSizeUp() {
    const drag = edit.size;
    edit.size = null;
    hint("");
    clearGuides();
    if (drag === null || !drag.live) return;
    commit(sizeLine(drag), identOf(drag.el), true);
  }

  /** A free move: the selection offset by the pointer, snapped to its siblings. */
  function onFreeMove(event) {
    const d = edit.drag;
    const el = d.els[0];
    const dx = event.clientX - d.x;
    const dy = event.clientY - d.y;
    let x = Math.round(d.from.x + dx);
    let y = Math.round(d.from.y + dy);
    const b = box(el);
    const o = offsetOf(el);
    const want = { x: b.x - o.x + x, y: b.y - o.y + y, w: b.w, h: b.h };
    const snap = snapTo(want, d.lines);
    x += Math.round(snap.dx);
    y += Math.round(snap.dy);
    setOffset(el, x, y);
    drawSnap(snap);
    hint(`X ${x}  Y ${y}`, event.clientX, event.clientY);
    frame();
  }

  /* ---------------------------------------------------------- the verbs */

  function applyTrait(attr, raw) {
    const list = edit.sel.filter((el) => el.isConnected);
    if (list.length === 0) return;
    const value = String(raw === null || raw === undefined ? "" : raw).trim();
    if (attr === "data-go" && value !== "" && !/^[\w./#?=&-]{1,80}$/.test(value)) return;
    const changed = [];
    for (const el of list) {
      const offered = attr === "data-go" ? [] : traitsFor(el)[attr];
      const allowed = attr === "data-go" || (writable(attr) && offered !== undefined);
      if (!allowed) continue;
      /* A FLAG IS PRESENT OR ABSENT (#38): any word turns it on, written bare; `""` takes it off. */
      if (attr !== "data-go" && isFlag(offered)) {
        if (el.hasAttribute(attr) === (value !== "")) continue;
        if (value === "") el.removeAttribute(attr);
        else el.setAttribute(attr, "");
        changed.push(el);
        continue;
      }
      if (attr !== "data-go" && value !== "" && !offered.includes(value)) continue;
      if ((el.getAttribute(attr) || "") === value) continue;
      if (value === "") {
        if (!el.hasAttribute(attr)) continue;
        el.removeAttribute(attr);
      } else el.setAttribute(attr, value);
      changed.push(el);
    }
    if (changed.length === 0) return;
    const who = namesOf(changed);
    commit(
      value === "" ? `cleared ${attr} on ${who}` : `set ${attr} to ${value} on ${who}`,
      identOf(changed[0]),
    );
  }

  /**
   * A CHANGE THAT ARRIVED FROM THE STUDIO, run against the selection the studio was told about.
   *
   * IT MATCHES ON WHAT WE SENT, NOT ON WHAT A SELECTOR FINDS: the message's `selectors` (or the
   * single `selector`, for a page that predates v8) are checked against `edit.sent` and a
   * mismatch does nothing — a stale panel is about to be told again anyway, and obeying it would
   * land a change on whatever the old selector now resolves to.
   */
  function fromRail(msg, run) {
    if (!edit.on || edit.held) return;
    const said = Array.isArray(msg.selectors)
      ? msg.selectors.filter((s) => typeof s === "string").join("\n")
      : typeof msg.selector === "string"
        ? msg.selector
        : "";
    if (said === "" || said !== edit.sent) return;
    run();
  }

  /** A selector the studio may name: one from the last tree we posted, and nothing else. */
  function known(selector) {
    if (typeof selector !== "string" || selector === "" || !edit.known.has(selector)) return null;
    try {
      const el = document.querySelector(selector);
      return el === screenRoot() || within(el) !== null ? el : null;
    } catch {
      return null;
    }
  }

  /** `studio:select` — the tree or the breadcrumb picking an element. `add` is a shift-click. */
  function selectFrom(msg) {
    if (!edit.on || edit.held) return;
    const el = known(msg.selector);
    if (el === null) return;
    if (msg.add === true) {
      select(edit.sel.includes(el) ? edit.sel.filter((s) => s !== el) : [...edit.sel, el]);
    } else select(el);
    if (typeof el.scrollIntoView === "function" && msg.reveal === true) {
      el.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }

  /** `studio:hover` — the tree's row under the pointer, shown on the screen. */
  function hoverFrom(msg) {
    if (!edit.on || edit.held || edit.n === null) return;
    const el = typeof msg.selector === "string" && msg.selector !== "" ? known(msg.selector) : null;
    showHover(el);
  }

  function duplicate() {
    const list = movable();
    if (list.length === 0) return;
    const copies = list.map((el) => {
      const copy = el.cloneNode(true);
      el.parentElement.insertBefore(copy, nextReal(el.nextElementSibling));
      return copy;
    });
    select(copies);
    commit(`duplicated ${namesOf(list)}`, identOf(copies[0]));
  }

  function removeSelection() {
    const list = movable();
    if (list.length === 0) return;
    const ident = identOf(list[0]);
    const label = namesOf(list);
    for (const el of list) el.remove();
    select([]);
    commit(`deleted ${label}`, ident);
  }

  /** `hidden` on, or off: "take this out for now", which the file can say without a rule. */
  function toggleHidden() {
    const list = movable();
    if (list.length === 0) return;
    const hide = !list.every((el) => el.hasAttribute("hidden"));
    for (const el of list) {
      if (hide) el.setAttribute("hidden", "");
      else el.removeAttribute("hidden");
    }
    commit(`${hide ? "hid" : "showed"} ${namesOf(list)}`, identOf(list[0]));
  }

  /** A container from the vocabulary, or a bare `<div>` when it names none: the slot IS the
   *  design system's word for "a group", and `stack` / `row` / `group` are what it is usually
   *  called. A slot outside the vocabulary is not written — the wrap is a bare div instead. */
  function wrapSelection(slotWanted) {
    const list = movable();
    if (list.length === 0) return;
    const parent = list[0].parentElement;
    if (!list.every((el) => el.parentElement === parent)) return;
    const slots = edit.vocab === null ? [] : edit.vocab.slots;
    const slot =
      typeof slotWanted === "string" && slots.includes(slotWanted)
        ? slotWanted
        : (["stack", "group", "row"].find((s) => slots.includes(s)) ?? "");
    const wrap = document.createElement("div");
    if (slot !== "") wrap.setAttribute("data-slot", slot);
    const kin = siblingsOf(list[0]);
    const first = kin.find((k) => list.includes(k));
    parent.insertBefore(wrap, first);
    for (const el of kin) if (list.includes(el)) wrap.appendChild(el);
    select(wrap);
    /* THE SUBJECT IS WHAT WAS WRAPPED, NOT THE WRAPPER (v16): the ident is the wrapper's, so the
       studio can select it; the kind is the wrapped element's. */
    commit(`wrapped ${namesOf(list)} in ${slot === "" ? "a group" : slot}`, {
      ...identOf(wrap),
      kind: list.length === 1 ? list[0].getAttribute("data-slot") || "" : "",
    });
  }

  function unwrapSelection() {
    const list = movable();
    const el = list.length === 1 ? list[0] : null;
    if (el === null) return;
    const kids = [...el.children].filter((k) => !ours(k));
    if (kids.length === 0) return;
    const ident = identOf(el);
    const label = holderOf(el);
    const parent = el.parentElement;
    for (const kid of kids) parent.insertBefore(kid, el);
    el.remove();
    select(kids);
    commit(`unwrapped ${label}`, ident);
  }

  /** Sibling order: earlier or later, first or last. `⌘[` and `⌘]` in every design tool. */
  function reorder(where) {
    const el = primary();
    if (el === null || within(el) === null || el.parentElement === null) return;
    const parent = el.parentElement;
    const kin = siblingsOf(el);
    const at = kin.indexOf(el);
    let before = null;
    if (where === "backward") {
      if (at <= 0) return;
      before = kin[at - 1];
    } else if (where === "forward") {
      if (at >= kin.length - 1) return;
      before = nextReal(kin[at + 1].nextElementSibling);
    } else if (where === "back") {
      if (at === 0) return;
      before = kin[0];
    } else {
      if (at === kin.length - 1) return;
      before = null;
    }
    parent.insertBefore(el, before);
    const word = { backward: "earlier", forward: "later", back: "first", front: "last" }[where];
    commit(`moved ${labelOf(el)} ${word} in ${holderOf(parent)}`, identOf(el));
  }

  /** Two selected: they change places. The one surgery a designer does most and no editor names. */
  function swap() {
    const list = movable();
    if (list.length !== 2) return;
    const [a, b] = list;
    const aParent = a.parentElement;
    const aNext = nextReal(a.nextElementSibling);
    const bParent = b.parentElement;
    const bNext = nextReal(b.nextElementSibling);
    if (aNext === b) {
      aParent.insertBefore(b, a);
    } else if (bNext === a) {
      bParent.insertBefore(a, b);
    } else {
      bParent.insertBefore(a, bNext);
      aParent.insertBefore(b, aNext);
    }
    select(list);
    commit(`swapped ${nameOf(a)} and ${nameOf(b)}`, identOf(a));
  }

  /* ALIGN AND DISTRIBUTE, AS FREE OFFSETS. In flow layout there is no "x" to set, so these write
     a transform per member — which is a picture of what the designer meant, and the agent turns
     it into `justify-content`, `align-items` or a row. One selected aligns within its parent. */
  function align(kind) {
    const list = movable();
    if (list.length === 0) return;
    const boxes = list.map(box);
    const ref =
      list.length === 1 && list[0].parentElement !== null
        ? box(list[0].parentElement)
        : union(boxes);
    if (ref === null) return;
    const was = list.map((el) => el.getAttribute("style"));
    for (let i = 0; i < list.length; i += 1) {
      const el = list[i];
      const b = boxes[i];
      const o = offsetOf(el);
      let x = o.x;
      let y = o.y;
      if (kind === "left") x += ref.x - b.x;
      if (kind === "hcenter") x += ref.x + ref.w / 2 - (b.x + b.w / 2);
      if (kind === "right") x += ref.x + ref.w - (b.x + b.w);
      if (kind === "top") y += ref.y - b.y;
      if (kind === "vcenter") y += ref.y + ref.h / 2 - (b.y + b.h / 2);
      if (kind === "bottom") y += ref.y + ref.h - (b.y + b.h);
      setOffset(el, Math.round(x), Math.round(y));
    }
    const word = {
      left: "left",
      hcenter: "centre",
      right: "right",
      top: "top",
      vcenter: "middle",
      bottom: "bottom",
    }[kind];
    /* ALREADY THERE IS NOT A CHANGE: nothing moved, so nothing is committed and no line is said. */
    if (word === undefined || list.every((el, i) => el.getAttribute("style") === was[i])) return;
    commit(
      `aligned ${namesOf(list)} to the ${word}${list.length === 1 ? ` of ${holderOf(list[0].parentElement)}` : ""}`,
      identOf(list[0]),
      true,
    );
  }

  function distribute(axis) {
    const list = movable();
    if (list.length < 3) return;
    const h = axis === "h";
    const sorted = list
      .map((el) => ({ el, b: box(el) }))
      .sort((p, q) => (h ? p.b.x - q.b.x : p.b.y - q.b.y));
    const first = sorted[0].b;
    const last = sorted[sorted.length - 1].b;
    const span = h ? last.x + last.w - first.x : last.y + last.h - first.y;
    const total = sorted.reduce((sum, p) => sum + (h ? p.b.w : p.b.h), 0);
    const gap = (span - total) / (sorted.length - 1);
    let cursor = h ? first.x : first.y;
    for (const p of sorted) {
      const o = offsetOf(p.el);
      const want = cursor - (h ? p.b.x : p.b.y);
      setOffset(p.el, Math.round(h ? o.x + want : o.x), Math.round(h ? o.y : o.y + want));
      cursor += (h ? p.b.w : p.b.h) + gap;
    }
    commit(
      `distributed ${namesOf(list)} ${h ? "horizontally" : "vertically"}, ${Math.round(gap)}px apart`,
      identOf(list[0]),
      true,
    );
  }

  /** `studio:act style` — one inline declaration from the rail, on every member. */
  function styleFromRail(prop, raw) {
    const list = edit.sel.filter((el) => el.isConnected);
    if (list.length === 0 || typeof prop !== "string" || !STYLE_PROPS.has(prop)) return;
    const value = String(raw === null || raw === undefined ? "" : raw).trim();
    if (value !== "" && !STYLE_VALUE.test(value)) return;
    for (const el of list) setStyle(el, prop, value);
    const who = namesOf(list);
    commit(
      value === "" ? `cleared ${prop} on ${who}` : `set ${prop} to ${value} on ${who}`,
      identOf(list[0]),
      true,
    );
  }

  /** Every inline declaration off the selection: back to what the stylesheet says. */
  function resetStyles() {
    const list = edit.sel.filter((el) => el.isConnected && el.hasAttribute("style"));
    if (list.length === 0) return;
    for (const el of list) el.removeAttribute("style");
    commit(`put ${namesOf(list)} back to the system's own layout`, identOf(list[0]), true);
  }

  /* ---------------------------------------------------------- the clipboard */

  /* OURS, AND THE SYSTEM'S WHERE IT WILL TAKE IT. A copy keeps the markup in this document's own
     memory, which is what a paste reads; it is also written to the system clipboard as text,
     best effort, so a designer can drop a component's source into a chat. Nothing is ever READ
     from the system clipboard: a paste of arbitrary markup into a screen is an insert of
     arbitrary markup, and `insertHtml` is the door for that. */
  function copySelection(cut) {
    const list = movable();
    if (list.length === 0) return;
    edit.clip = list.map((el) => el.outerHTML);
    try {
      navigator.clipboard?.writeText?.(edit.clip.join("\n"));
    } catch {
      /* no permission, no problem */
    }
    if (!cut) return;
    const ident = identOf(list[0]);
    const label = namesOf(list);
    for (const el of list) el.remove();
    select([]);
    commit(`cut ${label}`, ident);
  }

  /** Markup from the studio or the clipboard, made safe to stand in a screen: no scripts, no
   *  handlers, no styles it did not earn, no ids that would collide. The write gate refuses all
   *  of these anyway; stripping them here is what keeps a handler from RUNNING before it does. */
  function fragmentOf(html) {
    const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
    for (const bad of doc.querySelectorAll("script,style,link,iframe,object,embed")) bad.remove();
    for (const el of doc.body.querySelectorAll("*")) {
      for (const name of [...el.getAttributeNames()]) {
        if (
          name.startsWith("on") ||
          name === "id" ||
          name === "contenteditable" ||
          name === "data-studio-edit"
        ) {
          el.removeAttribute(name);
        }
      }
    }
    return [...doc.body.children].map((el) => document.importNode(el, true));
  }

  /** Where a new thing goes: after the primary, into it when it is an empty container, at the
   *  end of the root with nothing selected. */
  function insertionPoint(where) {
    const root = screenRoot();
    const el = primary();
    if (root === null) return null;
    if (el === null || el === root) return { parent: root, before: null };
    const empty = el.children.length === 0 && (el.textContent || "").trim() === "" && !canText(el);
    if (where === "into" || (where !== "after" && empty)) return { parent: el, before: null };
    if (where === "before") return { parent: el.parentElement, before: el };
    return { parent: el.parentElement, before: nextReal(el.nextElementSibling) };
  }

  function insertHtml(html, where, said) {
    if (typeof html !== "string" || html.length > 20000) return;
    const nodes = fragmentOf(html);
    const at = insertionPoint(where);
    if (nodes.length === 0 || at === null || at.parent === null) return;
    for (const node of nodes) at.parent.insertBefore(node, at.before);
    select(nodes);
    commit(
      `${said || "inserted"} ${namesOf(nodes)} into ${holderOf(at.parent)}`,
      identOf(nodes[0]),
    );
  }

  function paste() {
    if (edit.clip === null || edit.clip.length === 0) return;
    insertHtml(edit.clip.join("\n"), "after", "pasted");
  }

  /* ---------------------------------------------------------- text: plain, and only plain */

  /** Only an element whose children are text. Anything else loses a `data-bind` to one keystroke. */
  const canText = (el) =>
    el !== null &&
    el.children.length === 0 &&
    !/^(br|hr|img|input|select|textarea|svg|canvas|video|audio|iframe)$/.test(
      el.tagName.toLowerCase(),
    );

  function startText(el) {
    if (!canText(el)) return;
    stopText(true);
    edit.text = el;
    edit.from = el.textContent || "";
    /* `plaintext-only` IS THE ENGINE DOING THE WORK where it is understood — WebKit and Chromium
       both are. Where it is not, fall back to `true` and let the paste and Enter handlers carry it. */
    el.setAttribute("contenteditable", "plaintext-only");
    if (el.isContentEditable !== true) el.setAttribute("contenteditable", "true");
    if (typeof el.focus === "function") el.focus();
    post("studio:text", { screen: screenId(), on: true });
    /* AND THE WORDS ARE SELECTED, because *retype it* is the verb: the first keystroke replaces,
       and Escape still restores `edit.from`. */
    const sel = document.getSelection();
    if (sel !== null && typeof document.createRange === "function") {
      const range = document.createRange();
      range.selectNodeContents(el);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    frame();
  }

  /** Ends text editing. Returns whether it was on — the Escape chain reads that. */
  function stopText(keep) {
    const el = edit.text;
    if (el === null) return false;
    edit.text = null;
    /* FLATTENED BACK TO TEXT ON THE WAY OUT: an engine's own paste path or an IME can leave a
       `<br>` behind even with Enter intercepted. */
    const text = keep ? el.textContent || "" : edit.from;
    el.removeAttribute("contenteditable");
    if (el.innerHTML !== text) el.textContent = text;
    const was = edit.from;
    edit.from = "";
    soon();
    post("studio:text", { screen: screenId(), on: false });
    if (!keep || text === was) return true;
    commit(`changed "${was.trim().slice(0, 40)}" to "${text.trim().slice(0, 40)}"`, identOf(el));
    return true;
  }

  /* THE WORDS END ON ENTER, ESCAPE, A CLICK AWAY OR A LOST FOCUS — AND ON NOTHING ELSE (v12, plan
     62 D7). They used to end on a 400-ms pause with the element still selected, so a designer who
     stopped to think and then pressed Backspace deleted the ELEMENT, an arrow nudged it instead of
     moving the caret, and every pause was a write and an undo step of its own. A keystroke is
     never a round item; the end of the words is one. */

  /* ---------------------------------------------------------- the listeners, and their removal */

  /** Every listener edit mode installs is recorded here, because "off" has to mean off. */
  const bound = [];

  function listen(target, type, fn, options) {
    target.addEventListener(type, fn, options);
    bound.push([target, type, fn, options]);
  }

  /** Edit mode's handlers for a frozen type, run INSIDE the freeze's own listener (v21, R9). */
  const editOwn = {};
  function ownEdit(type, fn) {
    if (editOwn[type] === undefined) editOwn[type] = [];
    editOwn[type].push(fn);
    bound.push([null, type, fn, null]);
  }

  function unlisten() {
    for (const [target, type, fn, options] of bound.splice(0)) {
      if (target === null) editOwn[type] = (editOwn[type] ?? []).filter((f) => f !== fn);
      else target.removeEventListener(type, fn, options);
    }
  }

  /* THE PRESS TAKES THE FOCUS (v13, plan 66 review 1). The freeze cancels the `mousedown` that
     would have moved the keyboard focus into this document, so after a click on a studio control
     and then one on the screen, Delete and the arrows went to that control. Inside the gesture
     that pressed, so the engine allows it; never off the words being typed. */
  function takeFocus() {
    try {
      if (!document.hasFocus()) window.focus();
    } catch {
      /* a host that refuses it keeps the studio's own key routing */
    }
  }

  function onDown(event) {
    if (edit.on && !edit.held) {
      edit.pressAt = Date.now();
      takeFocus();
    }
    if (!edit.on || edit.held || ours(event.target) || event.button === 2) return;
    flushPend();
    const hit = under(event);
    if (edit.text !== null && hit !== null && edit.text.contains(hit)) return;
    const el = within(hit);
    /* THE GROUND: a press on the root or outside every component starts a MARQUEE, and a click
       there deselects. */
    if (el === null) {
      edit.drag = {
        kind: "marquee",
        x: event.clientX,
        y: event.clientY,
        live: false,
        els: [],
        add: event.shiftKey === true,
      };
      return;
    }
    if (event.shiftKey) {
      select(edit.sel.includes(el) ? edit.sel.filter((s) => s !== el) : [...edit.sel, el]);
      edit.lastEl = el;
      edit.drag = null;
      return;
    }
    /* PRESSING THE SAME ELEMENT AGAIN WALKS OUT ONE LEVEL — decided on the RELEASE, so that a drag
       beginning on the thing already selected is still a drag. "THE SAME ELEMENT", NOT "THE
       SELECTED ONE": remembering what was last PRESSED makes each further press on that same spot
       one more step out — button, footer, card. */
    const again = edit.sel.length > 0 && el === edit.lastEl;
    edit.lastEl = el;
    /* INSIDE A SELECTED CONTAINER, THE PRESS IS THE CONTAINER'S — a drag beginning on a card's
       button moves the card, the way Figma moves a selected group — and the CLICK is the
       button's: released without a drag it selects the thing under the pointer (`onUp`). */
    const insideSel = edit.sel.find((s) => s.contains(el));
    if (!again && insideSel === undefined) select(el);
    const els = again || insideSel !== undefined ? edit.sel.filter((s) => s.isConnected) : [el];
    const free = (event.metaKey || event.ctrlKey) && els.length === 1;
    edit.drag = {
      kind: free ? "free" : "move",
      els,
      x: event.clientX,
      y: event.clientY,
      live: false,
      drop: null,
      again,
      hit: el,
      inside: !again && insideSel !== undefined,
      copy: event.altKey === true,
      ghost: null,
      from: free ? offsetOf(els[0]) : null,
      lines: free ? snapLines(els[0]) : null,
      was: free ? els[0].getAttribute("style") : null,
    };
  }

  function onMove(event) {
    if (!edit.on || edit.held) return;
    if (edit.size !== null) {
      onSizeMove(event);
      return;
    }
    const d = edit.drag;
    if (d === null) {
      const el = within(under(event));
      showHover(el);
      /* ⌥ HELD: measure from the selection to what is under the pointer. */
      if (event.altKey && edit.sel.length > 0 && el !== null && !edit.sel.includes(el)) {
        edit.measure = el;
        drawMeasure();
      } else if (edit.measure !== null) {
        edit.measure = null;
        clearGuides();
      }
      return;
    }
    if (
      !d.live &&
      Math.abs(event.clientX - d.x) < MIN_DRAG &&
      Math.abs(event.clientY - d.y) < MIN_DRAG
    ) {
      return;
    }
    d.live = true;
    if (d.kind === "marquee") {
      const r = {
        x: Math.min(d.x, clampX(event.clientX)),
        y: Math.min(d.y, clampY(event.clientY)),
        w: Math.abs(clampX(event.clientX) - d.x),
        h: Math.abs(clampY(event.clientY) - d.y),
      };
      d.rect = r;
      place(edit.n.marquee, r);
      return;
    }
    if (d.kind === "free") {
      onFreeMove(event);
      return;
    }
    d.drop = dropAt(event, d.els);
    showCaret(d.drop);
    showGhost(event);
    autoScroll(event);
    if (edit.n) edit.n.hover.style.display = "none";
  }

  /** Everything the marquee fully encloses, outermost only — Figma's rule for a nested tree. */
  function enclosed(r) {
    const root = screenRoot();
    if (root === null) return [];
    const inside = [];
    for (const el of root.querySelectorAll("*")) {
      if (ours(el) || within(el) === null) continue;
      const b = box(el);
      if (b.w === 0 && b.h === 0) continue;
      if (b.x >= r.x && b.y >= r.y && b.x + b.w <= r.x + r.w && b.y + b.h <= r.y + r.h)
        inside.push(el);
    }
    return normalise(inside);
  }

  function onUp(event) {
    if (!edit.on || edit.held) return;
    if (edit.size !== null) {
      onSizeUp();
      return;
    }
    const d = edit.drag;
    edit.drag = null;
    showCaret(null);
    hideGhost();
    hint("");
    if (d === null) return;
    if (d.kind === "marquee") {
      place(edit.n.marquee, null);
      if (!d.live) {
        select(d.add ? edit.sel : []);
        return;
      }
      const found = enclosed(d.rect);
      select(d.add ? [...edit.sel, ...found] : found);
      return;
    }
    if (d.kind === "free") {
      clearGuides();
      if (!d.live) return;
      const el = d.els[0];
      const o = offsetOf(el);
      commit(offsetLine(el, o.x, o.y), identOf(el), true);
      return;
    }
    if (!d.live) {
      /* `within` excludes the root, so climbing past the outermost component deselects rather
         than selecting the screen itself. */
      if (d.again) select(within(primary()?.parentElement ?? null));
      else if (d.inside) select(d.hit);
      return;
    }
    d.drop = dropAt(event, d.els) || d.drop;
    applyDrop(d.els, d.drop, d.copy);
  }

  /* A RIGHT-CLICK IS THE STUDIO'S TO ANSWER. The point and the element go over the seam and the
     page opens its own menu there, in its own components; a menu drawn in here would be a second
     menu system and would be shot with the screen if anything went wrong. */
  function onContext(event) {
    if (!edit.on || ours(event.target)) return;
    evCancel(event);
    evStop(event);
    if (edit.held) return;
    const el = within(under(event));
    if (el !== null && !edit.sel.some((s) => s === el || s.contains(el))) select(el);
    post("studio:menu", {
      screen: screenId(),
      x: event.clientX,
      y: event.clientY,
      selector: primary() === null ? "" : selectorOf(primary()),
    });
  }

  /** An element whose Space is its click — the engine activates it rather than typing into it. */
  const activatesOnSpace = (el) =>
    el.tagName === "BUTTON" || el.tagName === "SUMMARY" || el.getAttribute("role") === "button";

  /** One space at the caret, by hand, and the input the engine would have fired. */
  function insertSpace(el) {
    const sel = document.getSelection();
    const range = sel !== null && sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
    if (range === null || !el.contains(range.commonAncestorContainer)) {
      el.textContent = `${el.textContent || ""} `;
    } else {
      range.deleteContents();
      const space = document.createTextNode(" ");
      range.insertNode(space);
      range.setStartAfter(space);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function onKey(event) {
    if (!edit.on) return;
    /* HELD STILL FOR A SWAP: the freeze still eats the key, and nothing it means is done. */
    if (edit.held) {
      evCancel(event);
      return;
    }
    if (event.key === "Enter" && edit.text !== null) {
      evCancel(event);
      stopText(true);
      return;
    }
    /* A BUTTON'S SPACE IS ITS CLICK (#32): left to the engine, `Finish now` reached the file as
       `Finishnow`. Taken here and on keyup, and the space put in where the caret is. */
    if (event.key === " " && edit.text !== null && activatesOnSpace(edit.text)) {
      evCancel(event);
      insertSpace(edit.text);
      return;
    }
    if (edit.text !== null || ours(event.target)) return;
    /* THE TWO PAGE KEYS EDIT MODE HAS NO VERB FOR (v13): `I` opens the studio's insert palette and
       `?` the app's shortcuts. Now that a press takes the focus in here, they would otherwise die
       in this document. */
    if (
      !(event.metaKey || event.ctrlKey || event.altKey) &&
      (event.key === "i" || event.key === "I" || event.key === "?")
    ) {
      evCancel(event);
      post("studio:key", { key: event.key, shift: event.shiftKey, mod: false });
      return;
    }
    const meta = event.metaKey || event.ctrlKey;
    const key = event.key;
    const low = key.toLowerCase();
    const el = primary();
    const stop = () => evCancel(event);
    if (meta && low === "z") {
      stop();
      if (event.shiftKey) redo();
      else undo();
      return;
    }
    if (meta && low === "d") {
      stop();
      duplicate();
      return;
    }
    if (meta && low === "c") {
      stop();
      copySelection(false);
      return;
    }
    if (meta && low === "x") {
      stop();
      copySelection(true);
      return;
    }
    if (meta && low === "v") {
      stop();
      paste();
      return;
    }
    if (meta && low === "a") {
      stop();
      selectAll();
      return;
    }
    if (meta && low === "g") {
      stop();
      if (event.shiftKey) unwrapSelection();
      else wrapSelection();
      return;
    }
    if (meta && event.shiftKey && low === "h") {
      stop();
      toggleHidden();
      return;
    }
    /* ⌘' IS THE GRID in Excalidraw, Penpot and tldraw alike. The switch is the studio's, so the
       studio is told it moved. */
    if (meta && key === "'") {
      stop();
      edit.opts.grid = !edit.opts.grid;
      applyOpts();
      post("studio:opts", { screen: screenId(), ...edit.opts });
      return;
    }
    if (meta && (key === "[" || key === "]")) {
      stop();
      reorder(
        key === "[" ? (event.altKey ? "back" : "backward") : event.altKey ? "front" : "forward",
      );
      return;
    }
    if (meta) return;
    if (key === "Delete" || key === "Backspace") {
      stop();
      removeSelection();
      return;
    }
    if (key === "Enter") {
      stop();
      if (event.shiftKey) selectParent();
      else if (el !== null && canText(el)) startText(el);
      else selectChild();
      return;
    }
    if (key === "Tab") {
      stop();
      selectSibling(event.shiftKey ? -1 : 1);
      return;
    }
    const arrow = ARROWS.get(key);
    if (arrow === undefined) return;
    stop();
    nudge(
      edit.sel,
      arrow[0] * (event.shiftKey ? NUDGE_BIG : NUDGE),
      arrow[1] * (event.shiftKey ? NUDGE_BIG : NUDGE),
      event.altKey === true,
    );
  }

  function onKeyUp(event) {
    if (!edit.on) return;
    if (event.key === " " && edit.text !== null && activatesOnSpace(edit.text)) {
      evCancel(event); // the release is where a button's click fires (#32)
      return;
    }
    if (event.key !== "Alt" || edit.measure === null) return;
    edit.measure = null;
    clearGuides();
  }

  /**
   * A gesture in the middle of itself, abandoned — and the DOM put back exactly as it was before
   * it started (v12, plan 66 D8). A resize and a free move write their declaration on every move
   * so a designer can see what they are doing; abandoning one used to leave that width or that
   * transform in the DOM, uncommitted, riding into whatever was committed next. The attribute is
   * restored byte for byte from the copy taken when the gesture began. A reorder never touched the
   * DOM before its drop, and a marquee never does. Answers whether there was one.
   */
  function cancelGesture() {
    const size = edit.size;
    const d = edit.drag;
    if (size === null && d === null) return false;
    edit.size = null;
    edit.drag = null;
    const put = (el, was) => {
      if (!(el instanceof Element)) return;
      if (was === null || was === undefined) el.removeAttribute("style");
      else el.setAttribute("style", was);
    };
    if (size?.live) put(size.el, size.was);
    if (d?.kind === "free" && d.live) put(d.els[0], d.was);
    showCaret(null);
    hideGhost();
    hint("");
    clearGuides();
    if (edit.n) place(edit.n.marquee, null);
    frame();
    return true;
  }

  /** Escape, in edit mode: out of a gesture, out of the text, then out of the selection, then
   *  out of the mode. */
  function editEscape() {
    if (edit.held) return true;
    if (cancelGesture()) return true;
    if (stopText(false)) return true;
    if (edit.sel.length === 0) return false;
    select([]);
    return true;
  }

  /** `studio:act` — every verb the studio can ask for, by name. */
  const ACTS = {
    text: () => {
      const el = primary();
      if (el !== null) startText(el);
    },
    duplicate: () => duplicate(),
    delete: () => removeSelection(),
    hide: () => toggleHidden(),
    wrap: (m) => wrapSelection(m.slot),
    unwrap: () => unwrapSelection(),
    copy: () => copySelection(false),
    cut: () => copySelection(true),
    forward: () => reorder("forward"),
    backward: () => reorder("backward"),
    front: () => reorder("front"),
    back: () => reorder("back"),
    swap: () => swap(),
    align: (m) => align(String(m.kind || "")),
    distribute: (m) => distribute(m.axis === "v" ? "v" : "h"),
    style: (m) => styleFromRail(m.prop, m.value),
    reset: () => resetStyles(),
    nudge: (m) => nudge(edit.sel, Number(m.dx) || 0, Number(m.dy) || 0, m.spacing === true),
    trait: (m) => applyTrait(m.attr, m.value),
    selectParent: () => selectParent(),
    selectChild: () => selectChild(),
    selectNext: () => selectSibling(1),
    selectPrev: () => selectSibling(-1),
    comment: () => {
      const el = primary();
      if (el === null) return;
      post("studio:picked", {
        screen: screenId(),
        path: pathOf(el),
        selector: selectorOf(el),
        rect: box(el),
        text: (el.textContent || "").trim().slice(0, 80),
        tag: el.tagName.toLowerCase(),
        state: html.dataset.state || null,
        variant: html.dataset.variant || null,
        theme: html.dataset.theme || null,
      });
    },
  };
  /** The verbs that need no selection to be echoed back, because they act on none or on all. */
  const FREE_ACTS = {
    undo: () => undo(),
    redo: () => redo(),
    paste: () => paste(),
    selectAll: () => selectAll(),
    insert: (m) => insertHtml(m.html, m.where, "inserted"),
    /* THE STUDIO'S ESCAPE (v13): a live gesture is put back first, as this document's own would. */
    deselect: () => {
      if (!cancelGesture()) select([]);
    },
  };

  function act(msg) {
    if (!edit.on || edit.held || msg === null || typeof msg !== "object") return;
    const name = String(msg.act || "");
    const free = FREE_ACTS[name];
    if (free !== undefined) {
      flushPend();
      free(msg);
      return;
    }
    const run = ACTS[name];
    if (run === undefined) return;
    fromRail(msg, () => {
      flushPend();
      run(msg);
    });
  }

  function installEdit() {
    /* THE FROZEN TYPES' HANDLERS RUN INSIDE THE FREEZE (v21, R9), in the order they used to run:
       `window`'s capture first, then our handles', then the document's. */
    ownEdit("mousedown", onDown);
    ownEdit("mousedown", (event) => {
      if (edit.chrome?.contains(event.target)) onHandleDown(event);
    });
    ownEdit("mousemove", onMove);
    ownEdit("mouseup", onUp);
    ownEdit("keydown", onKey);
    ownEdit("keyup", onKeyUp);
    ownEdit("contextmenu", onContext);
    listen(window, "scroll", soon, { capture: true, passive: true });
    listen(window, "resize", soon);
    listen(document, "input", (event) => {
      if (edit.text?.contains(event.target) === true) soon();
    });
    /* `blur` DOES NOT BUBBLE, so this is the capture phase: clicking away from the words is the
       commonest way a person finishes typing, and it has to be the one that files the change. */
    listen(
      document,
      "blur",
      (event) => {
        if (edit.text !== null && edit.text === event.target) stopText(true);
      },
      true,
    );
    /* AND THE WINDOW'S: a click on the studio's own panel takes the focus out of this document, and
       that is a click away. A gesture whose button was released where we cannot hear it is put
       back, never committed half-made (v12). */
    listen(window, "blur", () => {
      cancelGesture();
      stopText(true);
      showHover(null);
    });
    /* THE HOVER IS THE POINTER'S, AND GOES WITH IT (v14): an outline and a name left on an element
       after the pointer moved to the conversation read as a selection nobody made. */
    ownEdit("mouseleave", (event) => {
      if (event.target === document.documentElement) showHover(null);
    });
    /* PLAIN TEXT ONLY: the clipboard's own `text/plain`, inserted at the caret by hand. */
    listen(document, "paste", (event) => {
      if (edit.text === null || !edit.text.contains(event.target)) return;
      evCancel(event);
      const text = event.clipboardData === null ? "" : event.clipboardData.getData("text/plain");
      const selection = document.getSelection();
      if (selection === null || selection.rangeCount === 0) {
        edit.text.textContent = (edit.text.textContent || "") + text;
      } else {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode(text.replace(/\s+/g, " ")));
        selection.collapseToEnd();
      }
      soon();
    });
    /* INSIDE THE FREEZE: `dblclick` is in FROZEN. */
    ownEdit("dblclick", (event) => {
      if (edit.held || ours(event.target)) return;
      /* INSIDE THE WORDS A DOUBLE-CLICK IS THE ENGINE'S: it selects a word. Restarting the edit
           there committed the words and selected all of them again (v12). */
      if (edit.text !== null && event.target instanceof Node && edit.text.contains(event.target))
        return;
      const el = within(under(event));
      if (el === null || !canText(el)) return;
      select(el);
      startText(el);
    });
    /* LAYOUT MOVES WITHOUT A SCROLL OR A RESIZE — an image loads, a font arrives, the words being
       typed grow their box. One observer on the root, one frame per change. */
    if (typeof ResizeObserver === "function") {
      const root = screenRoot();
      if (root !== null) {
        edit.ro = new ResizeObserver(() => soon());
        edit.ro.observe(root);
      }
    }
  }

  /* ---------------------------------------------------------- on, and off */

  function enterEdit() {
    edit.on = true;
    edit.stack = [];
    edit.at = -1;
    edit.gone = [];
    release();
    edit.sel = [];
    edit.lastEl = null;
    edit.drag = null;
    edit.size = null;
    edit.pend = null;
    edit.measure = null;
    edit.known = new Set();
    buildChrome();
    installEdit();
    /* THE BASE SNAPSHOT CARRIES NO SUMMARY, which is what keeps it out of `ops`. */
    const root = screenRoot();
    pushSnapshot(screenHtml(), "", root === null ? "" : pathOf(root), false);
    postTree();
  }

  /* OFF MEANS THE DOCUMENT IS AS WE FOUND IT. The studio shoots this document; a stray
     `contenteditable`, a selection box or one of our listeners still swallowing a click would be
     shot, committed, or blamed on the prototype. There is no partial teardown. */
  function exitEdit() {
    /* THE HELD NUDGE IS FILED BEFORE ANYTHING IS TAKEN DOWN: the DOM already moved. */
    flushPend();
    stopText(true);
    unlisten();
    if (edit.ro) {
      edit.ro.disconnect();
      edit.ro = null;
    }
    if (edit.raf !== 0 && typeof cancelAnimationFrame === "function")
      cancelAnimationFrame(edit.raf);
    edit.raf = 0;
    if (edit.chrome !== null) edit.chrome.remove();
    edit.chrome = null;
    edit.n = null;
    edit.on = false;
    edit.sel = [];
    edit.lastEl = null;
    edit.drag = null;
    edit.size = null;
    edit.pend = null;
    edit.measure = null;
    edit.vocab = null;
    edit.stack = [];
    edit.at = -1;
    edit.gone = [];
    edit.sent = "";
    edit.known = new Set();
    release();
  }

  /**
   * `studio:edit` — arm, update, or disarm. Armed already, it is an UPDATE: the vocabulary is
   * replaced and the editor is not torn down (a selection is not the price of a stylesheet
   * moving). A `seed` (v12) is the studio's copy of this file's history: taken on arming, and taken
   * while armed too — which is how *Discard this session's edits* puts the first state back.
   * `studio:editable` answers every one, with the history as it now stands and the root as the
   * document now holds it, so the studio's copy follows whatever was actually adopted.
   */
  function setEdit(on, vocab, seed) {
    if (on) {
      if (!edit.on) enterEdit();
      edit.vocab = vetVocab(vocab);
      if (seed !== undefined && seed !== null) {
        adoptSeed(seed);
        postTree();
      }
      soon();
    } else if (edit.on) {
      exitEdit();
    }
    /* THE REVIEW'S MARKS ARE NOT DRAWN OVER EDIT MODE'S CHROME (§11), and come back after it */
    if (marks.host !== null) measure(false);
    if (!edit.on) {
      post("studio:editable", { screen: screenId(), on: false });
      return;
    }
    const step = edit.stack[edit.at];
    post("studio:editable", {
      screen: screenId(),
      on: true,
      html: step === undefined ? screenHtml() : step.html,
      step: step === undefined ? null : stepMeta(step),
      history: historyNow(),
    });
  }

  /* ---------------------------------------------------------------- start */

  /* FILL RUNS AGAIN WHEN THE DOM GROWS, and that is not belt-and-braces: a framework screen
     renders AFTER DOMContentLoaded, so a one-shot fill on load finds no `[data-bind]` at all and
     the name typed on screen one never appears on screen three. One observer, one rAF, no poll. */
  let filling = 0;
  function watchForBinds() {
    const observer = new MutationObserver(() => {
      /* NOT WHILE SOMEBODY IS EDITING. Every move and every keystroke in §6 is a mutation, and a
         fill that ran off one would re-write a `[data-bind]` element's text from the session bag
         the moment a designer retyped it — their words replaced by the bag's, mid-sentence. */
      if (filling !== 0 || edit.on) return;
      filling = requestAnimationFrame(() => {
        filling = 0;
        fill();
      });
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  /* A TRAIL THAT DOES NOT END HERE IS SOMEBODY ELSE'S. The studio re-points the frame whenever a
     designer picks a screen off the map, and that load is not a step in any journey — so a Back
     offered from it would leave for wherever the last `data-go` came from. */
  function checkTrail() {
    if (studio === null) return;
    const list = trail();
    if (list.length === 0) return;
    const last = list[list.length - 1];
    if (last === null || typeof last !== "object" || last.to !== hereUrl()) setTrail([]);
  }

  /* EACH STEP ON ITS OWN (v24): a page that broke what `fill` uses still hears `studio:ready`. */
  function start() {
    quietly(checkTrail)();
    quietly(fill)();
    quietly(watchForBinds)();
    quietly(ready)();
    quietly(announce)();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
  /* A PAGE BROUGHT BACK FROM THE BACK-FORWARD CACHE runs no script and loads nothing, so it says
     where it is again (v21, the review's R13): Back inside the frame moves the page's address with
     it, as the link that left it did. */
  addEventListener("pageshow", (event) => {
    if (event.persisted) ready();
  });

  addEventListener("popstate", () => {
    if (stamp(location.search)) announce();
    post("studio:navigated", { screen: screenId() });
  });

  /* WHERE THIS DOCUMENT IS LEAVING FOR (v24): a file that is not a page (`data.json`, an image)
     loads with no bridge and says nothing, so this is the last word the page hears from the frame
     — it names the file on the stage instead of a silent Comment. The engine's Navigation API
     where it has one (a script's `location.href` too); else a plain link followed. Said, never
     acted on: the page only words its notice with it. */
  const leaving = (url) => {
    try {
      const to = new URL(url, location.href);
      if (to.origin !== location.origin) return;
      let file = to.pathname;
      try {
        file = decodeURIComponent(file);
      } catch {
        /* kept encoded */
      }
      post("studio:leaving", { file });
    } catch {
      /* not a URL */
    }
  };
  const nav = window.navigation;
  if (studio !== null && nav && typeof nav.addEventListener === "function")
    apply(addListener, nav, [
      "navigate",
      quietly((event) => {
        if (event.hashChange || !event.destination) return;
        leaving(event.destination.url);
      }),
    ]);
  else if (studio !== null)
    addEventListener(
      "click",
      quietly((event) => {
        if (event.defaultPrevented || !(event.target instanceof Element)) return;
        const a = event.target.closest("a[href]");
        if (a === null || (a.target !== "" && a.target !== "_self")) return;
        const to = new URL(a.href, location.href);
        if (to.pathname === location.pathname && to.search === location.search) return;
        leaving(a.href);
      }),
    );

  /* THE PAGE'S OWN WINDOW-CAPTURE WHEEL LISTENERS ARE MUTE WHILE FROZEN (item 13). They run after
     the freeze's first listener and before the router, which is added at the freeze — so, under a
     studio, each one the page adds is called only while nothing is frozen. Installed LAST, so no
     listener of this file's is wrapped; a page's code runs after this file, so every one of its is. */
  if (studio !== null) {
    const muted = new WeakMap();
    const capturing = (o) => (typeof o === "boolean" ? o : Boolean(o?.capture));
    const ofWheel = (target, type, o) => target === window && type === "wheel" && capturing(o);
    EventTarget.prototype.addEventListener = function addEventListener(type, fn, o) {
      if (
        !ofWheel(this, type, o) ||
        fn === null ||
        (typeof fn !== "object" && typeof fn !== "function")
      )
        return apply(addListener, this, [type, fn, o]);
      let mute = muted.get(fn);
      if (mute === undefined) {
        mute = function wheel(event) {
          if (still.on) return undefined;
          return typeof fn === "function" ? apply(fn, this, [event]) : fn.handleEvent(event);
        };
        muted.set(fn, mute);
      }
      return apply(addListener, this, [type, mute, o]);
    };
    EventTarget.prototype.removeEventListener = function removeEventListener(type, fn, o) {
      const mute = ofWheel(this, type, o) && fn !== null ? muted.get(fn) : undefined;
      return apply(removeListener, this, [type, mute ?? fn, o]);
    };
  }

  window.studio = { go, data: bag, path: pathOf, selector: selectorOf, screen: screenId };
})();
