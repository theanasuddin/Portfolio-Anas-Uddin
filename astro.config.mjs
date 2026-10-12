import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import vercel from "@astrojs/vercel/serverless";
import { readdir, readFile, writeFile } from "node:fs/promises";

// @astrojs/vercel 7.x (the last release line for Astro 4) only knows Node 18 and
// 20, and labels functions built on any newer Node as "nodejs18.x", a runtime
// Vercel has retired. Once the adapter has written its function configs, point
// them at the Node version that ran the build (24.x on Vercel, per package.json).
function withBuildNodeRuntime(adapter) {
  const { "astro:config:done": configDone, "astro:build:done": buildDone } = adapter.hooks;
  let outDir;
  adapter.hooks["astro:config:done"] = (options) => {
    outDir = options.config.outDir;
    return configDone(options);
  };
  adapter.hooks["astro:build:done"] = async (options) => {
    await buildDone(options);
    const runtime = `nodejs${process.versions.node.split(".")[0]}.x`;
    const functionsDir = new URL("./functions/", outDir);
    for (const name of await readdir(functionsDir).catch(() => [])) {
      if (!name.endsWith(".func")) continue;
      const configFile = new URL(`./${name}/.vc-config.json`, functionsDir);
      const config = JSON.parse(await readFile(configFile, "utf8"));
      if (!config.runtime?.startsWith("nodejs") || config.runtime === runtime) continue;
      await writeFile(configFile, JSON.stringify({ ...config, runtime }, null, "\t"));
      options.logger.info(`Using ${runtime} for ${name} (the adapter picked ${config.runtime}).`);
    }
  };
  return adapter;
}

// https://astro.build/config
export default defineConfig({
  // Static-first: every page is prerendered by default. Only routes that opt out
  // with `export const prerender = false` (the /api/credits.json endpoint) run as
  // Vercel serverless functions.
  output: "hybrid",
  adapter: withBuildNodeRuntime(vercel()),
  integrations: [tailwind()],
});
