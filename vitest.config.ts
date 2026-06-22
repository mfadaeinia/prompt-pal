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
        statements: 55,
        branches: 45,
        functions: 50,
        lines: 55,
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
