import js from "@eslint/js";
import ts from "typescript-eslint";
import svelte from "eslint-plugin-svelte";
import unusedImports from "eslint-plugin-unused-imports";
import globals from "globals";

export default ts.config(
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs["flat/recommended"],
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    files: ["**/*.svelte"],
    languageOptions: {
      parserOptions: {
        parser: ts.parser,
      },
    },
  },
  {
    plugins: {
      "unused-imports": unusedImports,
    },
    rules: {
      "no-multi-spaces": [
        2,
        {
          ignoreEOLComments: true,
        },
      ],
      "unused-imports/no-unused-imports": "error",
      "svelte/no-navigation-without-resolve": "off",
    },
  },
  {
    ignores: [
      "build/",
      ".svelte-kit/",
      ".next/",
      "dist/",
      "out/",
      "node_modules/",
      "worker/",
      "playwright-report/",
    ],
  },
);
