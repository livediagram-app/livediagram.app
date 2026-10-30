// The editor's side of text-only flashcards (docs/specs/007-editor/flashcards.md "Text only"): the
// commit choke point passes each edit of the guarded tab through guardFlashcards, after the page
// locks' guard, and says once in a while why something was held back.
import { guardFlashcards, pagesOf, type Tab } from '@livedocuments/document';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';

// One notice per stretch of held-back edits, not one per drag tick.
const NOTICE_GAP_MS = 2500;
let lastNotice = 0;
let toast: ((message: string) => void) | null = null;

export const TEXT_ONLY_NOTICE = 'Flashcards hold text only.';

/** Where the notice goes: the editor's toast, set once it mounts. */
export function setTextOnlyToast(next: ((message: string) => void) | null): void {
  toast = next;
}

/** Says a card holds text only, at most once in NOTICE_GAP_MS. */
export function announceTextOnly(now = Date.now()): void {
  if (now - lastNotice < NOTICE_GAP_MS) return;
  lastNotice = now;
  toast?.(TEXT_ONLY_NOTICE);
}

/** `next` with the guarded tab's edit held back where it would add an element onto a card or move
 *  one onto it. Same array when nothing was held back. `onBlocked` runs inside the commit's state
 *  update: it must defer anything that sets state. */
export function guardFlashcardsIn(
  prev: readonly Tab[],
  next: Tab[],
  tabId: string | null,
  onBlocked: () => void,
): Tab[] {
  if (!tabId) return next;
  const at = next.findIndex((t) => t.id === tabId);
  const before = prev.find((t) => t.id === tabId);
  const after = next[at];
  if (!before || !after || before === after || before.elements === after.elements) return next;
  const r = guardFlashcards(before.elements, after.elements, pagesOf(after));
  if (!r.blocked) return next;
  debugLog('[flashcard] held back', { tabId });
  onBlocked();
  const out = [...next];
  out[at] = { ...after, elements: r.elements };
  return out;
}
