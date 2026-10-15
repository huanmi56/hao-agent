import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

// Supply a preinstalled Playwright module and browser; never download to C.
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.HAO_PLAYWRIGHT_PATH || "playwright");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pageUrl = pathToFileURL(join(root, "examples/plugins/hao-agent/renderer/index.html")).href;

test("rendered panel saves assignments, disables offline preview and fits mobile", { timeout: 30000 }, async (t) => {
  const output = join(root, "distribution/panel-tests"); await mkdir(output, { recursive: true });
  const profile = await mkdtemp(join(output, "profile-"));
  const browser = await chromium.launchPersistentContext(profile, {
    headless: true, executablePath: process.env.HAO_BROWSER_PATH || undefined,
    viewport: { width: 1050, height: 950 }, locale: "zh-CN",
    env: { ...process.env, TEMP: output, TMP: output },
  });
  t.after(() => browser.close());
  const page = await browser.newPage(); const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const ids = ["gpt-6-astra", "kimi-k2.7-code", "glm-5.3", "qwen3.8-flash"];
    const roles = ["decision", "execution", "review", "text"];
    const models = ids.map((id, i) => ({ key: id, modelId: id, label: id, providerName: i ? "OpenCode Go" : "ChatGPT" }));
    window.testSaves = [];
    window.pluginBridge = { on() {}, async invoke(channel, payload) {
      if (channel === "app.getAppearance") return { base: "dark" };
      if (channel === "hao.state") return { locale: "zh-CN", models, roles: {}, suggestions: Object.fromEntries(roles.map((role, i) => [role, ids[i]])), jobs: [] };
      if (channel === "hao.save") { window.testSaves.push(payload); return { saved: true }; }
      throw new Error(`Unexpected panel channel: ${channel}`);
    } };
  });
  await page.goto(pageUrl);
  await page.getByRole("button", { name: "推荐已连接模型" }).click();
  assert.equal(await page.locator('select[name="decision"]').inputValue(), "gpt-6-astra");
  await page.getByRole("button", { name: "保存分工" }).click();
  await page.getByText("模型分工已保存。", { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.testSaves.length), 1);
  assert.deepEqual(errors, []);
  const fits = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  assert.equal(await fits(), true);
  await page.screenshot({ path: join(output, "hao-agent-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { document.documentElement.dataset.base = "light"; });
  assert.equal(await fits(), true);
  await page.screenshot({ path: join(output, "hao-agent-mobile.png"), fullPage: true });
  const offline = await browser.newPage(); await offline.goto(pageUrl);
  await offline.getByText("当前仅为预览；请在 PI-Desktop 中打开本面板来配置模型。", { exact: true }).waitFor();
  assert.equal(await offline.locator("button:enabled").count(), 0);
});
