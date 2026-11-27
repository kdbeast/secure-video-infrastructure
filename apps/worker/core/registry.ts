import type { ProcessorDefinition, ProcessorName } from "./processor.js";

export function selectProcessors(
  available: readonly ProcessorDefinition[],
  enabled: readonly ProcessorName[],
): ProcessorDefinition[] {
  return available.filter((processor) => enabled.includes(processor.name));
}
