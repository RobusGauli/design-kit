# `design.json` — the template, and what each key is

Copy `assets/design.json` to `design/design.json` and correct the paths. The vanilla shape is the
default because it is the one that needs no toolchain at all.

| key | what it is |
|---|---|
| `tokens` | the DTCG source. **Where the knobs are** |
| `css` | the generated sheet. Never hand-edited; `tokens-to-css.mjs --check` fails when it is stale |
| `system` | where components live — **the lint's "inside"**: tokens are allowed here and nowhere else |
| `screens` | where journeys live — **the lint's "outside"**: layout only, tokens never |
| `product` | the production source. It must never import `design/` |
| `catalogue` | a route on the preview origin, or a file under `design/` |
| `lint` | the ONE command a person or a tool runs. Put stylelint and eslint behind it too |
| `build` / `dist` | optional: the production build command and the directory it writes, for `verify.mjs --build` |
| `contrast.large` | optional: surface names whose floor is 3:1 rather than 4.5:1 (non-text) |
| `preview` | optional: `{ "command": …, "origin": "http://localhost:5174" }`. **Omit it** when the screens are plain HTML — then the studio serves `design/` statically on its own loopback port, with no command and no confirm |

**There is no `stack:` field, on purpose.** Whatever reads this branches on what is in the
directory — `.html` files are served statically, a `preview.command` is a toolchain — and never on
a framework's name.

**The `preview.origin` must be loopback**: `http://127.0.0.1:<port>` or `http://localhost:<port>`,
and not the page's own port. Anything else is refused with the reason printed, because a frame on
the page's own origin could read the page's own URL.
