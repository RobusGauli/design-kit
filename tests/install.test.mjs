import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const KIT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WINDOWS = process.platform === "win32";

/** Run the platform's installer against `repo`, from the local checkout. */
function install(repo) {
  const env = { ...process.env, DESIGN_KIT_DIR: repo, DESIGN_KIT_SOURCE: KIT };
  const [cmd, args] = WINDOWS
    ? ["pwsh", ["-NoProfile", "-File", join(KIT, "install.ps1")]]
    : ["sh", [join(KIT, "install.sh")]];
  const run = spawnSync(cmd, args, { env, encoding: "utf8" });
  return { code: run.status, out: run.stdout.replace(/\r/g, ""), err: run.stderr };
}

const changes = (out) => out.split("\n").filter((l) => /^(wrote|refreshed|kept|appended):/.test(l));

describe(`installer (${WINDOWS ? "install.ps1" : "install.sh"})`, () => {
  let repo;
  before(() => {
    repo = mkdtempSync(join(tmpdir(), "dk-repo-"));
    execFileSync("git", ["init", "-q", repo]);
    writeFileSync(join(repo, "AGENTS.md"), "# My app\n");
  });
  after(() => rmSync(repo, { recursive: true, force: true }));

  test("writes Harbor's layout into the repo and ends with done.", () => {
    const run = install(repo);
    assert.equal(run.code, 0, run.err);
    assert.match(run.out, /\ndone\.\n$/);
    for (const f of [
      ".harbor/skills/design-system/SKILL.md",
      ".harbor/skills/design-system/scripts/studio.mjs",
      ".harbor/skills/prototype/references/rounds.md",
      ".claude/skills/design-system/SKILL.md",
      ".kiro/skills/prototype/SKILL.md",
      ".cursor/rules/design.mdc",
      "design/DESIGN.md",
      "design/studio-bridge.js",
      "design/studio.mjs",
      "design/lint.mjs",
      ".harbor/shots/.gitignore",
      ".harbor/reviews/.gitignore",
    ]) {
      assert.ok(existsSync(join(repo, f)), `${f} missing`);
    }
    assert.equal(
      readFileSync(join(repo, "design/studio-bridge.js"), "utf8"),
      readFileSync(join(KIT, "skills/design-system/assets/studio-bridge.js"), "utf8"),
    );
  });

  test("appends to an existing AGENTS.md once, keeping what was there", () => {
    const agents = readFileSync(join(repo, "AGENTS.md"), "utf8");
    assert.ok(agents.startsWith("# My app\n"));
    assert.equal(agents.split("## Design work in this repo").length - 1, 1);
  });

  test("a second run changes nothing", () => {
    const run = install(repo);
    assert.equal(run.code, 0, run.err);
    assert.deepEqual(changes(run.out), []);
  });

  test("refreshes ours, keeps yours", () => {
    appendFileSync(join(repo, "design/DESIGN.md"), "my answers\n");
    appendFileSync(join(repo, "design/lint.mjs"), "// edited\n");
    const run = install(repo);
    assert.equal(run.code, 0, run.err);
    assert.deepEqual(changes(run.out).sort(), ["kept:      design/DESIGN.md (yours; left as it is)", "refreshed: design/lint.mjs"]);
    assert.match(readFileSync(join(repo, "design/DESIGN.md"), "utf8"), /my answers\n$/);
    assert.doesNotMatch(readFileSync(join(repo, "design/lint.mjs"), "utf8"), /\/\/ edited/);
  });

  test("refuses the home directory", { skip: WINDOWS && "PowerShell's $HOME cannot be redirected" }, () => {
    const home = mkdtempSync(join(tmpdir(), "dk-home-"));
    const run = spawnSync("sh", [join(KIT, "install.sh")], {
      env: { ...process.env, HOME: home, DESIGN_KIT_DIR: home, DESIGN_KIT_SOURCE: KIT },
      encoding: "utf8",
    });
    rmSync(home, { recursive: true, force: true });
    assert.notEqual(run.status, 0);
    assert.match(run.stderr, /is not a project/);
  });
});
