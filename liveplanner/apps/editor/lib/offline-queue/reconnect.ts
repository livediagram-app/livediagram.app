// When waiting changes are sent (docs/specs/007-editor/offline-changes.md "Sending them"): the browser's `online`
// event and the room's connection opening again both say "try now", and between them a wait that doubles. Which
// failures mean "no connection" (the change waits) rather than a refusal (it is taken back) is decided here too.
import { ApiError } from '@/lib/api/core';

const listeners = new Set<() => void>();
let windowListening = false;

function fire(): void {
  for (const l of [...listeners]) l();
}

/** Calls `listener` whenever the connection may be back; returns the unsubscribe. */
export function onReconnect(listener: () => void): () => void {
  if (!windowListening && typeof window !== 'undefined') {
    windowListening = true;
    window.addEventListener('online', fire);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The room's connection opened again: send what waits now. */
export function signalReconnect(): void {
  fire();
}

/** Resolves after `ms`, or as soon as the connection may be back, whichever is first. */
export function waitOrReconnect(ms: number, wait: (ms: number) => Promise<void>): Promise<void> {
  return new Promise((resolve) => {
    const finish = () => {
      unsubscribe();
      resolve();
    };
    const unsubscribe = onReconnect(finish);
    void wait(ms).then(finish);
  });
}

// Spec "Sending them": 2 s, doubling up to a minute. Safe range 1..10 s and 30..300 s.
const RETRY_FIRST_MS = 2_000;
export const RETRY_MAX_MS = 60_000;

export function retryDelayMs(attempt: number): number {
  return Math.min(RETRY_FIRST_MS * 2 ** Math.min(attempt, 16), RETRY_MAX_MS);
}

// No answer from the server, or its gateway's "not reached" (spec "What waits"): the request did not get through, so
// sending it again later can still land it. A 500 is the server failing this write, which is a refusal.
const UNREACHED = new Set([0, 408, 429, 502, 503, 504]);

export function isConnectionFailure(e: unknown): boolean {
  if (e instanceof ApiError) return UNREACHED.has(e.status);
  return e instanceof TypeError;
}
