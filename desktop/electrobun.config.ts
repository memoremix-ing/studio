import type { ElectrobunConfig } from "electrobun";

const engine = {
  bundleCEF: false,
  chromiumFlags: { "remote-debugging-port": false },
};

export default {
  app: {
    name: "Memoremix Studio",
    identifier: "com.memoremix.studio",
    version: "0.1.0",
    description: "A workspace for remixers",
  },
  build: {
    mainProcess: "rust",
    rust: { version: "1.92.0", manifest: "Cargo.toml", binary: "main" },
    copy: {
      "web/index.html": "views/studio/index.html",
      "web/app.js": "views/studio/app.js",
      "web/style.css": "views/studio/style.css",
    },
    mac: engine,
    linux: engine,
    win: engine,
  },
  runtime: { exitOnLastWindowClosed: true },
} satisfies ElectrobunConfig;
