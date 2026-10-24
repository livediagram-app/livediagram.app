import { FormatPainterIcon } from '@liveplanner/ui';
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import { ModeBanner } from '@/components/chrome/ModeBanner';
import { OfflineBanner } from '@/components/chrome/OfflineBanner';
import { usePaletteStripBox } from '@/components/chrome/PaletteTray';
import { TopCenterRow, TopCenterStack } from '@/components/chrome/TopCenter';

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
  | 'onExitFormatTool'
  | 'canvasTool'
  | 'formatSourceId'
>;

export function TopCenterChrome({
  readOnly,
  participantPalette = false,
  onExitFormatTool,
  canvasTool,
  formatSourceId,
}: TopCenterChromeProps) {
  // The palette strip, when it is on screen: the mode banners hang from it as its tray
  // (docs/specs/007-editor/toolbar-layout.md "Layout details"), and the stack starts below the tray.
  const modeBanner = canvasTool === 'format';
  const strip = usePaletteStripBox(modeBanner);
  // The strip is on screen for an Editor and for a Participant's own palette (docs/specs/013-workspace/share-roles.md):
  // either way the stack starts beneath it, or the timer and banners sit on the palette.
  const stripShown = !readOnly || participantPalette;
  const tray = stripShown ? strip : null;
  return (
    <TopCenterStack below={stripShown ? (tray && modeBanner ? 'tray' : 'toolbar') : undefined}>
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
            message={
              formatSourceId
                ? 'Tap elements to paint this style onto them'
                : 'Select a base element to copy its style'
            }
            actionLabel="Done"
            onAction={onExitFormatTool}
            tray={tray}
          />
        ) : null}

      </TopCenterRow>
    </TopCenterStack>
  );
}
