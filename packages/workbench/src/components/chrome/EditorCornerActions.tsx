'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { Glyph, HoverCard } from '@liveworkspace/ui';
import {
  CORNER_CARD_EVENT,
  STRIP_MENU_GAP_PX,
  STRIP_NAMED_EVENT,
  cornerCardCompact,
} from '../canvas/menu-join';
import { AuthControls } from './AuthControls';
import { useUiScale } from '../providers/ui-scale';
import { toSurfacePx, uiScaleStyle } from '../../lib/ui-scale';
import { HeaderShareIcon } from './EditorHeader';

// Experiment (livediagram, livedocuments): no header bar. The header's right-edge actions (Copy, Present, Share and the account) float in a card of
// their own at the canvas's top right, the same card as the menu card at its top left. The account control is the
// shared AuthControls, drawn as a header action; styles/corner-actions.css redraws it as a button in
// this card.

// One button in the card: 36px tall like the menu card's, its glyph beside its name (the glyph alone on a phone).
export const CORNER_BTN =
  'flex h-9 min-w-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2.5 phone:px-0 [[data-compact]_&]:px-0 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50';
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
  // Make a Copy's hover card, in the app's own noun: "Duplicate this canvas into your own files."
  copyDescription: string;
};

export function EditorCornerActions({
  showShare,
  shareable,
  onOpenShare,
  onMakeCopy,
  copying = false,
  present,
  onOpenAccount,
  copyDescription,
}: EditorCornerActionsProps) {
  // Drawn at the toolbar's UI scale (docs/specs/007-editor/ui-scale.md), as the palette strip and the menu card are,
  // so the three stand the same height in one row, still 12px from the corner.
  const scale = useUiScale('toolbar');
  // The palette strip keeps clear of this card (stripRoomBesideMenu): tell it when the card mounts, resizes (Share
  // arriving after hydration, Sign in becoming the account) or goes.
  const cardRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const root = document.documentElement;
    const say = () => {
      // A phone's strip row spans the top and keeps this much room at its right for the card: its width (layout px,
      // the strip's own scale) and the strip's gap.
      if (cardRef.current) {
        root.style.setProperty(
          '--corner-card-room',
          `${cardRef.current.offsetWidth + STRIP_MENU_GAP_PX}px`,
        );
      } else root.style.removeProperty('--corner-card-room');
      window.dispatchEvent(new Event(CORNER_CARD_EVENT));
    };
    say();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(say);
    observer?.observe(el);
    return () => {
      observer?.disconnect();
      // After this commit, so the card is gone when the strip measures.
      requestAnimationFrame(say);
    };
  }, []);
  // Its names go before the palette's (cornerCardCompact): once the palette, named, no longer fits beside the card
  // with its names, the card shows its glyphs alone. Judged by its width WITH names, kept from when it last had them,
  // so dropping them never undoes the call.
  const [compact, setCompact] = useState(false);
  const wide = useRef(0);
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const judge = () => {
      if (!compact) wide.current = el.getBoundingClientRect().width;
      const next = cornerCardCompact(wide.current);
      if (next !== compact) setCompact(next);
    };
    judge();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(judge);
    observer?.observe(el);
    const menu = document.querySelector<HTMLElement>('[data-toolbar-menu]');
    if (menu) observer?.observe(menu);
    window.addEventListener('resize', judge);
    window.addEventListener(STRIP_NAMED_EVENT, judge);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', judge);
      window.removeEventListener(STRIP_NAMED_EVENT, judge);
    };
  }, [compact]);
  return (
    // A zero-height layer over the canvas, so the canvas keeps the whole height a header bar took.
    // Not `data-app-chrome` (the header bar's, which keeps the app's own colours): it takes the tab's style, as the
    // palette strip and the menu card beside it do.
    <div className="relative z-[var(--z-modal)] h-0">
      <div
        ref={cardRef}
        data-corner-actions=""
        data-compact={compact ? '' : undefined}
        data-floating-panel=""
        // Fades with the panel-opacity preference as the palette strip does, so the two read as one row of chrome.
        data-panel-translucent=""
        data-region="header"
        style={
          scale === 1
            ? undefined
            : { ...uiScaleStyle(scale), top: toSurfacePx(12, scale), right: toSurfacePx(12, scale) }
        }
        className="pointer-events-auto absolute right-3 top-3 flex h-[46px] items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-md shadow-slate-900/5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:shadow-slate-950/40"
      >
        {onMakeCopy ? (
          <HoverCard title="Make a Copy" description={copyDescription}>
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
              <span className="phone:sr-only [[data-compact]_&]:sr-only">
                {copying ? 'Copying' : 'Copy'}
              </span>
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
              <span className="phone:sr-only [[data-compact]_&]:sr-only">
                {present.starting ? 'Starting' : 'Present'}
              </span>
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
              <span className="phone:sr-only [[data-compact]_&]:sr-only">Share</span>
            </button>
          </HoverCard>
        ) : null}
        <AuthControls onOpenAccount={onOpenAccount} />
      </div>
    </div>
  );
}
