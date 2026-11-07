'use client';

// The Call dock (docs/specs/008-canvas/avatar-mode.md "The Call dock"): the call's buttons on a card of their own,
// bottom centre, while you walk (owner, 2026-11-07: "Audio, Camera and Share buttons should be moved from the palette
// and put as buttons in the bottom ... center them"). It holds the call group (CallStripGroup: the microphone, the
// camera, Share Screen) and, while you share, the Screen Share group after it. The card
// draws nothing while neither shows (`empty:hidden`), so a role with no call and no preview sees no empty frame.
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
}: {
  // Your status is Do Not Disturb, and how to clear it (the avatar status setter).
  doNotDisturb?: boolean;
  onClearDoNotDisturb?: () => void;
}) {
  const isMobile = useIsMobileViewport();
  const scale = useUiScale('toolbar');
  const sharing = useScreenSharing();
  return (
    <div
      data-call-dock=""
      data-region="call"
      // Centred along the bottom edge; on a phone, where the bottom-right cluster spans the row, one row above it
      // (16px inset + its 44px buttons + an 8px gap).
      className="pointer-events-none absolute bottom-4 left-1/2 z-[var(--z-panel)] flex -translate-x-1/2 justify-center phone:bottom-[68px]"
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
