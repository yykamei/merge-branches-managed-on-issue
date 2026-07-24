import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    clearMocks: true,
    include: ["__tests__/**/*.ts"],
    coverage: {
      enabled: true,
      provider: "v8",
      include: ["src/**/*.ts"],
      reportsDirectory: "coverage",
    },
    server: {
      deps: {
        inline: ["@actions/core", "@actions/github"],
      },
    },
  },
})
