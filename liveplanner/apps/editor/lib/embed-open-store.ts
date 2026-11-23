// Which Dashboard slots were just given an Embed File here (docs/specs/013-workspace/embeds.md "Embed File on a
// Dashboard", Work Tracker 1375): placing one opens Embed File at once, for this person only. The slot's card takes its
// mark as it mounts, so the dialog opens once and never for a collaborator's slot or on a reload. Never synced.
const placed = new Set<string>();

/** Marks a slot as just given an empty Embed File by this person (idempotent: an updater may run twice). */
export function markEmbedPlaced(slotId: string): void {
  placed.add(slotId);
}

/** Whether the slot was just given one here (read as its card first renders). */
export function wasEmbedPlaced(slotId: string): boolean {
  return placed.has(slotId);
}

/** Forgets the mark once the card has mounted, so the dialog opens only the once. */
export function forgetEmbedPlaced(slotId: string): void {
  placed.delete(slotId);
}
