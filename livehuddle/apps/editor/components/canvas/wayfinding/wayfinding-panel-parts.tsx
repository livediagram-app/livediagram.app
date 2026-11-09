'use client';

import { type ReactNode } from 'react';
import { IDENTITY_FILL, identityVars, lazyPanel, lucideGlyph, Tooltip } from '@livehuddle/ui';
import { lucideX } from '@liveworkspace/icons/lucide';
import { initialsOf } from '@liveworkspace/model-core/names';
import { loadWayfindingPopover } from '@/lib/editor-deferred-code';

// What the Stairs', the Elevator's and the Directory's panels are made of (docs/specs/009-elements/directory.md,
// elevator.md, stairs.md): the card's header, who is somewhere, a row's action, and the card itself, which loads the
// first time a piece opens it (docs/specs/016-platform/web-performance.md "A piece's panel").

const CloseIcon = lucideGlyph(lucideX, 15);

/** The floating card (WayfindingPopover), from its own chunk the first time it is drawn. */
export const LazyWayfindingPopover = lazyPanel('wayfinding', loadWayfindingPopover);

/** A face's press props that fetch the card's code as a pointer comes over it or it takes focus. */
export const wayfindingPrefetchProps = {
  onPointerEnter: () => void LazyWayfindingPopover.preload(),
  onFocus: () => void LazyWayfindingPopover.preload(),
} as const;

/** The card's header: the piece's name and one line under it. */
export function WayfindingHeader({
  title,
  line,
  onClose,
}: {
  title: string;
  line: string;
  // A pinned card's way out besides its piece and Escape.
  onClose?: () => void;
}) {
  return (
    <div className="sticky top-0 z-[1] flex items-start gap-2 border-b border-slate-100 bg-white/95 px-3.5 pb-2 pt-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
      <div className="min-w-0 flex-1">
        <h2 className="text-[13px] font-semibold leading-tight">{title}</h2>
        <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{line}</p>
      </div>
      {onClose ? (
        <Tooltip label="Close">
          <button
            type="button"
            aria-label={`Close ${title}`}
            onClick={onClose}
            className="-mr-1.5 -mt-1 flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-sky-500 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            <CloseIcon />
          </button>
        </Tooltip>
      ) : null}
    </div>
  );
}

const MAX_FACES = 4;

/** Who is somewhere: overlapping initials in each person's colour, then +n. */
export function PeopleChips({
  people,
}: {
  people: readonly { id: string; name: string; color: string; self?: boolean }[];
}) {
  if (people.length === 0) return null;
  const shown = people.slice(0, MAX_FACES);
  const names = people.map((p) => (p.self ? `${p.name} (you)` : p.name)).join(', ');
  return (
    <Tooltip label={names}>
      <span className="flex items-center" role="img" tabIndex={0} aria-label={names}>
        {shown.map((p, i) => (
          <span
            key={p.id}
            aria-hidden
            className={`flex h-5 w-5 items-center justify-center rounded-full text-[8.5px] font-semibold text-white ring-2 ring-white dark:ring-slate-900 ${IDENTITY_FILL} ${i > 0 ? '-ml-1.5' : ''}`}
            style={identityVars(p.color)}
          >
            <span className="text-optical-centre">{initialsOf(p.name)}</span>
          </span>
        ))}
        {people.length > MAX_FACES ? (
          <span
            aria-hidden
            className="ml-1 text-[10px] font-medium text-slate-500 dark:text-slate-400"
          >
            +{people.length - MAX_FACES}
          </span>
        ) : null}
      </span>
    </Tooltip>
  );
}

/** A small action on a row: Walk There, Go, a floor's other Elevator. */
export function RowAction({
  children,
  onClick,
  primary = false,
  label,
}: {
  children: ReactNode;
  onClick: () => void;
  primary?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`shrink-0 cursor-pointer rounded-md px-2 py-1 text-[11px] font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 ${
        primary
          ? 'bg-sky-600 text-white hover:bg-sky-700 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400'
          : 'border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800'
      }`}
    >
      {children}
    </button>
  );
}
