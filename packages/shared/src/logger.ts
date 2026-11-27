import { type LevelWithSilent, type Logger, pino } from "pino";

export type { Logger };

export type LogLevel = LevelWithSilent;

export const LOG_LEVELS = [
  "fatal",
  "error",
  "warn",
  "info",
  "debug",
  "trace",
  "silent",
] as const satisfies readonly LogLevel[];

const REDACTED_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  'res.headers["set-cookie"]',
];

export interface LoggerOptions {
  name: string;
  level: LogLevel;
}

export function createLogger(options: LoggerOptions): Logger {
  return pino({
    name: options.name,
    level: options.level,
    redact: { paths: REDACTED_PATHS, censor: "[redacted]" },
  });
}
