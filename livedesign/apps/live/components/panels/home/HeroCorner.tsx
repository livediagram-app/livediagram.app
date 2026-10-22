'use client';

import { CloseIcon, Tooltip } from '@livedesign/ui';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { useExplorer } from '@/app/explorer/ExplorerContext';
import { commitUserPreferences } from '@/lib/user-preferences';
import { track } from '@/lib/telemetry';
import { HERO_COPY } from '@/app/explorer/home/hero-model';
import { FOCUS_RING } from './home-styles';

// The hero's corner (docs/specs/013-workspace/explorer-home.md "Hiding the banner"): Home's Help, then a close
// that hides the banner for good, as the synced `homeBanner` preference, which Settings turns back on. Drawn
// wherever the hero puts its Help (a phone's row, the pills' row, the wide top right), so the two never part.
export function HeroCorner() {
  const { prefs, ownerId } = useExplorer();
  const hide = () => {
    // A settings flip is told before it is written, so an opt-out still reaches the wire.
    track('UI', 'Toggled', 'HomeBannerOff');
    commitUserPreferences(prefs, { ...prefs, homeBanner: false }, ownerId);
  };
  return (
    <span className="inline-flex items-center gap-1.5">
      <HelpArticleLink article="timeline" variant="button" />
      <Tooltip label={HERO_COPY.hideBanner}>
        <button
          type="button"
          onClick={hide}
          aria-label={HERO_COPY.hideBanner}
          data-home-banner-close=""
          className={`relative flex size-[30px] shrink-0 touch-target cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white ${FOCUS_RING}`}
        >
          <CloseIcon size={14} />
        </button>
      </Tooltip>
    </span>
  );
}
