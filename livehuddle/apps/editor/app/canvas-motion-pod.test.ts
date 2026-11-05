import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { POD_DOOR_MS } from '@liveworkspace/avatar/pod';

// The pod's door slides in canvas-motion.css while the walk waits POD_DOOR_MS for it (docs/specs/009-elements/office.md
// "Office Pod"): the two must name the same time, or a character walks through a door still closing.
describe('the pod door motion', () => {
  it('slides for exactly as long as the walk waits', () => {
    const css = readFileSync(fileURLToPath(new URL('./canvas-motion.css', import.meta.url)), 'utf8');
    const rule = /\.lh-pod-door\s*\{\s*transition:\s*transform\s+(\d+)ms/.exec(css);
    expect(Number(rule?.[1])).toBe(POD_DOOR_MS);
  });
});
