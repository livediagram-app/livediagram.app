// Small pure helpers for the canvas chrome, lifted out of Canvas.tsx so
// they're unit-testable: the mobile dock-popover anchor math and the
// cursor-class decision. Both are referentially transparent — geometry
// / flags in, value out — with no React or DOM dependency.

// Where a dock popover should open, in canvas-relative px. The dock lives
// at the top-right, so every popover RIGHT-ALIGNS to the dock's right edge
// (8px inside the canvas) and opens in the same right-tucked spot
// regardless of which button was tapped. (Centring under each button left
// the leftmost Explorer popover drifting toward the centre while the
// rightmost panels sat flush right — they no longer disagree.) `arrowOffset`
// keeps the pointer triangle aimed at the tapped button, clamped to stay on
// the popover.
//
// `from: 'button'` is for a lone button that is NOT the dock: the Toolbar
// layout's menu button in the top-left corner (docs/specs/007-editor/toolbar-layout.md). Right-tucking its
// popover would open the Explorer on the far side of the canvas from the
// button that asked for it, so it hangs from the button's own left edge
// instead, still kept on the canvas.
//
// `from: 'above'` is for a button in the bottom-right cluster (Layers, Activity
// in every layout but Floating): the popover opens UP from it, hanging from
// the button's left edge like 'button' does, and `bottom` (the distance from the
// canvas's bottom edge to the button's top) tells the panel to hang there.
// Where a dock-controlled popover hangs, canvas-relative. `bottom` set =
// it opens UP from the button (see 'above' below); unset = down from `top`.
export type DockAnchor = { left: number; top: number; arrowOffset: number; bottom?: number };

export function computeDockAnchor(
  btnRect: { left: number; top?: number; bottom: number; width: number },
  canvasRect: { left: number; top: number; width: number; height?: number },
  popoverWidth: number,
  from: 'dock' | 'button' | 'above' = 'dock',
): DockAnchor {
  const centerX = btnRect.left + btnRect.width / 2 - canvasRect.left;
  const bottomY = btnRect.bottom - canvasRect.top;
  const rightTucked = canvasRect.width - popoverWidth - 8;
  const left = Math.max(
    8,
    from === 'dock' ? rightTucked : Math.min(btnRect.left - canvasRect.left, rightTucked),
  );
  const arrowOffset = Math.max(14, Math.min(popoverWidth - 14, centerX - left));
  if (from === 'above') {
    const bottom = (canvasRect.height ?? 0) - ((btnRect.top ?? btnRect.bottom) - canvasRect.top);
    return { left, top: bottomY, arrowOffset, bottom };
  }
  return { left, top: bottomY, arrowOffset };
}

// The Tailwind cursor class for the canvas surface, resolved from the
// current gesture + tool state. Order matters: an in-progress gesture
// (draw / pan / marquee) wins over the resting tool cursor, and holding
// Space (pan override) suppresses the laser/pan tool cursors.
export function canvasCursorClass(input: {
  pendingDraw: boolean;
  pan: boolean;
  marquee: boolean;
  canvasTool: string;
  spaceHeld: boolean;
  isPaintMode: boolean;
}): string {
  const { pendingDraw, pan, marquee, canvasTool, spaceHeld, isPaintMode } = input;
  if (pendingDraw) return 'cursor-crosshair';
  if (pan) return 'cursor-grabbing';
  if (marquee) return 'cursor-crosshair';
  if (canvasTool === 'laser' && !spaceHeld) return 'cursor-crosshair';
  // Spotlight (docs/specs/008-canvas/canvas-and-palette.md): a custom glowing-dot cursor (see .cursor-spotlight
  // in globals.css) pins the exact centre of the light. Space still pans, so
  // defer to the grab cursor while it's held.
  if (canvasTool === 'spotlight' && !spaceHeld) return 'cursor-spotlight';
  // Avatar mode (docs/specs/008-canvas/avatar-mode.md): every click is "walk over there", so the pointer
  // cursor is the honest affordance. Space still pans, so defer to grab.
  if (canvasTool === 'avatar' && !spaceHeld) return 'cursor-pointer';
  // Eraser shows a custom eraser glyph (see .cursor-eraser in globals.css),
  // unless Space is held for a temporary pan.
  if (canvasTool === 'eraser' && !spaceHeld) return 'cursor-eraser';
  // Isometric view (docs/specs/008-canvas/isometric-view.md) is navigation-only: it pans like Hand, so it
  // shares the grab cursor (grabbing while dragging is handled by the `pan`
  // branch above).
  if (canvasTool === 'isometric' && !spaceHeld) return 'cursor-grab';
  // Format tool (docs/specs/008-canvas/canvas-and-palette.md): the copy cursor in both phases (picking a base
  // and painting onto targets) signals "this click acts on the element".
  if (canvasTool === 'format' && !spaceHeld) return 'cursor-copy';
  if (canvasTool === 'pan' && !spaceHeld) return 'cursor-grab';
  if (canvasTool === 'select') return 'cursor-crosshair';
  if (isPaintMode) return 'cursor-copy';
  return 'cursor-grab';
}
