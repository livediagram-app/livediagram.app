// The laptop wireframe builder, split out of template-builders-wireframes.ts
// (which re-exports it) once the dashboard redesign outgrew a shared file.
// Pure: (cx, cy) -> Element[]. See docs/specs/008-canvas/canvas-and-palette.md "Templates".

import {
  createShape,
  createTable,
  createText,
  type Element,
  type ShapeElement,
} from '@livediagram/document';
import { TEMPLATE_CONTENT_LAYER_ID, TEMPLATE_SCAFFOLD_LAYER_ID } from './template-layers';
import { uiAt } from './template-wireframe-kit';

// Laptop wireframe: a believable analytics dashboard where the screen is the
// star. The laptop is drawn front-on from three plain shapes (the lid with
// its display, a slim base and the hinge notch) rather than the `laptop`
// device shape, whose own keyboard deck takes a third of its height: at
// template size that was a wall of empty keys under a half-empty screen.
// Inside: a top nav (logo, links, search, bell, avatar), a sidebar with the
// active page highlighted, a page header with a date-range pill, a stat row
// of real-looking KPIs with deltas, a weekly line chart and a recent
// sign-ups table. Colours are left to the theme (recolourElementsForTheme)
// like the other wireframes; only the active nav row takes the soft preset.
export function buildLaptopWireframe(cx: number, cy: number): Element[] {
  const lidW = 1240;
  const lidH = 780;
  const bezel = 22;
  const baseW = 1400;
  const baseH = 28;
  const lidX = cx - lidW / 2;
  const lidY = cy - (lidH + baseH) / 2;
  const sx = lidX + bezel;
  const sy = lidY + bezel;
  const screenW = lidW - bezel * 2;
  const screenH = lidH - bezel * 2;

  const frame = (
    x: number,
    y: number,
    w: number,
    h: number,
    extra: Partial<ShapeElement> = {},
  ) => ({
    ...createShape('square', x, y),
    width: w,
    height: h,
    layerId: TEMPLATE_SCAFFOLD_LAYER_ID,
    ...extra,
  });
  // Offsets below are relative to the display's top-left.
  const ui = uiAt(sx, sy);
  const small = { textSize: 'sm' as const };
  const left = { textAlignX: 'left' as const };

  const elements: Element[] = [
    frame(lidX, lidY, lidW, lidH, { borderRadius: 'lg', strokeWidth: 'thick' }),
    frame(sx, sy, screenW, screenH, { borderRadius: 'sm', strokeWidth: 'thin' }),
    frame(cx - baseW / 2, lidY + lidH, baseW, baseH, { borderRadius: 'lg' }),
    frame(cx - 90, lidY + lidH, 180, 10, { borderRadius: 'md', strokeWidth: 'thin' }),
  ];

  // Top nav: brand, three links, a search field and the account corner.
  elements.push(
    ui('square', 16, 16, screenW - 32, 60, { borderRadius: 'md', strokeWidth: 'thin' }),
  );
  elements.push(ui('square', 32, 28, 96, 36, { label: 'Logo', ...small }));
  ['Home', 'Projects', 'Reports'].forEach((label, i) => {
    elements.push(ui('stadium', 150 + i * 100, 28, 88, 36, { label, ...small }));
  });
  elements.push(ui('stadium', 690, 28, 300, 36, { label: 'Search…', ...small }));
  elements.push(ui('icon', 1024, 32, 28, 28, { iconId: 'bell' }));
  elements.push(ui('circle', 1092, 26, 40, 40));

  // Sidebar: the current page is the one tinted row.
  elements.push(ui('square', 16, 92, 200, screenH - 108, { strokeWidth: 'thin' }));
  ['Overview', 'Customers', 'Pipeline', 'Reports', 'Settings'].forEach((label, i) => {
    elements.push(
      ui('square', 28, 108 + i * 52, 176, 40, {
        label,
        ...small,
        ...left,
        ...(i === 0 ? { colorPreset: 'soft', textBold: true } : {}),
      }),
    );
  });
  // The footer row pinned to the sidebar's foot, like a real app's help link.
  elements.push(ui('square', 28, screenH - 16 - 52, 176, 40, { label: 'Help', ...small, ...left }));

  // Main column: header, KPIs, then a chart beside a table.
  const mainX = 232;
  const mainW = screenW - 16 - mainX;
  elements.push({
    ...createText(sx + mainX, sy + 92),
    width: 300,
    height: 44,
    label: 'Overview',
    textSize: 'lg',
    textBold: true,
    ...left,
    layerId: TEMPLATE_CONTENT_LAYER_ID,
  });
  elements.push(
    ui('stadium', mainX + mainW - 160, 96, 160, 36, { label: 'Last 30 days', ...small }),
  );
  elements.push(
    ui('stat-row', mainX, 148, mainW, 104, {
      borderRadius: 'md',
      stats: [
        { value: '12,480', caption: 'Active users ▲ 8%' },
        { value: '$84.2k', caption: 'Revenue ▲ 12%' },
        { value: '3.4%', caption: 'Conversion ▼ 0.2 pts' },
        { value: '1m 52s', caption: 'Avg. session ▲ 5%' },
      ],
    }),
  );
  const lowerY = 272;
  const lowerH = screenH - 16 - lowerY;
  const chartW = 560;
  // The chart and the table each carry a heading, like dashboard cards do.
  const cardHeading = (rx: number, w: number, label: string): Element => ({
    ...createText(sx + rx, sy + lowerY),
    width: w,
    height: 36,
    label,
    textSize: 'md',
    textBold: true,
    ...left,
    layerId: TEMPLATE_CONTENT_LAYER_ID,
  });
  elements.push(cardHeading(mainX, chartW, 'Weekly active users (k)'));
  elements.push(
    ui('line-chart', mainX, lowerY + 44, chartW, lowerH - 44, {
      lineCategories: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6'],
      lineSeries: [
        { name: 'This month', values: [8.1, 9.4, 9.0, 10.8, 11.6, 12.5] },
        { name: 'Last month', values: [7.2, 7.9, 8.4, 8.1, 9.2, 9.6] },
      ],
      chartLegendPosition: 'top',
    }),
  );
  const tableX = mainX + chartW + 20;
  const tableW = mainW - chartW - 20;
  elements.push(cardHeading(tableX, tableW, 'Recent sign-ups'));
  elements.push({
    ...createTable(sx + tableX, sy + lowerY + 44),
    width: tableW,
    height: lowerH - 44,
    cells: [
      ['Customer', 'Plan', 'When'],
      ['Acme Co', 'Pro', '2m ago'],
      ['Globex', 'Team', '1h ago'],
      ['Initech', 'Pro', '3h ago'],
      ['Umbrella', 'Free', 'Yesterday'],
      ['Hooli', 'Team', 'Mon'],
    ],
    headerRow: true,
    zebra: true,
    textSize: 'sm',
    layerId: TEMPLATE_CONTENT_LAYER_ID,
  });

  return elements;
}
