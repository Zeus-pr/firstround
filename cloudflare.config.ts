import { bindings, defineConfig, defineWorker } from "cf/config";

export default defineConfig({
  accountId: "e1e2ce8ab37dba30e2fed136e733d405",
  worker: defineWorker({
    name: "firstround",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-11-07",
    compatibilityFlags: ["nodejs_compat"],
    workersDev: false,
    previewUrls: false,
    domains: ["firstround.space", "www.firstround.space"],
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    env: {
      ASSETS: bindings.assets(),
    },
  }),
});
