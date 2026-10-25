// liveplanner as the shared verbs name it (@liveworkspace/agent-verbs/product): its CLI, and what its api and links
// call its files. Every shared module this package binds takes it, so the words its CLI and MCP print stay its own.
import type { AgentProduct } from '@liveworkspace/agent-verbs/product';

export const AGENT_PRODUCT = {
  cli: 'liveplanner',
  noun: 'project',
  collection: 'projects',
  // Its messages call a project a plan.
  word: 'plan',
  words: 'plans',
} as const satisfies AgentProduct;
