import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
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

  test("writes only inside the repo, no .harbor, and ends with done.", () => {
    const run = install(repo);
    assert.equal(run.code, 0, run.err);
    assert.match(run.out, /\ndone\.\n$/);
    for (const f of [
      ".agents/skills/design-system/SKILL.md",
      ".agents/skills/design-system/scripts/studio.mjs",
      ".agents/skills/prototype/references/rounds.md",
      ".claude/skills/design-system/SKILL.md",
      ".kiro/skills/prototype/SKILL.md",
      ".cursor/rules/design.mdc",
      "design/DESIGN.md",
      "design/studio-bridge.js",
      "design/studio.mjs",
      "design/lint.mjs",
      "design/.shots/.gitignore",
    ]) {
      assert.ok(existsSync(join(repo, f)), `${f} missing`);
    }
    assert.ok(!existsSync(join(repo, ".harbor")), "wrote a .harbor directory");
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

  test("refuses a design/ that is a symlink, before writing anything", { skip: WINDOWS && "symlinks need privileges" }, () => {
    const out = mkdtempSync(join(tmpdir(), "dk-out-"));
    const other = mkdtempSync(join(tmpdir(), "dk-repo2-"));
    execFileSync("git", ["init", "-q", other]);
    symlinkSync(out, join(other, "design"));
    const run = install(other);
    const wrote = readdirSync(out).length;
    const left = readdirSync(other).sort();
    rmSync(out, { recursive: true, force: true });
    rmSync(other, { recursive: true, force: true });
    assert.notEqual(run.code, 0);
    assert.match(run.err + run.out, /symlink/);
    assert.equal(wrote, 0, "wrote outside the repo");
    assert.deepEqual(left, [".git", "design"]);
  });

  test("inside a host that takes the pictures, shots.mjs and verify.mjs stand down", () => {
    const env = { ...process.env, HARBOR_DESIGN_SHOTS: "1" };
    const shots = spawnSync("node", ["design/shots.mjs", "example"], { cwd: repo, env, encoding: "utf8" });
    assert.equal(shots.status, 0, shots.stderr);
    assert.match(shots.stdout, /takes the pictures itself/);
    const verify = spawnSync(
      "node",
      ["--input-type=module", "-e", 'const { shotsCheck } = await import("./design/verify.mjs"); shotsCheck({ screens: ["design/journeys"] }, process.cwd());'],
      { cwd: repo, env, encoding: "utf8" },
    );
    assert.match(verify.stdout, /shots SKIP — this environment takes the pictures itself/, verify.stderr);
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
