'use client';

// The surface Ask and AI Knowledge are drawn on (docs/specs/030-knowledgebase/blueprints/ask-ui.md "The frame"): it
// covers the editor's canvas, page tree and bottom bar and leaves the top row's card (the switch, Share, the
// account) floating over its top right corner, so the three views share one top row. While it shows, the editor
// underneath is inert and its window-level shortcuts stand down, so no key pressed here reaches a page.
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useModalGuard } from '@liveworkspace/workbench/hooks/ui/useModalGuard';

/** A zero-height mark in the editor's column: the frame starts at its top, under anything in the flow above it (an
 *  approver's banner, a phone's switch row). */
export const KNOWLEDGE_VIEW_ANCHOR = 'data-knowledge-view-anchor';
/** On a column child that stays live while a view covers the editor (the phone's switch row). */
export const KNOWLEDGE_VIEW_KEEP = 'data-knowledge-view-keep';

type ChromeBox = { top: number; cornerRoom: number };
const NO_BOX: ChromeBox = { top: 0, cornerRoom: 0 };
// Between the header's last control and the top row's card.
const CORNER_GAP_PX = 12;

const CornerRoomContext = createContext(0);

function measure(): ChromeBox {
  const anchor = document.querySelector(`[${KNOWLEDGE_VIEW_ANCHOR}]`);
  const corner = document.querySelector('[data-corner-actions]');
  const top = anchor ? Math.max(0, Math.round(anchor.getBoundingClientRect().top)) : 0;
  const cornerRect = corner?.getBoundingClientRect();
  const cornerRoom =
    cornerRect && cornerRect.width > 0
      ? Math.max(0, Math.round(window.innerWidth - cornerRect.left + CORNER_GAP_PX))
      : 0;
  return { top, cornerRoom };
}

// Where the frame starts and how much of its header the top row's card covers, re-read when either moves.
function useChromeBox(): ChromeBox {
  const [box, setBox] = useState(NO_BOX);
  useLayoutEffect(() => {
    const read = () =>
      setBox((held) => {
        const next = measure();
        return held.top === next.top && held.cornerRoom === next.cornerRoom ? held : next;
      });
    read();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(read);
    const corner = document.querySelector('[data-corner-actions]');
    const anchor = document.querySelector(`[${KNOWLEDGE_VIEW_ANCHOR}]`);
    if (corner) observer?.observe(corner);
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

// The editor's regions (canvas, bars) under the frame take no focus, press or screen reader while it shows. The top
// row's card and anything marked to keep stay live. Dialogs and toasts are portals outside the column.
function useEditorInert(frame: React.RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const column = frame.current?.parentElement;
    if (!column) return;
    const made: Element[] = [];
    for (const child of column.children) {
      if (child === frame.current || child.hasAttribute(KNOWLEDGE_VIEW_KEEP)) continue;
      if (child.hasAttribute('inert')) continue;
      const region = child.matches('[data-region]') || child.querySelector('[data-region]');
      if (!region || child.querySelector('[data-corner-actions]')) continue;
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
      style={{ top: box.top }}
      className="fixed inset-x-0 bottom-0 z-[var(--z-canvas-modal)] flex flex-col bg-slate-50 text-slate-900 outline-none motion-safe:animate-fade-in dark:bg-slate-950 dark:text-slate-100"
    >
      <CornerRoomContext.Provider value={box.cornerRoom}>{children}</CornerRoomContext.Provider>
    </div>
  );
}

/** A view's header: its name, one line about it, and its own actions, clear of the top row's card. 70px tall, the
 *  top row's height, so the card sits centred in it. */
export function KnowledgeViewHeader({
  title,
  about,
  children,
}: {
  title: string;
  about: string;
  children?: ReactNode;
}) {
  const cornerRoom = useContext(CornerRoomContext);
  const titleId = useId();
  return (
    <header
      style={{ paddingRight: cornerRoom || undefined }}
      className="flex min-h-[70px] shrink-0 items-center gap-3 border-b border-slate-200 bg-white pl-4 pr-4 dark:border-slate-800 dark:bg-slate-900 sm:pl-6"
    >
      <div className="min-w-0 flex-1 py-2">
        <h1 id={titleId} className="truncate text-base font-semibold tracking-tight">
          {title}
        </h1>
        <p className="truncate text-xs text-slate-600 dark:text-slate-400">{about}</p>
      </div>
      {children ? <div className="flex shrink-0 items-center gap-1.5">{children}</div> : null}
    </header>
  );
}
