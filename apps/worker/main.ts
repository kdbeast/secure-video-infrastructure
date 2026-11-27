import { createLogger } from "@siv/shared";

import { loadEnv } from "./core/env/index.js";
import { runProcessors } from "./core/lifecycle.js";
import { selectProcessors } from "./core/registry.js";
import { aiProcessor } from "./processors/ai/index.js";
import { ingestProcessor } from "./processors/ingest/index.js";
import { maintenanceProcessor } from "./processors/maintenance/index.js";
import { transcodeProcessor } from "./processors/transcode/index.js";

const SHUTDOWN_TIMEOUT_MS = 30_000;

const AVAILABLE_PROCESSORS = [
  ingestProcessor,
  transcodeProcessor,
  aiProcessor,
  maintenanceProcessor,
];

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger({ name: "worker", level: env.LOG_LEVEL });
  const processors = selectProcessors(
    AVAILABLE_PROCESSORS,
    env.WORKER_PROCESSORS,
  );

  logger.info(
    { nodeEnv: env.NODE_ENV, enabled: env.WORKER_PROCESSORS },
    "worker starting",
  );
  await runProcessors(processors, logger, {
    shutdownTimeoutMs: SHUTDOWN_TIMEOUT_MS,
  });
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "Worker failed to start.";
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
