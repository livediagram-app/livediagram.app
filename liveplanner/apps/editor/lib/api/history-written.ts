// A write to a card's history that leaves the card itself alone (a session's Skip), so its `rev` doesn't move: an open
// Activity tab hears it here and reads the history again (hooks/plan/useCardHistory.ts).
const listeners = new Set<(itemId: string) => void>();

export function onHistoryWritten(listener: (itemId: string) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function historyWritten(itemId: string): void {
  for (const listener of listeners) listener(itemId);
}
