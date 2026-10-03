'use client';

// "Add a page" (docs/specs/007-editor/illustrate-pages.md "Page kinds"): the + after the last page
// opens this small popover offering the two kinds of page, each a card with a miniature of it and a
// line under its name. Arrow keys move between them, Enter or a press chooses, Escape or an outside
// press closes. On a phone it is a bottom sheet.
import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { PageKind } from '@livediagram/document';
import { useClickOutside, useEscape } from '@livediagram/ui';
import { Portal } from '@/components/primitives/Portal';
import { BottomSheet } from '@/components/primitives/BottomSheet';
import { useIsMobileViewport } from '@/hooks/ui/useIsMobileViewport';
import { VIEWPORT_EDGE_MARGIN as EDGE } from '@/lib/clamp-to-viewport';

const WIDTH = 332;
const GAP = 10;

const KINDS: { kind: PageKind; name: string; line: string }[] = [
  {
    kind: 'infographic',
    name: 'Infographic',
    line: 'A page to lay out: layouts, icons, charts and media.',
  },
  {
    kind: 'document',
    name: 'Document',
    line: 'A page to write on, flowing onto new pages as it grows.',
  },
];

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
    const step = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1;
    cards.current[(at + step + KINDS.length) % KINDS.length]?.focus();
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
        {KINDS.map(({ kind, name, line }, i) => (
          <button
            key={kind}
            ref={(el) => {
              cards.current[i] = el;
            }}
            type="button"
            onClick={() => choose(kind)}
            className="group flex flex-col items-stretch gap-2 rounded-lg border border-slate-200 bg-white p-2 text-left transition hover:border-brand-400 hover:bg-brand-50/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-brand-400 dark:hover:bg-brand-500/10"
          >
            <span className="flex h-24 items-center justify-center rounded-md bg-slate-50 dark:bg-slate-800/70">
              {kind === 'document' ? <DocumentMiniature /> : <InfographicMiniature />}
            </span>
            <span className="px-0.5">
              <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
                {name}
              </span>
              <span className="mt-0.5 block text-xs leading-snug text-slate-500 dark:text-slate-400">
                {line}
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
function InfographicMiniature() {
  return (
    <svg width="58" height="78" viewBox="0 0 58 78" aria-hidden className="drop-shadow-sm">
      <rect width="58" height="78" rx="3" className="fill-white dark:fill-slate-700" />
      <rect
        x="8"
        y="8"
        width="30"
        height="5"
        rx="2"
        className="fill-slate-700 dark:fill-slate-200"
      />
      <rect
        x="8"
        y="16"
        width="20"
        height="3"
        rx="1.5"
        className="fill-slate-300 dark:fill-slate-500"
      />
      <rect
        x="8"
        y="26"
        width="42"
        height="22"
        rx="3"
        className="fill-brand-100 dark:fill-brand-500/25"
      />
      <rect x="13" y="38" width="5" height="7" rx="1" className="fill-brand-500" />
      <rect x="21" y="33" width="5" height="12" rx="1" className="fill-brand-500" />
      <rect x="29" y="30" width="5" height="15" rx="1" className="fill-brand-500" />
      <rect x="37" y="35" width="5" height="10" rx="1" className="fill-brand-500" />
      <circle cx="14" cy="60" r="5" className="fill-amber-400" />
      <circle cx="29" cy="60" r="5" className="fill-emerald-400" />
      <circle cx="44" cy="60" r="5" className="fill-rose-400" />
      <rect
        x="8"
        y="69"
        width="42"
        height="2.5"
        rx="1.25"
        className="fill-slate-200 dark:fill-slate-500"
      />
    </svg>
  );
}

// A sheet of writing: a title, paragraphs, a list and a picture with text wrapping beside it.
function DocumentMiniature() {
  const line = 'fill-slate-300 dark:fill-slate-500';
  return (
    <svg width="58" height="78" viewBox="0 0 58 78" aria-hidden className="drop-shadow-sm">
      <rect width="58" height="78" rx="3" className="fill-white dark:fill-slate-700" />
      <rect
        x="8"
        y="8"
        width="28"
        height="5"
        rx="2"
        className="fill-slate-700 dark:fill-slate-200"
      />
      <rect x="8" y="18" width="42" height="2.5" rx="1.25" className={line} />
      <rect x="8" y="23" width="40" height="2.5" rx="1.25" className={line} />
      <rect x="8" y="28" width="30" height="2.5" rx="1.25" className={line} />
      <rect
        x="8"
        y="36"
        width="17"
        height="14"
        rx="2"
        className="fill-brand-100 dark:fill-brand-500/25"
      />
      <rect x="28" y="36" width="22" height="2.5" rx="1.25" className={line} />
      <rect x="28" y="41" width="20" height="2.5" rx="1.25" className={line} />
      <rect x="28" y="46" width="22" height="2.5" rx="1.25" className={line} />
      <circle cx="10" cy="57" r="1.5" className="fill-brand-500" />
      <rect x="14" y="56" width="30" height="2.5" rx="1.25" className={line} />
      <circle cx="10" cy="62" r="1.5" className="fill-brand-500" />
      <rect x="14" y="61" width="26" height="2.5" rx="1.25" className={line} />
      <rect x="8" y="68" width="38" height="2.5" rx="1.25" className={line} />
    </svg>
  );
}
