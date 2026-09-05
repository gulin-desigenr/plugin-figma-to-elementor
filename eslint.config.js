import js from "@eslint/js";
import globals from "globals";
import prettier from "eslint-config-prettier";

export default [
  {
    ignores: ["node_modules/", "dist/", "extension/dist/", "coverage/"]
  },
  js.configs.recommended,
  {
    files: ["src/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.browser,
        figma: "readonly",
        __html__: "readonly"
      }
    }
  },
  {
    files: ["extension/**/*.js"],
    ignores: ["extension/dist/**"],
    languageOptions: {
      globals: {
        ...globals.browser,
        chrome: "readonly"
      }
    }
  },
  {
    files: ["tests/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.node
      }
    }
  },
  {
    rules: {
      "no-unused-vars": "error",
      "no-undef": "error",
      "prefer-const": "error",
      "no-var": "error",
      eqeqeq: ["error", "always"]
    }
  },
  prettier
];
