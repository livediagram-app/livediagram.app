'use client';

// Bringing a template start back (docs/specs/007-editor/start-diagramming.md "Bringing it back"): once its × has
// closed it, an empty tab says so in the palette tray, hanging from the strip as the mode banners do, with Show
// Templates to open its start again. It goes with the emptiness: the first element ends it. Without a strip on screen
// it is the same message as a top-centre pill below the top chrome, as a mode banner falls back to (ModeBanner).
// Either way it steps aside while a mode's message is up, which takes the same place.
import { lucideGlyph } from '@livedesign/ui';
import { lucideSparkles } from '@liveworkspace/icons/lucide';
import type { EditorMode } from '@livedesign/design';
import {
  PaletteTray,
  PaletteTrayAction,
  usePaletteStripBox,
} from '@/components/chrome/PaletteTray';
import { TopCenterBanner } from '@/components/chrome/TopCenter';
import { restoreEmptyCard } from '@/components/canvas/empty-card-dismissed';
import { useEmptyCardDismissed } from '@/components/canvas/useEmptyCardDismissed';
import { startClosedKey } from './start-closed-key';

const SparklesGlyph = lucideGlyph(lucideSparkles, 15);

export function StartAgainTray({
  mode,
  tabId,
  tabName,
}: {
  mode: EditorMode;
  tabId: string;
  tabName: string;
}) {
  const key = startClosedKey(tabId, mode);
  const closed = useEmptyCardDismissed(key);
  const strip = usePaletteStripBox(closed);
  if (!closed) return null;
  const reopen = () => restoreEmptyCard(key);
  if (!strip)
    return (
      <div
        // Steps aside while a mode message (an armed tool's Cancel, a modifier hint) is on screen: both stand in the
        // same place, so they would overlap (globals.css).
        data-yields-to-mode=""
        className="pointer-events-none fixed inset-x-0 top-20 z-[var(--z-chrome)] flex justify-center px-4 [body[data-explorer-open]_&]:hidden"
      >
        <TopCenterBanner
          tone="brand"
          className="pointer-events-auto gap-3 py-1.5 pl-3 pr-1.5 text-sm"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <span role="status" className="flex items-center gap-2">
            <SparklesGlyph />
            {tabName} is empty
          </span>
          <button
            type="button"
            onClick={reopen}
            className="cursor-pointer rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Show Templates
          </button>
        </TopCenterBanner>
      </div>
    );
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
