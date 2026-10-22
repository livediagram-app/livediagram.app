// @vitest-environment jsdom
// A chart in a Sheet looks exactly as it would on the canvas (docs/specs/029-sheets/sheet.md "Charts"): drawn by the
// canvas's own element view, so its palette preset, shadow, opacity, animation and indicators reach the page, while
// it sits square at its frame's origin; shown from another tab it loses only its indicators.
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CHART_PALETTES, type ShapeElement } from '@livepages/document';
import { useSheetChartRenderer, sheetChartElement, type BoxedShared } from './sheet-chart-renderer';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const range = { r1: 'aaaa', c1: 'bbbb', r2: 'cccc', c2: 'dddd' };
const pie = (over: Partial<ShapeElement> = {}): ShapeElement => ({
  id: 'chart1',
  type: 'shape',
  shape: 'pie-chart',
  x: 400,
  y: 300,
  width: 260,
  height: 220,
  pieSlices: [
    { label: 'A', value: 3 },
    { label: 'B', value: 2 },
    { label: 'C', value: 1 },
  ],
  chartSource: { sheetId: 'sheet0001', range },
  sheetAnchor: { x: 10, y: 10 },
  ...over,
});

const shared = (): BoxedShared => ({
  isPaintMode: false,
  onBeginDrag: vi.fn(),
  onBeginEdit: vi.fn(),
  onCommitLabel: vi.fn(),
  onCommitTable: vi.fn(),
  onCancelEdit: vi.fn(),
  onFollowLink: vi.fn(),
  onOpenComments: vi.fn(),
  onOpenAction: vi.fn(),
  onOpenNote: vi.fn(),
  onSetPageHeading: vi.fn(),
  onContextSelect: vi.fn(),
  tabLocked: false,
  tabSummaries: [],
  readOnly: false,
});

function Drawn({ element, interactive = true }: { element: ShapeElement; interactive?: boolean }) {
  const renderChart = useSheetChartRenderer(shared(), undefined);
  return <>{renderChart(element, interactive)}</>;
}

const view = () => document.querySelector<HTMLElement>('[data-element-id="chart1"]')!;
const sliceFills = () =>
  [...view().querySelectorAll('path')].map((p) => p.getAttribute('fill')).filter(Boolean);

afterEach(cleanup);

describe('useSheetChartRenderer', () => {
  it('draws through the canvas element view, findable by its element id at the frame origin', () => {
    render(<Drawn element={pie({ rotation: 45 })} />);
    expect(view()).not.toBeNull();
    expect(view().style.left).toBe('0px');
    expect(view().style.top).toBe('0px');
    expect(view().style.transform).not.toContain('rotate');
  });

  it('paints the chart in its palette preset, and plays its animation', async () => {
    render(<Drawn element={pie({ chartPalette: 'sunset', pieAnim: 'spin' })} />);
    const sunset = CHART_PALETTES.find((p) => p.id === 'sunset')!.colors;
    // The live chart view loads on demand (ShapeContentRouter's SheetLinkedChart).
    await waitFor(() => expect(sliceFills().slice(0, 3)).toEqual(sunset.slice(0, 3)));
    expect(view().querySelector('.lvd-pie-spin')).not.toBeNull();
  });

  it('wears its shadow and opacity', () => {
    render(
      <Drawn
        element={pie({ shadow: { offsetX: 6, offsetY: 6, blur: 0, opacity: 0.35 }, opacity: 0.5 })}
      />,
    );
    const style = view().getAttribute('style') ?? '';
    expect(style).toMatch(/shadow/);
    expect(view().style.opacity).toBe('0.5');
  });

  it('shows its comment count, and hides it when drawn from another tab', () => {
    const commented = pie({
      commentThread: {
        resolved: false,
        comments: [
          {
            id: 'c1',
            text: 'Check it',
            authorId: 'me',
            authorName: 'Me',
            authorColor: '#000',
            createdAt: 0,
          },
        ],
      },
    });
    const { unmount } = render(<Drawn element={commented} />);
    expect(view().querySelector('[data-indicators]')).not.toBeNull();
    unmount();
    render(<Drawn element={commented} interactive={false} />);
    expect(view().querySelector('[data-indicators]')).toBeNull();
  });
});

describe('sheetChartElement', () => {
  it('moves the chart to the origin and drops its turn, keeping the rest', () => {
    const out = sheetChartElement(pie({ rotation: 90, chartPalette: 'berry' }));
    expect(out).toMatchObject({ x: 0, y: 0, chartPalette: 'berry', width: 260 });
    expect('rotation' in out).toBe(false);
  });
});
