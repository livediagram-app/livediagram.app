import { lucidePencilLine } from '@liveplanner/icons/lucide';
import { drawBannerMessage, isHeldPenIntent } from '@/lib/draw-mode';
import { FormatPainterIcon, lucideGlyph } from '@liveplanner/ui';
import { isMobileViewportSync } from '@/lib/responsive';
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import { ModeBanner } from '@/components/chrome/ModeBanner';
import { OfflineBanner } from '@/components/chrome/OfflineBanner';
import { usePaletteStripBox } from '@/components/chrome/PaletteTray';
import { TopCenterRow, TopCenterStack } from '@/components/chrome/TopCenter';
import { useCanvasCovered } from '@/hooks/plan/plan-cover-store';
import { formatBannerMessage } from '@/lib/format-page-brush';

// Everything that floats at the top of the canvas: the active editor-mode banner. (The session timer and the vote's status and
// results walkthrough live in the Session strip's popovers,
// docs/specs/012-collaboration/session-tools.md.) (The multi-selection toolbar now floats over the selection
// itself, via Canvas + FloatingToolbar.) Extracted from CanvasChrome so the
// chrome shell stays lean — this is one cohesive concern (the top-centre
// stack and its non-overlap layout) with its own props.
type TopCenterChromeProps = Pick<
  CanvasProps,
  | 'readOnly'
  | 'participantPalette'
  | 'pendingDraw'
  | 'onCancelDraw'
  | 'onExitFormatTool'
  | 'canvasTool'
  | 'formatSourceId'
  | 'pagesMode'
> & {
  // A whiteboard's dock at the top (docs/specs/023-draw-mode/draw-mode.md "Where the dock sits"):
  // the stack starts beneath it.
  dockOnTop?: boolean;
  // The tab has a Plan board: an armed Plan card's hint says to pick a column, not to add a board first.
  hasPlanBoard?: boolean;
};

export function TopCenterChrome({
  readOnly,
  participantPalette = false,
  pendingDraw,
  hasPlanBoard = false,
  onCancelDraw,
  onExitFormatTool,
  canvasTool,
  formatSourceId,
  pagesMode,
  dockOnTop = false,
}: TopCenterChromeProps) {
  // The palette strip, when it is on screen: the mode banners hang from it as its tray
  // (docs/specs/007-editor/toolbar-layout.md "Layout details"), and the stack starts below the tray.
  const drawBanner = !!pendingDraw && !isHeldPenIntent(pendingDraw);
  const modeBanner = canvasTool === 'format' || drawBanner;
  const strip = usePaletteStripBox(modeBanner);
  // The strip is on screen for an Editor and for a Participant's own palette (docs/specs/013-workspace/share-roles.md):
  // either way the stack starts beneath it, or the timer and banners sit on the palette.
  const stripShown = !readOnly || participantPalette;
  const tray = stripShown && !dockOnTop ? strip : null;
  // A board, view or Sheet covering the canvas: the draw hint moves to the bottom.
  const covered = useCanvasCovered();
  return (
    <TopCenterStack
      below={
        dockOnTop ? 'dock' : stripShown ? (tray && modeBanner ? 'tray' : 'toolbar') : undefined
      }
    >
      {/* Offline (docs/specs/007-editor/load-recovery.md "Offline"): first, since it says whether
          anything else on screen is being saved. */}
      <OfflineBanner readOnly={readOnly === true} />
      {/* The active mode banner. `empty:hidden` collapses the row (and its
          stack gap) when nothing in it is active. */}
      {/* The multi-selection toolbar used to sit here; it now floats over the
          selection (Canvas + FloatingToolbar). */}
      <TopCenterRow className="flex-col sm:flex-row empty:hidden">
        {/* The Format tool (the palette tool): a two-phase guided banner.
            Phase 1 (no source armed) asks the user to pick a base; phase 2
            (source armed) invites them to tap as many targets as they like. */}
        {canvasTool === 'format' ? (
          <ModeBanner
            icon={<FormatPainterIcon />}
            message={formatBannerMessage(formatSourceId, !!pagesMode)}
            actionLabel="Done"
            onAction={onExitFormatTool}
            tray={tray}
          />
        ) : null}

        {/* The banner belongs to a one-shot ARM: "you picked a square, now
            drag one out", with a Cancel because the intent is transient. A
            held pen (a whiteboard pen, the Path tool) is excluded: a tool in
            the hand does not need telling you it is on every time you look up. */}
        {pendingDraw && drawBanner && !covered ? (
          <ModeBanner
            icon={<DrawIcon />}
            message={drawBannerMessage(pendingDraw, isMobileViewportSync(), { hasPlanBoard })}
            onAction={onCancelDraw}
            tray={tray}
          />
        ) : null}
      </TopCenterRow>
      {/* A board covering the canvas fills the top with its header: the hint sits at the bottom instead, clear of
          the columns' headers (docs/specs/026-plan/plan-board.md "Maximised board"). */}
      {pendingDraw && drawBanner && covered ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[var(--z-toolbar)] flex justify-center [&>*]:pointer-events-auto">
          <ModeBanner
            icon={<DrawIcon />}
            message={drawBannerMessage(pendingDraw, isMobileViewportSync(), { hasPlanBoard })}
            onAction={onCancelDraw}
          />
        </div>
      ) : null}
    </TopCenterStack>
  );
}

const DrawIcon = lucideGlyph(lucidePencilLine, 14);
