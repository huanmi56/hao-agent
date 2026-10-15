"use strict";

const { HaoEngine } = require("./engine.cjs");
const { ROLES, suggestModels, resolveRoles } = require("./models.cjs");

let engine;
let locale = "en";
const TOOL = {
  name: "hao_task",
  description: "Run Hao Agent's budgeted workflow. start plans a coding task once with Astra (or answers text without Astra). Inspect the plan, then advance dispatches workers and collects their exact delivery results, reviews reports, and formats an answer. status is read-only; cancel retains sessions. No automatic premium retries. Children must not use this tool.",
  risk: "high",
  schema: {
    type: "object", additionalProperties: false,
    properties: {
      action: { type: "string", enum: ["start", "advance", "status", "cancel"] },
      kind: { type: "string", enum: ["coding", "text"] },
      request: { type: "string", maxLength: 12000 },
      context: { type: "string", maxLength: 6000 },
      jobId: { type: "string" },
    },
    required: ["action"],
  },
};

async function onLoad() {
  locale = await pi.app.getLocale();
  engine = new HaoEngine(pi);
  await engine.load();
  await pi.commands.register({
    id: "hao-agent.open", title: locale.startsWith("zh") ? "Hao Agent：模型与调度台" : "Hao Agent: Model Workbench",
    keywords: ["hao", "agent", "models", "budget"],
    run: () => pi.ui.openPanel(),
  });
  await pi.agent.registerTool({ ...TOOL, execute: (args, ctx) => engine.execute(args, ctx) });
}

async function onPanelInvoke(channel, payload) {
  if (channel === "hao.state") {
    const models = await pi.models.list();
    const settings = await pi.plugin.getSettings();
    return {
      locale, models, roles: Object.fromEntries(ROLES.map((role) => [role, settings[role] ?? ""])),
      suggestions: suggestModels(models),
      jobs: engine.jobs.map((job) => ({ id: job.id, status: job.status, summary: job.summary ?? job.request.slice(0, 100), calls: job.calls, telemetry: job.telemetry, error: job.error })),
    };
  }
  if (channel === "hao.save") {
    if (!payload || typeof payload !== "object") throw new Error("INVALID_SETTINGS");
    const roles = Object.fromEntries(ROLES.map((role) => [role, payload[role]]));
    resolveRoles(roles, await pi.models.list());
    await pi.plugin.setSettings(roles);
    return { saved: true };
  }
  throw new Error("UNSUPPORTED_CHANNEL");
}

async function onUnload() {
  engine?.close();
  await pi.agent.unregisterTool("hao_task");
  await pi.commands.unregister("hao-agent.open");
}

module.exports = { onLoad, onUnload, onPanelInvoke, TOOL };
