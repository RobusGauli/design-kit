# design-kit

Two [Agent Skills](https://agentskills.io) that teach a coding agent (Claude Code, Codex, Cursor,
Kiro, ...) to lay a product's design system and build clickable prototypes from it:

- **`design-system`** — DTCG tokens, the type and space scales, measured contrast, the four
  states, the component floor, a catalogue and a mechanical lint, in whatever stack the repo
  already has (vanilla, React, Svelte, Vue, Tailwind 4, or brownfield).
- **`prototype`** — a user journey as a directory of screens: variants as files, states as URL
  parameters, links as `data-go` attributes, screenshots as evidence, and numbered feedback rounds.

The scripts they ship (`lint.mjs`, `tokens-to-css.mjs`, `contrast.mjs`, `verify.mjs`,
`shots.mjs`, `studio.mjs`) are zero-dependency and run under Node 18+ or Bun.

## Install

**The quick way: ask your agent.** Paste this into Claude Code, Codex or Cursor:

```
set up https://raw.githubusercontent.com/RobusGauli/design-kit/main/SETUP.md
```

The agent finds the repo you are in and runs the installer there.

**Or run the installer yourself, from the repo root:**

```sh
curl -fsSL https://raw.githubusercontent.com/RobusGauli/design-kit/main/install.sh | sh
```

On Windows, in PowerShell:

```powershell
irm https://raw.githubusercontent.com/RobusGauli/design-kit/main/install.ps1 | iex
```

It installs **into the repo**, not your home directory, so the skills are committed with the
project and every teammate's agent gets them. Everything it writes is inside the repo:

```
.agents/skills/design-system/  .agents/skills/prototype/    the two skills
.claude/skills/  .kiro/skills/  .cursor/rules/  AGENTS.md    pointers, so each agent finds them
design/DESIGN.md                                             the brief (yours; never overwritten)
design/studio-bridge.js  design/*.mjs                        the prototype runtime and the scripts
design/.shots/                                               screenshots (git-ignored)
```

It downloads the **latest release** (not `main`), never deletes a file, refreshes only its own files
when they differ, keeps `design/DESIGN.md`, and appends one paragraph to an existing `AGENTS.md`
once. Re-run it to update. Pin a version with `sh -s v0.2.0` or `DESIGN_KIT_REF=v0.2.0`.

## Use

In a repo: *"lay the design system"*, then *"prototype a checkout"*. The skills say the rest.

## Browse your prototypes

From the repo root: `node design/studio.mjs --open`. It serves a read-only dashboard on 127.0.0.1: journeys, screens and variants, each
screen in a frame with state, theme, variant and viewport controls, a flow map drawn from the
`data-go` links, the shots, and `JOURNEY.md`. It reloads when files change and writes nothing.
Screens must be plain `.html`, or declare `preview.origin` in `design/design.json` and start that
preview yourself. Node 18+ or Bun, no dependencies.

## Harbor

`design/studio-bridge.js` is byte-for-byte the file Harbor's
design studio ships, so the same screens open in Harbor's studio unchanged. Nothing else in a
design-kit repo is Harbor's, and nothing is written under `.harbor/`.

## License

MIT
