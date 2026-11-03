#!/bin/sh
# design-kit installer: puts the design-system and prototype skills where coding agents find them.
#
#   curl -fsSL https://raw.githubusercontent.com/RobusGauli/design-kit/main/install.sh | sh
#
# What it does (safe to re-run; re-running updates to the latest release):
#   1. downloads the latest GitHub release (not the main branch) and keeps
#      skills/design-system/ and skills/prototype/ under
#      ${XDG_DATA_HOME:-~/.local/share}/design-kit/, with a receipt in install.json
#   2. links each into ~/.claude/skills/ and ~/.agents/skills/
#      (and ~/.cursor/skills/, ~/.kiro/skills/ when those tools are present)
#
# It never touches a repo, and never replaces a file or link it did not create.
#
# Output contract (agents read it): `installed:` lines, `linked:` / `skipped:`
# lines, `skills:`, `version:`, `source:`, `next:` and a final `done.`.
# No `done.` line means the install did not finish.
#
# Pin a version: `sh -s v0.1.0`, or DESIGN_KIT_REF=v0.1.0 (a tag, branch or commit).
# Overrides: DESIGN_KIT_SOURCE (a local checkout to install from, for testing).
#
# The whole body is a function called on the last line, so a download that
# stops part-way runs nothing.

main() {
  set -eu
  REPO="RobusGauli/design-kit"
  SKILLS="design-system prototype"
  REF="${1:-${DESIGN_KIT_REF:-}}"

  [ -n "${HOME:-}" ] || die "HOME is not set."
  case "$(uname -s 2>/dev/null)" in
    MINGW* | MSYS* | CYGWIN*)
      die "on Windows, run this in PowerShell instead: irm https://raw.githubusercontent.com/$REPO/main/install.ps1 | iex" ;;
  esac
  [ "$(id -u)" != 0 ] || die "do not run this as root or with sudo. It installs for your own user."
  case "${XDG_DATA_HOME:-}" in
    /*) DATA="$XDG_DATA_HOME/design-kit" ;;
    *)  DATA="$HOME/.local/share/design-kit" ;;
  esac

  mkdir -p "$DATA/skills"
  STAGE=$(mktemp -d "$DATA/.stage.XXXXXX")

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
  for s in $SKILLS; do
    [ -f "$SRC/skills/$s/SKILL.md" ] || die "$SRC has no skills/$s/SKILL.md."
  done
  VERSION=$(cat "$SRC/VERSION" 2>/dev/null || echo unknown)

  # Swap each skill in by rename.
  for s in $SKILLS; do
    cp -R "$SRC/skills/$s" "$STAGE/$s.new"
    [ -e "$DATA/skills/$s" ] && mv "$DATA/skills/$s" "$STAGE/$s.old"
    mv "$STAGE/$s.new" "$DATA/skills/$s"
    say "installed: $DATA/skills/$s"
  done
  printf '{\n  "version": "%s",\n  "source": "%s",\n  "installed_at": "%s"\n}\n' \
    "$VERSION" "$SOURCE" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$DATA/install.json"

  for s in $SKILLS; do
    link "$DATA/skills/$s" "$HOME/.claude/skills/$s"   # Claude Code
    link "$DATA/skills/$s" "$HOME/.agents/skills/$s"   # Codex, Cursor
    if [ -d "$HOME/.cursor" ]; then link "$DATA/skills/$s" "$HOME/.cursor/skills/$s"; fi
    if [ -d "$HOME/.kiro" ];   then link "$DATA/skills/$s" "$HOME/.kiro/skills/$s"; fi
  done

  if ! command -v node >/dev/null 2>&1 && ! command -v bun >/dev/null 2>&1; then
    say "warning:   neither node (18+) nor bun is on PATH; the design scripts need one of them."
  fi
  say "skills:    $DATA/skills"
  say "version:   $VERSION"
  say "source:    $SOURCE"
  say "next:      in the repo to design in, copy $DATA/skills/design-system/assets/DESIGN.md to"
  say "           design/DESIGN.md and assets/studio-bridge.js to design/studio-bridge.js (never overwrite)"
  say "done."
}

say() { printf '%s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

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

ours() { case "$1" in */design-kit/skills/*) return 0 ;; *) return 1 ;; esac; }

link() {  # link TARGET LINKPATH: create or repoint, but only an empty slot or our own link
  if [ -L "$2" ] && [ "$(readlink "$2")" = "$1" ]; then
    say "linked:    $2"
  elif [ -L "$2" ] && ours "$(readlink "$2")"; then
    ln -sfn "$1" "$2"
    say "linked:    $2 (updated)"
  elif [ -e "$2" ] || [ -L "$2" ]; then
    say "skipped:   $2 (already exists and is not design-kit's; left it alone)"
  elif ! mkdir -p "$(dirname "$2")" 2>/dev/null || ! ln -s "$1" "$2" 2>/dev/null; then
    say "skipped:   $2 (could not create it)"
  else
    say "linked:    $2"
  fi
}

cleanup() { [ -n "${STAGE:-}" ] && rm -rf "$STAGE"; return 0; }
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

main "$@"
