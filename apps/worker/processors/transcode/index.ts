import type { ProcessorDefinition } from "../../core/processor.js";

// Placeholder: queue consumers are added with the BullMQ integration.
export const transcodeProcessor: ProcessorDefinition = {
  name: "transcode",
  start: () => Promise.resolve(),
  stop: () => Promise.resolve(),
};
