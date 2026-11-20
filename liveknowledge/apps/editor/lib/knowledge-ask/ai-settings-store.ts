// The knowledgebase's AI settings as the editor holds them (docs/specs/030-knowledgebase/search-and-ask.md "Ask"):
// whether a key is set, its last characters (an Editor's only), the model and the models offered. Never the key:
// the route does not send it, and nothing here takes it. Held outside React so the Ask view, AI Knowledge and the
// AI Settings dialog read one answer, asked for once per knowledgebase and again only after a failure.
import type { KnowledgeAiSettings } from '@liveknowledge/api-schema';
import { apiKnowledgeAi, type KnowledgeCaller } from '@/lib/api/knowledge';

export type AiSettingsState =
  | { status: 'idle' | 'loading' }
  | { status: 'ready'; settings: KnowledgeAiSettings }
  | { status: 'failed' };

const IDLE: AiSettingsState = { status: 'idle' };
const LOADING: AiSettingsState = { status: 'loading' };
const FAILED: AiSettingsState = { status: 'failed' };

const states = new Map<string, AiSettingsState>();
const inFlight = new Map<string, Promise<void>>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

function put(documentId: string, state: AiSettingsState): void {
  states.set(documentId, state);
  notify();
}

export const aiSettingsStore = {
  subscribe: (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  get: (documentId: string): AiSettingsState => states.get(documentId) ?? IDLE,
  /** Read the settings unless they are here or on their way. A failed read is tried again when next asked. */
  load(who: KnowledgeCaller, documentId: string): Promise<void> {
    const held = states.get(documentId);
    if (held?.status === 'ready') return Promise.resolve();
    const running = inFlight.get(documentId);
    if (running) return running;
    put(documentId, LOADING);
    const request = apiKnowledgeAi(who, documentId)
      .then((settings) => put(documentId, { status: 'ready', settings }))
      .catch(() => put(documentId, FAILED))
      .finally(() => inFlight.delete(documentId));
    inFlight.set(documentId, request);
    return request;
  },
  /** What a write answered: the settings as they are now. */
  set(documentId: string, settings: KnowledgeAiSettings): void {
    put(documentId, { status: 'ready', settings });
  },
  reset(): void {
    states.clear();
    inFlight.clear();
    notify();
  },
};
