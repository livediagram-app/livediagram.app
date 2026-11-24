'use client';

// A footer popover that is a drawer on a phone (liveworkspace/docs/specs/004-index/footer-tools-menu.md "On a phone"):
// on a wide screen an AnchoredPopover hanging from its button with a pointer; on a phone a sheet the full width of the
// screen, docked to its foot over a dim scrim, shaped as a phone dialog's sheet is (the dialog hero's band running up
// under the grab handle, as Tab Style's does): the shared PhoneDrawer every tool panel opens as on a phone
// (liveworkspace/docs/specs/011-workbench/phone-drawers.md). The handle drags it closed; a tap on the scrim or Escape
// closes it; focus is kept inside while it is open, and goes back to the button. Tools and Get Started both open through it, so the two behave as one. The children
// lay out as a column: the header fixed, their list scrolling (`min-h-0` and its own overflow).
import type { ReactNode } from 'react';
import { useIsMobileViewport } from '../../hooks/ui/useIsMobileViewport';
import { AnchoredPopover, type AnchoredAlign } from './AnchoredPopover';
import { PhoneDrawer } from './PhoneDrawer';

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
    <PhoneDrawer
      name={name}
      onClose={() => {
        onClose();
        anchor.focus({ preventScroll: true });
      }}
      layer={levels?.layer}
      hidden={hidden}
      onEscape={levels?.onEscape}
      passEscape={levels?.passEscape}
      attrs={{ 'data-popover-sheet': '' }}
    >
      {children(true)}
    </PhoneDrawer>
  );
}
