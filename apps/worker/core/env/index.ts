import { LOG_LEVELS } from "@siv/shared";
import { z } from "zod";

import { PROCESSOR_NAMES } from "../processor.js";

const WorkerEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  LOG_LEVEL: z.enum(LOG_LEVELS).default("info"),
  WORKER_PROCESSORS: z
    .string()
    .default(PROCESSOR_NAMES.join(","))
    .transform((value) =>
      value
        .split(",")
        .map((name) => name.trim())
        .filter((name) => name.length > 0),
    )
    .pipe(z.array(z.enum(PROCESSOR_NAMES)).min(1))
    .transform((names) => [...new Set(names)]),
});

export type WorkerEnv = Readonly<z.infer<typeof WorkerEnvSchema>>;

/** Parses the worker environment once. Errors list variable names only, never values. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): WorkerEnv {
  const result = WorkerEnvSchema.safeParse(source);
  if (!result.success) {
    const names = [
      ...new Set(result.error.issues.map((issue) => String(issue.path[0]))),
    ];
    throw new Error(
      `Invalid worker environment variables: ${names.join(", ")}`,
    );
  }
  return Object.freeze(result.data);
}
