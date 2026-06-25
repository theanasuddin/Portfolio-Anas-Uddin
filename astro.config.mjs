import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import vercel from "@astrojs/vercel/serverless";

// https://astro.build/config
export default defineConfig({
  // Static-first: every page is prerendered by default. Only routes that opt out
  // with `export const prerender = false` (the /api/credits.json endpoint) run as
  // Vercel serverless functions.
  output: "hybrid",
  adapter: vercel(),
  integrations: [tailwind()],
});
