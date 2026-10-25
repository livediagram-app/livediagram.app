'use client';

// The Setup Board and Setup Sheet dialog (docs/specs/026-plan/plan-board.md "Setup Board"; docs/specs/029-sheets/sheet.md
// "Setup Sheet"): the editor's shared Dialog (backdrop, focus trap, Escape, aria-modal, the modal guard), never a
// screen inside the element. A glyph, the title, a line, Help and Close; the step indicator (SetupStepper); the step,
// which alone scrolls; and a footer that stays put. A fixed height, so moving between steps never jumps it; the whole
// screen on a phone (the Dialog's edge-to-edge sizes).
import { useEffect, useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { DialogCloseButton } from '@liveplanner/ui';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { useOpenModalCount } from '@liveworkspace/workbench/lib/modal-guard';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { useAppearance } from '@/hooks/ui/useAppearance';
import type { HelpArticleKey } from '@/lib/help-articles';
import { planPalette, type PlanPalette } from './plan-palette';
import { SetupStepper } from './SetupStepper';

// The app's colours for the steps (they draw from a PlanPalette): light or dark as the editor is, never the board's.
export function useSetupPalette(): PlanPalette {
  return planPalette(useAppearance().appearance === 'dark' ? 'dark' : 'light');
}

// Where Enter already means something: typing, pressing a control, following a link.
const OWN_ENTER =
  'input:not([type="checkbox"]):not([type="radio"]), textarea, select, a[href], [contenteditable="true"]';

// Enter presses the primary action, except where it already means something: a text field, a link, a button (an
// option row not yet chosen is picked by it; a chosen one lets it through).
export function entersPrimary(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return true;
  if (target.closest(OWN_ENTER)) return false;
  const button = target.closest('button, [role="button"]');
  if (!button) return true;
  return button.getAttribute('role') === 'radio' && button.getAttribute('aria-checked') === 'true';
}

// The dialog's events stay the dialog's: React carries a portal's events up through the element it was opened from
// (a board's press would select it, a Sheet's focus would take the keys).
const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [tabindex="0"]';

export function SetupDialog({
  open,
  onClose,
  titleId,
  title,
  line,
  icon,
  help,
  palette,
  steps,
  at,
  onStep,
  footer,
  onPrimary,
  wide = false,
  returnFocus,
  children,
}: {
  open: boolean;
  // Escape, Close, the backdrop and Not now / Cancel: the element stays as it is.
  onClose: () => void;
  titleId: string;
  title: string;
  line: string;
  icon: ReactNode;
  help: HelpArticleKey;
  palette: PlanPalette;
  steps: readonly { label: string }[];
  at: number;
  onStep: (i: number) => void;
  footer: ReactNode;
  // The step's primary action, for Enter; absent while it cannot be pressed.
  onPrimary?: (() => void) | undefined;
  // 60 rem rather than 40 on a wide screen (Setup Sheet: its lists and options side by side).
  wide?: boolean;
  // Where focus goes once it has closed (after the focus trap hands it back): the placeholder's button, the board, the
  // grid. Read when it closes, so it can name what the close itself drew.
  returnFocus?: () => void;
  children: ReactNode;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  // A dialog opened over this one (Add New Card Type's type editor) takes Escape alone: this one, counted too, stays.
  const coveredByAnother = useOpenModalCount() > 1;
  const returnRef = useRef(returnFocus);
  useLayoutEffect(() => {
    returnRef.current = returnFocus;
  });
  // On open, the step's first control takes focus (not Help in the header); a frame after it closes, focus goes where
  // the host says, past the trap's own hand-back.
  useEffect(() => {
    if (!open) return;
    const first = bodyRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus({ preventScroll: true });
    return () => {
      requestAnimationFrame(() => returnRef.current?.());
    };
  }, [open]);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // Escape goes on to the Dialog's own listener on the document (it closes); every other key stays here.
    if (e.key === 'Escape') return;
    e.stopPropagation();
    if (e.key !== 'Enter' || e.defaultPrevented || e.nativeEvent.isComposing) return;
    if (e.shiftKey || e.altKey || e.metaKey || e.ctrlKey) return;
    if (!onPrimary || !entersPrimary(e.target)) return;
    e.preventDefault();
    onPrimary();
  };
  return (
    <div
      className="contents"
      onKeyDown={onKeyDown}
      onKeyUp={stop}
      onPointerDown={stop}
      onPointerUp={stop}
      onClick={stop}
      onDoubleClick={stop}
      onContextMenu={stop}
      onWheel={stop}
      onFocus={stop}
      onBlur={stop}
    >
      <Dialog
        open={open}
        onClose={onClose}
        titleId={titleId}
        size={wide ? '3xl' : '2xl'}
        initialFocus="container"
        closeOnEscape={!coveredByAnother}
        className="h-[min(40rem,calc(100dvh-2rem))] max-h-[calc(100dvh-2rem)] overflow-hidden"
      >
        <header className="flex shrink-0 items-start gap-3.5 px-6 pt-6">
          <span
            aria-hidden
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
          >
            {icon}
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id={titleId}
              className="text-[17px] font-semibold text-slate-900 dark:text-slate-100"
            >
              {title}
            </h2>
            <p className="mt-1 text-[13px] leading-snug text-slate-600 dark:text-slate-400">
              {line}
            </p>
          </div>
          <div className="-mt-1 flex shrink-0 items-center gap-0.5">
            <HelpArticleLink article={help} variant="icon" />
            <DialogCloseButton onClick={onClose} />
          </div>
        </header>
        <div className="mt-5 shrink-0 border-b border-slate-100 px-6 pb-4 dark:border-slate-800">
          <SetupStepper
            steps={steps.map((x, i) => ({ id: String(i), label: x.label }))}
            at={at}
            palette={palette}
            onStep={(id) => onStep(Number(id))}
          />
        </div>
        {/* Keyed by the step, so each step opens at its top. */}
        <div
          key={at}
          ref={bodyRef}
          data-setup-body=""
          className="min-h-0 flex-1 overflow-y-auto px-6 py-5"
          style={{ color: palette.text }}
        >
          {children}
        </div>
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-6 py-4 dark:border-slate-800">
          {footer}
        </footer>
      </Dialog>
    </div>
  );
}
