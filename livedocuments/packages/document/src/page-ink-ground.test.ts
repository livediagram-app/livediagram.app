import { describe, expect, it } from 'vitest';
import { pageFillTone } from './page-content';
import { gradientPosition, pageGroundUnder, PAPER_TONE } from './page-ink-ground';

// docs/specs/007-editor/pages-mode.md "Re-inking": what the page is under an element.
const rect = { x: 100, y: 200, width: 400, height: 800 };

describe('page ground', () => {
  it('measures the paper as white, a solid as itself, a picture as its tone', () => {
    const box = { x: 150, y: 250, width: 10, height: 10 };
    expect(pageGroundUnder(undefined, rect, box)).toEqual({ tones: [PAPER_TONE], mean: '#ffffff' });
    expect(pageGroundUnder({ fill: { kind: 'solid', color: '#123456' } }, rect, box)).toEqual({
      tones: ['#123456'],
      mean: '#123456',
    });
    const image = { kind: 'image', imageId: 'abc', tone: '#336699' } as const;
    expect(pageGroundUnder({ fill: image }, rect, box).tones).toEqual([pageFillTone(image)]);
  });

  it('places a point along a CSS gradient by its angle', () => {
    const top = { x: 300, y: 200 };
    const bottom = { x: 300, y: 1000 };
    expect(gradientPosition(rect, 180, top)).toBeCloseTo(0);
    expect(gradientPosition(rect, 180, bottom)).toBeCloseTo(1);
    expect(gradientPosition(rect, 0, bottom)).toBeCloseTo(0);
    expect(gradientPosition(rect, 90, { x: 100, y: 600 })).toBeCloseTo(0);
    expect(gradientPosition(rect, 90, { x: 500, y: 600 })).toBeCloseTo(1);
    expect(gradientPosition(rect, 180, { x: 300, y: 600 })).toBeCloseTo(0.5);
    expect(gradientPosition({ x: 0, y: 0, width: 0, height: 0 }, 45, { x: 0, y: 0 })).toBe(0.5);
  });

  it('takes the gradient colours across the element, and their mean', () => {
    const fill = { kind: 'gradient', from: '#000000', to: '#ffffff', angle: 180 } as const;
    const nearTop = pageGroundUnder({ fill }, rect, { x: 150, y: 200, width: 100, height: 80 });
    expect(nearTop.tones[0]).toBe('#000000');
    expect(nearTop.tones.length).toBeGreaterThan(1);
    expect(nearTop.tones.every((t) => parseInt(t.slice(1, 3), 16) <= 26)).toBe(true);
    const whole = pageGroundUnder({ fill }, rect, rect);
    expect(whole.tones).toContain('#ffffff');
    expect(whole.mean).toBe('#808080');
  });
});
