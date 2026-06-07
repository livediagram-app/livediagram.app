// Comparison-table template builder. A single `table` element seeded
// with a plan-comparison grid (header row + header column + zebra
// striping) so users see tables doing real work straight away.

import { createTable, type Element } from '@livediagram/diagram';

export function buildComparisonTable(cx: number, cy: number): Element[] {
  const cells = [
    ['Feature', 'Basic', 'Pro', 'Enterprise'],
    ['Price', 'Free', '$12 / mo', 'Custom'],
    ['Users', '1', '10', 'Unlimited'],
    ['Storage', '1 GB', '50 GB', '1 TB'],
    ['Support', 'Community', 'Email', '24/7 priority'],
  ];
  const width = 520;
  const height = 240;
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
