// Small pure helpers for the canvas chrome, lifted out of Canvas.tsx so
// they're unit-testable: the button-popover anchor math and the
// cursor-class decision. Both are referentially transparent — geometry
// / flags in, value out — with no React or DOM dependency.

// Where a popover opened from a button hangs, canvas-relative. It hangs from
// the button's own left edge, kept on the canvas (8px in from either side),
// and `arrowOffset` keeps the pointer triangle aimed at the button, clamped
// to stay on the popover.
//
// `from: 'button'` opens DOWN from the button: the Toolbar layout's menu
// button in the top-left corner (docs/specs/007-editor/toolbar-layout.md).
//
// `from: 'above'` opens UP from a button in the bottom-right cluster (Layers,
// Activity, Collaborate), and `bottom` (the distance from the canvas's bottom
// edge to the button's top) tells the panel to hang there.
// How far below the canvas's top the Toolbar strip ends, with a gap: where what sits under the strip
// starts (the top corner stacks when the strip crowds them, Pages mode's Contents sidebar). The strip
// sits 12px down and is 46px tall; 68px leaves a 10px gap. It is drawn at the UI scale
// (docs/specs/007-editor/ui-scale.md), so only its height scales.
export const toolbarTopClearancePx = (scale: number) => 12 + 46 * scale + 10;

export type DockAnchor = { left: number; top: number; arrowOffset: number; bottom?: number };

export function computeDockAnchor(
  btnRect: { left: number; top?: number; bottom: number; width: number },
  canvasRect: { left: number; top: number; width: number; height?: number },
  popoverWidth: number,
  from: 'button' | 'above',
): DockAnchor {
  const centerX = btnRect.left + btnRect.width / 2 - canvasRect.left;
  const bottomY = btnRect.bottom - canvasRect.top;
  const rightTucked = canvasRect.width - popoverWidth - 8;
  const left = Math.max(8, Math.min(btnRect.left - canvasRect.left, rightTucked));
  const arrowOffset = Math.max(14, Math.min(popoverWidth - 14, centerX - left));
  if (from === 'above') {
    const bottom = (canvasRect.height ?? 0) - ((btnRect.top ?? btnRect.bottom) - canvasRect.top);
    return { left, top: bottomY, arrowOffset, bottom };
  }
  return { left, top: bottomY, arrowOffset };
}

// The Tailwind cursor class for the canvas surface, resolved from the
// current gesture + tool state. Order matters: an in-progress gesture
// (pan / marquee) wins over the resting tool cursor, and holding
// Space (pan override) suppresses the tool cursors.
export function canvasCursorClass(input: {
  pan: boolean;
  marquee: boolean;
  canvasTool: string;
  spaceHeld: boolean;
}): string {
  const { pan, marquee, canvasTool, spaceHeld } = input;
  if (pan) return 'cursor-grabbing';
  if (marquee) return 'cursor-crosshair';
  if (canvasTool === 'pan' && !spaceHeld) return 'cursor-grab';
  if (canvasTool === 'select') return 'cursor-crosshair';
  return 'cursor-grab';
}
