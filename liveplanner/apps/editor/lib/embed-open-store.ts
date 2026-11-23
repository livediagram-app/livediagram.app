// Which Dashboard slot's Embed File is asked open here (docs/specs/013-workspace/embeds.md "Embed File on a
// Dashboard", Work Tracker 1375): placing one opens the dialog at once, and Slot Settings' Change File opens it again,
// for this person only. The slot's card follows its own slot's mark, so only that card re-renders, and the dialog
// never opens for a collaborator's slot or on a reload. Never synced.
const asked = new Set<string>();
const listeners = new Set<() => void>();
const emit = () => {
  for (const l of listeners) l();
};

export function subscribeEmbedAsk(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** Asks the slot's Embed File open (idempotent: an updater may run twice). */
export function askEmbedFile(slotId: string): void {
  if (asked.has(slotId)) return;
  asked.add(slotId);
  emit();
}

/** Whether the slot's Embed File is asked open. */
export function isEmbedAsked(slotId: string): boolean {
  return asked.has(slotId);
}

/** The dialog closed: the slot's ask is done. */
export function forgetEmbedAsk(slotId: string): void {
  if (asked.delete(slotId)) emit();
}
