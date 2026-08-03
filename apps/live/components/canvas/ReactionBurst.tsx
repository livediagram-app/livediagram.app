'use client';

import { useEffect, useRef } from 'react';

import { SHAPE_DEFAULT_SIZE, type Reaction } from '@livediagram/diagram';

import { drawParticle, spawnBurst, stepParticles, type Particle } from '@/lib/reaction-particles';

// The burst a Reaction Pad throws (spec/135), drawn on a canvas.
//
// It used to be a dozen emoji spans on one CSS keyframe. That could not be
// made good: every particle followed the same interpolation between the same
// two transforms, so there was no velocity, no gravity, no drag and no tumble,
// and the whole thing read as clip-art sliding across the screen. Spectacle
// needs a hundred particles that disagree with each other, and a hundred
// animated DOM nodes with per-particle keyframes is both slower and harder to
// read than one canvas and a step function.
//
// The physics live in lib/reaction-particles.ts as pure functions. This file
// is the surface, the clock and the cleanup.

/** Hard stop, in ms. Every reaction's particles die well inside this. */
export const BURST_MS = 2600;

/**
 * How much bigger than the pad the canvas is, per side.
 *
 * The burst is supposed to leave the element — confetti that stopped at the
 * pad's edge would be a rectangle of paper. 2 means the canvas is 5x the pad
 * in each dimension (2 either side plus the pad itself), which is enough for
 * the fastest confetti at its default speed without paying for a surface the
 * size of the viewport.
 */
const OVERSCAN = 2;

export function ReactionBurst({
  reaction,
  seed,
  width,
  height,
  onDone,
}: {
  reaction: Reaction;
  // Changes per burst, so pressing again restarts rather than continuing.
  seed: number;
  // The pad's size in canvas px, so a big pad throws a proportionally big
  // burst instead of the same small one in a larger box.
  width: number;
  height: number;
  onDone: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // The callback changes identity every render; the animation must not.
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Reduced motion: draw one still frame of the burst at its widest and
    // leave it. The reaction is celebration rather than information, so
    // somebody who asked for less motion loses nothing by getting a picture.
    const still =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

    const boxW = Math.max(1, width * (1 + OVERSCAN * 2));
    const boxH = Math.max(1, height * (1 + OVERSCAN * 2));
    // Cap the backing store at 2x. A 3x phone painting a hundred sparks gains
    // nothing a person can see and costs fill rate on every frame.
    const dpr = Math.min(2, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1);
    canvas.width = Math.round(boxW * dpr);
    canvas.height = Math.round(boxH * dpr);
    canvas.style.width = `${boxW}px`;
    canvas.style.height = `${boxH}px`;

    // Deterministic per burst: the same seed replays the same burst, which is
    // what makes the effect debuggable, and two presses still differ because
    // the seed does.
    let s = (seed * 2654435761 + 1) % 4294967296;
    const rand = () => {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    };

    const scale = Math.min(3, Math.max(0.55, width / SHAPE_DEFAULT_SIZE['reaction-pad'].width));
    let particles: Particle[] = spawnBurst(reaction, scale, rand);

    const paint = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, boxW, boxH);
      ctx.save();
      // Origin at the pad's centre, which is where every reaction spawns from.
      ctx.translate(boxW / 2, boxH / 2);
      // Additive blending: overlapping sparks and confetti build up light
      // instead of the topmost one flatly covering the rest.
      ctx.globalCompositeOperation = 'lighter';
      for (const p of particles) drawParticle(ctx, p);
      ctx.restore();
    };

    if (still) {
      // Step straight into the middle of the burst, draw it once, stop.
      particles = stepParticles(particles, 0.45);
      paint();
      const timer = window.setTimeout(() => doneRef.current(), 900);
      return () => window.clearTimeout(timer);
    }

    let raf = 0;
    let last = performance.now();
    const started = last;

    const frame = (now: number) => {
      // Clamped: a backgrounded tab resumes with a huge delta, and without
      // this the whole burst would teleport to its end state in one step.
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      particles = stepParticles(particles, dt);
      paint();
      if (particles.length === 0 || now - started > BURST_MS) {
        doneRef.current();
        return;
      }
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [reaction, seed, width, height]);

  return (
    <canvas
      ref={canvasRef}
      // Pointer-inert and centred on the pad. `z-10` so the burst is over the
      // element's own face but still under the selection chrome.
      className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
      aria-hidden
    />
  );
}
