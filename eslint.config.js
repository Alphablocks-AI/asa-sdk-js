import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default [
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "no-unused-vars": "error",
      "no-undef": "error",
    },
  },
  {
    ignores: ["dist/", "types/", "coverage/"],
  },
  {
    languageOptions: {
      globals: {
        ...globals.jest,
        ...globals.browser,
      },
    },
  },
];
