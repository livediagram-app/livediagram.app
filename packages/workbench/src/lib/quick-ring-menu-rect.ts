import type { QuickConnectDirection } from './quick-connect';

// Where a quick-connect ring's menu (docs/specs/008-canvas/canvas-and-palette.md "Quick add + connect") lands on
// screen once open: it fans outward from the plus, `near` px beyond the plus centre, centred across that side. Worked
// out from the plus centre and the menu's layout size rather than measured, because the open animation starts the
// menu scaled to nothing and its live rect is that sliver.
export function quickRingMenuRect(
  plus: { x: number; y: number },
  menu: { width: number; height: number },
  side: QuickConnectDirection,
  near: number,
): DOMRect {
  const { width, height } = menu;
  switch (side) {
    case 'right':
      return new DOMRect(plus.x + near, plus.y - height / 2, width, height);
    case 'left':
      return new DOMRect(plus.x - near - width, plus.y - height / 2, width, height);
    case 'below':
      return new DOMRect(plus.x - width / 2, plus.y + near, width, height);
    case 'above':
      return new DOMRect(plus.x - width / 2, plus.y - near - height, width, height);
  }
}
