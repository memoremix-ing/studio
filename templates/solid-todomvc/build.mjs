import { build, transform } from "esbuild";
import { transformAsync } from "@babel/core";
import solid from "@solidjs/babel-plugin";
import { mkdir, copyFile, writeFile, readFile, unlink } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const template = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || !["--performer", "--app"].includes(args[0]))) {
  throw new Error("Usage: bun build.mjs [--performer /path/to/created/performer]");
}
const app = args.length ? resolve(args[1]) : null;
const source = resolve(app || template, "src");
const out = app || resolve(template, "dist");
await mkdir(out, { recursive: true });
if (!app) {
  for (const file of ["studio.json", "worker.js", "index.html"]) {
    await copyFile(resolve(template, "src", file), resolve(out, file));
  }
  await mkdir(resolve(out, "src"), { recursive: true });
  for (const file of ["main.tsx", "app.tsx", "todos.ts", "filter.ts", "api.ts", "app.css"]) {
    await copyFile(resolve(source, file), resolve(out, "src", file));
  }
  for (const file of ["solid-license.txt", "upstream.json"]) {
    await copyFile(resolve(template, file), resolve(out, file));
  }
  await unlink(resolve(out, "solid.js")).catch(error => { if (error.code !== "ENOENT") throw error; });
}
const result = await build({
  entryPoints: [resolve(source, "main.tsx")], bundle: true, write: false,
  nodePaths: [resolve(template, "node_modules")],
  format: "esm", platform: "browser", conditions: ["browser"], minify: false,
  legalComments: "eof", define: { "process.env.NODE_ENV": '"production"' },
  plugins: [{
    name: "solid-jsx",
    setup(builder) {
      builder.onLoad({ filter: /\.tsx$/ }, async ({ path }) => {
        const ts = await transform(await readFile(path, "utf8"), { loader: "tsx", jsx: "preserve" });
        const jsx = await transformAsync(ts.code, {
          filename: path, babelrc: false, configFile: false,
          plugins: [[solid, { generate: "dom", hydratable: false }]]
        });
        return { contents: jsx.code, loader: "js", resolveDir: dirname(path) };
      });
    }
  }]
});
await writeFile(resolve(out, "client.js"), result.outputFiles[0].contents);
await copyFile(resolve(source, "app.css"), resolve(out, "style.css"));
