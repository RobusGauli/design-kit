#!/bin/sh
# design-kit installer: writes the design-system and prototype skills INTO A REPO.
#
#   cd <your repo> && curl -fsSL https://raw.githubusercontent.com/RobusGauli/design-kit/main/install.sh | sh
#
# It writes the same layout Harbor's `design init` writes, so the repo also works in Harbor:
#   .harbor/skills/design-system/  .harbor/skills/prototype/   the skills (the one source of truth)
#   .claude/skills/  .kiro/skills/  .cursor/rules/design.mdc     pointers to them, per agent
#   AGENTS.md                                                    one paragraph (Codex and others)
#   design/DESIGN.md                                             the brief, a stub of questions
#   design/studio-bridge.js  design/*.mjs                         the runtime and the scripts
#   .harbor/reviews/.gitignore  .harbor/shots/.gitignore         rounds and pictures stay out of git
#
# The overwrite rule is per file, the same as Harbor's:
#   missing          -> written
#   identical        -> skipped
#   ours, differs    -> refreshed (skills, pointers, bridge, scripts: never edit them by hand)
#   yours, differs   -> kept (design/DESIGN.md); AGENTS.md gets the paragraph appended once
# It never deletes anything and never writes outside the repo. Re-run it to update.
#
# Output contract (agents read it): `wrote:` / `refreshed:` / `kept:` lines, then `repo:`,
# `version:`, `source:` and a final `done.`. No `done.` line means it did not finish.
#
# Pin a version: `sh -s v0.2.0`, or DESIGN_KIT_REF=v0.2.0 (default: the latest release).
# Overrides: DESIGN_KIT_DIR (the repo; default: the current directory),
#            DESIGN_KIT_SOURCE (a local checkout to install from, for testing).
#
# The whole body is a function called on the last line, so a download that
# stops part-way runs nothing.

main() {
  set -eu
  REPO="RobusGauli/design-kit"
  REF="${1:-${DESIGN_KIT_REF:-}}"
  DEST=$(cd "${DESIGN_KIT_DIR:-.}" 2>/dev/null && pwd -P) || die "no such directory: ${DESIGN_KIT_DIR:-.}"

  case "$DEST" in
    / | "$(cd "${HOME:-/}" && pwd -P)")
      die "$DEST is not a project. cd into the repo you want to design in, then run this again." ;;
  esac
  git -C "$DEST" rev-parse --is-inside-work-tree >/dev/null 2>&1 \
    || say "warning:   $DEST is not a git repo; writing anyway"

  STAGE=$(mktemp -d "${TMPDIR:-/tmp}/design-kit.XXXXXX")
  if [ -n "${DESIGN_KIT_SOURCE:-}" ]; then
    SRC="$DESIGN_KIT_SOURCE"
    SOURCE="local:$SRC"
  else
    command -v curl >/dev/null 2>&1 || die "curl not found."
    [ -n "$REF" ] || REF=$(latest_release)
    curl -fsSL "https://codeload.github.com/$REPO/tar.gz/$REF" -o "$STAGE/src.tgz" \
      || die "could not download $REPO@$REF."
    mkdir "$STAGE/src"
    tar -xzf "$STAGE/src.tgz" -C "$STAGE/src" --strip-components=1 \
      || die "the download of $REPO@$REF is not a valid archive."
    SRC="$STAGE/src"
    SOURCE="$REPO@$REF"
  fi
  for f in skills/design-system/SKILL.md skills/prototype/SKILL.md template/AGENTS.md; do
    [ -f "$SRC/$f" ] || die "$SOURCE has no $f."
  done
  VERSION=$(cat "$SRC/VERSION" 2>/dev/null || echo unknown)

  # The skills, whole, under .harbor/skills/.
  (cd "$SRC/skills" && find design-system prototype -type f ! -name '.DS_Store') | while IFS= read -r f; do
    put ours "$SRC/skills/$f" ".harbor/skills/$f"
  done
  # The pointers, one per agent.
  (cd "$SRC/template" && find .claude .kiro .cursor -type f) | while IFS= read -r f; do
    put ours "$SRC/template/$f" "$f"
  done
  # The runtime and the scripts, where the skill runs them from.
  put ours "$SRC/skills/design-system/assets/studio-bridge.js" design/studio-bridge.js
  for f in "$SRC"/skills/design-system/scripts/*.mjs; do
    put ours "$f" "design/$(basename "$f")"
  done
  # Yours: written once, never overwritten.
  put yours "$SRC/skills/design-system/assets/DESIGN.md" design/DESIGN.md
  append_once "$SRC/template/AGENTS.md" AGENTS.md
  for d in .harbor/reviews .harbor/shots; do
    [ -e "$DEST/$d/.gitignore" ] || { mkdir -p "$DEST/$d" && printf '*\n' > "$DEST/$d/.gitignore" && say "wrote:     $d/.gitignore"; }
  done

  if ! command -v node >/dev/null 2>&1 && ! command -v bun >/dev/null 2>&1; then
    say "warning:   neither node (18+) nor bun is on PATH; the design scripts need one of them."
  fi
  say "repo:      $DEST"
  say "version:   $VERSION"
  say "source:    $SOURCE"
  say "next:      ask the agent to \"lay the design system\", then \"prototype a checkout\";"
  say "           browse with: node design/studio.mjs --open"
  say "done."
}

say() { printf '%s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

# put ours|yours SRC RELPATH: write it if missing; refresh it if ours and different; keep it if yours.
put() {
  target="$DEST/$3"
  if [ ! -e "$target" ]; then
    mkdir -p "$(dirname "$target")" && cp "$2" "$target"
    say "wrote:     $3"
  elif cmp -s "$2" "$target"; then
    :
  elif [ "$1" = ours ]; then
    cp "$2" "$target"
    say "refreshed: $3"
  else
    say "kept:      $3 (yours; left as it is)"
  fi
}

# append_once SRC RELPATH: write it if missing, else append it once, keyed on its first line.
append_once() {
  target="$DEST/$2"
  if [ ! -e "$target" ]; then
    cp "$1" "$target"
    say "wrote:     $2"
  elif ! grep -qxF "$(head -n 1 "$1")" "$target"; then
    { printf '\n'; cat "$1"; } >> "$target"
    say "appended:  $2"
  fi
}

# The tag /releases/latest redirects to (no API call). Never falls back to main.
latest_release() {
  url=$(curl -fsSLI -o /dev/null -w '%{url_effective}' "https://github.com/$REPO/releases/latest" 2>/dev/null) || url=
  case "$url" in
    */releases/tag/?*) ;;
    *) die "could not find the latest design-kit release. Check your connection, or pin one with DESIGN_KIT_REF=<tag>." ;;
  esac
  tag=${url##*/releases/tag/}
  case "$tag" in */* | *[!A-Za-z0-9._-]*) die "unexpected release tag '$tag'." ;; esac
  printf '%s' "$tag"
}

cleanup() { [ -n "${STAGE:-}" ] && rm -rf "$STAGE"; return 0; }
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

main "$@"
