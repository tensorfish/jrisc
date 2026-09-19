import { copyFile, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url));
const output = join(root, "dist");
// Explicit browser-only manifest: never include the proxy, credentials or artifacts.
const files = {
  "public/index.html": "index.html",
  "public/app.js": "app.js",
  "public/style.css": "style.css",
  "lib/vm.js": "lib/vm.js",
  "lib/semantic.js": "lib/semantic.js",
  "docs/isa.md": "docs/isa.md",
};
await rm(output, { recursive: true, force: true });
for (const [source, destination] of Object.entries(files)) {
  const target = join(output, destination);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(join(root, source), target);
}
console.log(`Built ${Object.keys(files).length} static files in dist/`);
