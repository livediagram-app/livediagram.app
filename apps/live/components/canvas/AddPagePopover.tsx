'use client';

// "Add a page" (docs/specs/007-editor/illustrate-pages.md "Page kinds"): the + after the last page
// opens this small popover offering the four kinds of page, each a card with a miniature of it and a
// line under its name. Arrow keys move between them, Enter or a press chooses, Escape or an outside
// press closes. On a phone it is a bottom sheet.
import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { PageKind } from '@livediagram/document';
import { useClickOutside, useEscape, Portal } from '@livediagram/ui';
import { BottomSheet } from '@/components/primitives/BottomSheet';
import { useIsMobileViewport } from '@/hooks/ui/useIsMobileViewport';
import { VIEWPORT_EDGE_MARGIN as EDGE } from '@/lib/clamp-to-viewport';
import { PAGE_KINDS, PageKindCard } from './page-kind-cards';

const WIDTH = 420;
// The kind cards sit two to a row.
const KIND_COLUMNS = 2;
const GAP = 10;

export function AddPagePopover({
  getAnchor,
  onAdd,
  onClose,
}: {
  // The + button the popover hangs from.
  getAnchor: () => HTMLElement | null;
  onAdd: (kind: PageKind) => void;
  onClose: (restoreFocus: boolean) => void;
}) {
  const mobile = useIsMobileViewport();
  const box = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLButtonElement | null)[]>([]);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const a = getAnchor()?.getBoundingClientRect();
    if (!a) return;
    const h = box.current?.offsetHeight ?? 0;
    // Under the +, centred on it, kept inside the window.
    const left = Math.max(
      EDGE,
      Math.min(a.left + a.width / 2 - WIDTH / 2, window.innerWidth - WIDTH - EDGE),
    );
    const below = a.bottom + GAP;
    const top = below + h + EDGE <= window.innerHeight ? below : Math.max(EDGE, a.top - GAP - h);
    setPos({ left, top });
    cards.current[0]?.focus({ preventScroll: true });
  }, [getAnchor]);
  useClickOutside(box, () => onClose(false), true, '[data-add-page-trigger]');
  useEscape(() => onClose(true), { capture: true, stopPropagation: true });

  const choose = (kind: PageKind) => {
    onClose(false);
    onAdd(kind);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const at = cards.current.findIndex((c) => c === document.activeElement);
    // Left / Right step one card; Up / Down a row of the two-by-two grid.
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -KIND_COLUMNS, ArrowDown: KIND_COLUMNS }[
      e.key as 'ArrowLeft'
    ];
    cards.current[(at + step + PAGE_KINDS.length) % PAGE_KINDS.length]?.focus();
  };

  const body = (
    <div
      role="group"
      aria-label="Add a page"
      onKeyDown={onKeyDown}
      className={mobile ? 'flex flex-col gap-2 px-4 pb-3' : 'flex flex-col gap-2 p-3'}
    >
      <p className="px-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">Add a Page</p>
      <div className="grid grid-cols-2 gap-2">
        {PAGE_KINDS.map((k, i) => (
          <PageKindCard
            key={k.kind}
            choice={k}
            ref={(el) => {
              cards.current[i] = el;
            }}
            onChoose={() => choose(k.kind)}
          />
        ))}
      </div>
    </div>
  );

  if (mobile) {
    return (
      <BottomSheet
        ref={box}
        role="dialog"
        aria-label="Add a page"
        onClose={() => onClose(false)}
        zClassName="z-[var(--z-overlay)]"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {body}
      </BottomSheet>
    );
  }
  return (
    <Portal>
      <div
        ref={box}
        role="dialog"
        aria-label="Add a page"
        onPointerDown={(e) => e.stopPropagation()}
        className="fixed z-[var(--z-overlay)] animate-fade-in rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/15 dark:border-slate-700 dark:bg-slate-900"
        style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, width: WIDTH }}
      >
        {body}
      </div>
    </Portal>
  );
}

// A sheet with a title bar, a chart and three blocks: a page laid out.
