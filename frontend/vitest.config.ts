import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  // Resolve the same "@/..." alias your app uses (tsconfig paths).
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    coverage: {
      enabled: true,
      provider: "v8",
      reporter: ["text", "html"],
      reportsDirectory: "./coverage",
      reportOnFailure: true,
      // Only measure code with real LOGIC.
      include: ["src/lib/**", "src/hooks/**", "src/types/**"],
      exclude: [
        "**/*.test.*",
        // static data / reference tables — no logic to test
        "src/lib/mock/**",
        "src/lib/api/**",
        "src/lib/circuits.ts",
        // pure type definitions + static registries (no branching logic)
        "src/types/assistant.ts",
        "src/types/baseball.ts",
        "src/types/basketball.ts",
        "src/types/f1.ts",
        "src/types/f1-race.ts",
        "src/types/lineup.ts",
        "src/types/radio.ts",
        "src/types/worldcup.ts",
        // NOTE: football.ts stays IN scope — it has classifyStatus/statusLabel logic.
      ],
    },
  },
});