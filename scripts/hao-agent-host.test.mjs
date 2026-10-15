import assert from "node:assert/strict";
import { spawn, fork } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, mkdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";
import test from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const plugin = join(root, "examples/plugins/hao-agent");
const manifest = JSON.parse(await readFile(join(plugin, "manifest.json"), "utf8"));

function requestQueue(send) {
  let next = 0;
  const pending = new Map();
  return {
    receive(message) {
      const call = pending.get(String(message.id));
      if (!call) return;
      pending.delete(String(message.id)); clearTimeout(call.timer);
      if (message.error || message.ok === false) call.reject(new Error(JSON.stringify(message.error)));
      else call.resolve(message.result ?? message.value);
    },
    call(message) {
      const id = String(++next);
      return new Promise((resolveCall, rejectCall) => {
        const timer = setTimeout(() => { pending.delete(id); rejectCall(new Error(`Timeout: ${JSON.stringify(message)}`)); }, 15000);
        pending.set(id, { resolve: resolveCall, reject: rejectCall, timer });
        send({ ...message, id });
      });
    },
  };
}

test("native release host rejects missing grants and installs with explicit fixture grants", { timeout: 25000 }, async (t) => {
  const testsRoot = join(root, "distribution", "host-tests"); await mkdir(testsRoot, { recursive: true });
  const data = await mkdtemp(join(testsRoot, "profile-"));
  const child = spawn(join(root, "distribution/pi-desktop/resources/bin/pi-desktop-host-core.exe"), [], {
    windowsHide: true, stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, PI_DESKTOP_DATA_DIR: data, PI_DESKTOP_AGENTS_DIR: join(data, "agents"), TEMP: data, TMP: data },
  });
  const exited = once(child, "exit");
  t.after(async () => { child.kill(); await exited; });
  let stderr = ""; child.stderr.on("data", (chunk) => { stderr += String(chunk); });
  const queue = requestQueue((message) => child.stdin.write(JSON.stringify(message) + "\n"));
  createInterface({ input: child.stdout }).on("line", (line) => { try { queue.receive(JSON.parse(line)); } catch {} });
  const handshake = await queue.call({ jsonrpc: "2.0", method: "app.handshake", params: { protocolVersion: 11 } });
  assert.equal(handshake.protocolVersion, 11, stderr);
  const metadata = JSON.parse(await readFile(join(root, "distribution/hao-agent-package.json"), "utf8"));
  const install = { path: metadata.packagePath, expectedShasum: metadata.shasum, enable: false };
  await assert.rejects(queue.call({ jsonrpc: "2.0", method: "plugins.installFromPackage", params: { ...install, grantedPermissions: [] } }), /PLUGIN_PERMISSION_DENIED/);
  await queue.call({ jsonrpc: "2.0", method: "plugins.installFromPackage", params: { ...install, grantedPermissions: manifest.permissions } });
  const listing = await queue.call({ jsonrpc: "2.0", method: "plugins.list", params: {} });
  const installed = listing.plugins.find((entry) => entry.id === manifest.id);
  assert.ok(installed, "native host must persist the installed package");
  assert.equal(installed.enabled, false, "installation must preserve the explicit disabled state");
});

test("actual isolated plugin process loads main, serves panel and executes a text job", { timeout: 20000 }, async (t) => {
  const child = fork(join(root, "apps/desktop/electron/main/plugin-host-process.mjs"), [], { stdio: ["ignore", "pipe", "pipe", "ipc"], windowsHide: true });
  const exited = once(child, "exit");
  t.after(async () => { child.kill(); await exited; });
  const models = [
    { key: "chatgpt/gpt-6-astra", providerId: "chatgpt", providerName: "ChatGPT", modelId: "gpt-6-astra", label: "Astra", thinkingLevels: ["low"] },
    ...["kimi-k2.7-code", "glm-5.3", "qwen3.8-flash"].map((modelId) => ({ key: `go/${modelId}`, providerId: "go", providerName: "OpenCode Go", modelId, label: modelId, availableForSubagents: true })),
  ];
  let saved = {}; const completions = [];
  const queue = requestQueue((message) => child.send(message));
  child.on("message", async (message) => {
    if (message.t === "res") { queue.receive(message); return; }
    if (message.t !== "call") return;
    try {
      let value;
      switch (message.api) {
        case "app.getLocale": value = "zh-CN"; break;
        case "plugin.getSettings": value = saved; break;
        case "plugin.setSettings": saved = { ...saved, ...message.args[0] }; value = null; break;
        case "models.list": value = models; break;
        case "commands.register": case "commands.unregister": case "agent.registerTool": case "agent.unregisterTool": value = null; break;
        case "agent.complete": completions.push(message.args[0]); value = { text: "A concise answer.", modelKey: models[3].key }; break;
        default: throw new Error(`Unapproved host API in fixture: ${message.api}`);
      }
      child.send({ t: "res", id: message.id, ok: true, value });
    } catch (error) { child.send({ t: "res", id: message.id, ok: false, error: { code: "FIXTURE_ERROR", message: error.message } }); }
  });
  await queue.call({ t: "init", pluginId: manifest.id, pluginPath: plugin, main: manifest.main, manifest });
  const initial = await queue.call({ t: "call", method: "panel.invoke", payload: { channel: "hao.state" } });
  assert.equal(initial.locale, "zh-CN"); assert.equal(initial.models.length, 4);
  await queue.call({ t: "call", method: "panel.invoke", payload: { channel: "hao.save", payload: initial.suggestions } });
  const result = await queue.call({ t: "call", method: "tool.execute", invocationId: "tool-1", payload: { name: "hao_task", sessionId: "parent", mode: "agent", args: { action: "start", kind: "text", request: "Explain this briefly." } } });
  assert.equal(result.status, "completed"); assert.equal(result.calls.decision, 0);
  assert.equal(completions.length, 1); assert.equal(completions[0].modelKey, models[3].key);
  await queue.call({ t: "call", method: "lifecycle.unload", payload: {} });
});
