/* eslint-env node */
require("@rushstack/eslint-patch/modern-module-resolution");

module.exports = {
  root: true,
  env: {
    node: true,
    browser: true,
    es2022: true,
  },
  extends: [
    "plugin:vue/vue3-essential",
    "eslint:recommended",
    "@vue/eslint-config-typescript",
    "@vue/eslint-config-prettier",
  ],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  overrides: [
    {
      files: ["*.vue"],
      parser: "vue-eslint-parser",
      parserOptions: {
        parser: "@typescript-eslint/parser",
        extraFileExtensions: [".vue"],
      },
    },
    {
      files: ["*.ts", "*.tsx"],
      parser: "@typescript-eslint/parser",
    },
    {
      files: ["*.js", "*.cjs", "*.mjs"],
      env: {
        node: true,
      },
    },
  ],
  rules: {
    "no-console": "off",
    "no-debugger": "warn",
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    "vue/multi-word-component-names": "off",
    "vue/no-unused-vars": "warn",
  },
  ignorePatterns: [
    "dist",
    "node_modules",
    "target",
    "*.d.ts",
    "public/auth.js",
    "generate-wallets.js",
  ],
};
