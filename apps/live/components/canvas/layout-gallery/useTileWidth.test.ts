import { describe, expect, it } from 'vitest';
import { tileColumns } from './useTileWidth';

describe('tileColumns', () => {
  it('fits as many tiles as the width holds at their least width', () => {
    expect(tileColumns(500, 156, 8)).toEqual({ cols: 3, tileWidth: (500 - 16) / 3 });
    expect(tileColumns(820, 156, 8).cols).toBe(5);
  });

  it('keeps two columns however narrow, and two fallback tiles before measuring', () => {
    expect(tileColumns(200, 156, 8).cols).toBe(2);
    expect(tileColumns(0, 156, 8)).toEqual({ cols: 2, tileWidth: 168 });
  });
});
