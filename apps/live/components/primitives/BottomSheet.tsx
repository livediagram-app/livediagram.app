'use client';

import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { Portal, SheetHandle, SHEET_FULL_HEIGHT, useSheetDrag, safeInset } from '@livediagram/ui';
import { COACH_DOCK_FLOOR_VAR } from '@/components/tour/coach-dock/coach-dock-copy';

// The coach dock's floor (docs/specs/007-editor/coach-dock.md "Where it sits"): 0 with no tour in the dock.
const FLOOR = `var(${COACH_DOCK_FLOOR_VAR}, 0px)`;

// A menu as a bottom sheet on a phone (docs/specs/007-editor/live-app.md "Menus are bottom sheets on
// a phone"): the width of the screen (up to 32rem), docked to the bottom edge, at most 60% of its
// height with its own scroll, clear of the home indicator, rising in. A grab handle across its top
// drags it up to fill the screen below the top bar (and back down), or, from rest, down to close it
// past a threshold or on a flick (useSheetDrag). The element
// context menu and the tab menu render through it on a phone; each keeps its own outside-tap and
// Escape handling, which reach the sheet through the forwarded ref.
type BottomSheetProps = Omit<HTMLAttributes<HTMLDivElement>, 'className' | 'style'> & {
  onClose: () => void;
  children: ReactNode;
  // The sheet's stacking layer, as the menu it stands in for uses (`z-[var(--z-overlay)]`).
  zClassName: string;
  // Children that carry their own edge-to-edge sections need no bottom padding.
  flush?: boolean;
};

export const BottomSheet = forwardRef<HTMLDivElement, BottomSheetProps>(function BottomSheet(
  { onClose, children, zClassName, flush = false, ...rest },
  ref,
) {
  const sheet = useSheetDrag(onClose);
  return (
    <Portal>
      <div
        ref={ref}
        data-bottom-sheet=""
        {...rest}
        // While a tour speaks through the coach dock, the sheet rises from the dock's top edge rather than the
        // screen's, so the tour's words and buttons stay in reach under it; the dock already clears the home
        // indicator, and a full sheet gives up the dock's height so it still stops below the top bar.
        style={{
          bottom: FLOOR,
          paddingBottom: `max(0px, calc(${safeInset('bottom')} - ${FLOOR}))`,
          maxHeight: `min(60dvh, calc(100dvh - ${FLOOR} - 3.5rem))`,
          ...sheet.style,
          ...(sheet.style.height === SHEET_FULL_HEIGHT
            ? { height: `calc(${SHEET_FULL_HEIGHT} - ${FLOOR})` }
            : {}),
        }}
        className={`fixed inset-x-0 ${zClassName} mx-auto flex w-full max-w-lg animate-sheet-up flex-col overflow-hidden rounded-t-2xl border border-b-0 border-slate-200 bg-white text-sm shadow-[0_-8px_40px_-12px_rgb(0_0_0/0.25)] dark:border-slate-700 dark:bg-slate-900`}
      >
        {/* The grab handle: the full width of the sheet, that drags it down. */}
        <SheetHandle handleProps={sheet.handleProps} />
        <div
          className={`lvd-menu-stagger flex min-h-0 flex-col overflow-y-auto overscroll-contain ${
            flush ? '' : 'pb-1'
          }`}
        >
          {children}
        </div>
      </div>
    </Portal>
  );
});
