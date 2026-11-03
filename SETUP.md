# Set up design-kit

You are a coding agent (Claude Code, Codex, Cursor, Kiro, ...) and the user asked you to set up
design-kit from this file. Do these steps in order. Report each command's output.

## 1. Install the two skills

macOS and Linux:

```bash
curl -fsSL https://raw.githubusercontent.com/RobusGauli/design-kit/main/install.sh | sh
```

Windows, in PowerShell (from Git Bash, wrap it in `powershell -NoProfile -Command "..."`):

```powershell
irm https://raw.githubusercontent.com/RobusGauli/design-kit/main/install.ps1 | iex
```

The installer copies `design-system` and `prototype` to `~/.local/share/design-kit/skills/`
(`%LOCALAPPDATA%\design-kit\skills\` on Windows) and links them into the skill folders of Claude
Code, Codex, Cursor and Kiro. It does not touch any repo. Its output ends with `done.`. If that
line is missing, the install failed: show the user the output and stop.

Remember the path on its `skills:` line. Call it `$S` below.

## 2. Check the runtime

The design scripts need Node 18+ or Bun. Run `node --version` and `bun --version`. If neither
works, tell the user, and continue: the skills still install.

## 3. Prepare the current repo (only if the user is in one)

If the current directory is a git repo the user wants to design in, ask once: *Add design-kit's
`design/` starter files to this repo?* On yes, copy these two files, and **never overwrite one
that exists** (say which you skipped):

| from | to |
|---|---|
| `$S/design-system/assets/DESIGN.md` | `design/DESIGN.md` |
| `$S/design-system/assets/studio-bridge.js` | `design/studio-bridge.js` |

Do not lay tokens or write components now. That is the design-system skill's work, and it starts
by looking at the repo's stack.

## 4. Tell the user what they can say

End with these lines, and nothing that needs a reply:

- *"Lay the design system in this repo"* → the `design-system` skill (tokens, type and space
  scales, contrast, states, the component floor, a catalogue and a lint, in the repo's own stack).
- *"Prototype a checkout"* → the `prototype` skill (a clickable journey in
  `design/journeys/<name>/`).
- To update later, run the same installer again.
