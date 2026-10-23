import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Element } from '@livedesign/design';
import { lintResult } from './lint';

const text = (id: string, y: number): Element => ({
  id,
  type: 'text',
  x: 0,
  y,
  width: 200,
  height: 40,
  label: id,
});
const where = { designId: 'D', tabId: 't1' };

afterEach(() => vi.restoreAllMocks());

describe('lintResult', () => {
  it('lints the whole tab, logging with where it ran', () => {
    const infos: unknown[][] = [];
    vi.spyOn(console, 'info').mockImplementation((...args: unknown[]) => void infos.push(args));
    const report = lintResult({ elements: [text('One', 0), text('Two', 8)] }, where);
    expect(report?.counts.warning).toBe(1);
    expect(infos[0]).toEqual([
      '[lint] run',
      expect.objectContaining({ designId: 'D', tabId: 't1' }),
    ]);
  });
});
