'use client';

// The surface Ask and AI Knowledge are drawn on (docs/specs/030-knowledgebase/blueprints/ask-ui.md "The frame"): it
// covers the editor's canvas and page tree, from the top of the editor's column to the top of the footer, whose
// tabs are how the view is changed. Its header is the top row every view shares (KnowledgeTopRow): the view's name
// and its own buttons, then Share and the account button. While it shows, the editor underneath is inert and its
// window-level shortcuts stand down, so no key pressed here reaches a page.
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useModalGuard } from '@liveworkspace/workbench/hooks/ui/useModalGuard';
import { KnowledgeTopRow } from '@/components/chrome/KnowledgeTopRow';
import { KnowledgeLogo } from '@/components/chrome/KnowledgeLogo';

/** A zero-height mark in the editor's column: the frame starts at its top, under anything in the flow above it (an
 *  approver's banner). */
export const KNOWLEDGE_VIEW_ANCHOR = 'data-knowledge-view-anchor';
// The footer (BottomBar): the frame ends at its top, and it stays live under the frame.
const FOOTER = '[data-editor-tabbar]';

type ChromeBox = { top: number; bottom: number };
const NO_BOX: ChromeBox = { top: 0, bottom: 0 };

function measure(): ChromeBox {
  const anchor = document.querySelector(`[${KNOWLEDGE_VIEW_ANCHOR}]`);
  const footer = document.querySelector(FOOTER)?.getBoundingClientRect();
  const top = anchor ? Math.max(0, Math.round(anchor.getBoundingClientRect().top)) : 0;
  const bottom =
    footer && footer.height > 0 ? Math.max(0, Math.round(window.innerHeight - footer.top)) : 0;
  return { top, bottom };
}

// Where the frame starts and ends, re-read when the column above it or the footer under it changes size.
function useChromeBox(): ChromeBox {
  const [box, setBox] = useState(NO_BOX);
  useLayoutEffect(() => {
    const read = () =>
      setBox((held) => {
        const next = measure();
        return held.top === next.top && held.bottom === next.bottom ? held : next;
      });
    read();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(read);
    const footer = document.querySelector(FOOTER);
    const anchor = document.querySelector(`[${KNOWLEDGE_VIEW_ANCHOR}]`);
    if (footer) observer?.observe(footer);
    // The anchor has no size of its own: what moves it is the column above it.
    if (anchor?.previousElementSibling) observer?.observe(anchor.previousElementSibling);
    window.addEventListener('resize', read);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', read);
    };
  }, []);
  return box;
}

// The editor's regions (the canvas and its chrome) under the frame take no focus, press or screen reader while it
// shows. The footer stays live: its tabs are the way to another view. Dialogs and toasts are portals outside the
// column.
function useEditorInert(frame: React.RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const column = frame.current?.parentElement;
    if (!column) return;
    const made: Element[] = [];
    for (const child of column.children) {
      if (child === frame.current) continue;
      if (child.hasAttribute('inert')) continue;
      const region = child.matches('[data-region]') || child.querySelector('[data-region]');
      if (!region || child.matches(FOOTER) || child.querySelector(FOOTER)) continue;
      child.setAttribute('inert', '');
      made.push(child);
    }
    return () => made.forEach((child) => child.removeAttribute('inert'));
  }, [frame]);
}

export function KnowledgeViewFrame({ label, children }: { label: string; children: ReactNode }) {
  const frame = useRef<HTMLDivElement>(null);
  const box = useChromeBox();
  useModalGuard(true);
  useEditorInert(frame);
  // The view is what the person asked for: its region takes the focus, so a screen reader says where they are and
  // Tab starts inside it.
  useEffect(() => frame.current?.focus({ preventScroll: true }), []);
  return (
    <div
      ref={frame}
      role="region"
      aria-label={label}
      tabIndex={-1}
      data-knowledge-view-frame=""
      style={{ top: box.top, bottom: box.bottom }}
      className="fixed inset-x-0 z-[var(--z-canvas-modal)] flex flex-col bg-slate-50 text-slate-900 outline-none motion-safe:animate-fade-in dark:bg-slate-950 dark:text-slate-100"
    >
      {children}
    </div>
  );
}

/** A view's header, the top row every view shares: the logo, its name, one line about it where there is room, its own
 *  buttons, then Share and the account button (the row's slot). */
export function KnowledgeViewHeader({
  title,
  about,
  children,
}: {
  title: string;
  about: string;
  children?: ReactNode;
}) {
  const titleId = useId();
  return (
    <header aria-labelledby={titleId} className="shrink-0">
      <KnowledgeTopRow rank="view" className="pl-4 sm:pl-6 phone:pl-3">
        {/* The logo leads every view's row, as it heads the page tree on a page. */}
        <KnowledgeLogo className="shrink-0" />
        <span
          aria-hidden
          className="mx-3 h-5 w-px shrink-0 bg-slate-200 phone:mx-2 dark:bg-slate-700"
        />
        <h1 id={titleId} className="shrink-0 truncate text-sm font-semibold tracking-tight">
          {title}
        </h1>
        <p className="ml-2 hidden min-w-0 flex-1 truncate text-xs text-slate-600 lg:block dark:text-slate-400">
          {about}
        </p>
        {children ? (
          <div className="ml-auto flex shrink-0 items-center gap-1.5 pl-2">{children}</div>
        ) : null}
        <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-slate-200 dark:bg-slate-700" />
      </KnowledgeTopRow>
    </header>
  );
}
