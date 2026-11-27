import type { Logger } from "./logger.js";

export interface ShutdownOptions {
  /** Maximum time allowed for the shutdown handler before the process is forced to exit with code 1. */
  timeoutMs: number;
}

/**
 * Runs `handler` once on SIGTERM or SIGINT, then exits with code 0 on success or 1 on failure or timeout.
 * Unhandled rejections and uncaught exceptions are logged as fatal and exit with code 1.
 */
export function registerShutdown(
  logger: Logger,
  handler: () => Promise<void>,
  options: ShutdownOptions,
): void {
  let shuttingDown = false;

  const shutdown = (signal: NodeJS.Signals): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, "shutdown started");

    // Deliberately not unref'd: the timeout must still fire if nothing else keeps the process alive.
    setTimeout(() => {
      logger.fatal({ timeoutMs: options.timeoutMs }, "shutdown timed out");
      process.exit(1);
    }, options.timeoutMs);

    handler().then(
      () => {
        logger.info("shutdown complete");
        process.exit(0);
      },
      (error: unknown) => {
        logger.fatal({ err: error }, "shutdown failed");
        process.exit(1);
      },
    );
  };

  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);

  process.on("unhandledRejection", (reason) => {
    logger.fatal({ err: reason }, "unhandled promise rejection");
    process.exit(1);
  });
  process.on("uncaughtException", (error) => {
    logger.fatal({ err: error }, "uncaught exception");
    process.exit(1);
  });
}
