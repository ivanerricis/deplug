import { defineConfig, configDefaults } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Keep tests scoped to the app sources: agent worktrees and the docs site
// live inside the repo folder and must not be picked up.
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    exclude: [...configDefaults.exclude, ".claude/**", "docs/**"],
  },
});
