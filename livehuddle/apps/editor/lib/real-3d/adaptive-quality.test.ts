import { describe, expect, it } from 'vitest';
import { FrameGovernor, QUALITY_RATIOS, startLevel } from './adaptive-quality';

describe('startLevel', () => {
  it('starts a strong machine sharpest', () => {
    expect(startLevel({ gpu: 'ANGLE (Apple, Apple M2 Pro)', cores: 12, memoryGb: 8 })).toBe(0);
  });
  it('starts integrated graphics, small machines and phones softer', () => {
    expect(startLevel({ gpu: 'ANGLE (Intel, Intel(R) UHD Graphics 620)', cores: 8 })).toBe(2);
    expect(startLevel({ gpu: 'Apple GPU', cores: 4 })).toBe(2);
    expect(startLevel({ gpu: 'Adreno (TM) 640', mobile: true })).toBe(2);
  });
  it('starts software rendering at the softest', () => {
    expect(startLevel({ gpu: 'Google SwiftShader' })).toBe(QUALITY_RATIOS.length - 1);
  });
});

describe('FrameGovernor', () => {
  it('steps down when frames keep coming late', () => {
    const g = new FrameGovernor(0);
    let changed = false;
    for (let i = 0; i < 45; i++) changed = g.frame(i % 2 ? 30 : 16) || changed;
    expect(changed).toBe(true);
    expect(g.ratio).toBe(1.75);
  });
  it('steps back up only after a long run of easy frames', () => {
    const g = new FrameGovernor(2);
    for (let i = 0; i < 45 * 5; i++) g.frame(16);
    expect(g.level).toBe(2);
    for (let i = 0; i < 45; i++) g.frame(16);
    expect(g.level).toBe(1);
  });
  it('ignores pauses', () => {
    const g = new FrameGovernor(0);
    for (let i = 0; i < 100; i++) g.frame(1000);
    expect(g.level).toBe(0);
  });
});
