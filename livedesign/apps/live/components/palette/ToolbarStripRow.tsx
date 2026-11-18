// The Toolbar layout's strip row and card width (ToolbarPalette.tsx, docs/specs/007-editor/toolbar-layout.md
// "On a phone"). Split out of ToolbarPalette.tsx.
import { PHONE_EDGE_LEFT_IN_ROW } from '@liveworkspace/workbench/components/chrome/MenuCardLogo';
import type { ReactNode, RefObject } from 'react';
import { atLeastInset, safeInlinePadding } from '@livedesign/ui';
import { LANDSCAPE_HANDLE_ROOM } from '@/components/chrome/LandscapeBars';
import { SnapWidth } from '@liveworkspace/workbench/components/primitives/SnapWidth';
import { PACKED_TOOLBAR_ITEMS } from '@liveworkspace/workbench/components/chrome/phone-toolbar-items';
import { TOOLBAR_CARD } from '@liveworkspace/workbench/components/chrome/toolbar-surface';

// The strip's card, and the leading card beside it on a phone. Its 36px items are packed 2px apart, so on a touch
// screen each gets a full 44 x 44 pad behind it and a tap in a gap still picks a tile (PACKED_TOOLBAR_ITEMS,
// docs/specs/004-interface-design/touch-targets.md); the category flyouts hang beside the card, not in it, so the
// card's own stacking context traps none of them.
export const CARD_CLASS = `${TOOLBAR_CARD} ${PACKED_TOOLBAR_ITEMS}`;

// On a phone's row, the menu card sits at the left gutter and the strip beside
// it rather than centred (docs/specs/007-editor/toolbar-layout.md "On a phone");
// held sideways there is no menu card and the strip starts at the gutter. Off a
// phone, the strip alone, centred by its parent.
export function StripRow({
  leading,
  leadingRef,
  children,
}: {
  leading?: ReactNode;
  leadingRef: RefObject<HTMLDivElement | null>;
  children: ReactNode;
}) {
  if (leading === undefined) return <>{children}</>;
  return (
    <div
      // 12px gutters, or a landscape notch's inset where that is bigger (lib/safe-area). Held
      // sideways, the right gutter also clears the bars handle at the canvas's top-right corner
      // (LandscapeBarsHandle), so a long strip's rail scrolls short of it rather than under it.
      style={{
        // 6px on a phone's row (experiment: no header bar), so the strip has every pixel it can.
        ...safeInlinePadding('0.375rem'),
        // Clear of the top-right corner card instead where there is one (EditorCornerActions sets --corner-card-room,
        // its width and the row's 6 px gap: the card now meets the screen's edge, so the gutter is not added to it).
        paddingRight: `calc(max(${atLeastInset('0.375rem', 'right')}, var(--corner-card-room, 0px)) + var(--landscape-handle-room, 0px))`,
      }}
      className={`pointer-events-none flex w-full items-start gap-1.5 [&>*]:pointer-events-auto ${LANDSCAPE_HANDLE_ROOM}`}
    >
      {leading == null ? null : (
        <div
          ref={leadingRef}
          data-strip-leading=""
          className={`${CARD_CLASS} ${PHONE_EDGE_LEFT_IN_ROW}`}
        >
          {leading}
        </div>
      )}
      {children}
    </div>
  );
}

// Centred alone (desktop), the card is whole-pixel wide with the canvas's
// parity (see SnapWidth). Beside the menu card (a phone) it is left-aligned
// and may shrink to the row, its rail scrolling, so it is not snapped there.
export function CardWidth({ swipe, children }: { swipe: boolean; children: ReactNode }) {
  if (swipe) return <div className="flex min-w-0">{children}</div>;
  return <SnapWidth matchParentParity>{children}</SnapWidth>;
}
