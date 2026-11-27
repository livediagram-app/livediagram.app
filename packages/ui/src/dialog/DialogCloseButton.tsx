'use client';

import { lucideX } from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '../icons/lucide-glyph';
import { Tooltip } from '../Tooltip';
import { useDialogDismiss } from './dialog-dismiss';
import { useDialogInline } from './dialog-slot';

// The one close every modal and drawer header wears (liveworkspace/docs/specs/022-interface-design/close-button.md):
// the phone Apps drawer's X in a 44 px circle, the same on a phone and a desktop, so it is as easy to hit with a
// thumb as it is to find with a pointer. Its well is a translucent ink rather than a flat grey, so on white it is the
// drawer's slate-100 and on a tinted band (the hero header's, the start panel's) it takes the band's hue instead of
// sitting on it as a grey disc. `tone="dark"` is the same circle over a dark bar (a video's). A header that hands it
// a longer name ("Close Version History") keeps that name, and its tooltip says it. The guard
// (close-button-guard.test.ts) fails a modal or drawer that types its own. In a phone sheet it closes through the
// dialog (useDialogDismiss), so the sheet slides out before `onClick` runs.

const CloseGlyph = /* @__PURE__ */ lucideGlyph(lucideX, 18);

const TONES = {
  light:
    'bg-slate-900/[0.055] text-slate-700 hover:bg-slate-900/10 active:bg-slate-900/15 dark:bg-white/[0.08] dark:text-slate-200 dark:hover:bg-white/[0.14] dark:active:bg-white/20',
  dark: 'bg-white/10 text-white hover:bg-white/20 active:bg-white/25',
} as const;

export type DialogCloseButtonProps = {
  onClick: () => void;
  /** The accessible name and tooltip; "Close" unless the header names what it closes. */
  label?: string;
  /** `dark` over a dark bar; the default reads on white, slate and a tinted band, light and dark. */
  tone?: keyof typeof TONES;
};

export function DialogCloseButton({
  onClick,
  label = 'Close',
  tone = 'light',
}: DialogCloseButtonProps) {
  const dismiss = useDialogDismiss();
  // Inside Tools the popover's own close, beside its back bar, closes it.
  if (useDialogInline()) return null;
  return (
    <Tooltip label={label}>
      <button
        type="button"
        onClick={() => dismiss(onClick)}
        aria-label={label}
        data-dialog-close=""
        className={`flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 motion-reduce:transition-none ${TONES[tone]}`}
      >
        <CloseGlyph aria-hidden />
      </button>
    </Tooltip>
  );
}
