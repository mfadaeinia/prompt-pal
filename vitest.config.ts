import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\//, replacement: path.resolve(__dirname, "./src/") + "/" },
    ],
  },
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      thresholds: {
        statements: 20,
        branches: 13,
        functions: 22,
        lines: 20,
      },
      exclude: [
        "node_modules/**",
        "src/routeTree.gen.ts",
        "**/*.d.ts",
        "**/*.test.ts",
        "**/*.test.tsx",
        "**/*.config.*",
      ],
    },
  },
});
