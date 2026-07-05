import { CloseIcon } from '@/components/primitives/CloseIcon';

// The dialog header's standard close (×) button. Two blessed shapes:
// the default h-7 square that tucks into a title row's top-right corner
// (Share / Import / Export / LinkPicker / MoveToFolder), and the
// `compact` p-1 variant with the larger 16px glyph that Settings /
// CanvasTheme / ThemesPane / ImagePicker's slimmer headers use. New
// dialogs should mount one of these instead of re-typing the class
// string — the ThemesPane copy had already dropped a dark-hover token.
// Dialogs with a deliberately different close treatment (the welcome
// picker's h-8, the sign-in modal's on-gradient white) keep their own.
export function DialogCloseButton({
  onClick,
  compact = false,
}: {
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Close"
      className={
        compact
          ? 'rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
          : '-mr-2 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
      }
    >
      {compact ? <CloseIcon size={16} strokeWidth={1.6} /> : <CloseIcon />}
    </button>
  );
}
