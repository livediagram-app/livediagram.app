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
export function computeDockAnchor(
  btnRect: { left: number; bottom: number; width: number },
  canvasRect: { left: number; top: number; width: number },
  popoverWidth: number,
): { left: number; top: number; arrowOffset: number } {
  const centerX = btnRect.left + btnRect.width / 2 - canvasRect.left;
  const bottomY = btnRect.bottom - canvasRect.top;
  const left = Math.max(8, canvasRect.width - popoverWidth - 8);
  const arrowOffset = Math.max(14, Math.min(popoverWidth - 14, centerX - left));
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
  isGroupMode: boolean;
}): string {
  const { pendingDraw, pan, marquee, canvasTool, spaceHeld, isPaintMode, isGroupMode } = input;
  if (pendingDraw) return 'cursor-crosshair';
  if (pan) return 'cursor-grabbing';
  if (marquee) return 'cursor-crosshair';
  if (canvasTool === 'laser' && !spaceHeld) return 'cursor-crosshair';
  if (canvasTool === 'pan' && !spaceHeld) return 'cursor-grab';
  if (canvasTool === 'select') return 'cursor-crosshair';
  if (isPaintMode) return 'cursor-copy';
  if (isGroupMode) return 'cursor-crosshair';
  return 'cursor-grab';
}
