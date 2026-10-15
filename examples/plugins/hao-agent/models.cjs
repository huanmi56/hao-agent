"use strict";

const ROLES = ["decision", "execution", "review", "text"];
const PREFERENCES = {
  decision: ["gpt-6-astra"],
  execution: ["kimi-k2.7-code", "kimi-k2.6", "glm-5.3", "minimax-m3"],
  review: ["glm-5.3", "deepseek-v4-pro", "kimi-k2.7-code"],
  text: ["qwen3.8-flash", "deepseek-v4.1-flash", "mimo-v2.5"],
};

function isGo(model) {
  return /opencode.?go/i.test(`${model.providerId} ${model.providerName}`);
}

function suggestModels(catalog) {
  return Object.fromEntries(ROLES.map((role) => {
    const candidates = catalog.filter((model) => role === "decision" || isGo(model));
    const match = PREFERENCES[role].map((id) => candidates.find((model) => model.modelId === id)).find(Boolean);
    return [role, match?.key ?? ""];
  }));
}

function resolveRoles(config, catalog) {
  const selected = {};
  for (const role of ROLES) {
    const model = catalog.find((item) => item.key === config[role]);
    if (!model) throw new Error(`MODEL_UNAVAILABLE: configure the ${role} model in Hao Agent.`);
    if (role === "decision" && model.modelId !== "gpt-6-astra") {
      throw new Error("DECISION_MODEL: GPT-6 Astra must be selected explicitly; no silent substitution.");
    }
    if (role !== "decision" && !isGo(model)) throw new Error(`GO_MODEL_REQUIRED: ${role}`);
    if (role === "execution" && !model.availableForSubagents) {
      throw new Error("MODEL_OPT_IN_REQUIRED: enable the execution model for delegation in Models settings.");
    }
    selected[role] = model;
  }
  return selected;
}

function reasoning(model, preferred = "low") {
  return model.thinkingLevels?.includes(preferred) ? { thinkingLevel: preferred } : {};
}

module.exports = { ROLES, PREFERENCES, suggestModels, resolveRoles, reasoning };
