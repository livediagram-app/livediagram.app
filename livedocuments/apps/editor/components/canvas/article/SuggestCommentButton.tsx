'use client';

// The Comment button a Participant on Suggest Only has (docs/specs/007-editor/suggestions.md "Comments on selected
// text"): with text selected in an article, a small button in the page's right margin beside the selection puts a
// comment on it, as ⌘⌥M does. The toolbar is an Editor's, so this is the Participant's one door to a margin note.
import { useEffect, useLayoutEffect, useRef } from 'react';
import { lucideMessageSquare } from '@liveworkspace/icons/lucide';
import { lucideGlyph, Portal, Tooltip } from '@livedocuments/ui';
import { keyLabel } from '@liveworkspace/workbench/lib/key-label';
import { useActiveArticle, useArticleCommentRequest } from '@/lib/article/article-editor-store';
import { useSuggestOnly } from '@/lib/article/article-suggest-store';

const CommentGlyph = lucideGlyph(lucideMessageSquare, 16);

type Spot = { left: number; top: number };

/** Where the button sits: the right margin of the writing, level with the selection's first line. */
function spotOf(flow: string): Spot | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const rect = sel.getRangeAt(0).getClientRects()[0];
  const column = document.querySelector(`.article-flow[data-article-flow="${CSS.escape(flow)}"]`);
  if (!rect || !column) return null;
  const box = column.getBoundingClientRect();
  return { left: box.right + 10, top: rect.top + rect.height / 2 - 16 };
}

export function SuggestCommentButton({
  articlePages,
  onNote,
}: {
  articlePages: readonly { flow: string; card?: boolean }[];
  onNote: (flow: string, kind: 'comment') => void;
}) {
  const suggestOnly = useSuggestOnly();
  const active = useActiveArticle();
  const flow = active?.handle.flow ?? null;
  const onCard = articlePages.some((p) => p.flow === flow && p.card === true);
  const can =
    suggestOnly &&
    !!active &&
    active.focused &&
    active.selection.hasText &&
    !active.selection.inTable &&
    !onCard;
  // Read as it renders, which every selection change does (the active article store).
  const spot = can && flow ? spotOf(flow) : null;

  // ⌘⌥M in the writing puts a comment on the selected text, as the button does.
  const request = useArticleCommentRequest();
  const seen = useRef(request);
  const now = useRef({ can, flow, onNote });
  useLayoutEffect(() => {
    now.current = { can, flow, onNote };
  });
  useEffect(() => {
    if (request === seen.current) return;
    seen.current = request;
    const { can: may, flow: f, onNote: note } = now.current;
    if (may && f) note(f, 'comment');
  }, [request]);

  if (!can || !spot || !flow) return null;
  const label = `Comment (${keyLabel('Mod-Alt-m')})`;
  return (
    <Portal>
      <Tooltip label={label}>
        <button
          type="button"
          aria-label={label}
          data-suggest-comment=""
          data-article-keep-active=""
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onNote(flow, 'comment')}
          className="fixed z-[var(--z-toolbar)] flex size-8 animate-fade-in items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-md shadow-slate-900/10 transition hover:border-brand-300 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-brand-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-brand-300"
          style={{ left: spot.left, top: spot.top }}
        >
          <CommentGlyph />
        </button>
      </Tooltip>
    </Portal>
  );
}
