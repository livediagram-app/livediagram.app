'use client';

// Add a Page (docs/specs/007-editor/pages-mode.md "Adding a page"): the chooser the button under the
// + opens, for a page of any kind. A compact list, one row per kind (its glyph, its name and a line
// on what it is for), so it stays small however many kinds there are. Up and Down move between the
// rows, Enter or a press chooses, Escape or an outside press closes. On a phone it is a bottom sheet.
import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { PageKind } from '@livedocuments/document';
import { useClickOutside, useEscape, Portal } from '@livedocuments/ui';
import { BottomSheet } from '@/components/primitives/BottomSheet';
import { useIsMobileViewport } from '@/hooks/ui/useIsMobileViewport';
import { VIEWPORT_EDGE_MARGIN as EDGE } from '@/lib/clamp-to-viewport';
import { PAGE_KINDS } from './page-kind-cards';
import { PageKindGlyph } from './page-kind-glyph';

const WIDTH = 300;
const GAP = 10;

const ROW =
  'group flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:outline-2 focus-visible:outline-brand-600 dark:hover:bg-slate-800 dark:focus-visible:bg-slate-800';

// Up and Down between the rows of a list, wrapping; Home and End to its ends.
function moveBetweenRows(e: KeyboardEvent<HTMLElement>) {
  const rows = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('[data-add-row]')];
  const at = rows.indexOf(document.activeElement as HTMLButtonElement);
  const to =
    e.key === 'ArrowDown'
      ? at + 1
      : e.key === 'ArrowUp'
        ? at - 1
        : e.key === 'Home'
          ? 0
          : e.key === 'End'
            ? rows.length - 1
            : null;
  if (to === null) return;
  e.preventDefault();
  rows[(to + rows.length) % rows.length]?.focus();
}

export function AddPagePopover({
  getAnchor,
  onAdd,
  onClose,
}: {
  // The button the popover hangs from.
  getAnchor: () => HTMLElement | null;
  onAdd: (kind: PageKind) => void;
  onClose: (restoreFocus: boolean) => void;
}) {
  const mobile = useIsMobileViewport();
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  // Placed beside the button (right of it while there is room, else left), level with it and kept
  // inside the window.
  useLayoutEffect(() => {
    const a = getAnchor()?.getBoundingClientRect();
    if (!a) return;
    const h = box.current?.offsetHeight ?? 0;
    const right = a.right + GAP + WIDTH + EDGE <= window.innerWidth;
    const left = right ? a.right + GAP : Math.max(EDGE, a.left - GAP - WIDTH);
    const top = Math.max(
      EDGE,
      Math.min(a.top + a.height / 2 - h / 2, window.innerHeight - h - EDGE),
    );
    setPos({ left, top });
  }, [getAnchor]);
  // Focus the first row.
  useLayoutEffect(() => {
    box.current?.querySelector<HTMLButtonElement>('[data-add-row]')?.focus({ preventScroll: true });
  }, []);
  useClickOutside(box, () => onClose(false), true, '[data-add-page-trigger]');
  useEscape(() => onClose(true), {
    capture: true,
    stopPropagation: true,
  });

  const choose = (kind: PageKind) => {
    onClose(false);
    onAdd(kind);
  };

  const body = (
    <div className="flex flex-col">
      <p className="px-2 pb-1 text-xs font-semibold text-slate-900 dark:text-slate-100">
        Add a Page
      </p>
      <div role="group" aria-label="Add a Page" onKeyDown={moveBetweenRows}>
        {PAGE_KINDS.map((k) => (
          <button
            key={k.kind}
            type="button"
            data-add-row=""
            data-add-kind={k.kind}
            onClick={() => choose(k.kind)}
            className={ROW}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600 transition group-hover:bg-white group-hover:text-brand-700 group-hover:shadow-sm group-focus-visible:bg-white group-focus-visible:text-brand-700 dark:bg-slate-800 dark:text-slate-300 dark:group-hover:bg-slate-700 dark:group-hover:text-brand-100">
              <PageKindGlyph kind={k.kind} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold text-slate-900 dark:text-slate-100">
                {k.name}
              </span>
              <span className="block truncate text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                {k.hint}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );

  if (mobile) {
    return (
      <BottomSheet
        ref={box}
        role="dialog"
        aria-label="Add a Page"
        data-menu-surface=""
        onClose={() => onClose(false)}
        zClassName="z-[var(--z-overlay)]"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="px-3 pb-3">{body}</div>
      </BottomSheet>
    );
  }
  return (
    <Portal>
      <div
        ref={box}
        role="dialog"
        aria-label="Add a Page"
        data-add-page-popover=""
        // Floating UI: the canvas leaves its presses alone, and an open Contents popover counts
        // them as inside it (MovablePanel).
        data-floating-panel=""
        data-menu-surface=""
        onPointerDown={(e) => e.stopPropagation()}
        className="fixed z-[var(--z-overlay)] animate-fade-in overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/15 dark:border-slate-700 dark:bg-slate-900"
        style={{
          left: pos?.left ?? -9999,
          top: pos?.top ?? -9999,
          width: WIDTH,
          maxHeight: `calc(100vh - ${2 * EDGE}px)`,
        }}
      >
        {body}
      </div>
    </Portal>
  );
}
