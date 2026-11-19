'use client';

// The overlay's text kept sharp (docs/specs/008-canvas/3d-view.md "The overlay"): in the 3D view what floats over a
// head is drawn flat on the screen, each card moved and scaled about its speaker's feet to exactly where the camera
// would stand it (space-3d-camera.ts `standingShift`). Drawn through the camera's perspective instead, the browser
// resamples it and every word went soft. The tilt is read from the camera's stage each frame, so the cards follow it
// as the view rises and falls. A pass is a read of each card, then the writes. Passes run a frame at a time only while
// something moves (docs/specs/008-canvas/canvas-performance.md "A still Space does nothing"): woken by a change under
// the overlay (a card added, a speaker's feet moving, the view panning or zooming), by the camera's style changing,
// and by the stage resizing; they carry on while the camera's tilt or turn is still animating or a pass moved a card,
// and stop on the first pass that finds everything where it was.

import { useEffect, type RefObject } from 'react';
import { SPACE_3D_TILT_DEG, standingShift } from '@/lib/space-3d/space-3d-camera';

type Placed = { el: HTMLElement; dx: number; dy: number; scale: number };

export function useFlatBillboards(world: RefObject<HTMLElement | null>, zoom: number): void {
  useEffect(() => {
    let frame = 0;
    // What each card carries now, so its flat place is read back out of its box.
    const carried = new WeakMap<HTMLElement, { dx: number; dy: number; scale: number }>();
    const cameraOf = (stage: HTMLElement | null | undefined) =>
      stage?.parentElement?.querySelector<HTMLElement>(
        ':scope > [data-space-stage]:not([data-space-overlay])',
      ) ?? null;
    // One pass; true when the camera is mid-move or a card moved, so the next frame passes again.
    const pass = (): boolean => {
      const node = world.current;
      const stage = node?.parentElement;
      if (!node || !stage) return false;
      const camera = cameraOf(stage);
      if (!camera || !stage.closest('[data-space-view]')) return false;
      // The camera's tilt and turn now, mid-move too: Rx(tilt)·Rz(turn)'s third column is (0, -sin, cos) of the tilt
      // alone, and its first is (cos turn, sin turn · cos tilt, …) (3d-view.md "Turning the camera").
      const m = getComputedStyle(camera).transform;
      const v = m.startsWith('matrix3d(') ? m.slice(9).split(',').map(parseFloat) : null;
      const cos = v ? (v[10] ?? 1) : 1;
      const tilt = (Math.acos(Math.min(1, Math.max(-1, cos))) * 180) / Math.PI;
      const turn = v && cos > 0.01 ? Math.atan2((v[1] ?? 0) / cos, v[0] ?? 1) : 0;
      const box = stage.getBoundingClientRect();
      const size = { width: box.width, height: box.height };
      const cards = node.querySelectorAll<HTMLElement>('[data-space-billboard]');
      const next: Placed[] = [];
      // Reads first.
      for (const el of cards) {
        const r = el.getBoundingClientRect();
        const [ox = 0, oy = 0] = getComputedStyle(el).transformOrigin.split(' ').map(parseFloat);
        const was = carried.get(el) ?? { dx: 0, dy: 0, scale: 1 };
        // The feet on the screen now, less what this card was moved by: where the flat view has them.
        const flat = {
          x: r.left - box.left + ox * zoom * was.scale - was.dx,
          y: r.top - box.top + oy * zoom * was.scale - was.dy,
        };
        // Where the turned floor carries the feet, then where the tilt stands them.
        const cx = size.width / 2;
        const cy = size.height / 2;
        const turned = {
          x: cx + (flat.x - cx) * Math.cos(turn) - (flat.y - cy) * Math.sin(turn),
          y: cy + (flat.x - cx) * Math.sin(turn) + (flat.y - cy) * Math.cos(turn),
        };
        const t = standingShift(turned, size, tilt);
        const s = { dx: turned.x - flat.x + t.dx, dy: turned.y - flat.y + t.dy, scale: t.scale };
        // Whole pixels once settled, so the words sit on the pixel grid; mid-turn, exact, so nothing steps.
        const settled = Math.abs(tilt - SPACE_3D_TILT_DEG) < 0.01;
        const px = (v: number) => (settled ? Math.round(v) : v);
        next.push({ el, dx: px(s.dx), dy: px(s.dy), scale: s.scale });
      }
      // Then writes, only where a card's place changed.
      let moved = false;
      for (const p of next) {
        const was = carried.get(p.el);
        if (was && was.dx === p.dx && was.dy === p.dy && Math.abs(was.scale - p.scale) < 0.0005)
          continue;
        moved = true;
        carried.set(p.el, { dx: p.dx, dy: p.dy, scale: p.scale });
        p.el.style.setProperty('--space-flat-x', `${p.dx / zoom}px`);
        p.el.style.setProperty('--space-flat-y', `${p.dy / zoom}px`);
        p.el.style.setProperty('--space-flat-scale', p.scale.toFixed(4));
      }
      // A browser without getAnimations (a test's DOM) has no running transition to follow.
      return moved || (camera.getAnimations?.().length ?? 0) > 0;
    };
    const tick = () => {
      frame = pass() ? requestAnimationFrame(tick) : 0;
    };
    const wake = () => {
      if (frame === 0) frame = requestAnimationFrame(tick);
    };
    // What wakes it: anything changing under the overlay's world (its own writes included, which costs one pass
    // that finds nothing to move), the camera's style (a tilt or turn starting), and the stage's size.
    const observer = new MutationObserver(wake);
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(wake);
    const node = world.current;
    const stage = node?.parentElement;
    if (node) observer.observe(node, { attributes: true, childList: true, subtree: true });
    const camera = cameraOf(stage);
    if (camera) observer.observe(camera, { attributes: true });
    if (stage) resize?.observe(stage);
    wake();
    return () => {
      observer.disconnect();
      resize?.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [world, zoom]);
}
