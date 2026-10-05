'use client';

import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { Portal } from '@/components/primitives/Portal';
import { useSwipeDownDismiss } from '@/hooks/ui/useSwipeDownDismiss';
import { safeInset } from '@/lib/safe-area';

// A menu as a bottom sheet on a phone (docs/specs/007-editor/live-app.md "Menus are bottom sheets on
// a phone"): the width of the screen (up to 32rem), docked to the bottom edge, at most 60% of its
// height with its own scroll, clear of the home indicator, rising in. A grab handle across its top
// drags it down and closes it past a threshold or on a flick (useSwipeDownDismiss). The element
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
  const swipe = useSwipeDownDismiss(onClose);
  return (
    <Portal>
      <div
        ref={ref}
        data-bottom-sheet=""
        {...rest}
        style={{
          paddingBottom: safeInset('bottom'),
          transform: swipe.offset > 0 ? `translateY(${swipe.offset}px)` : undefined,
          transition: swipe.dragging ? 'none' : 'transform var(--transition-duration-micro) ease',
        }}
        className={`fixed inset-x-0 bottom-0 ${zClassName} mx-auto flex max-h-[60dvh] w-full max-w-lg animate-sheet-up flex-col overflow-hidden rounded-t-2xl border border-b-0 border-slate-200 bg-white text-sm shadow-[0_-8px_40px_-12px_rgb(0_0_0/0.25)] dark:border-slate-700 dark:bg-slate-900`}
      >
        {/* The grab handle: the full width of the sheet, 24px tall, that drags it down. */}
        <div
          aria-hidden
          data-sheet-handle=""
          {...swipe.handleProps}
          className="flex h-6 shrink-0 cursor-grab touch-none items-center justify-center"
        >
          <span className="h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-600" />
        </div>
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
