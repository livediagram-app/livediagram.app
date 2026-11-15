// The notice for typing a paragraph someone else holds (docs/specs/007-editor/article-pages.md "Holding a
// paragraph"): "<Name> is writing in this paragraph.", said once per stretch of refused keys, not once per key, and
// when the room gave a paragraph we had started in to someone else. Apart from the holds plugin, as the caps notice
// is apart from the caps plugin, so the editor can set the toast as it mounts without loading ProseMirror.

// One notice per stretch of refused edits, not one per key held down.
const NOTICE_GAP_MS = 2500;
let lastNotice = 0;
let toast: ((message: string) => void) | null = null;

export const articleHeldNotice = (name: string): string => `${name} is writing in this paragraph.`;

/** Where the notice goes: the editor's toast, set once it mounts. */
export function setArticleHeldToast(next: ((message: string) => void) | null): void {
  toast = next;
}

/** Says who holds the paragraph, at most once in NOTICE_GAP_MS. */
export function announceArticleHeld(name: string, now = Date.now()): void {
  if (now - lastNotice < NOTICE_GAP_MS) return;
  lastNotice = now;
  toast?.(articleHeldNotice(name));
}

export function resetArticleHeldNoticeForTests(): void {
  lastNotice = 0;
  toast = null;
}
