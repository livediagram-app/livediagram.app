// liveknowledge as the shared verbs name it (@liveworkspace/agent-verbs/product): its CLI, and what its api and links
// call its files. Every shared module this package binds takes it, so the words its CLI and MCP print stay its own.
import type { AgentProduct } from '@liveworkspace/agent-verbs/product';

export const AGENT_PRODUCT = {
  cli: 'liveknowledge',
  noun: 'document',
  collection: 'documents',
  // What a person calls one (docs/specs/003-system-architecture/domain-language.md): the api's `document` is a
  // knowledgebase in every message.
  word: 'knowledgebase',
  words: 'knowledgebases',
} as const satisfies AgentProduct;
