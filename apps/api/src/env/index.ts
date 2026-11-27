import { LOG_LEVELS } from "@siv/shared";
import { z } from "zod";

const ApiEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  LOG_LEVEL: z.enum(LOG_LEVELS).default("info"),
});

export type ApiEnv = Readonly<z.infer<typeof ApiEnvSchema>>;

/** Parses the API environment once. Errors list variable names only, never values. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): ApiEnv {
  const result = ApiEnvSchema.safeParse(source);
  if (!result.success) {
    const names = [
      ...new Set(result.error.issues.map((issue) => String(issue.path[0]))),
    ];
    throw new Error(`Invalid API environment variables: ${names.join(", ")}`);
  }
  return Object.freeze(result.data);
}
