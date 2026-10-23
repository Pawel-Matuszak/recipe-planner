import { spawnSync } from "node:child_process";
import { createSerwistRoute } from "@serwist/turbopack";

// the app shell is one page, so precaching "/" makes the whole app open offline
const revision = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).stdout?.trim() || crypto.randomUUID();

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute({
  additionalPrecacheEntries: [{ url: "/", revision }],
  swSrc: "src/app/sw.ts",
  useNativeEsbuild: true,
});
