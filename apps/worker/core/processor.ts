import type { Logger } from "@siv/shared";

export const PROCESSOR_NAMES = [
  "ingest",
  "transcode",
  "ai",
  "maintenance",
] as const;

export type ProcessorName = (typeof PROCESSOR_NAMES)[number];

export interface ProcessorContext {
  logger: Logger;
}

export interface ProcessorDefinition {
  name: ProcessorName;
  start(context: ProcessorContext): Promise<void>;
  stop(): Promise<void>;
}
