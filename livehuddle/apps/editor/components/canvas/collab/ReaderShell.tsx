'use client';

// A piece opened large on screen (docs/specs/008-canvas/avatar-mode.md "The reader"): a dialog centred over a dimmed
// backdrop, its name and Close at the top, focus kept inside, Escape and the backdrop dismissing it. Its type is the
// screen's, not the canvas's, so it reads at any zoom. It looks like every dialog in the app (the shared Dialog's card
// and backdrop, DialogHeader and DialogCloseButton); only the Screen's player keeps a dark bar over its video. Not
// built on Dialog itself: a reader is opened from a piece on the canvas, so it keeps every press and Escape from
// reaching the piece and the walk behind it, which Dialog leaves to its caller. The Screen's large player
// (docs/specs/009-elements/screen-and-room-sign.md "Screen") and the reading pieces' reader share it.
import { useRef, type ReactNode } from 'react';
import { useModalGuard } from '@liveworkspace/workbench/hooks/ui/useModalGuard';
import {
  DialogCloseButton,
  DialogFooter,
  DialogHeader,
  Portal,
  useEscape,
  useFocusTrap,
  type FocusTrapInitial,
} from '@livehuddle/ui';

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
  initialFocus = 'first',
  onBackdrop,
  barStart,
  barActions,
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
  // Where focus lands as it opens: the first control, or the dialog itself (the Arcade's game, where Space must
  // never press Close).
  initialFocus?: FocusTrapInitial;
  // A press on the dim around it: closes, unless the caller does something else (the Arcade pauses a run).
  onBackdrop?: () => void;
  // The dark bar only: what leads the title (a file's app logo), and buttons before Close (the file overlay's Show
  // This Tab on the Screen and Open in its app).
  barStart?: ReactNode;
  barActions?: ReactNode;
  children: ReactNode;
} & { [attr: `data-${string}`]: string | boolean | undefined }) {
  const panel = useRef<HTMLDivElement>(null);
  useFocusTrap(panel, true, initialFocus);
  useEscape(onClose, { capture: true, stopPropagation: true });
  // While open a reader holds the keyboard: walkInputBlocked() reads the guard, so no arrow or W/A/S/D walks the
  // character behind it and the editor's shortcuts stand aside. Fields inside it still type.
  useModalGuard(true);
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
          onClick={onBackdrop ?? onClose}
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
              <DialogCloseButton onClick={onClose} />
            </DialogHeader>
          ) : (
            // Over the Screen's video: a dark bar, its close the one circled X in its dark tone, which reads on black.
            <div className="flex h-13 shrink-0 items-center justify-between gap-3 border-b border-white/10 px-3">
              <span className="flex min-w-0 items-center gap-2">
                {barStart}
                <span className="truncate text-sm font-semibold text-white">{title}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {barActions}
                <DialogCloseButton tone="dark" onClick={onClose} />
              </span>
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
          {footer ? <DialogFooter>{footer}</DialogFooter> : null}
        </div>
      </div>
    </Portal>
  );
}
