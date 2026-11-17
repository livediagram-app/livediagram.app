'use client';

// The Call dock (docs/specs/008-canvas/avatar-mode.md "The Call dock"): the call's buttons on a card of their own,
// bottom centre, while you walk (owner, 2026-11-07: "Audio, Camera and Share buttons should be moved from the palette
// and put as buttons in the bottom ... center them"). It holds the call group (CallStripGroup: the microphone, the
// camera, Share Screen) and, while you share, the Screen Share group after it. The card
// draws nothing while neither shows (`empty:hidden`), so a role with no call and no preview sees no empty frame.
// It always sits in the bottom-right cluster's row (CanvasChrome lays the row out), on the zoom buttons' bottom line,
// centred while there is room and moving left rather than ever covering them (owner, 2026-11-07, Work Tracker #642, for
// a phone; Work Tracker 1041 for every width, after Pop Out spilled past the card and over the zoom buttons at 760 px).
// Pop Out ends it, where the browser can open the mini view (Work Tracker 908).
import { useIsMobileViewport } from '@liveworkspace/workbench/hooks/ui/useIsMobileViewport';
import { useMediaQuery } from '@liveworkspace/ui';
import { useUiScale } from '@liveworkspace/workbench/components/providers/ui-scale';
import { uiScaleStyle } from '@liveworkspace/workbench/lib/ui-scale';
import { PHONE_TOOLBAR_ITEMS } from '@/components/chrome/phone-toolbar-items';
import { TOOLBAR_CARD } from '@/components/chrome/toolbar-surface';
import { Divider } from '@/components/palette/strip-rail-items';
import { CallNames } from './CallSegment';
import { CallStripGroup } from './CallStripGroup';
import { PopOutSegment } from './PopOutSegment';
import { ScreenShareStripGroup, useScreenSharing } from './ScreenShareStripGroup';

/** The window width from which the dock names its buttons: below it they would not fit beside the zoom buttons. */
export const CALL_DOCK_NAMED_QUERY = '(min-width: 1024px)';

export function CallDock({
  doNotDisturb = false,
  onClearDoNotDisturb,
}: {
  // Your status is Do Not Disturb, and how to clear it (the avatar status setter).
  doNotDisturb?: boolean;
  onClearDoNotDisturb?: () => void;
}) {
  const isMobile = useIsMobileViewport();
  const wide = useMediaQuery(CALL_DOCK_NAMED_QUERY);
  // Drawn at the toolbar's UI scale, as it was while it floated: the row is drawn at the corner buttons', so the dock
  // takes the difference (zooms multiply). A phone draws both at 100%, so there it takes none.
  const scale = Math.round((useUiScale('toolbar') / useUiScale('cornerButtons')) * 100) / 100;
  const sharing = useScreenSharing();
  return (
    <div
      data-call-dock=""
      data-region="call"
      // The cluster row's middle column: the row's grid centres it on the canvas while there is room. `w-max` keeps
      // the column from ever squeezing the card below its content (Pop Out's two words wrapped and spilled past the
      // card, Work Tracker 1041).
      className="pointer-events-none col-start-2 row-start-1 flex w-max justify-center"
      style={uiScaleStyle(scale)}
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
        {/* Each named beside its glyph with a short label in a wide desktop window (Mic, Camera, Share), glyphs alone
            on a phone (owner, 2026-11-07: "On desktop add short labels to each, on mobile do not") and in a window
            narrower than 1024 px, where the names would not fit beside the zoom buttons (Work Tracker 1041). */}
        <CallNames.Provider value={wide && !isMobile}>
          <CallStripGroup
            doNotDisturb={doNotDisturb}
            onClearDoNotDisturb={onClearDoNotDisturb}
            after={sharing ? <Divider /> : null}
          />
          {sharing ? <ScreenShareStripGroup /> : null}
          {/* The mini view's Pop Out, last (avatar-mode.md "The mini view"). */}
          <PopOutSegment sharing={sharing} />
        </CallNames.Provider>
      </div>
    </div>
  );
}
