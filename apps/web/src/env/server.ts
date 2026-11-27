import "server-only";

import { z } from "zod";

// Server-only configuration. Importing this module from a Client Component fails the build.
// Never add secrets to the web app, and never give these variables the NEXT_PUBLIC_ prefix.

const DEVELOPMENT_API_INTERNAL_URL = "http://localhost:4000";

const isProduction = process.env.NODE_ENV === "production";

const ServerEnvSchema = z.object({
  API_INTERNAL_URL: isProduction
    ? z.url({ protocol: /^https?$/ })
    : z.url({ protocol: /^https?$/ }).default(DEVELOPMENT_API_INTERNAL_URL),
});

export type ServerEnv = Readonly<z.infer<typeof ServerEnvSchema>>;

function loadServerEnv(): ServerEnv {
  const result = ServerEnvSchema.safeParse({
    API_INTERNAL_URL: process.env.API_INTERNAL_URL,
  });
  if (!result.success) {
    const variables = [
      ...new Set(result.error.issues.map((issue) => String(issue.path[0]))),
    ];
    throw new Error(
      `Invalid web server environment variables: ${variables.join(", ")}`,
    );
  }
  return Object.freeze(result.data);
}

export const serverEnv: ServerEnv = loadServerEnv();
