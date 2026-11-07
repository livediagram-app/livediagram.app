'use client';

// The Call dock (docs/specs/008-canvas/avatar-mode.md "The Call dock"): the call's buttons on a card of their own,
// bottom centre, while you walk (owner, 2026-11-07: "Audio, Camera and Share buttons should be moved from the palette
// and put as buttons in the bottom ... center them"). It holds the call group (CallStripGroup: the microphone, the
// camera, Share Screen) and, while you share, the Screen Share group after it. The card
// draws nothing while neither shows (`empty:hidden`), so a role with no call and no preview sees no empty frame.
// On a phone it sits in the bottom-right cluster's row (`inRow`, CanvasChrome lays the row out), on the zoom buttons'
// bottom line rather than a row above them (owner, 2026-11-07, Work Tracker #642).
import { useIsMobileViewport } from '@liveworkspace/workbench/hooks/ui/useIsMobileViewport';
import { useUiScale } from '@liveworkspace/workbench/components/providers/ui-scale';
import { uiScaleStyle } from '@liveworkspace/workbench/lib/ui-scale';
import { PHONE_TOOLBAR_ITEMS } from '@/components/chrome/phone-toolbar-items';
import { TOOLBAR_CARD } from '@/components/chrome/toolbar-surface';
import { Divider } from '@/components/palette/strip-rail-items';
import { CallNames } from './CallSegment';
import { CallStripGroup } from './CallStripGroup';
import { ScreenShareStripGroup, useScreenSharing } from './ScreenShareStripGroup';

export function CallDock({
  doNotDisturb = false,
  onClearDoNotDisturb,
  inRow = false,
}: {
  // Your status is Do Not Disturb, and how to clear it (the avatar status setter).
  doNotDisturb?: boolean;
  onClearDoNotDisturb?: () => void;
  // In the bottom-right cluster's row, its middle column (a phone): placed and scaled by that row rather than floating
  // over the canvas on its own.
  inRow?: boolean;
}) {
  const isMobile = useIsMobileViewport();
  const scale = useUiScale('toolbar');
  const sharing = useScreenSharing();
  return (
    <div
      data-call-dock=""
      data-region="call"
      // Centred along the bottom edge, 16px up. In the cluster's row the row's grid centres it, and the row is drawn
      // at the corner buttons' scale, so it takes no scale of its own there (zooms multiply).
      className={
        inRow
          ? 'pointer-events-none col-start-2 row-start-1 flex justify-center'
          : 'pointer-events-none absolute bottom-4 left-1/2 z-[var(--z-panel)] flex -translate-x-1/2 justify-center'
      }
      style={inRow ? undefined : uiScaleStyle(scale)}
    >
      <div
        data-floating-panel=""
        data-panel-translucent=""
        className={`pointer-events-auto empty:hidden ${TOOLBAR_CARD} ${PHONE_TOOLBAR_ITEMS}`}
        onPointerDown={(e) => e.stopPropagation()}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        {/* Each named beside its glyph with a short label on a desktop (Mic, Camera, Share), glyphs alone on a phone
            (owner, 2026-11-07: "On desktop add short labels to each, on mobile do not"). */}
        <CallNames.Provider value={!isMobile}>
          <CallStripGroup
            doNotDisturb={doNotDisturb}
            onClearDoNotDisturb={onClearDoNotDisturb}
            after={sharing ? <Divider /> : null}
          />
          {sharing ? <ScreenShareStripGroup /> : null}
        </CallNames.Provider>
      </div>
    </div>
  );
}
