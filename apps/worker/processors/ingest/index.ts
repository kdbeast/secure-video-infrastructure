import type { ProcessorDefinition } from "../../core/processor.js";

// Placeholder: queue consumers are added with the BullMQ integration.
export const ingestProcessor: ProcessorDefinition = {
  name: "ingest",
  start: () => Promise.resolve(),
  stop: () => Promise.resolve(),
};
