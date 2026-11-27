import type { ProcessorDefinition } from "../../core/processor.js";

// Placeholder: queue consumers are added with the BullMQ integration.
export const aiProcessor: ProcessorDefinition = {
  name: "ai",
  start: () => Promise.resolve(),
  stop: () => Promise.resolve(),
};
