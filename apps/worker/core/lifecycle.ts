import { type Logger, registerShutdown } from "@siv/shared";

import type { ProcessorDefinition } from "./processor.js";

export interface RunOptions {
  shutdownTimeoutMs: number;
}

/** Starts the given processors and keeps the worker running until SIGTERM or SIGINT. */
export async function runProcessors(
  processors: readonly ProcessorDefinition[],
  logger: Logger,
  options: RunOptions,
): Promise<void> {
  const started: ProcessorDefinition[] = [];

  // Queue consumers will keep the event loop alive once they exist; until then this timer does.
  const keepAlive = setInterval(() => undefined, 2 ** 30);

  registerShutdown(
    logger,
    async () => {
      clearInterval(keepAlive);
      for (const processor of [...started].reverse()) {
        await processor.stop();
        logger.info({ processor: processor.name }, "processor stopped");
      }
    },
    { timeoutMs: options.shutdownTimeoutMs },
  );

  for (const processor of processors) {
    await processor.start({
      logger: logger.child({ processor: processor.name }),
    });
    started.push(processor);
    logger.info({ processor: processor.name }, "processor started");
  }

  logger.info(
    { processors: started.map((processor) => processor.name) },
    "worker running",
  );
}
