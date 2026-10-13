'use client';

// Bringing a template start back (docs/specs/007-editor/start-diagramming.md "Bringing it back"): once its × has
// closed it, an empty Diagram, Facilitate or Illustrate tab says so in the palette tray, hanging from the strip as the
// mode banners do, with Show Templates to open its start again. It goes with the emptiness: the first element ends
// it. Without a strip on screen (Draw's dock) it is the same message as a top-centre pill, as a mode banner falls
// back to (ModeBanner).
import { lucideGlyph } from '@livediagram/ui';
import { lucideSparkles } from '@livediagram/icons/lucide';
import {
  PaletteTray,
  PaletteTrayAction,
  usePaletteStripBox,
  useToolbarBox,
} from '@/components/chrome/PaletteTray';
import { TopCenterBanner } from '@/components/chrome/TopCenter';
import { restoreEmptyCard } from '@/components/canvas/empty-card-dismissed';
import { useEmptyCardDismissed } from '@/components/canvas/useEmptyCardDismissed';
import { startClosedKey } from './start-closed-key';
import type { TemplateStartMode } from './start-template-items';

const SparklesGlyph = lucideGlyph(lucideSparkles, 15);

// The pill's room from the dock it stands clear of, px.
const DOCK_GAP = 10;

// Where the pill goes without a strip: under a dock in the top half of the screen, over one in the bottom half, and
// with no dock, below the top chrome.
export function pillPlace(
  dock: { top: number; bottom: number } | null,
  viewportHeight = typeof window === 'undefined' ? 0 : window.innerHeight,
): { top: number } | { bottom: number } {
  if (!dock) return { top: 80 };
  return dock.top < viewportHeight / 2
    ? { top: dock.bottom + DOCK_GAP }
    : { bottom: viewportHeight - dock.top + DOCK_GAP };
}

export function StartAgainTray({
  mode,
  tabId,
  tabName,
}: {
  mode: TemplateStartMode;
  tabId: string;
  tabName: string;
}) {
  const key = startClosedKey(tabId, mode);
  const closed = useEmptyCardDismissed(key);
  const strip = usePaletteStripBox(closed);
  // Without a strip, Draw's dock: the pill sits just clear of it, below a top dock and above a bottom one.
  const dock = useToolbarBox('[data-whiteboard-dock]', closed && !strip);
  if (!closed) return null;
  const reopen = () => restoreEmptyCard(key);
  if (!strip)
    return (
      <div
        className="pointer-events-none fixed inset-x-0 z-[var(--z-chrome)] flex justify-center px-4 [body[data-explorer-open]_&]:hidden"
        style={pillPlace(dock)}
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
      lead={<SparklesGlyph />}
      end={<PaletteTrayAction label="Show Templates" onAction={reopen} />}
    >
      {tabName} is empty
    </PaletteTray>
  );
}
