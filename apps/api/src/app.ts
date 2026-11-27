import type { Logger } from "@siv/shared";
import express, { type Express } from "express";
import helmet from "helmet";

import { errorHandler } from "./middleware/error-handler.js";
import { notFound } from "./middleware/not-found.js";
import { requestLogger } from "./middleware/request-logger.js";
import { healthRouter } from "./routes/health.js";

const JSON_BODY_LIMIT = "100kb";

export interface AppDependencies {
  logger: Logger;
}

export function createApp({ logger }: AppDependencies): Express {
  const app = express();

  // Request logging runs before body parsing so malformed requests are still logged.
  app.use(requestLogger(logger));
  app.use(helmet());
  app.use(express.json({ limit: JSON_BODY_LIMIT }));

  app.use("/health", healthRouter());

  app.use(notFound);
  app.use(errorHandler(logger));

  return app;
}
