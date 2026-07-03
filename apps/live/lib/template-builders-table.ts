// Table-based template builders: the plan-comparison grid and the RACI
// responsibility matrix. Both are a single `table` element doing the
// real work (header row + column, zebra striping), so users see tables
// earning their keep straight away.

import { createShape, createTable, createText, type Element } from '@livediagram/diagram';

export function buildComparisonTable(cx: number, cy: number): Element[] {
  const cells = [
    ['Feature', 'Basic', 'Pro', 'Enterprise'],
    ['Price', 'Free', '$12 / mo', 'Custom'],
    ['Users', '1', '10', 'Unlimited'],
    ['Storage', '1 GB', '50 GB', '1 TB'],
    ['Analytics', 'No', 'Standard', 'Advanced'],
    ['Support', 'Community', 'Email', '24/7 priority'],
  ];
  const width = 560;
  const height = 360;
  return [
    {
      ...createTable(cx - width / 2, cy - height / 2),
      width,
      height,
      cells,
      headerRow: true,
      headerColumn: true,
      zebra: true,
    },
  ];
}

// RACI matrix for a feature launch: tasks down the side, roles across
// the top, one owner picture per row (a single R and A, sometimes the
// same seat as A/R). A legend of tinted chips beneath spells out the
// four letters, and a bold title above names the initiative being
// chartered.
export function buildRaciMatrix(cx: number, cy: number): Element[] {
  const cells = [
    ['Task', 'Product', 'Design', 'Engineering', 'QA'],
    ['Write the spec', 'A/R', 'C', 'C', 'I'],
    ['Design mock-ups', 'A', 'R', 'C', 'I'],
    ['Build the feature', 'C', 'C', 'A/R', 'I'],
    ['Test the release', 'I', 'I', 'C', 'A/R'],
    ['Announce the launch', 'A/R', 'C', 'I', 'C'],
  ];
  const tableW = 760;
  const tableH = 336;
  const titleH = 48;
  const titleGap = 28;
  const legendGap = 32;
  const legendH = 36;
  const totalH = titleH + titleGap + tableH + legendGap + legendH;
  const x0 = cx - tableW / 2;
  const y0 = cy - totalH / 2;

  const elements: Element[] = [];

  elements.push({
    ...createText(x0, y0),
    width: tableW,
    height: titleH,
    label: 'Feature launch · RACI',
    textSize: 'lg',
    textBold: true,
  });

  elements.push({
    ...createTable(x0, y0 + titleH + titleGap),
    width: tableW,
    height: tableH,
    cells,
    headerRow: true,
    headerColumn: true,
    zebra: true,
    // The task column needs the room; the four role columns share the rest.
    colWidths: [232, null, null, null, null],
  });

  // Legend chips: each letter in the tint family the boards already
  // use (green / blue / amber / slate), locked so the coding survives
  // a theme switch.
  const legend: { label: string; fill: string; stroke: string; text: string }[] = [
    { label: 'R · Responsible', fill: '#dcfce7', stroke: '#86efac', text: '#15803d' },
    { label: 'A · Accountable', fill: '#dbeafe', stroke: '#93c5fd', text: '#1d4ed8' },
    { label: 'C · Consulted', fill: '#fef3c7', stroke: '#fcd34d', text: '#a16207' },
    { label: 'I · Informed', fill: '#e2e8f0', stroke: '#cbd5e1', text: '#475569' },
  ];
  const chipW = 178;
  const chipGap = (tableW - legend.length * chipW) / (legend.length - 1);
  const legendY = y0 + titleH + titleGap + tableH + legendGap;
  legend.forEach((entry, i) => {
    elements.push({
      ...createShape('stadium', x0 + i * (chipW + chipGap), legendY),
      width: chipW,
      height: legendH,
      label: entry.label,
      textSize: 'sm',
      fillColor: entry.fill,
      strokeColor: entry.stroke,
      textColor: entry.text,
      themeLockFill: true,
    });
  });

  return elements;
}
