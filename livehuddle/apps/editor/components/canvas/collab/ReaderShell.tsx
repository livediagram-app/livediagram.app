'use client';

// A piece opened large on screen (docs/specs/008-canvas/avatar-mode.md "The reader"): a dialog centred over a dimmed
// backdrop, its name and Close at the top, focus kept inside, Escape and the backdrop dismissing it. Its type is the
// screen's, not the canvas's, so it reads at any zoom. It looks like every dialog in the app (the shared Dialog's card
// and backdrop, DialogHeader and DialogCloseButton); only the Screen's player keeps a dark bar over its video. Not
// built on Dialog itself: a reader is opened from a piece on the canvas, so it keeps every press and Escape from
// reaching the piece and the walk behind it, which Dialog leaves to its caller. The Screen's large player
// (docs/specs/009-elements/screen-and-room-sign.md "Screen") and the reading pieces' reader share it.
import { useRef, type ReactNode } from 'react';
import { lucideX } from '@liveworkspace/icons/lucide';
import {
  DialogCloseButton,
  DialogFooter,
  DialogHeader,
  lucideGlyph,
  Portal,
  Tooltip,
  useEscape,
  useFocusTrap,
} from '@livehuddle/ui';

const CloseIcon = lucideGlyph(lucideX, 16);
const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

const TONES = {
  dark: { panel: 'bg-slate-950 ring-1 ring-white/10' },
  // The shared Dialog's card.
  light: {
    panel:
      'border border-slate-200 bg-white text-slate-800 shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:shadow-slate-950/40',
  },
} as const;

export function ReaderShell({
  title,
  subtitle,
  footer,
  onClose,
  tone = 'light',
  widthClassName = 'max-w-[720px]',
  children,
  ...data
}: {
  title: string;
  // A line under the title (the Room Sign's status chip), on the light tone only.
  subtitle?: ReactNode;
  // The dialog's action row, pinned under the scrolling body (the Room Sign's Knock and Walk In).
  footer?: ReactNode;
  onClose: () => void;
  tone?: keyof typeof TONES;
  // The panel's width cap: a reader is up to 720 px; the Screen's player is sized to its video.
  widthClassName?: string;
  children: ReactNode;
} & { [attr: `data-${string}`]: string | boolean | undefined }) {
  const panel = useRef<HTMLDivElement>(null);
  useFocusTrap(panel, true, 'first');
  useEscape(onClose, { capture: true, stopPropagation: true });
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
          // The shared Dialog's dim.
          className="absolute inset-0 animate-fade-in cursor-default bg-slate-900/40 backdrop-blur-sm dark:bg-slate-950/60"
        />
        <div
          ref={panel}
          role="dialog"
          tabIndex={-1}
          aria-modal="true"
          aria-label={title}
          {...data}
          className={`relative flex max-h-[calc(100dvh-1.5rem)] w-full flex-col overflow-hidden rounded-xl shadow-2xl outline-none motion-safe:animate-dialog-in sm:max-h-[calc(100dvh-4rem)] ${widthClassName} ${TONES[tone].panel}`}
        >
          {tone === 'light' ? (
            <DialogHeader title={title} subtitle={subtitle}>
              <Tooltip label="Close">
                <DialogCloseButton onClick={onClose} />
              </Tooltip>
            </DialogHeader>
          ) : (
            // Over the Screen's video: a dark bar, its Close a labelled button that reads on black.
            <div className="flex h-13 shrink-0 items-center justify-between gap-3 border-b border-white/10 px-3">
              <span className="truncate text-sm font-semibold text-white">{title}</span>
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-white/10 px-3 text-sm font-medium text-white ring-1 ring-white/15 transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:bg-white/25"
              >
                <CloseIcon />
                Close
              </button>
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
          {footer ? <DialogFooter>{footer}</DialogFooter> : null}
        </div>
      </div>
    </Portal>
  );
}
