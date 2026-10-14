import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PAGE_MOTIONS } from '@livediagram/document';
import { motionPaint } from './page-motion';
import { motionParts, wavePath, type MotionNode } from './page-motion-parts';

// Every motion's parts, read by both the moving layer and the still export (docs/specs/007-editor/
// illustrate-pages.md "Animated backgrounds").

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

describe('wavePath', () => {
  it('runs two periods of the width and closes along the bottom', () => {
    const d = wavePath(100, 50, 5, 30, 2);
    expect(d.startsWith('M0 30')).toBe(true);
    expect(d.match(/Q/g)).toHaveLength(4);
    expect(d.endsWith('V50 H0 Z')).toBe(true);
  });
});
