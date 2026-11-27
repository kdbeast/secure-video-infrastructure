import { LogLevelSchema, NodeEnvSchema, parseEnv } from "@siv/shared";
import { z } from "zod";

const ApiEnvSchema = z.object({
  NODE_ENV: NodeEnvSchema,
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  LOG_LEVEL: LogLevelSchema,
});

export type ApiEnv = Readonly<z.infer<typeof ApiEnvSchema>>;

/** Parses the API environment once. Errors list variable names only, never values. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): ApiEnv {
  return parseEnv("API", ApiEnvSchema, source);
}
