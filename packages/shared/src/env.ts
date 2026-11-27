import { z } from "zod";

import { LOG_LEVELS } from "./logger.js";

export const NodeEnvSchema = z
  .enum(["development", "production", "test"])
  .default("development");

export const LogLevelSchema = z.enum(LOG_LEVELS).default("info");

/** Thrown when environment validation fails. Carries variable names only, never values. */
export class EnvValidationError extends Error {
  readonly variables: readonly string[];

  constructor(app: string, variables: readonly string[]) {
    super(`Invalid ${app} environment variables: ${variables.join(", ")}`);
    this.name = "EnvValidationError";
    this.variables = variables;
  }
}

/**
 * Parses an environment source (normally `process.env`, passed in by the app) with `schema`.
 * Returns a frozen result. On failure, throws an EnvValidationError naming the invalid variables.
 */
export function parseEnv<T extends z.ZodType>(
  app: string,
  schema: T,
  source: Readonly<Record<string, string | undefined>>,
): Readonly<z.output<T>> {
  const result = schema.safeParse(source);
  if (!result.success) {
    const variables = [
      ...new Set(result.error.issues.map((issue) => String(issue.path[0]))),
    ];
    throw new EnvValidationError(app, variables);
  }
  return Object.freeze(result.data);
}
