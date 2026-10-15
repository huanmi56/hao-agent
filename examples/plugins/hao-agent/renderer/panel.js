"use strict";

const roleNames = ["decision", "execution", "review", "text"];
let state;
let strings = window.HAO_MESSAGES.en;
const bridge = window.pluginBridge;
const status = document.getElementById("status");
function localize(locale) {
  strings = window.HAO_MESSAGES[locale?.startsWith("zh") ? "zh" : "en"];
  document.documentElement.lang = locale?.startsWith("zh") ? "zh-CN" : "en";
  for (const node of document.querySelectorAll("[data-i18n]")) node.textContent = strings[node.dataset.i18n];
}
function renderRoles(values) {
  const root = document.getElementById("roles"); root.replaceChildren();
  for (const role of roleNames) {
    const label = document.createElement("label"); label.textContent = strings[role];
    const select = document.createElement("select"); select.name = role; select.required = true;
    const empty = document.createElement("option"); empty.value = ""; empty.textContent = strings.select; select.append(empty);
    for (const model of state.models) {
      const option = document.createElement("option"); option.value = model.key;
      option.textContent = `${model.providerName} · ${model.alias || model.label || model.modelId}`;
      select.append(option);
    }
    select.value = values[role] ?? ""; label.append(select); root.append(label);
  }
}
async function refresh() {
  if (!bridge?.invoke) {
    localize(navigator.language);
    status.textContent = strings.offline;
    for (const node of document.querySelectorAll("button")) node.disabled = true;
    return;
  }
  state = await bridge.invoke("hao.state"); localize(state.locale); renderRoles(state.roles);
  const root = document.getElementById("jobs"); root.replaceChildren();
  if (!state.models.length) status.textContent = strings.missing;
  if (!state.jobs.length) root.textContent = strings.empty;
  for (const job of state.jobs.slice().reverse()) {
    const card = document.createElement("div"); card.className = "job";
    const title = document.createElement("strong"); title.textContent = job.summary;
    const detail = document.createElement("small"); detail.textContent = `${job.status} · ${strings.calls}: ${job.calls.total} · Astra: ${job.calls.decision}`;
    card.append(title, detail);
    if (job.error) { const error = document.createElement("p"); error.className = "error"; error.textContent = job.error; card.append(error); }
    root.append(card);
  }
}
document.getElementById("assignments").addEventListener("submit", async (event) => {
  event.preventDefault(); const button = event.submitter; button.disabled = true;
  try { await bridge.invoke("hao.save", Object.fromEntries(new FormData(event.currentTarget))); status.textContent = strings.saved; }
  catch (error) { status.textContent = String(error.message ?? error); }
  finally { button.disabled = false; }
});
document.getElementById("suggest").addEventListener("click", () => renderRoles(state.suggestions));
document.getElementById("refresh").addEventListener("click", () => refresh().catch((error) => { status.textContent = error.message; }));
bridge?.on?.("appearance:changed", (appearance) => { document.documentElement.dataset.base = appearance.base; });
if (bridge?.invoke) bridge.invoke("app.getAppearance").then((appearance) => { document.documentElement.dataset.base = appearance.base; }).catch(() => {});
refresh().catch((error) => { localize(navigator.language); status.textContent = error.message; });
