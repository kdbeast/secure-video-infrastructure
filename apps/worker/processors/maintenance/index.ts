import type { ProcessorDefinition } from "../../core/processor.js";

// Placeholder: queue consumers are added with the BullMQ integration.
export const maintenanceProcessor: ProcessorDefinition = {
  name: "maintenance",
  start: () => Promise.resolve(),
  stop: () => Promise.resolve(),
};
