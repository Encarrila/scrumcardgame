import { defineConfig } from "vite";
import { copyFileSync } from "node:fs";
import { resolve } from "node:path";

function copyLegacyScripts() {
  return {
    name: "copy-legacy-scripts",
    closeBundle() {
      for (const fileName of ["game.js", "game-data.js"]) {
        copyFileSync(resolve(fileName), resolve("dist", fileName));
      }
    }
  };
}

export default defineConfig({
  base: "/scrumcardgame/",
  plugins: [copyLegacyScripts()]
});
