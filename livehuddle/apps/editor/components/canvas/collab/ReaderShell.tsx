'use client';

// A piece opened large on screen (docs/specs/008-canvas/avatar-mode.md "The reader"): a dialog centred over a dimmed
// backdrop, a bar with its name and Close, focus kept inside, Escape and the backdrop dismissing it. Its type is the
// screen's, not the canvas's, so it reads at any zoom. The Screen's large player
// (docs/specs/009-elements/screen-and-room-sign.md "Screen") and the reading pieces' reader share it.
import { useRef, type ReactNode } from 'react';
import { lucideX } from '@liveworkspace/icons/lucide';
import { lucideGlyph, Portal, useEscape, useFocusTrap } from '@livehuddle/ui';

const CloseIcon = lucideGlyph(lucideX, 16);
const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

const TONES = {
  dark: {
    panel: 'bg-slate-950 ring-white/10',
    bar: 'border-white/10',
    title: 'text-white',
    close:
      'bg-white/10 text-white ring-white/15 hover:bg-white/20 focus-visible:outline-white active:bg-white/25',
  },
  light: {
    panel:
      'bg-white text-slate-800 ring-slate-900/10 dark:bg-slate-900 dark:text-slate-100 dark:ring-white/10',
    bar: 'border-slate-200 dark:border-slate-700',
    title: 'text-slate-900 dark:text-white',
    close:
      'bg-slate-100 text-slate-700 ring-slate-200 hover:bg-slate-200 focus-visible:outline-sky-500 active:bg-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700 dark:hover:bg-slate-700',
  },
} as const;

export function ReaderShell({
  title,
  onClose,
  tone = 'light',
  widthClassName = 'max-w-[720px]',
  children,
  ...data
}: {
  title: string;
  onClose: () => void;
  tone?: keyof typeof TONES;
  // The panel's width cap: a reader is up to 720 px; the Screen's player is sized to its video.
  widthClassName?: string;
  children: ReactNode;
} & { [attr: `data-${string}`]: string | boolean | undefined }) {
  const panel = useRef<HTMLDivElement>(null);
  useFocusTrap(panel, true, 'first');
  useEscape(onClose, { capture: true, stopPropagation: true });
  const t = TONES[tone];
  return (
    <Portal>
      {/* React events bubble out of a portal to the element it was opened from: kept here, so a press in the reader
          never selects, drags or walks to the piece behind it. */}
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-8"
        onPointerDown={stop}
        onClick={stop}
        onDoubleClick={stop}
      >
        <button
          type="button"
          tabIndex={-1}
          aria-label="Close"
          onClick={onClose}
          className="absolute inset-0 cursor-default bg-slate-950/55 backdrop-blur-[2px]"
        />
        <div
          ref={panel}
          role="dialog"
          tabIndex={-1}
          aria-modal="true"
          aria-label={title}
          {...data}
          className={`relative flex max-h-[calc(100dvh-1.5rem)] w-full flex-col overflow-hidden rounded-2xl shadow-2xl ring-1 outline-none motion-safe:animate-card-rise sm:max-h-[calc(100dvh-4rem)] ${widthClassName} ${t.panel}`}
        >
          <div
            className={`flex h-13 shrink-0 items-center justify-between gap-3 border-b px-3 ${t.bar}`}
          >
            <span className={`truncate text-sm font-semibold ${t.title}`}>{title}</span>
            <button
              type="button"
              onClick={onClose}
              className={`flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-sm font-medium ring-1 transition focus-visible:outline-2 focus-visible:outline-offset-2 ${t.close}`}
            >
              <CloseIcon />
              Close
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </div>
      </div>
    </Portal>
  );
}
