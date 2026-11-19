'use client';

// Bringing a template start back (each editor's docs/specs/007-editor/start-diagramming.md "Bringing it back"), every
// editor's one copy: once its × has closed it, an empty tab says so in the palette tray, hanging from the strip as the
// mode banners do, with Show Templates to open its start again. It goes with the emptiness: the first element ends it.
// Without a strip on screen it is the same message as a top-centre pill, as a mode banner falls back to (ModeBanner):
// below the top chrome, or clear of a dock where the editor has one (livediagram's Draw). Either way it steps aside
// while a mode's message is up, which takes the same place.
import type { CSSProperties } from 'react';
import { lucideGlyph } from '@liveworkspace/ui';
import { lucideSparkles } from '@liveworkspace/icons/lucide';
import {
  PaletteTray,
  PaletteTrayAction,
  pillPlace,
  usePaletteStripBox,
  useToolbarBox,
} from '../chrome/PaletteTray';
import { TopCenterBanner } from '../chrome/TopCenter';
import { useViewportHeight } from '../../hooks/ui/useViewportHeight';
import { restoreEmptyCard } from '../canvas/empty-card-dismissed';
import { useEmptyCardDismissed } from '../canvas/useEmptyCardDismissed';

const SparklesGlyph = lucideGlyph(lucideSparkles, 15);

export function StartAgainTray({
  closedKey,
  tabName,
  dockSelector,
}: {
  // The closed start's key in the empty-card list (the editor's startClosedKey: the tab, and its mode where it has
  // several).
  closedKey: string;
  tabName: string;
  // The dock the pill stands clear of without a strip (livediagram's `[data-whiteboard-dock]`); absent, the pill sits
  // below the top chrome.
  dockSelector?: string;
}) {
  const closed = useEmptyCardDismissed(closedKey);
  const strip = usePaletteStripBox(closed);
  if (!closed) return null;
  const reopen = () => restoreEmptyCard(closedKey);
  if (!strip) {
    return dockSelector ? (
      <DockedPill dockSelector={dockSelector} tabName={tabName} onReopen={reopen} />
    ) : (
      <StartAgainPill className="top-20" tabName={tabName} onReopen={reopen} />
    );
  }
  return (
    <PaletteTray
      box={strip}
      standing
      lead={<SparklesGlyph />}
      end={<PaletteTrayAction label="Show Templates" onAction={reopen} />}
    >
      {tabName} is empty
    </PaletteTray>
  );
}

type PillProps = { tabName: string; onReopen: () => void };

// Beside a dock: just clear of it, below a top dock and above a bottom one (pillPlace, shared with the template
// example tray). Measured only while it shows.
function DockedPill({ dockSelector, ...pill }: PillProps & { dockSelector: string }) {
  const dock = useToolbarBox(dockSelector);
  const viewportHeight = useViewportHeight();
  return <StartAgainPill style={pillPlace(dock, viewportHeight)} {...pill} />;
}

function StartAgainPill({
  tabName,
  onReopen,
  className = '',
  style,
}: PillProps & { className?: string; style?: CSSProperties }) {
  return (
    <div
      // Steps aside while a mode message (an armed tool's Cancel, a modifier hint) is on screen: both stand in the
      // same place, so they would overlap (globals.css).
      data-yields-to-mode=""
      className={`pointer-events-none fixed inset-x-0 ${className} z-[var(--z-chrome)] flex justify-center px-4 [body[data-explorer-open]_&]:hidden`}
      style={style}
    >
      <TopCenterBanner
        tone="brand"
        shape="card"
        className="pointer-events-auto gap-3 py-1.5 pl-3 pr-1.5 text-sm leading-snug"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <span role="status" className="flex items-center gap-2">
          <SparklesGlyph />
          {tabName} is empty
        </span>
        <button
          type="button"
          onClick={onReopen}
          className="cursor-pointer rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Show Templates
        </button>
      </TopCenterBanner>
    </div>
  );
}
