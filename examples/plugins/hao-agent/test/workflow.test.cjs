"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { HaoEngine } = require("../engine.cjs");
const { parsePlan, readyTasks } = require("../plan.cjs");
const { suggestModels, resolveRoles } = require("../models.cjs");
const manifest = require("../manifest.json");
const { TOOL } = require("../main.js");

const ctx = { sessionId: "parent-1", mode: "agent" };
const catalog = [
  { key: "chatgpt/gpt-6-astra", modelId: "gpt-6-astra", providerId: "chatgpt", providerName: "ChatGPT", thinkingLevels: ["low", "high"] },
  ...["kimi-k2.7-code", "glm-5.3", "qwen3.8-flash"].map((modelId) => ({ key: `go/${modelId}`, modelId, providerId: "go", providerName: "OpenCode Go", thinkingLevels: [], availableForSubagents: true })),
];
const roles = Object.fromEntries(["decision", "execution", "review", "text"].map((role, index) => [role, catalog[index].key]));
const validPlan = { summary: "Implement and verify the requested change.", tasks: [{ id: "implement", task: "Change the requested function and run its tests. Report command evidence.", dependsOn: [], writes: true }] };
const clone = (value) => JSON.parse(JSON.stringify(value));

async function setup({ plan = validPlan, failure, review = { verdict: "pass", findings: [], verificationGaps: [] } } = {}) {
  let saved = clone(roles);
  let sequence = 0;
  const requests = []; const operations = []; const outcomes = new Map();
  const api = {
    plugin: { getSettings: async () => clone(saved), setSettings: async (value) => { saved = { ...saved, ...clone(value) }; } },
    models: { list: async () => clone(catalog) },
    agent: { complete: async (input) => {
      requests.push(clone(input));
      assert.ok(saved.jobRecords.at(-1).calls.total > 0, "persist reservation before paid boundary");
      if (failure) throw new Error(failure);
      return { text: input.modelKey === roles.decision ? JSON.stringify(plan) : input.modelKey === roles.review ? JSON.stringify(review) : "Final answer with recorded verification.", usage: { inputTokens: 20, outputTokens: 10, totalTokens: 30 } };
    } },
    desktop: { invoke: async ({ operation, args: [input] }) => {
      operations.push({ operation, input: clone(input) });
      if (operation.endsWith("/spawn")) {
        const sessionId = `worker-${++sequence}`; const messageId = `delivery-${sequence}`;
        outcomes.set(messageId, { id: messageId, targetSessionId: sessionId, status: "running" });
        return { sessionId, messageId, status: "running" };
      }
      if (operation.endsWith("/result")) return { ready: outcomes.get(input.messageId)?.status !== "running", message: outcomes.get(input.messageId) };
      if (operation.endsWith("/cancel")) return { sessionId: input.sessionId, cancelled: true, sessionRetained: true };
      throw new Error("Unexpected host operation");
    } },
  };
  const engine = new HaoEngine(api, { now: () => 100, id: () => "job-1" }); await engine.load();
  const start = (extra = {}) => engine.execute({ action: "start", request: "Fix the parser and test it.", kind: "coding", ...extra }, ctx);
  const advance = () => engine.execute({ action: "advance", jobId: "job-1" }, ctx);
  const finish = () => { for (const value of outcomes.values()) Object.assign(value, { status: "completed", result: "Changed parser.js; ran node --test; all three tests passed." }); };
  return { engine, api, start, advance, finish, requests, operations, outcomes, saved: () => clone(saved) };
}

test("user path: start, inspect plan, dispatch, exact delivery, review and text", async () => {
  const f = await setup();
  assert.equal((await f.start()).status, "ready");
  assert.equal(f.operations.length, 0, "planning never executes work");
  assert.equal((await f.advance()).status, "running");
  f.finish(); const done = await f.advance();
  assert.equal(done.status, "completed");
  assert.deepEqual(f.requests.map((request) => request.modelKey), [roles.decision, roles.review, roles.text]);
  assert.equal(f.requests[0].thinkingLevel, "low");
  assert.ok(f.requests.every((request) => request.includeSessionContext === false));
  assert.equal(done.telemetry.length, 3);
  const spawn = f.operations.find((operation) => operation.operation.endsWith("/spawn"));
  assert.equal(spawn.input.modelKey, roles.execution);
  assert.equal(spawn.input.idempotencyKey, "hao:job-1:implement");
  assert.equal((await f.advance()).calls.total, 3);
});

test("text path does not spend an Astra decision or spawn a worker", async () => {
  const f = await setup(); const result = await f.start({ kind: "text" });
  assert.equal(result.status, "completed"); assert.equal(result.calls.decision, 0);
  assert.deepEqual(f.requests.map((r) => r.modelKey), [roles.text]); assert.equal(f.operations.length, 0);
});

test("duplicate requests reuse the durable job without another billed request", async () => {
  const f = await setup(); const first = await f.start(); const second = await f.start();
  assert.equal(first.id, second.id); assert.equal(f.requests.length, 1);
});

test("failed decision reserves quota and stays paused without retry", async () => {
  const f = await setup({ failure: "PROVIDER_RATE_LIMITED" });
  assert.equal((await f.start()).status, "paused");
  await f.start(); await f.advance();
  assert.equal(f.requests.length, 1); assert.equal(f.saved().jobRecords[0].calls.decision, 1);
});

test("malformed or cyclic plans stop before worker creation", async () => {
  const f = await setup({ plan: { summary: "Bad", tasks: [{ id: "a", task: "Task", dependsOn: ["b"], writes: true }, { id: "b", task: "Task", dependsOn: ["a"], writes: false }] } });
  assert.equal((await f.start()).status, "paused"); assert.equal(f.operations.length, 0);
});

test("writer tasks serialize and cannot overlap active readers", () => {
  const tasks = [{ id: "a", status: "pending", writes: true, dependsOn: [] }, { id: "b", status: "pending", writes: true, dependsOn: [] }];
  assert.deepEqual(readyTasks(tasks).map((t) => t.id), ["a"]);
  tasks[0].status = "running"; assert.deepEqual(readyTasks(tasks), []);
  tasks[0].writes = false; assert.deepEqual(readyTasks(tasks), []);
});

test("ready read-only tasks are bounded and dependency ordered", () => {
  const tasks = [{ id: "a", status: "pending", writes: false, dependsOn: [] }, { id: "b", status: "pending", writes: false, dependsOn: [] }, { id: "c", status: "pending", writes: false, dependsOn: ["a"] }];
  assert.deepEqual(readyTasks(tasks).map((t) => t.id), ["a", "b"]);
  tasks[0].status = "completed"; tasks[1].status = "running";
  assert.deepEqual(readyTasks(tasks).map((t) => t.id), ["c"]);
});

test("dependent worker receives bounded prerequisite evidence only after completion", async () => {
  const f = await setup({ plan: { summary: "Two dependent tasks", tasks: [...validPlan.tasks, { id: "verify", task: "Read the changed parser and verify the evidence.", dependsOn: ["implement"], writes: false }] } });
  await f.start(); await f.advance();
  assert.equal(f.operations.filter((o) => o.operation.endsWith("/spawn")).length, 1);
  f.finish(); await f.advance();
  const spawns = f.operations.filter((o) => o.operation.endsWith("/spawn"));
  assert.equal(spawns.length, 2); assert.match(spawns[1].input.task, /all three tests passed/);
});

test("another parent session cannot access or cancel a job", async () => {
  const f = await setup(); await f.start();
  await assert.rejects(f.engine.execute({ action: "cancel", jobId: "job-1" }, { ...ctx, sessionId: "different" }), /JOB_NOT_FOUND/);
});

test("known worker sessions cannot recursively start orchestration", async () => {
  const f = await setup(); await f.start(); await f.advance();
  await assert.rejects(f.engine.execute({ action: "start", kind: "coding", request: "Spawn more" }, { ...ctx, sessionId: "worker-1" }), /WORKER_RECURSION/);
});

test("cancellation targets exact delivery and preserves its session", async () => {
  const f = await setup(); await f.start(); await f.advance();
  const result = await f.engine.execute({ action: "cancel", jobId: "job-1" }, ctx);
  assert.equal(result.status, "cancelled");
  const cancel = f.operations.find((o) => o.operation.endsWith("/cancel"));
  assert.deepEqual(cancel.input, { sessionId: "worker-1", messageId: "delivery-1" });
  assert.equal(f.requests.length, 1);
});

test("failed workers pause instead of auto retrying or reviewing a failure as success", async () => {
  const f = await setup(); await f.start(); await f.advance();
  Object.assign(f.outcomes.get("delivery-1"), { status: "failed", error: "tests failed" });
  assert.equal((await f.advance()).status, "paused"); assert.equal(f.requests.length, 1);
});

test("review findings or verification gaps prevent a success summary", async () => {
  for (const review of [
    { verdict: "pass", findings: [], verificationGaps: ["No runtime evidence"] },
    { verdict: "pass", findings: ["A regression remains"], verificationGaps: [] },
  ]) {
    const f = await setup({ review });
    await f.start(); await f.advance(); f.finish();
    assert.equal((await f.advance()).status, "changes_requested");
    assert.deepEqual(f.requests.map((r) => r.modelKey), [roles.decision, roles.review]);
  }
});

test("malformed review evidence pauses without producing a success summary", async () => {
  const f = await setup({ review: { verdict: "pass", findings: [{}], verificationGaps: [] } });
  await f.start(); await f.advance(); f.finish();
  const result = await f.advance();
  assert.equal(result.status, "paused"); assert.match(result.error, /INVALID_REVIEW/);
  assert.equal(f.requests.length, 2);
});

test("restart recovers running sessions without respawning them", async () => {
  const f = await setup(); await f.start(); await f.advance();
  const resumed = new HaoEngine(f.api); await resumed.load(); f.finish();
  assert.equal((await resumed.execute({ action: "advance", jobId: "job-1" }, ctx)).status, "completed");
  assert.equal(f.operations.filter((o) => o.operation.endsWith("/spawn")).length, 1);
});

test("restart during billed decision pauses instead of billing twice", async () => {
  const f = await setup(); await f.start();
  const saved = f.saved(); saved.jobRecords[0].status = "planning"; await f.api.plugin.setSettings(saved);
  const resumed = new HaoEngine(f.api); await resumed.load();
  assert.equal((await resumed.execute({ action: "advance", jobId: "job-1" }, ctx)).status, "paused");
  assert.equal(f.requests.length, 1);
});

test("oversized context is rejected before consuming quota", async () => {
  const f = await setup(); await assert.rejects(f.start({ context: "x".repeat(6001) }), /TOO_LARGE/);
  assert.equal(f.requests.length, 0);
});

test("plan-mode and aborted calls cannot dispatch", async () => {
  const f = await setup(); await assert.rejects(f.engine.execute({ action: "start" }, { ...ctx, mode: "plan" }), /AGENT_SESSION/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(f.engine.execute({ action: "start" }, { ...ctx, signal: controller.signal }), /CANCELLED/);
  assert.equal(f.operations.length, 0);
});

test("unrelated or stale host deliveries are rejected", async () => {
  const f = await setup(); await f.start(); await f.advance(); f.finish();
  f.outcomes.get("delivery-1").id = "other-delivery";
  await assert.rejects(f.advance(), /DELIVERY_MISMATCH/);
});

test("catalog suggestions use only connected models and never invent IDs", () => {
  assert.deepEqual(suggestModels(catalog), roles);
  assert.equal(suggestModels(catalog.slice(1)).decision, "");
  assert.throws(() => resolveRoles({ ...roles, decision: roles.review }, catalog), /DECISION_MODEL/);
  const disabled = clone(catalog); disabled[1].availableForSubagents = false;
  assert.throws(() => resolveRoles(roles, disabled), /OPT_IN/);
});

test("manifest and registered tool share the exact schema and least-privilege surface", () => {
  assert.deepEqual(manifest.contributes.agentTools[0].schema, TOOL.schema);
  assert.ok(!manifest.permissions.includes("net.fetch"));
  assert.ok(!manifest.permissions.includes("session.read"));
  assert.ok(!manifest.permissions.includes("fs.write"));
});

test("validation rejects duplicate task IDs and invalid dependency targets", () => {
  assert.throws(() => parsePlan(JSON.stringify({ ...validPlan, tasks: [validPlan.tasks[0], validPlan.tasks[0]] })), /DUPLICATE/);
  assert.throws(() => parsePlan(JSON.stringify({ ...validPlan, tasks: [{ ...validPlan.tasks[0], dependsOn: ["missing"] }] })), /DEPENDENCY/);
});
