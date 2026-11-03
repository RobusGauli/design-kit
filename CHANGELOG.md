# Changelog

## 0.2.0

- `scripts/studio.mjs`: a read-only, zero-dependency dashboard over `design/journeys`
  (`node design/studio.mjs [--port N] [--open]`). Journeys, screens and variants from the files on
  disk, a framed screen with state / theme / variant / viewport controls, a flow map from `data-go`
  literals, the shots grid, `JOURNEY.md`, live reload. Binds 127.0.0.1, refuses foreign Host headers
  and any path outside `design/` and `.harbor/shots/`, writes nothing, starts no preview.
- Tests under `tests/` (`node --test`) with a worked fixture, and a CI workflow (Node 18 and 22,
  Ubuntu and macOS).
- SETUP step 3 also copies `scripts/*.mjs` into `design/`, never overwriting a differing file.
- `studio-bridge.js` is unchanged: it is the same file Harbor ships.

## 0.1.0

First release: the `design-system` and `prototype` skills.
