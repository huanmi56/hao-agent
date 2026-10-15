import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

// Close the desktop normally before running this offline installer. It uses
// the official host install API, including package validation and permission
// grants, rather than editing the registry or credential store directly.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distribution = join(root, "distribution");
const data = join(distribution, "data");
const metadata = JSON.parse(await readFile(join(distribution, "hao-agent-package.json"), "utf8"));
const manifest = JSON.parse(await readFile(join(root, "examples/plugins/hao-agent/manifest.json"), "utf8"));
assert.equal(createHash("sha256").update(await readFile(metadata.packagePath)).digest("hex"), metadata.shasum, "Package digest mismatch");
const backup = join(distribution, "install-backups", String(Date.now()));
await mkdir(backup, { recursive: true });
await mkdir(join(distribution, "temp"), { recursive: true });
try { await copyFile(join(data, "plugins/registry.json"), join(backup, "registry.json")); }
catch (error) { if (error.code !== "ENOENT") throw error; }
const child = spawn(join(distribution, "pi-desktop/resources/bin/pi-desktop-host-core.exe"), [], {
  windowsHide: true, stdio: ["pipe", "pipe", "pipe"],
  env: { ...process.env, PI_DESKTOP_DATA_DIR: data,
    PI_DESKTOP_AGENTS_DIR: join(distribution, "agents"), PI_CODING_AGENT_DIR: join(distribution, "pi-agent"),
    XDG_CACHE_HOME: join(distribution, "cache"), TEMP: join(distribution, "temp"), TMP: join(distribution, "temp") },
});
const exited = once(child, "exit");
let sequence = 0; const pending = new Map();
child.stderr.on("data", () => {});
createInterface({ input: child.stdout }).on("line", (line) => {
  let message; try { message = JSON.parse(line); } catch { return; }
  const call = pending.get(String(message.id)); if (!call) return;
  pending.delete(String(message.id)); clearTimeout(call.timer);
  if (message.error) call.reject(new Error(JSON.stringify(message.error)));
  else call.resolve(message.result);
});
function rpc(method, params) {
  const id = String(++sequence);
  return new Promise((resolveCall, rejectCall) => {
    const timer = setTimeout(() => { pending.delete(id); rejectCall(new Error(`Timeout: ${method}`)); }, 20000);
    pending.set(id, { resolve: resolveCall, reject: rejectCall, timer });
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
}
try {
  await rpc("app.handshake", { protocolVersion: 11 });
  await rpc("plugins.installFromPackage", { path: metadata.packagePath, expectedShasum: metadata.shasum, enable: true, grantedPermissions: manifest.permissions });
  const listing = await rpc("plugins.list", {});
  const installed = listing.plugins.find((plugin) => plugin.id === manifest.id);
  assert.ok(installed?.enabled, "Installed plugin must be enabled");
  const result = { id: installed.id, version: installed.version, enabled: installed.enabled, path: installed.path, grantedPermissions: installed.permissions, backup };
  await writeFile(join(distribution, "installation-result.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  for (const call of pending.values()) clearTimeout(call.timer);
  child.kill(); await exited;
}
