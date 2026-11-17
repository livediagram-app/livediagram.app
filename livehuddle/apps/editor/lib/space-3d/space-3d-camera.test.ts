import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { pointerToCanvas } from '@/lib/canvas';
import {
  SPACE_3D_PERSPECTIVE_PX,
  SPACE_3D_TILT_DEG,
  SPACE_3D_TILT_MS,
  floorPointAt,
  screenPointOf,
  stageTransform,
} from './space-3d-camera';

const rect = { left: 100, top: 50, width: 1200, height: 800 };
const view = { zoom: 1.25, offset: { x: -340, y: 120 } };

describe('the 3D view camera (docs/specs/008-canvas/3d-view.md "The camera")', () => {
  it('is the flat map at a tilt of 0', () => {
    // The wrapper's rect in the flat view: the world scaled about the canvas's centre.
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const wrapper = {
      left: rect.left + cx + view.zoom * (view.offset.x - cx),
      top: rect.top + cy + view.zoom * (view.offset.y - cy),
    } as DOMRect;
    for (const client of [
      { x: 300, y: 200 },
      { x: 900, y: 790 },
    ]) {
      const flat = pointerToCanvas(client.x, client.y, wrapper, view.zoom);
      const at = floorPointAt(client, rect, view, 0)!;
      expect(at.x).toBeCloseTo(flat.x, 6);
      expect(at.y).toBeCloseTo(flat.y, 6);
    }
  });

  it('keeps the middle of the screen where it was: the tilt turns about it', () => {
    const middle = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    const flat = floorPointAt(middle, rect, view, 0)!;
    const tilted = floorPointAt(middle, rect, view, SPACE_3D_TILT_DEG)!;
    expect(tilted.x).toBeCloseTo(flat.x, 6);
    expect(tilted.y).toBeCloseTo(flat.y, 6);
  });

  it('traces a press back to the floor point that shows there', () => {
    for (const point of [
      { x: 500, y: 200 },
      { x: 1200, y: -600 },
      { x: 120, y: 700 },
    ]) {
      const screen = screenPointOf(point, rect, view, SPACE_3D_TILT_DEG);
      const back = floorPointAt(
        { x: screen.x + rect.left, y: screen.y + rect.top },
        rect,
        view,
        SPACE_3D_TILT_DEG,
      )!;
      expect(back.x).toBeCloseTo(point.x, 4);
      expect(back.y).toBeCloseTo(point.y, 4);
    }
  });

  it('sees further up the screen than the flat map does, and nearer things bigger', () => {
    const top = floorPointAt({ x: rect.left + 600, y: rect.top }, rect, view, SPACE_3D_TILT_DEG)!;
    const flatTop = floorPointAt({ x: rect.left + 600, y: rect.top }, rect, view, 0)!;
    expect(top.y).toBeLessThan(flatTop.y);
    // The same screen width spans more floor at the top (far) than at the bottom (near).
    const span = (y: number) =>
      floorPointAt({ x: rect.left + 1000, y }, rect, view, SPACE_3D_TILT_DEG)!.x -
      floorPointAt({ x: rect.left + 200, y }, rect, view, SPACE_3D_TILT_DEG)!.x;
    expect(span(rect.top)).toBeGreaterThan(span(rect.top + rect.height) * 1.5);
  });

  it('finds no floor above the horizon', () => {
    const tall = { left: 0, top: 0, width: 800, height: 4000 };
    expect(floorPointAt({ x: 400, y: 0 }, tall, view, SPACE_3D_TILT_DEG)).toBeNull();
  });

  it('tilts the stage by a variable, so the tilt transitions', () => {
    expect(stageTransform()).toBe(
      `perspective(${SPACE_3D_PERSPECTIVE_PX}px) rotateX(var(--space-tilt))`,
    );
  });

  it('is the camera the stylesheet draws, and its tilt takes the same time', () => {
    const css = readFileSync(new URL('../../app/space-3d.css', import.meta.url), 'utf8');
    expect(css).toContain(`transform: ${stageTransform()};`);
    expect(css).toContain(`transform ${SPACE_3D_TILT_MS}ms`);
  });
});
