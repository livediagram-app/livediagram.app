'use client';

// A link in the writing (docs/specs/007-editor/article-pages.md "Writing", Links): hovering it shows
// its address with Open, Edit and Remove under it; ⌘-press (Ctrl on Windows and Linux) opens it in
// a new tab. Listens on the writing's own element, so the editor's keyboard handling is untouched.
import { useEffect, useRef, useState, type RefObject } from 'react';
import { Portal } from '@livediagram/ui';
import type { EditorView } from 'prosemirror-view';
import { TextSelection } from 'prosemirror-state';
import { markRange } from '@/lib/article/article-commands';
import { articleSchema } from '@/lib/article/article-schema';
import { requestArticleLink } from '@/lib/article/article-editor-store';
import { isSafeArticleHref } from '@livediagram/document';

// How long the card stays once the pointer leaves the link, so it can cross to the card (ms).
const LINK_CARD_GRACE_MS = 250;

type Hover = { href: string; from: number; to: number; left: number; top: number };

const openLink = (href: string) => {
  if (isSafeArticleHref(href)) window.open(href, '_blank', 'noopener,noreferrer');
};

export function useArticleLinkHover(
  viewRef: RefObject<EditorView | null>,
  editable: boolean,
): React.ReactNode {
  const [hover, setHover] = useState<Hover | null>(null);
  const leave = useRef<number | null>(null);
  const stay = () => {
    if (leave.current !== null) window.clearTimeout(leave.current);
    leave.current = null;
  };
  const go = () => {
    stay();
    leave.current = window.setTimeout(() => setHover(null), LINK_CARD_GRACE_MS);
  };

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const dom = view.dom;
    const linkAt = (target: EventTarget | null) =>
      (target as Element | null)?.closest?.('a.article-link') as HTMLAnchorElement | null;
    const over = (e: MouseEvent) => {
      const a = linkAt(e.target);
      if (!a) return;
      stay();
      const pos = view.posAtDOM(a, 0);
      const range = markRange(view.state.doc.resolve(pos), articleSchema.marks.link!);
      if (!range) return;
      const r = a.getBoundingClientRect();
      setHover({
        href: range.mark.attrs.href as string,
        from: range.from,
        to: range.to,
        left: r.left,
        top: r.bottom + 6,
      });
    };
    const out = (e: MouseEvent) => {
      if (linkAt(e.target)) go();
    };
    const press = (e: MouseEvent) => {
      const a = linkAt(e.target);
      if (!a || !(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      openLink(a.getAttribute('href') ?? '');
    };
    dom.addEventListener('mouseover', over);
    dom.addEventListener('mouseout', out);
    dom.addEventListener('click', press);
    return () => {
      dom.removeEventListener('mouseover', over);
      dom.removeEventListener('mouseout', out);
      dom.removeEventListener('click', press);
      stay();
    };
    // The view is made once, before this runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!hover) return null;
  const view = viewRef.current;
  const edit = () => {
    if (!view) return;
    view.dispatch(
      view.state.tr.setSelection(TextSelection.create(view.state.doc, hover.from, hover.to)),
    );
    view.focus();
    setHover(null);
    requestArticleLink();
  };
  const remove = () => {
    if (!view) return;
    view.dispatch(view.state.tr.removeMark(hover.from, hover.to, articleSchema.marks.link!));
    setHover(null);
  };
  const button =
    'rounded-md px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-brand-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white';
  return (
    <Portal>
      <div
        role="dialog"
        aria-label="Link"
        data-article-keep-active=""
        className="fixed z-[var(--z-overlay)] flex max-w-[22rem] animate-fade-in items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-lg shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900"
        style={{ left: hover.left, top: hover.top }}
        onPointerEnter={stay}
        onPointerLeave={go}
        onMouseDown={(e) => e.preventDefault()}
      >
        <span className="min-w-0 truncate px-1.5 text-xs text-slate-500 dark:text-slate-400">
          {hover.href}
        </span>
        <button type="button" className={button} onClick={() => openLink(hover.href)}>
          Open
        </button>
        {editable ? (
          <>
            <button type="button" className={button} onClick={edit}>
              Edit
            </button>
            <button type="button" className={button} onClick={remove}>
              Remove
            </button>
          </>
        ) : null}
      </div>
    </Portal>
  );
}
