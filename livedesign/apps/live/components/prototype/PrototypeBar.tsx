'use client';

// Prototype mode's bar (docs/specs/007-editor/wireframe-pages.md "Prototype mode"): what is playing and where, Previous
// and Next, Copy Prototype Link and Close. On a phone it is a small floating pill over the full-screen screen.
import {
  lucideChevronLeft,
  lucideChevronRight,
  lucideLink,
  lucidePlay,
  lucideX,
} from '@liveworkspace/icons/lucide';
import { lucideGlyph, Tooltip } from '@livedesign/ui';

const PlayIcon = lucideGlyph(lucidePlay, 14);
const PrevIcon = lucideGlyph(lucideChevronLeft, 18);
const NextIcon = lucideGlyph(lucideChevronRight, 18);
const LinkIcon = lucideGlyph(lucideLink, 15);
const CloseIcon = lucideGlyph(lucideX, 18);

const ICON_BTN =
  'inline-flex size-9 cursor-pointer items-center justify-center rounded-lg text-slate-600 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white dark:disabled:hover:bg-transparent';

const PILL_BTN =
  'inline-flex size-10 cursor-pointer items-center justify-center rounded-full text-white transition-colors duration-150 hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent';

export function PrototypeBar({
  phone,
  name,
  place,
  atStart,
  atEnd,
  onStep,
  onClose,
  copyLink,
}: {
  phone: boolean;
  name: string;
  // "3 of 5".
  place: string;
  atStart: boolean;
  atEnd: boolean;
  onStep: (by: 1 | -1) => void;
  onClose: () => void;
  copyLink: (() => void) | null;
}) {
  if (phone) {
    return (
      <div
        data-prototype-bar="phone"
        className="pointer-events-none absolute inset-x-0 z-10 flex justify-center"
        style={{ top: 'max(8px, env(safe-area-inset-top))' }}
      >
        <div className="pointer-events-auto flex items-center gap-0.5 rounded-full bg-slate-900/80 p-1 text-white shadow-lg shadow-black/30 backdrop-blur-md">
          <button
            type="button"
            aria-label="Previous screen"
            className={PILL_BTN}
            disabled={atStart}
            onClick={() => onStep(-1)}
          >
            <PrevIcon />
          </button>
          <span
            aria-live="polite"
            className="min-w-12 px-1 text-center text-xs font-semibold tabular-nums"
          >
            {place}
          </span>
          <button
            type="button"
            aria-label="Next screen"
            className={PILL_BTN}
            disabled={atEnd}
            onClick={() => onStep(1)}
          >
            <NextIcon />
          </button>
          <span aria-hidden className="mx-0.5 h-5 w-px bg-white/25" />
          <button type="button" aria-label="Close prototype" className={PILL_BTN} onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
      </div>
    );
  }
  return (
    <div
      data-prototype-bar="desktop"
      className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-3 sm:px-4 dark:border-slate-800 dark:bg-slate-900"
    >
      <span className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
        <span
          aria-hidden
          className="inline-flex size-7 items-center justify-center rounded-full bg-brand-700 text-white dark:bg-brand-600"
        >
          <PlayIcon />
        </span>
        Prototype
      </span>
      <span aria-hidden className="h-5 w-px shrink-0 bg-slate-200 dark:bg-slate-700" />
      <span aria-live="polite" className="flex min-w-0 items-baseline gap-2 text-sm">
        <span className="truncate font-medium text-slate-800 dark:text-slate-100">{name}</span>
        <span className="shrink-0 tabular-nums text-slate-600 dark:text-slate-300">{place}</span>
      </span>
      <span className="ml-auto flex shrink-0 items-center gap-1">
        <Tooltip label="Previous screen">
          <button
            type="button"
            aria-label="Previous screen"
            className={ICON_BTN}
            disabled={atStart}
            onClick={() => onStep(-1)}
          >
            <PrevIcon />
          </button>
        </Tooltip>
        <Tooltip label="Next screen">
          <button
            type="button"
            aria-label="Next screen"
            className={ICON_BTN}
            disabled={atEnd}
            onClick={() => onStep(1)}
          >
            <NextIcon />
          </button>
        </Tooltip>
        {copyLink ? (
          <button
            type="button"
            aria-label="Copy Prototype Link"
            onClick={copyLink}
            className="ml-2 inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 transition-colors duration-150 hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
          >
            <LinkIcon />
            <span aria-hidden className="hidden md:inline">
              Copy Prototype Link
            </span>
            <span aria-hidden className="md:hidden">
              Copy Link
            </span>
          </button>
        ) : null}
        <span aria-hidden className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" />
        <Tooltip label="Close prototype">
          <button type="button" aria-label="Close prototype" className={ICON_BTN} onClick={onClose}>
            <CloseIcon />
          </button>
        </Tooltip>
      </span>
    </div>
  );
}
