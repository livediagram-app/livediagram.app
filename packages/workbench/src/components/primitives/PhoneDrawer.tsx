'use client';

// The drawer a tool panel opens as on a phone (liveworkspace/docs/specs/011-workbench/phone-drawers.md): a sheet the
// full width of a portrait phone (centred, up to 32rem, on one held sideways), docked to the screen's foot over a dim
// scrim and clear of the home indicator. Its grab handle drags it up to fill the screen or down to close
// (useSheetDrag); a tap on the scrim or Escape closes it; focus is kept inside while it is open and goes back to what
// opened it after. Tools and Get Started (PopoverOrSheet) and every editor's cluster popovers (MovablePanel) open
// through it, so all of them behave as one. The children lay out as a column: a header fixed, a body scrolling.
import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { Portal, SheetHandle, safeInset, useFocusTrap, useSheetDrag } from '@liveworkspace/ui';
import { announceToastFloorChange, TOAST_FLOOR_POPOVER } from '@liveworkspace/ui/toast';

export type PhoneDrawerProps = {
  // Its accessible name, unless `labelledBy` names a heading inside it.
  name: string;
  labelledBy?: string;
  onClose: () => void;
  // The layer it draws at: with the popovers (the default), or with the modals, so the menus, confirms and dialogs
  // a panel opens (portalled after it, at the modal layer) draw over it.
  layer?: 'popover' | 'modal';
  // Open but out of sight, taking no press or focus (a tool stepping aside, PopoverOrSheet `hidden`).
  hidden?: boolean;
  // Escape asked first: true when it was taken (a drill-in stepped back a level), the drawer then staying open.
  onEscape?: () => boolean;
  // Escape left alone while true: a modal opened from inside the drawer hears it.
  passEscape?: () => boolean;
  // The sheet element, for a host's own hooks (its keys, its measuring).
  ref?: RefObject<HTMLDivElement | null>;
  // `data-*` attributes on the sheet, for what finds it (`data-floating-panel`, `data-popover-sheet`).
  attrs?: Record<`data-${string}`, string | undefined>;
  children: ReactNode;
};

export function PhoneDrawer({
  name,
  labelledBy,
  onClose,
  layer = 'popover',
  hidden = false,
  onEscape,
  passEscape,
  ref,
  attrs,
  children,
}: PhoneDrawerProps) {
  const own = useRef<HTMLDivElement>(null);
  const sheet = ref ?? own;
  // Read by the one listener below, which stays put for the drawer's life.
  const latest = useRef({ onClose, onEscape, passEscape, hidden });
  useEffect(() => {
    latest.current = { onClose, onEscape, passEscape, hidden };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const now = latest.current;
      if (e.key !== 'Escape' || e.defaultPrevented || now.hidden || now.passEscape?.()) return;
      // Focus in a menu or dialog the panel opened (portalled elsewhere): that one takes its own Escape.
      const focus = document.activeElement;
      const el = sheet.current;
      if (el && focus && focus !== document.body && !el.contains(focus)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (now.onEscape?.()) return;
      now.onClose();
    };
    // Captured on the window: ahead of the editor's own Escape (deselect) and any listener on the document.
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [sheet]);
  useFocusTrap(sheet, !hidden);
  // A floor the toast stack stands on while it shows (phone-drawers.md "Toasts stand on it"), so a standing toast
  // never covers its controls: told on open, on stepping aside or back, and on close.
  useEffect(() => {
    if (hidden) return;
    announceToastFloorChange();
    return announceToastFloorChange;
  }, [hidden]);
  const drag = useSheetDrag(onClose);
  const z = layer === 'modal' ? 'z-[var(--z-modal)]' : 'z-[var(--z-popover)]';
  const off = hidden ? 'invisible' : '';
  return (
    <Portal>
      <div
        aria-hidden
        data-phone-drawer-scrim=""
        // The press ends here: nothing under the scrim (the canvas, an element being voted on) sees any of it, and
        // focus stays where it is until the drawer hands it back. It closes on the click.
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onClose()}
        onContextMenu={(e) => e.preventDefault()}
        className={`fixed inset-0 ${z} ${off} cursor-default bg-slate-900/30 motion-safe:animate-fade-in dark:bg-slate-950/55`}
      />
      <div
        ref={sheet}
        role="dialog"
        aria-modal="true"
        aria-label={labelledBy ? undefined : name}
        aria-labelledby={labelledBy}
        tabIndex={-1}
        data-phone-drawer=""
        data-toast-floor={hidden ? undefined : TOAST_FLOOR_POPOVER}
        {...attrs}
        // A press in it is the drawer's, never a canvas gesture's or a menu's outside press under it.
        onPointerDown={(e) => e.stopPropagation()}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        style={{ paddingBottom: safeInset('bottom'), ...drag.style }}
        className={`fixed inset-x-0 bottom-0 ${z} ${off} mx-auto flex max-h-[85dvh] w-full max-w-lg animate-sheet-up cursor-default flex-col overflow-hidden overscroll-contain rounded-t-2xl border border-b-0 border-slate-200 bg-white text-sm text-slate-900 shadow-[0_-8px_40px_-12px_rgb(0_0_0/0.25)] outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100`}
      >
        {/* Over a hero's band, which runs up under it (HeroDialogHeader `underHandle`). */}
        <SheetHandle handleProps={drag.handleProps} className="relative z-10" />
        {children}
      </div>
    </Portal>
  );
}
