// Which find chord a key is (docs/specs/007-editor/find-and-replace.md "Opening and closing"; blueprint "The current
// match"): Cmd/Ctrl+F opens Find and Cmd/Ctrl+Shift+H opens it with Replace, but only while the document has the
// keyboard (the canvas, a selection, the article's writing, or the bar itself). Anywhere else (another text field, a
// dialog, a deck presenting, an embed) the key stays the browser's, so its own find still works there. Pure over the
// event, so the rule is tested without a page.
import { isTypingTarget } from '@liveworkspace/workbench/lib/typing-target';

export type FindChord = 'find' | 'replace';

export type FindChordContext = {
  // A dialog is open (anyModalOpen), a deck presents, or the editor is an embed.
  standsAside: boolean;
};

// Where the document has the keyboard even though the target takes typing: the writing, and the Find bar.
const DOCUMENT_TYPING = '.article-flow, [data-find-bar]';

function documentHasKeyboard(target: EventTarget | null): boolean {
  if (!isTypingTarget(target)) return true;
  return target instanceof Element && target.closest(DOCUMENT_TYPING) !== null;
}

export function findChordOf(
  e: Pick<KeyboardEvent, 'key' | 'code' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey' | 'target'>,
  ctx: FindChordContext,
): FindChord | null {
  const mod = e.metaKey || e.ctrlKey;
  if (!mod || e.altKey || ctx.standsAside) return null;
  const lower = e.key.toLowerCase();
  const chord =
    !e.shiftKey && (lower === 'f' || e.code === 'KeyF')
      ? 'find'
      : e.shiftKey && (lower === 'h' || e.code === 'KeyH')
        ? 'replace'
        : null;
  if (!chord) return null;
  return documentHasKeyboard(e.target) ? chord : null;
}

/** The writing's selected text, as a query to start from: one line of up to `max` characters, else nothing. */
export function seedFromSelection(max: number): string {
  if (typeof window === 'undefined') return '';
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return '';
  const node = sel.anchorNode;
  const host = node instanceof Element ? node : node?.parentElement;
  if (!host?.closest('.article-flow')) return '';
  const text = sel.toString();
  if (text.length === 0 || text.length > max || text.includes('\n')) return '';
  return text;
}
