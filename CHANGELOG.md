# Changelog

## 0.2.0

- **Installs into the repo, never the home directory.** Everything is written inside the current
  repo: `.agents/skills/` (the skills), pointers for Claude Code, Kiro, Cursor and `AGENTS.md`,
  `design/DESIGN.md`, the bridge and the scripts. Per-file rule: ours refreshed, yours kept,
  nothing deleted. It refuses the home directory. v0.1.0's home install is no longer used.
- **No `.harbor/`.** Screenshots live in `design/.shots/<journey>/` (git-ignored); review rounds
  are read wherever the turn names them; inside a host that takes the pictures itself (`HARBOR_DESIGN_SHOTS=1`), `shots.mjs` and
  `verify.mjs` stand down and say so.
- The installer checks every path before writing anything and refuses to write through a
  symlink, so it can never write outside the repo.
  `studio-bridge.js` stays byte-identical to Harbor's, so screens still open in Harbor's studio.
- `scripts/studio.mjs`: a read-only, zero-dependency dashboard over `design/journeys`
  (`node design/studio.mjs [--port N] [--open]`). Journeys, screens and variants from the files on
  disk, a framed screen with state / theme / variant / viewport controls, a flow map from `data-go`
  literals, the shots grid, `JOURNEY.md`, live reload. Binds 127.0.0.1, refuses foreign Host headers
  and any path outside `design/`, writes nothing, starts no preview.
- Tests under `tests/` (`node --test`) with a worked fixture, and a CI workflow (Node 18 and 22,
  Ubuntu and macOS).
- `studio-bridge.js` is unchanged: it is the same file Harbor ships.

## 0.1.0

First release: the `design-system` and `prototype` skills.
