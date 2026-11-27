import type { Logger } from "@siv/shared";
import type { RequestHandler } from "express";
import { pinoHttp } from "pino-http";

export function requestLogger(logger: Logger): RequestHandler {
  return pinoHttp({ logger });
}
