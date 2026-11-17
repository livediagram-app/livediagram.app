'use client';

// The overlay's text kept sharp (docs/specs/008-canvas/3d-view.md "The overlay"): in the 3D view what floats over a
// head is drawn flat on the screen, each card moved and scaled about its speaker's feet to exactly where the camera
// would stand it (space-3d-camera.ts `standingShift`). Drawn through the camera's perspective instead, the browser
// resamples it and every word went soft. The tilt is read from the camera's stage each frame, so the cards follow it
// as the view rises and falls. One pass a frame while the view is 3D: a read of each card, then the writes.

import { useEffect, type RefObject } from 'react';
import { SPACE_3D_TILT_DEG, standingShift } from '@/lib/space-3d/space-3d-camera';

type Placed = { el: HTMLElement; dx: number; dy: number; scale: number };

export function useFlatBillboards(world: RefObject<HTMLElement | null>, zoom: number): void {
  useEffect(() => {
    let frame = 0;
    // What each card carries now, so its flat place is read back out of its box.
    const carried = new WeakMap<HTMLElement, { dx: number; dy: number; scale: number }>();
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const node = world.current;
      const stage = node?.parentElement;
      if (!node || !stage) return;
      const camera = stage.parentElement?.querySelector<HTMLElement>(
        ':scope > [data-space-stage]:not([data-space-overlay])',
      );
      if (!camera || !stage.closest('[data-space-view]')) return;
      // The camera's tilt now, mid-turn too: its matrix's second diagonal entry is the tilt's cosine.
      const m = getComputedStyle(camera).transform;
      const cos = m.startsWith('matrix3d(') ? parseFloat(m.slice(9).split(',')[5] ?? '1') : 1;
      const tilt = (Math.acos(Math.min(1, Math.max(-1, cos))) * 180) / Math.PI;
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
        const s = standingShift(flat, size, tilt);
        // Whole pixels once settled, so the words sit on the pixel grid; mid-turn, exact, so nothing steps.
        const settled = Math.abs(tilt - SPACE_3D_TILT_DEG) < 0.01;
        const px = (v: number) => (settled ? Math.round(v) : v);
        next.push({ el, dx: px(s.dx), dy: px(s.dy), scale: s.scale });
      }
      // Then writes, only where a card's place changed.
      for (const p of next) {
        const was = carried.get(p.el);
        if (was && was.dx === p.dx && was.dy === p.dy && Math.abs(was.scale - p.scale) < 0.0005)
          continue;
        carried.set(p.el, { dx: p.dx, dy: p.dy, scale: p.scale });
        p.el.style.setProperty('--space-flat-x', `${p.dx / zoom}px`);
        p.el.style.setProperty('--space-flat-y', `${p.dy / zoom}px`);
        p.el.style.setProperty('--space-flat-scale', p.scale.toFixed(4));
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [world, zoom]);
}
