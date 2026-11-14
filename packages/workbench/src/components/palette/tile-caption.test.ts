import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { describe, expect, it } from 'vitest';
import { tileCaption } from './tile-caption';

describe('tileCaption', () => {
  it('drops a leading Add and any parenthetical, then Title Cases the rest', () => {
    expect(tileCaption('Add web browser')).toBe('Web Browser');
    expect(tileCaption('Pencil (freehand)')).toBe('Pencil');
    expect(tileCaption('Sticky (note) board')).toBe('Sticky Board');
  });

  it("keeps a tile's own caption", () => {
    expect(tileCaption('Add text', 'Words')).toBe('Words');
  });

  it('reads a label of many tabs before a bracket in linear time', () => {
    const label = `a${'\t'.repeat(50_000)}(`;
    let caption = '';
    const ms = cpuMsOf(() => {
      caption = tileCaption(label);
    });
    expect(caption).toBe('A (');
    expect(ms).toBeLessThan(cpuBudgetMs(50));
  });

  it('reads a label of many unclosed brackets in linear time, and keeps them', () => {
    const label = '('.repeat(50_000);
    let caption = '';
    const ms = cpuMsOf(() => {
      caption = tileCaption(label);
    });
    expect(caption).toBe(label);
    expect(ms).toBeLessThan(cpuBudgetMs(50));
  });

  it('drops a bracket that closes after an unclosed one', () => {
    expect(tileCaption('Shape ((round) corners')).toBe('Shape Corners');
  });
});
