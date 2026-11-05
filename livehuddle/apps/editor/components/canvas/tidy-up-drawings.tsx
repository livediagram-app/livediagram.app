import type { ReactNode } from 'react';

// The Tidy Up popover's drawing (docs/specs/008-canvas/layout-cleanup.md "The popover"): a small picture of what
// Auto-align does, boxes in the brand colours on a dot grid, drawn for light and dark alike. Decorative: the
// row's name says it. (Auto Layout's style drawings left with its tiles, Work Tracker #423, part 4.)

// A node: a rounded box in the brand tint.
function Node({ x, y, w = 14, h = 9 }: { x: number; y: number; w?: number; h?: number }) {
  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx={2.5}
      className="fill-brand-100 stroke-brand-500 dark:fill-brand-500/25 dark:stroke-brand-300"
      strokeWidth={1.25}
    />
  );
}

function Frame({
  children,
  width,
  height,
}: {
  children: ReactNode;
  width: number;
  height: number;
}) {
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      aria-hidden="true"
      focusable="false"
      className="shrink-0 overflow-visible"
    >
      {children}
    </svg>
  );
}

// Auto-align: boxes sitting on a dot grid.
export function AutoAlignDrawing() {
  const dots: ReactNode[] = [];
  for (let x = 4; x <= 40; x += 6)
    for (let y = 4; y <= 28; y += 6)
      dots.push(
        <circle
          key={`${x}-${y}`}
          cx={x}
          cy={y}
          r={0.9}
          className="fill-slate-300 dark:fill-slate-600"
        />,
      );
  return (
    <Frame width={44} height={32}>
      {dots}
      <Node x={4} y={4} w={18} h={12} />
      <Node x={22} y={16} w={18} h={12} />
    </Frame>
  );
}
