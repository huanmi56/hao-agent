import { stripTypeScriptTypes } from "node:module";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(root, "distribution", "tools");

// The host toolchain is absent in a fresh clone. Emit the SDK/devkit's own
// dependency-free JS using Node's built-in TypeScript transform, not a second
// application dependency environment. This is packaging, not a typecheck.
for (const [source, destination] of [["packages/plugin-sdk/src", "sdk"], ["packages/plugin-devkit/src", "devkit"]]) {
  const target = join(output, destination);
  await mkdir(target, { recursive: true });
  await writeFile(join(target, "package.json"), JSON.stringify({ type: "module" }));
  for (const entry of await readdir(join(root, source))) {
    if (!entry.endsWith(".ts") || entry.endsWith(".test.ts")) continue;
    let code = await readFile(join(root, source, entry), "utf8");
    if (destination === "devkit") code = code.replaceAll('"@pi-desktop/plugin-sdk"', '"../sdk/index.js"');
    const javascript = stripTypeScriptTypes(code, { mode: "transform" });
    await writeFile(join(target, entry.replace(/\.ts$/, ".js")), javascript);
  }
}
const { pack } = await import(pathToFileURL(join(output, "devkit", "pack.js")));
const packaged = await pack(join(root, "examples", "plugins", "hao-agent"), { outDir: join(root, "distribution") });
await writeFile(join(root, "distribution", "hao-agent-package.json"), JSON.stringify(packaged, null, 2));
console.log(JSON.stringify({ packagePath: packaged.packagePath, fileCount: packaged.fileCount, shasum: packaged.shasum, warnings: packaged.check.warnings }, null, 2));
