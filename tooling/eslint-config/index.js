import { builtinModules } from "node:module";

import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import { defineConfig } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import tseslint from "typescript-eslint";

const SERVER_LIBRARIES = ["mongoose", "bullmq", "ioredis", "jsonwebtoken"];
const WORKER_PROCESSORS = ["ingest", "transcode", "ai", "maintenance"];
const SOURCE_FILES = ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"];

/**
 * @typedef {object} SivEslintOptions
 * @property {string} tsconfigRootDir Directory of the workspace (pass `import.meta.dirname`).
 * @property {"node" | "web"} [kind] Workspace kind. Defaults to "node".
 * @property {string[]} [envFiles] Globs of designated environment modules allowed to read `process.env`.
 * @property {boolean} [browserSafe] Forbid Node built-ins, server libraries and other workspace packages.
 * @property {boolean} [pipelinePayloadsOnly] Allow only `@siv/pipeline/payloads`, not the main entry.
 * @property {boolean} [s3Sdk] Allow the AWS S3 SDK (only `@siv/storage`).
 * @property {boolean} [workerProcessors] Forbid imports between worker processors.
 */

/**
 * @param {SivEslintOptions} options
 * @param {object[]} extraPatterns
 */
function restrictedImports(options, extraPatterns = []) {
  const paths = [];
  const patterns = [];

  if (!options.s3Sdk) {
    patterns.push({
      group: ["@aws-sdk/*"],
      message: "Only @siv/storage may use the AWS S3 SDK.",
    });
  }

  if (options.pipelinePayloadsOnly) {
    paths.push({
      name: "@siv/pipeline",
      message: "Domain packages may import only @siv/pipeline/payloads.",
    });
  }

  if (options.browserSafe) {
    const message = "@siv/contracts must stay browser-safe.";
    paths.push(
      ...builtinModules.map((name) => ({ name, message })),
      ...SERVER_LIBRARIES.map((name) => ({ name, message })),
    );
    patterns.push(
      { group: ["node:*"], message },
      {
        group: ["@siv/*"],
        message: "@siv/contracts must not depend on other workspace packages.",
      },
    );
  }

  if (options.kind === "web") {
    const message =
      "apps/web may import only @siv/contracts and no server-only libraries.";
    paths.push(...SERVER_LIBRARIES.map((name) => ({ name, message })));
    patterns.push({ group: ["@siv/*", "!@siv/contracts"], message });
  }

  patterns.push(...extraPatterns);

  return ["error", { paths, patterns }];
}

/**
 * @param {SivEslintOptions} options
 */
export function createConfig(options) {
  const resolved = { kind: "node", envFiles: [], ...options };

  const processorBoundaries = resolved.workerProcessors
    ? WORKER_PROCESSORS.map((processor) => {
        const others = WORKER_PROCESSORS.filter(
          (other) => other !== processor,
        ).join("|");
        return {
          files: SOURCE_FILES.map((glob) => `processors/${processor}/${glob}`),
          rules: {
            "no-restricted-imports": restrictedImports(resolved, [
              {
                regex: `^\\.{1,2}/(?:.*/)?(?:${others})(?:/|$)`,
                message:
                  "Worker processors must not import other processors. Share code through core/ or packages.",
              },
            ]),
          },
        };
      })
    : [];

  return defineConfig(
    {
      ignores: [
        "**/dist/**",
        "**/.next/**",
        "**/.turbo/**",
        "**/next-env.d.ts",
      ],
    },
    { linterOptions: { reportUnusedDisableDirectives: "error" } },
    js.configs.recommended,
    tseslint.configs.strictTypeChecked,
    {
      languageOptions: {
        parserOptions: {
          projectService: true,
          tsconfigRootDir: resolved.tsconfigRootDir,
        },
      },
      plugins: { "simple-import-sort": simpleImportSort },
      rules: {
        "simple-import-sort/imports": "error",
        "simple-import-sort/exports": "error",
        eqeqeq: ["error", "always"],
        "@typescript-eslint/switch-exhaustiveness-check": "error",
        "@typescript-eslint/no-unused-vars": [
          "error",
          {
            argsIgnorePattern: "^_",
            varsIgnorePattern: "^_",
            caughtErrorsIgnorePattern: "^_",
          },
        ],
      },
    },
    {
      files: SOURCE_FILES,
      rules: {
        "no-restricted-imports": restrictedImports(resolved),
        "no-restricted-properties": [
          "error",
          {
            object: "process",
            property: "env",
            message:
              "Read process.env only inside a designated environment module.",
          },
        ],
        ...(resolved.kind === "node" ? { "no-console": "error" } : {}),
      },
    },
    processorBoundaries,
    resolved.envFiles.length > 0
      ? [
          {
            files: resolved.envFiles,
            rules: { "no-restricted-properties": "off" },
          },
        ]
      : [],
    resolved.kind === "web"
      ? [
          {
            files: SOURCE_FILES,
            plugins: { "@next/next": nextPlugin, "react-hooks": reactHooks },
            rules: {
              ...nextPlugin.configs.recommended.rules,
              ...nextPlugin.configs["core-web-vitals"].rules,
              // App Router only: this rule targets the Pages Router.
              "@next/next/no-html-link-for-pages": "off",
              ...reactHooks.configs.recommended.rules,
            },
          },
        ]
      : [],
    {
      files: ["**/*.js", "**/*.mjs", "**/*.cjs"],
      ...tseslint.configs.disableTypeChecked,
    },
  );
}
