import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PAGE_MOTIONS } from '@livepages/document';
import { motionPaint } from './page-motion';
import { motionParts, waveLine, wavePath, type MotionNode } from './page-motion-parts';

// Every motion's parts, read by both the moving layer and the still export (docs/specs/007-editor/
// pages-mode.md "Animated backgrounds").

const paint = motionPaint({ from: '#1e3a8a', to: '#4c1d95' });
const flat = (nodes: readonly MotionNode[]): MotionNode[] =>
  nodes.flatMap((n) => (n.type === 'group' ? [n, ...flat(n.children)] : [n]));
const css = readFileSync(join(__dirname, '..', 'app', 'motion-page.css'), 'utf8');

describe('motionParts', () => {
  it.each(PAGE_MOTIONS)('%s has parts, within the hundred-or-so budget', (motion) => {
    const parts = flat(motionParts(motion, { w: 1920, h: 1080 }, paint));
    expect(parts.length).toBeGreaterThan(0);
    // Dot Wave's grid is the most: 14 columns by 8 rows on a 16:9 slide.
    expect(parts.length).toBeLessThanOrEqual(112);
  });

  it.each(PAGE_MOTIONS)('%s moves only by loops the stylesheet defines', (motion) => {
    for (const part of flat(motionParts(motion, { w: 1920, h: 1080 }, paint))) {
      const anim = 'anim' in part ? part.anim : undefined;
      if (anim) expect(css).toContain(`.pm-${anim.name}`);
    }
  });

  it('lands each part in the same place every time', () => {
    const a = motionParts('bokeh', { w: 800, h: 450 }, paint);
    expect(motionParts('bokeh', { w: 800, h: 450 }, paint)).toEqual(a);
  });

  it('starts every loop at or before zero, so a slide opens mid-motion', () => {
    for (const motion of PAGE_MOTIONS) {
      for (const part of flat(motionParts(motion, { w: 1920, h: 1080 }, paint))) {
        const anim = 'anim' in part ? part.anim : undefined;
        if (anim?.dl !== undefined) expect(anim.dl).toBeLessThanOrEqual(0);
      }
    }
  });
});

describe('the fourth page', () => {
  const parts = (motion: (typeof PAGE_MOTIONS)[number]) =>
    flat(motionParts(motion, { w: 1920, h: 1080 }, paint));

  it('times every radar blip to light as the sweep reaches it', () => {
    const nodes = parts('radar');
    const sweep = nodes.find((n) => n.type === 'box' && n.fill.kind === 'sweep');
    const blips = nodes.filter((n) => n.type === 'box' && n.anim?.name === 'blip');
    expect(blips.length).toBeGreaterThan(0);
    for (const blip of blips) {
      if (blip.type !== 'box' || sweep?.type !== 'box') throw new Error('not a box');
      expect(blip.anim!.d).toBe(sweep.anim!.d);
      // Clockwise from straight up, the angle of the blip's centre from the slide's.
      const cx = blip.left + blip.width / 2 - 960;
      const cy = blip.top + blip.height / 2 - 540;
      const angle = ((Math.atan2(cx, -cy) * 180) / Math.PI + 360) % 360;
      // Its loop starts (lit) when the sweep's edge has turned that far.
      const litAt = (-(blip.anim!.dl ?? 0) % blip.anim!.d) / blip.anim!.d;
      expect((1 - litAt) % 1).toBeCloseTo(angle / 360, 5);
    }
  });

  it('weaves threads that meet themselves where their loop starts again', () => {
    for (const n of parts('threads')) {
      if (n.type === 'wave') {
        expect(n.stroke).toBeGreaterThan(0);
        expect(n.periods % 2).toBe(0);
      }
    }
  });

  it('turns each orbit about the slide, from its own starting angle', () => {
    const orbits = parts('orbits').filter((n) => n.type === 'group');
    expect(orbits.length).toBeGreaterThan(4);
    for (const o of orbits) {
      if (o.type === 'group') expect(o.anim?.name).toBe('orbit');
    }
  });

  it('heads Warp streaks every way round, from the centre', () => {
    const headings = parts('warp').flatMap((n) =>
      n.type === 'box' && n.anim?.name === 'warp' ? [n.anim.r ?? 0] : [],
    );
    expect(Math.min(...headings)).toBeLessThan(10);
    expect(Math.max(...headings)).toBeGreaterThan(340);
  });
});

describe('waveLine', () => {
  it('is the wave outline without its closing run along the bottom', () => {
    expect(wavePath(100, 50, 5, 30, 2)).toBe(`${waveLine(100, 5, 30, 2)} V50 H0 Z`);
  });
});

describe('wavePath', () => {
  it('runs two periods of the width and closes along the bottom', () => {
    const d = wavePath(100, 50, 5, 30, 2);
    expect(d.startsWith('M0 30')).toBe(true);
    expect(d.match(/Q/g)).toHaveLength(4);
    expect(d.endsWith('V50 H0 Z')).toBe(true);
  });
});
