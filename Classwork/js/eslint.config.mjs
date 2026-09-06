import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";

export default defineConfig([
  { files: ["**/*.{js,mjs,cjs}"], plugins: { js }, extends: ["js/recommended"], languageOptions: { globals: globals.browser } },
  { files: ["**/*.js"], languageOptions: { sourceType: "module", ecmaVersion: "latest" } },
  {
    rules: {
      semi: "error",
      "prefer-const": "error",
      "quotes": ["error", "single"],
      "no-var": "error",
      eqeqeq: ["error", "always", { null: "ignore" }]
    },
  }
]);
