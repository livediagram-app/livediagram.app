import { describe, expect, it } from 'vitest';
import { canvasCursorClass, computeDockAnchor } from './canvas-chrome';

describe('computeDockAnchor', () => {
  const canvas = { left: 0, top: 0, width: 1000 };
  const popover = 256;
  const rightAligned = 1000 - 256 - 8; // 736

  it('right-aligns to the dock edge, so every button opens in the same spot', () => {
    // The leftmost (Explorer) and a rightmost dock button land at the SAME
    // left — they used to disagree (Explorer drifted toward the centre).
    const leftBtn = computeDockAnchor({ left: 760, bottom: 40, width: 40 }, canvas, popover);
    const rightBtn = computeDockAnchor({ left: 900, bottom: 40, width: 40 }, canvas, popover);
    expect(leftBtn.left).toBe(rightAligned);
    expect(rightBtn.left).toBe(rightAligned);
    expect(leftBtn.top).toBe(40);
  });

  it('points the arrow up at the tapped button', () => {
    const a = computeDockAnchor({ left: 900, bottom: 40, width: 40 }, canvas, popover);
    expect(a.arrowOffset).toBe(920 - rightAligned); // button centre 920
  });

  it('clamps the arrow to stay on the popover', () => {
    // A far-left button would push the arrow off the popover's left edge.
    const a = computeDockAnchor({ left: 100, bottom: 30, width: 40 }, canvas, popover);
    expect(a.left).toBe(rightAligned);
    expect(a.arrowOffset).toBe(14);
  });

  it('clamps to 8px from the left edge on a canvas narrower than the popover', () => {
    const narrow = { left: 0, top: 0, width: 200 };
    const a = computeDockAnchor({ left: 150, bottom: 30, width: 40 }, narrow, popover);
    expect(a.left).toBe(8); // 200 - 256 - 8 = -64, clamped to 8
  });

  it('subtracts the canvas offset so the anchor is canvas-relative', () => {
    const offsetCanvas = { left: 100, top: 50, width: 1000 };
    const a = computeDockAnchor({ left: 880, bottom: 90, width: 40 }, offsetCanvas, popover);
    expect(a.top).toBe(40); // 90 - 50
    expect(a.left).toBe(rightAligned); // width - popover - 8, offset-independent
    expect(a.arrowOffset).toBe(800 - rightAligned); // centre 880 + 20 - 100 = 800
  });
});

describe('canvasCursorClass', () => {
  const rest = {
    pendingDraw: false,
    pan: false,
    marquee: false,
    canvasTool: 'pan',
    spaceHeld: false,
    isPaintMode: false,
    isGroupMode: false,
  };

  it('a pending draw wins over everything', () => {
    expect(canvasCursorClass({ ...rest, pendingDraw: true, pan: true })).toBe('cursor-crosshair');
  });
  it('an active pan shows the grabbing cursor', () => {
    expect(canvasCursorClass({ ...rest, pan: true })).toBe('cursor-grabbing');
  });
  it('an active marquee shows crosshair', () => {
    expect(canvasCursorClass({ ...rest, marquee: true })).toBe('cursor-crosshair');
  });
  it('the laser tool shows crosshair unless Space is held', () => {
    expect(canvasCursorClass({ ...rest, canvasTool: 'laser' })).toBe('cursor-crosshair');
    // Space held suppresses the laser cursor, falling through to the rest
    // (pan tool here -> grab).
    expect(canvasCursorClass({ ...rest, canvasTool: 'laser', spaceHeld: true })).toBe(
      'cursor-grab',
    );
  });
  it('the resting pan tool shows grab; select shows crosshair', () => {
    expect(canvasCursorClass({ ...rest, canvasTool: 'pan' })).toBe('cursor-grab');
    expect(canvasCursorClass({ ...rest, canvasTool: 'select' })).toBe('cursor-crosshair');
  });
  it('format-paint mode shows copy, group mode shows crosshair', () => {
    expect(canvasCursorClass({ ...rest, canvasTool: 'x', isPaintMode: true })).toBe('cursor-copy');
    expect(canvasCursorClass({ ...rest, canvasTool: 'x', isGroupMode: true })).toBe(
      'cursor-crosshair',
    );
  });
  it('falls back to grab', () => {
    expect(canvasCursorClass({ ...rest, canvasTool: 'x' })).toBe('cursor-grab');
  });
});
