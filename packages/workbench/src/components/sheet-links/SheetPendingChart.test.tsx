// @vitest-environment jsdom
// A chart not linked to a sheet yet on the canvas (each reader app's docs/specs/009-elements/pie-chart.md "Not linked
// yet"): its view faded under the chip, the short words on a narrow chart, the fade alone on a tiny one, and every other
// element (a plain chart, a linked one, a shape) drawn as it is. It reads no context, so every role sees the same.
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ChartSheetSource } from '@liveworkspace/element-model/chart-sheet-source';
import { isSheetPending, SheetPendingChart } from './SheetPendingChart';

afterEach(cleanup);

const source: ChartSheetSource = {
  app: 'liveplanner',
  itemId: 'plan_1',
  sheetId: 'sheet0001',
  range: { r1: 'r001', c1: 'c001', r2: 'r003', c2: 'c002' },
  itemName: 'Budget',
  sheetName: 'Costs',
  a1: 'A1:B3',
  readAt: 1,
};
const chart = (o: Record<string, unknown> = {}) => ({
  id: 'c1',
  type: 'shape',
  shape: 'bar-chart',
  width: 320,
  height: 200,
  ...o,
});

const draw = (element: ReturnType<typeof chart>) =>
  render(
    <SheetPendingChart element={element}>
      <p>the chart</p>
    </SheetPendingChart>,
  );

describe('SheetPendingChart', () => {
  it('fades the chart under a chip that says it is not linked yet', () => {
    draw(chart({ chartSheetPending: true }));
    const fade = document.querySelector<HTMLElement>('[data-sheet-pending-fade]')!;
    expect(fade.style.opacity).toBe('0.3');
    expect(fade.textContent).toBe('the chart');
    expect(screen.getByText('Not linked to a sheet yet')).toBeTruthy();
    // The chip never takes the pointer from the chart.
    expect(document.querySelector('[data-sheet-pending]')!.className).toContain(
      'pointer-events-none',
    );
  });

  it('says the short words on a narrow chart and fades a tiny one alone', () => {
    draw(chart({ chartSheetPending: true, width: 120 }));
    expect(screen.getByText('Not linked yet')).toBeTruthy();
    cleanup();
    draw(chart({ chartSheetPending: true, width: 40, height: 20 }));
    expect(document.querySelector('[data-sheet-pending-fade]')).toBeTruthy();
    expect(document.querySelector('[data-sheet-pending]')).toBeNull();
  });

  it('draws a plain chart, a linked one and any other element as they are', () => {
    for (const el of [
      chart(),
      chart({ chartSheetPending: true, chartSheetSource: source }),
      chart({ chartSheetPending: true, shape: 'square' }),
    ]) {
      draw(el);
      expect(screen.getByText('the chart')).toBeTruthy();
      expect(document.querySelector('[data-sheet-pending-fade]')).toBeNull();
      expect(isSheetPending(el)).toBe(false);
      cleanup();
    }
  });
});
