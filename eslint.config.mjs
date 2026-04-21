import path from "node:path";
import { fileURLToPath } from "node:url";

import js from "@eslint/js";
import importPlugin from "eslint-plugin-import";
import jsxA11yPlugin from "eslint-plugin-jsx-a11y";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

const tsconfigRootDir = path.dirname(fileURLToPath(import.meta.url));
const typedLint = process.env["INFRASTRUCTURE_AS_WORDS_ESLINT_TYPED"] === "1";

const baselineRules = {
  "no-debugger": "error",
  "no-eval": "error",
  "no-implied-eval": "error",
  "no-new-func": "error",
  "no-unsafe-finally": "error",
  eqeqeq: ["error", "always", { null: "ignore" }],
  "prefer-const": "error",
  "no-var": "error",
  "@typescript-eslint/no-non-null-assertion": "error",
  "@typescript-eslint/ban-ts-comment": [
    "error",
    {
      "ts-expect-error": true,
      "ts-ignore": true,
      "ts-nocheck": true,
      minimumDescriptionLength: 10
    }
  ],
  "import/no-duplicates": "error"
};

const typedRules = typedLint
  ? {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          ignoreRestSiblings: true
        }
      ],
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": [
        "error",
        {
          checksVoidReturn: {
            attributes: false
          }
        }
      ],
      "@typescript-eslint/no-unsafe-argument": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "error"
    }
  : {};

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/.next/**",
      "**/out/**",
      "**/.cache/**",
      "**/.terraform/**",
      "**/node_modules/**",
      "web/next-env.d.ts",
      "web/next.config.ts",
      "infra/terraform/**/*.js"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node
      }
    }
  },
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    ignores: ["**/*.d.ts"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ...(typedLint
          ? {
              projectService: true,
              tsconfigRootDir
            }
          : { project: false }),
        ecmaFeatures: {
          jsx: true
        }
      },
      globals: {
        ...globals.node
      }
    },
    plugins: {
      import: importPlugin
    },
    rules: {
      ...baselineRules,
      ...typedRules
    }
  },
  {
    files: ["scripts/**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: ["./scripts/tsconfig.json"],
        tsconfigRootDir,
        projectService: false
      }
    }
  },
  {
    files: ["tests/**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: ["./tests/tsconfig.json"],
        tsconfigRootDir,
        projectService: false
      }
    }
  },
  {
    files: ["web/**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        project: ["./web/tsconfig.json"],
        tsconfigRootDir,
        projectService: false
      },
      globals: {
        ...globals.browser
      }
    },
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
      "jsx-a11y": jsxA11yPlugin
    },
    settings: {
      react: {
        version: "detect"
      }
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
      "jsx-a11y/alt-text": "error",
      "react/jsx-key": "error"
    }
  },
  {
    rules: {
      "no-console": "off"
    }
  }
);
