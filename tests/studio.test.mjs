import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { cp, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import http from "node:http";
import { start } from "../skills/design-system/scripts/studio.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(here, "..", "skills", "design-system", "scripts", "studio.mjs");
const PNG = Buffer.from("89504e470d0a1a0a", "hex");
const quiet = () => {};

/** A raw GET, so the Host header and an un-normalised path go out exactly as written. */
function get(server, path, headers = {}, method = "GET") {
  return new Promise((done, fail) => {
    const req = http.request(
      { host: "127.0.0.1", port: server.port, path, method, headers: { host: `127.0.0.1:${server.port}`, ...headers } },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => done({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString("utf8") }));
      },
    );
    req.on("error", fail);
    req.end();
  });
}

async function repo() {
  const root = await mkdtemp(join(tmpdir(), "studio-"));
  await cp(join(here, "fixtures", "vanilla"), root, { recursive: true });
  await mkdir(join(root, ".harbor", "shots", "example"), { recursive: true });
  await writeFile(join(root, ".harbor", "shots", "example", "list.ready.light.png"), PNG);
  await writeFile(join(root, ".harbor", "shots", "example", ".digests.json"), "{}");
  await writeFile(join(root, "outside.txt"), "secret");
  await symlink(join(root, "outside.txt"), join(root, "design", "leak.txt"));
  return root;
}

describe("studio.mjs", () => {
  let root;
  let server;
  before(async () => {
    root = await repo();
    server = await start({ root, port: 0, log: quiet });
  });
  after(async () => {
    await server.close();
    await rm(root, { recursive: true, force: true });
  });

  test("the dashboard has a CSP and nosniff", async () => {
    const res = await get(server, "/");
    assert.equal(res.status, 200);
    assert.match(res.headers["content-security-policy"], /default-src 'none'/);
    assert.equal(res.headers["x-content-type-options"], "nosniff");
    assert.match(res.headers["content-type"], /text\/html/);
  });

  test("serves a screen with the right type and the bridge beside it", async () => {
    const screen = await get(server, "/journeys/example/list.html");
    assert.equal(screen.status, 200);
    assert.match(screen.headers["content-type"], /text\/html/);
    const bridge = await get(server, "/studio-bridge.js");
    assert.match(bridge.headers["content-type"], /text\/javascript/);
  });

  test("serves a shot as png and refuses dotfiles beside it", async () => {
    const shot = await get(server, "/_studio/shots/example/list.ready.light.png");
    assert.equal(shot.status, 200);
    assert.equal(shot.headers["content-type"], "image/png");
    assert.equal((await get(server, "/_studio/shots/example/.digests.json")).status, 400);
    assert.equal((await get(server, "/_studio/shots/example/list.ready.light.png/../../x")).status, 400);
  });

  for (const path of ["/../../etc/passwd", "/%2e%2e/%2e%2e/etc/passwd", "/journeys/%2e%2e/%2e%2e/x", "/journeys/..%2f..%2fx", "/%00", "/.harbor/shots/example/list.ready.light.png"]) {
    test(`refuses ${path}`, async () => {
      const res = await get(server, path);
      assert.ok([400, 404].includes(res.status), `got ${res.status}`);
      assert.ok(!res.body.includes("root:"));
    });
  }

  test("refuses a symlink that leaves the repo", async () => {
    const res = await get(server, "/leak.txt");
    assert.equal(res.status, 404);
    assert.ok(!res.body.includes("secret"));
  });

  test("lists no directories", async () => {
    assert.equal((await get(server, "/journeys/")).status, 404);
    assert.equal((await get(server, "/journeys/example")).status, 404);
  });

  test("rejects a foreign Host and accepts localhost", async () => {
    assert.equal((await get(server, "/", { host: "evil.example" })).status, 403);
    assert.equal((await get(server, "/", { host: `evil.example:${server.port}` })).status, 403);
    assert.equal((await get(server, "/", { host: `localhost:${server.port}` })).status, 200);
  });

  test("has no write endpoints", async () => {
    for (const method of ["POST", "PUT", "DELETE", "PATCH"]) {
      assert.equal((await get(server, "/_studio/index.json", {}, method)).status, 405);
    }
  });

  test("answers 304 to a matching If-None-Match", async () => {
    const first = await get(server, "/journeys/example/list.html");
    const again = await get(server, "/journeys/example/list.html", { "if-none-match": first.headers.etag });
    assert.equal(again.status, 304);
    assert.equal(again.body, "");
  });

  test("the index reads screens, variants, states and flow edges from the files", async () => {
    const { journeys, preview } = JSON.parse((await get(server, "/_studio/index.json")).body);
    assert.equal(preview, null);
    const [example] = journeys;
    assert.equal(example.entry, "list");
    assert.deepEqual(example.screens.map((s) => s.id), ["list", "detail", "done"]);
    const detail = example.screens.find((s) => s.id === "detail");
    assert.deepEqual(detail.versions.map((v) => v.variant), [null, "dense"]);
    assert.deepEqual(detail.versions[1].states, ["error", "ready"]);
    assert.ok(detail.versions[0].links.includes("detail?variant=dense"));
    assert.ok(detail.versions[0].links.includes("back"));
    assert.deepEqual(example.shots.map((s) => s.file), ["list.ready.light.png"]);
  });

  test("keeps going on a malformed journey.json and a screen without data-states", async () => {
    await mkdir(join(root, "design", "journeys", "broken"), { recursive: true });
    await writeFile(join(root, "design", "journeys", "broken", "journey.json"), "{nope");
    await writeFile(join(root, "design", "journeys", "broken", "a.html"), '<main data-screen="a"><!-- <a data-go="ghost"> --><a data-go="b">x</a></main>');
    await mkdir(join(root, "design", "journeys", "bare"), { recursive: true });
    // the index is cached until a watch event, so read it through a fresh server
    const fresh = await start({ root, port: 0, log: quiet });
    try {
      const got = JSON.parse((await get(fresh, "/_studio/index.json")).body).journeys;
      const broken = got.find((j) => j.name === "broken");
      assert.match(broken.error, /not valid JSON/);
      assert.deepEqual(broken.screens[0].versions[0].states, ["ready"]);
      assert.deepEqual(broken.screens[0].versions[0].links, ["b"]);
      assert.match(got.find((j) => j.name === "bare").error, /missing/);
    } finally {
      await fresh.close();
    }
  });

  test("the index never serves stale data, watcher or not", async () => {
    const dir = join(root, "design", "journeys", "fresh");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "journey.json"), '{"title":"Fresh","entry":"a","screens":{}}');
    await writeFile(join(dir, "a.html"), '<main data-screen="a" data-states="ready"></main>');
    const names = JSON.parse((await get(server, "/_studio/index.json")).body).journeys.map((j) => j.name);
    assert.ok(names.includes("fresh"), `fresh missing from ${names}`);
    await rm(dir, { recursive: true });
  });

  test("a change on disk is pushed over SSE", async () => {
    const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
    const screen = join(root, "design", "journeys", "example", "list.html");
    let seen = "";
    const req = http.get({ host: "127.0.0.1", port: server.port, path: "/_studio/events", headers: { host: `127.0.0.1:${server.port}` } }, (res) => {
      res.setEncoding("utf8");
      res.on("data", (chunk) => (seen += chunk));
    });
    req.on("error", () => {});
    await sleep(800); // let the earlier tests' file events flush
    seen = "";
    await writeFile(screen, "<!-- touched -->", { flag: "a" });
    for (let waited = 0; !seen.includes('"kind":"design"') && waited < 8000; waited += 100) await sleep(100);
    req.destroy();
    assert.match(seen, /data: \{"kind":"design"/);
  });
});

describe("preview origin and empty repos", () => {
  test("design.json preview.origin reaches the index and the frame CSP", async () => {
    const root = await mkdtemp(join(tmpdir(), "studio-p-"));
    await mkdir(join(root, "design", "journeys"), { recursive: true });
    await writeFile(join(root, "design", "design.json"), JSON.stringify({ preview: { command: "x", origin: "http://localhost:5174/path" } }));
    const s = await start({ root, port: 0, log: quiet });
    try {
      assert.equal(JSON.parse((await get(s, "/_studio/index.json")).body).preview, "http://localhost:5174");
      assert.match((await get(s, "/")).headers["content-security-policy"], /frame-src 'self' http:\/\/localhost:5174/);
    } finally {
      await s.close();
      await rm(root, { recursive: true, force: true });
    }
  });

  test("a repo with no design/ still serves an empty index", async () => {
    const root = await mkdtemp(join(tmpdir(), "studio-e-"));
    const s = await start({ root, port: 0, log: quiet });
    try {
      assert.deepEqual(JSON.parse((await get(s, "/_studio/index.json")).body).journeys, []);
    } finally {
      await s.close();
      await rm(root, { recursive: true, force: true });
    }
  });

  test("a port in use falls back to a free one", async () => {
    const root = await mkdtemp(join(tmpdir(), "studio-b-"));
    const a = await start({ root, port: 0, log: quiet });
    const logged = [];
    const b = await start({ root, port: a.port, log: (m) => logged.push(m) });
    try {
      assert.notEqual(a.port, b.port);
      assert.match(logged.join("\n"), /in use/);
    } finally {
      await a.close();
      await b.close();
      await rm(root, { recursive: true, force: true });
    }
  });

  test("the command prints the URL first and exits 2 on a bad port", async () => {
    const root = await mkdtemp(join(tmpdir(), "studio-c-"));
    const child = spawn(process.execPath, [SCRIPT, "--port", "0"], { cwd: root });
    const first = await new Promise((done) => child.stdout.once("data", (d) => done(String(d))));
    child.kill();
    assert.match(first.split("\n")[0], /^http:\/\/127\.0\.0\.1:\d+\/$/);
    const bad = spawn(process.execPath, [SCRIPT, "--port", "abc"], { cwd: root });
    const code = await new Promise((done) => bad.on("exit", done));
    assert.equal(code, 2);
    await rm(root, { recursive: true, force: true });
  });
});
