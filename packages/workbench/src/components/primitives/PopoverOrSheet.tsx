'use client';

// A footer popover that is a drawer on a phone (liveworkspace/docs/specs/004-index/footer-tools-menu.md "On a phone"):
// on a wide screen an AnchoredPopover hanging from its button with a pointer; on a phone a sheet the full width of the
// screen, docked to its foot over a dim scrim, shaped as a phone dialog's sheet is (the dialog hero's band running up
// under the grab handle, as Tab Style's does). The handle drags it closed; a tap on the scrim or Escape closes it, and
// focus goes back to the button. Tools and Get Started both open through it, so the two behave as one. The children
// lay out as a column: the header fixed, their list scrolling (`min-h-0` and its own overflow).
import { useEffect, useRef, type ReactNode } from 'react';
import { Portal, SheetHandle, safeInset, useSheetDrag } from '@liveworkspace/ui';
import { useIsMobileViewport } from '../../hooks/ui/useIsMobileViewport';
import { AnchoredPopover, type AnchoredAlign } from './AnchoredPopover';

// What a host adds for a drill-in (the footer's Tools opening a tool inside itself, footer-tools-menu.md "Opening a
// tool inside Tools"): Escape asked first (true when it stepped back a level), Escape left to a modal the panel opened,
// the layer to draw at, and where a press is not outside it.
export type PopoverOrSheetLevels = {
  onEscape?: () => boolean;
  passEscape?: () => boolean;
  layer?: 'popover' | 'modal';
  keepOpenWithin?: string;
};

export function PopoverOrSheet({
  anchor,
  name,
  width,
  align = 'end',
  onClose,
  levels,
  hidden = false,
  children,
}: {
  anchor: HTMLElement;
  name: string;
  width: number;
  align?: AnchoredAlign;
  onClose: () => void;
  levels?: PopoverOrSheetLevels;
  // Open but out of sight, taking no press or focus (a tool stepping aside, footer-tools-menu.md "Stepping aside").
  hidden?: boolean;
  children: (sheet: boolean) => ReactNode;
}) {
  const sheet = useIsMobileViewport();
  if (!sheet) {
    return (
      <AnchoredPopover
        anchor={anchor}
        name={name}
        width={width}
        align={align}
        pointer
        onClose={onClose}
        onEscape={levels?.onEscape}
        passEscape={levels?.passEscape}
        layer={levels?.layer}
        keepOpenWithin={levels?.keepOpenWithin}
        hidden={hidden}
      >
        {children(false)}
      </AnchoredPopover>
    );
  }
  return (
    <Drawer anchor={anchor} name={name} onClose={onClose} levels={levels} hidden={hidden}>
      {children(true)}
    </Drawer>
  );
}

function Drawer({
  anchor,
  name,
  onClose,
  levels,
  hidden,
  children,
}: {
  anchor: HTMLElement;
  name: string;
  onClose: () => void;
  levels?: PopoverOrSheetLevels;
  hidden: boolean;
  children: ReactNode;
}) {
  const close = () => {
    onClose();
    anchor.focus({ preventScroll: true });
  };
  const levelsRef = useRef(levels);
  useEffect(() => {
    levelsRef.current = levels;
  });
  useEffect(() => {
    document
      .querySelector<HTMLElement>('[data-popover-sheet] button')
      ?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || levelsRef.current?.passEscape?.()) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (levelsRef.current?.onEscape?.()) return;
      onClose();
      anchor.focus({ preventScroll: true });
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [anchor, onClose]);
  const drag = useSheetDrag(close);
  // With the modals (a tool's view in Tools), so a dialog the tool opens draws over the drawer.
  const modal = levels?.layer === 'modal';
  return (
    <Portal>
      <div
        aria-hidden
        onPointerDown={close}
        className={`fixed inset-0 ${modal ? 'z-[var(--z-modal)]' : 'z-[var(--z-popover)]'} ${hidden ? 'invisible' : ''} bg-slate-900/30 motion-safe:animate-fade-in dark:bg-slate-950/55`}
      />
      <div
        role="dialog"
        aria-label={name}
        data-popover-sheet=""
        style={{ paddingBottom: safeInset('bottom'), ...drag.style }}
        className={`fixed inset-x-0 bottom-0 ${modal ? 'z-[var(--z-modal)]' : 'z-[calc(var(--z-popover)+1)]'} ${hidden ? 'invisible' : ''} flex max-h-[85dvh] w-full animate-sheet-up flex-col overflow-hidden rounded-t-2xl border border-b-0 border-slate-200 bg-white text-sm shadow-[0_-8px_40px_-12px_rgb(0_0_0/0.25)] dark:border-slate-700 dark:bg-slate-900`}
      >
        {/* Over the band, which runs up under it (HeroDialogHeader `underHandle`). */}
        <SheetHandle handleProps={drag.handleProps} className="relative z-10" />
        {children}
      </div>
    </Portal>
  );
}
