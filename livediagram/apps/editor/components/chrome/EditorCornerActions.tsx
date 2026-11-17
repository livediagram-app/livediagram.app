'use client';

import { Glyph, HoverCard } from '@livediagram/ui';
import { AuthControls } from '@liveworkspace/workbench/components/chrome/AuthControls';
import { HeaderShareIcon } from '@liveworkspace/workbench/components/chrome/EditorHeader';

// Experiment: no header bar. The header's right-edge actions (Copy, Present, Share and the account) float in a card of
// their own at the canvas's top right, the same card as the menu card at its top left. The account control is the
// shared AuthControls, drawn as a header action; `[data-corner-actions]` in globals.css redraws it as a button in
// this card.

// One button in the card: 36px tall like the menu card's, its glyph beside its name.
export const CORNER_BTN =
  'flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50';
const CORNER_TONE =
  'text-slate-600 enabled:hover:bg-slate-100 enabled:hover:text-slate-900 dark:text-slate-200 dark:enabled:hover:bg-slate-800 dark:enabled:hover:text-white';
const CORNER_ON =
  'bg-brand-700 text-white hover:bg-brand-800 dark:bg-brand-600 dark:hover:bg-brand-500';

export type EditorCornerActionsProps = {
  showShare: boolean;
  shareable: boolean;
  onOpenShare: () => void;
  onMakeCopy?: () => void;
  copying?: boolean;
  present?: { slideCount: number; starting: boolean; onPresent: () => void };
  onOpenAccount?: () => void;
};

export function EditorCornerActions({
  showShare,
  shareable,
  onOpenShare,
  onMakeCopy,
  copying = false,
  present,
  onOpenAccount,
}: EditorCornerActionsProps) {
  return (
    // A zero-height layer over the canvas, so the canvas keeps the whole height a header bar took.
    <div data-app-chrome className="relative z-[var(--z-modal)] h-0">
      <div
        data-corner-actions=""
        data-floating-panel=""
        data-region="header"
        className="pointer-events-auto absolute right-3 top-3 flex h-[46px] items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-md shadow-slate-900/5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:shadow-slate-950/40"
      >
        {onMakeCopy ? (
          <HoverCard title="Make a Copy" description="Duplicate this canvas into your own files.">
            <button
              type="button"
              onClick={onMakeCopy}
              disabled={copying}
              className={`${CORNER_BTN} ${CORNER_TONE}`}
            >
              <Glyph size={14} units={16}>
                <rect x="5" y="5" width="8" height="8.5" rx="1.5" />
                <path d="M3 11V3.5A1.5 1.5 0 0 1 4.5 2H10" />
              </Glyph>
              {copying ? 'Copying' : 'Copy'}
            </button>
          </HoverCard>
        ) : null}
        {present ? (
          <HoverCard
            title="Present"
            description={`Present the slide deck: ${present.slideCount} ${present.slideCount === 1 ? 'slide' : 'slides'}.`}
          >
            <button
              type="button"
              onClick={present.onPresent}
              disabled={present.starting}
              data-presentation-start="header"
              className={`${CORNER_BTN} ${CORNER_TONE}`}
            >
              <Glyph size={14} units={16}>
                <path d="M5 3.2v9.6a.6.6 0 0 0 .9.5l7.4-4.8a.6.6 0 0 0 0-1L5.9 2.7a.6.6 0 0 0-.9.5Z" />
              </Glyph>
              {present.starting ? 'Starting' : 'Present'}
            </button>
          </HoverCard>
        ) : null}
        {showShare ? (
          <HoverCard
            title={shareable ? 'Shared' : 'Share'}
            description={shareable ? 'Click to manage links.' : 'Invite collaborators with a link.'}
          >
            <button
              type="button"
              data-tour-id="share"
              onClick={onOpenShare}
              aria-pressed={shareable}
              className={`${CORNER_BTN} ${shareable ? CORNER_ON : CORNER_TONE}`}
            >
              <HeaderShareIcon />
              Share
            </button>
          </HoverCard>
        ) : null}
        <AuthControls onOpenAccount={onOpenAccount} />
      </div>
    </div>
  );
}
