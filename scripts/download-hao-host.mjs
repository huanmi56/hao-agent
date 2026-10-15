import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { access, mkdir, rename } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distribution = join(root, "distribution");
const archive = join(distribution, "downloads/PI-Desktop-Portable-0.20.1.zip");
const destination = join(distribution, "pi-desktop");
const executable = join(destination, "PI-Desktop.exe");
const digest = "a23f22195dbd3dcd64b152ed2f1f081f59eda4c2ebec9269d65f037fe352669a";
const url = "https://github.com/vastsa/PI-Desktop/releases/download/v0.20.1/PI-Desktop-Portable-0.20.1.zip";
if (process.platform !== "win32" || process.arch !== "x64") throw new Error("This helper requires Windows x64.");
await mkdir(dirname(archive), { recursive: true });
const exists = async (path) => { try { await access(path); return true; } catch { return false; } };
if (!await exists(archive)) {
  console.log("Downloading the pinned official portable host to distribution/downloads...");
  const response = await fetch(url, { signal: AbortSignal.timeout(600000) });
  if (!response.ok || !response.body) throw new Error(`Download failed: HTTP ${response.status}`);
  const partial = archive + ".partial";
  await pipeline(Readable.fromWeb(response.body), createWriteStream(partial));
  await rename(partial, archive);
}
const hash = createHash("sha256");
for await (const chunk of createReadStream(archive)) hash.update(chunk);
assert.equal(hash.digest("hex"), digest, "Host archive SHA-256 mismatch; extraction refused");
console.log("Official host archive SHA-256 verified.");
if (await exists(executable)) {
  console.log("Portable host already exists; its files were left unchanged.");
  process.exit(0);
}
if (await exists(destination)) throw new Error("Destination already exists without the executable; inspect it before extracting.");
const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
  "Expand-Archive -LiteralPath $env:HAO_HOST_ARCHIVE -DestinationPath $env:HAO_HOST_DESTINATION"], {
  windowsHide: true, stdio: "inherit",
  env: { ...process.env, HAO_HOST_ARCHIVE: archive, HAO_HOST_DESTINATION: destination },
});
await new Promise((resolveChild, reject) => {
  child.once("error", reject);
  child.once("exit", (code) => code === 0 ? resolveChild() : reject(new Error(`Extraction failed: ${code}`)));
});
assert.ok(await exists(executable), "Expected executable missing after extraction");
console.log("Portable host ready. Close the desktop before running scripts/install-hao-agent.mjs.");
