import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PAGE_MOTIONS } from '@livedesign/design';
import { motionPaint } from './page-motion';
import { motionParts, type MotionNode } from '@liveworkspace/page-background/motion-parts';

// Every motion's parts, read by both the moving layer and the still export (docs/specs/007-editor/
// pages-mode.md "Animated backgrounds"). The parts themselves are tested where they live,
// @liveworkspace/page-background; this checks this app's stylesheet runs every loop they ask for.

const paint = motionPaint({ from: '#1e3a8a', to: '#4c1d95' });
const flat = (nodes: readonly MotionNode[]): MotionNode[] =>
  nodes.flatMap((n) => (n.type === 'group' ? [n, ...flat(n.children)] : [n]));
const css = readFileSync(join(__dirname, '..', 'app', 'motion-page.css'), 'utf8');

describe('motionParts', () => {
  it.each(PAGE_MOTIONS)('%s moves only by loops the stylesheet defines', (motion) => {
    for (const part of flat(motionParts(motion, { w: 1920, h: 1080 }, paint))) {
      const anim = 'anim' in part ? part.anim : undefined;
      if (anim) expect(css).toContain(`.pm-${anim.name}`);
    }
  });
});
