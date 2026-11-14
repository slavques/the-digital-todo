import { cp, mkdir, rm, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const output = new URL("site/", root);

await rm(output, { recursive: true, force: true });
await mkdir(output);

for (const file of [
  "index.html",
  "styles.css",
  "tokens.css",
  "base.css",
  "app.js",
  "motion.js",
  "model.js",
  "theme.js",
]) {
  await cp(new URL(file, root), new URL(file, output));
}

for (const file of ["assets", "favicon.svg"]) {
  try {
    await cp(new URL(file, root), new URL(file, output), { recursive: true });
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

await writeFile(new URL(".nojekyll", output), "");
console.log("Static site is ready in site/.");
