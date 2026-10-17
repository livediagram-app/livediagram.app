// Home's hero, pure (docs/specs/013-workspace/explorer-home.md "The hero"; blueprint
// docs/specs/013-workspace/blueprints/explorer-home-view.md): the greeting by the reader's hour, the status pills'
// words, and which documents the fanned sheets show.

/** How many sheets fan out behind the hero's text. */
export const HERO_SHEETS = 3;

/** Morning runs from 5 to 11, afternoon from 12 to 17; the rest of the day is evening. */
export function heroGreeting(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Good morning.';
  if (hour >= 12 && hour < 18) return 'Good afternoon.';
  return 'Good evening.';
}

export const HERO_COPY = {
  question: 'What are we picking up?',
  lead: 'Jump back into what you use most, or see what changed while you were away.',
  newDocument: 'New document',
  // The page header's words for the same drawer button.
  openNav: 'Browse sections',
} as const;

export type HeroPill = { id: 'documents' | 'inbox'; label: string; tone: 'emerald' | 'sky' };

/** The status pills, each only once its count is known: never "0 documents" while the lists load, nor a clear Inbox
 *  that was never read. */
export function heroPills(input: {
  documents: number | undefined;
  inbox: number | undefined;
}): HeroPill[] {
  const pills: HeroPill[] = [];
  if (input.documents !== undefined) {
    pills.push({
      id: 'documents',
      label: input.documents === 1 ? '1 document' : `${input.documents} documents`,
      tone: 'emerald',
    });
  }
  if (input.inbox !== undefined) {
    pills.push({
      id: 'inbox',
      label: input.inbox === 0 ? 'Inbox is clear' : `${input.inbox} open in your Inbox`,
      tone: 'sky',
    });
  }
  return pills;
}

/** The fanned sheets: My documents' most recently saved, newest first, at most HERO_SHEETS. One pass that keeps the
 *  newest few, so a long list costs a scan, not a sort. Equal saves keep the list's order. */
export function heroSheets<T extends { savedAt: number }>(documents: readonly T[]): T[] {
  const top: T[] = [];
  for (const doc of documents) {
    let at = top.length;
    while (at > 0 && top[at - 1]!.savedAt < doc.savedAt) at -= 1;
    if (at >= HERO_SHEETS) continue;
    top.splice(at, 0, doc);
    if (top.length > HERO_SHEETS) top.pop();
  }
  return top;
}
