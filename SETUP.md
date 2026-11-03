# Set up design-kit

You are a coding agent (Claude Code, Codex, Cursor, Kiro, ...) and the user asked you to set up
design-kit from this file. It installs into **the repo the user is in**, not their home directory.
Do these steps in order and report each command's output.

## 1. Find the repo

Run `git rev-parse --show-toplevel`. If it prints a path, that is the repo: `cd` to it. If it fails,
ask the user which project directory to set up, and stop until they answer. Never run the
installer in the home directory (it refuses).

## 2. Install into the repo

From the repo root, on macOS and Linux:

```bash
curl -fsSL https://raw.githubusercontent.com/RobusGauli/design-kit/main/install.sh | sh
```

On Windows, in PowerShell (from Git Bash, wrap it in `powershell -NoProfile -Command "..."`):

```powershell
irm https://raw.githubusercontent.com/RobusGauli/design-kit/main/install.ps1 | iex
```

Everything it writes is inside the repo:

| path | what |
|---|---|
| `.agents/skills/design-system/`, `.agents/skills/prototype/` | the two skills |
| `.claude/skills/`, `.kiro/skills/`, `.cursor/rules/design.mdc`, `AGENTS.md` | pointers so each agent finds them |
| `design/DESIGN.md` | the brief, a stub of questions (never overwritten) |
| `design/studio-bridge.js`, `design/*.mjs` | the prototype runtime and the scripts |
| `design/.shots/.gitignore` | keeps screenshots out of git |

It never deletes a file. A file that exists and differs is refreshed only when it is design-kit's
own; `design/DESIGN.md` is kept, and `AGENTS.md` gets one paragraph appended once. Its output
ends with `done.`. If that line is missing, the install failed: show the user the output and stop.

## 3. Check the runtime

The design scripts need Node 18+ or Bun. If the installer printed a `warning:` about it, tell the
user.

## 4. Tell the user what they can say

Say that the files are new in the repo and are meant to be committed. Then end with these lines,
and nothing that needs a reply:

- *"Lay the design system in this repo"* → the `design-system` skill (tokens, type and space
  scales, contrast, states, the component floor, a catalogue and a lint, in the repo's own stack).
- *"Prototype a checkout"* → the `prototype` skill (a clickable journey in
  `design/journeys/<name>/`).
- *"Show me the prototypes"* → `node design/studio.mjs --open`: a read-only dashboard (screens,
  flow map, shots, brief) on 127.0.0.1.
- To update later, run the same installer again from the repo root.
