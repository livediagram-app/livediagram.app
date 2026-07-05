import { CloseIcon } from '@/components/primitives/CloseIcon';

// The dialog header's standard close (×) button — the h-7 square that
// tucks into the title row's top-right corner. Share / Import / Export
// each hand-rolled this identical button; new dialogs should mount this
// instead of re-typing the class string. Dialogs with a deliberately
// different close treatment (the welcome picker's h-8, Settings' p-1
// variant, the sign-in modal's on-gradient white) keep their own.
export function DialogCloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Close"
      className="-mr-2 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
    >
      <CloseIcon />
    </button>
  );
}
