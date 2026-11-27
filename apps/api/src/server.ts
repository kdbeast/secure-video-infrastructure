import type { Server } from "node:http";

import { createLogger, registerShutdown } from "@siv/shared";

import { createApp } from "./app.js";
import { loadEnv } from "./env/index.js";

const SHUTDOWN_TIMEOUT_MS = 10_000;

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
    server.closeIdleConnections();
  });
}

function main(): void {
  const env = loadEnv();
  const logger = createLogger({ name: "api", level: env.LOG_LEVEL });
  const app = createApp({ logger });

  const server = app.listen(env.PORT, (error) => {
    if (error) {
      logger.fatal({ err: error }, "api failed to listen");
      process.exit(1);
    }
    logger.info({ port: env.PORT, nodeEnv: env.NODE_ENV }, "api listening");
  });

  registerShutdown(logger, () => closeServer(server), {
    timeoutMs: SHUTDOWN_TIMEOUT_MS,
  });
}

try {
  main();
} catch (error) {
  const message =
    error instanceof Error ? error.message : "API failed to start.";
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
