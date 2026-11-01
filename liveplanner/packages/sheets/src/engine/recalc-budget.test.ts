import { describe, expect, it, vi } from 'vitest';

// A small read budget, so the whole-recalculation limit is reached in milliseconds.
vi.mock('../limits', async (orig) => ({ ...(await orig<object>()), RECALC_READS_MAX: 20_000 }));

const { book } = await import('../testing/book');

const cpuMs = (fn: () => unknown) => {
  const t = process.cpuUsage();
  fn();
  const d = process.cpuUsage(t);
  return (d.user + d.system) / 1000;
};

describe('the read budget covers the whole recalculation', () => {
  // 100 formulas of 500 reads each: every one is far under the 20,000 budget, together they are 50,000.
  const cells: Record<string, string> = {};
  for (let i = 1; i <= 500; i++) cells[`A${i}`] = '1';
  for (let i = 1; i <= 100; i++) cells[`B${i}`] = '=SUM($A$1:$A$500)';

  it('marks the formulas past the total over budget, read one by one', () => {
    const b = book(cells, { rows: 500, cols: 2 });
    let over = 0;
    const ms = cpuMs(() => {
      for (let i = 1; i <= 100; i++) {
        const v = b.v(`B${i}`);
        if (typeof v === 'object' && v !== null && 'e' in v) over++;
        else expect(v).toBe(500);
      }
    });
    expect(over).toBeGreaterThan(50);
    expect(b.v('B1')).toBe(500);
    expect(b.v('B100')).toMatchObject({ e: '#NUM!' });
    expect(b.wb.truncated).toBe(true);
    expect(ms).toBeLessThan(1_000);
  });

  it('gives the next recalculation a fresh budget', () => {
    const b = book(cells, { rows: 500, cols: 2 });
    for (let i = 1; i <= 100; i++) b.v(`B${i}`);
    expect(b.v('B100')).toMatchObject({ e: '#NUM!' });
    b.set('A1', '2');
    expect(b.v('B100')).toBe(501);
  });
});
