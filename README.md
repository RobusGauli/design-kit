# design-kit

Two [Agent Skills](https://agentskills.io) that teach a coding agent (Claude Code, Codex, Cursor,
Kiro, ...) to lay a product's design system and build clickable prototypes from it:

- **`design-system`** — DTCG tokens, the type and space scales, measured contrast, the four
  states, the component floor, a catalogue and a mechanical lint, in whatever stack the repo
  already has (vanilla, React, Svelte, Vue, Tailwind 4, or brownfield).
- **`prototype`** — a user journey as a directory of screens: variants as files, states as URL
  parameters, links as `data-go` attributes, screenshots as evidence, and numbered feedback rounds.

The scripts they ship (`lint.mjs`, `tokens-to-css.mjs`, `contrast.mjs`, `verify.mjs`,
`shots.mjs`) are zero-dependency and run under Node 18+ or Bun.

## Install

**The quick way: ask your agent.** Paste this into Claude Code, Codex or Cursor:

```
set up https://raw.githubusercontent.com/RobusGauli/design-kit/main/SETUP.md
```

The agent runs the installer, checks for Node or Bun, and offers to add the `design/` starter
files to the repo you are in.

**Or run the installer yourself:**

```sh
curl -fsSL https://raw.githubusercontent.com/RobusGauli/design-kit/main/install.sh | sh
```

On Windows, in PowerShell:

```powershell
irm https://raw.githubusercontent.com/RobusGauli/design-kit/main/install.ps1 | iex
```

The installer downloads the **latest release** (not `main`), copies `skills/` to
`~/.local/share/design-kit/` with a receipt in `install.json`, and links each skill into
`~/.claude/skills/` and `~/.agents/skills/` (plus `~/.cursor/skills/` and `~/.kiro/skills/` when
those tools are installed). It never replaces a file or link it did not create, and never touches
a repo. Re-run it to update. Pin a version with `sh -s v0.1.0` or `DESIGN_KIT_REF=v0.1.0`.

## Use

In a repo: *"lay the design system"*, then *"prototype a checkout"*. The skills say the rest.

## Source

These skills are published from Harbor, where the same skills
ship with the Design extension (`harbor design init`). Inside Harbor a studio takes the
screenshots and sends review rounds; outside it, `shots.mjs` takes them from a terminal.

## License

MIT
