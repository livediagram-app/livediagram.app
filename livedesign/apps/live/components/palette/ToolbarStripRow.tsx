// The Toolbar layout's strip row and card width (ToolbarPalette.tsx, docs/specs/007-editor/toolbar-layout.md
// "On a phone"). Split out of ToolbarPalette.tsx.
import type { ReactNode, RefObject } from 'react';
import { atLeastInset, safeInlinePadding } from '@livedesign/ui';
import { LANDSCAPE_HANDLE_ROOM } from '@/components/chrome/LandscapeBars';
import { SnapWidth } from '@liveworkspace/workbench/components/primitives/SnapWidth';
import { PHONE_TOOLBAR_ITEMS } from '@/components/chrome/phone-toolbar-items';
import { TOOLBAR_CARD } from '@/components/chrome/toolbar-surface';

// The strip's card, and the leading card beside it on a phone.
export const CARD_CLASS = `${TOOLBAR_CARD} ${PHONE_TOOLBAR_ITEMS}`;

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
        ...safeInlinePadding('0.75rem'),
        paddingRight: `calc(${atLeastInset('0.75rem', 'right')} + var(--landscape-handle-room, 0px))`,
      }}
      className={`pointer-events-none flex w-full items-start gap-2 [&>*]:pointer-events-auto ${LANDSCAPE_HANDLE_ROOM}`}
    >
      {leading == null ? null : (
        <div ref={leadingRef} data-strip-leading="" className={CARD_CLASS}>
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
