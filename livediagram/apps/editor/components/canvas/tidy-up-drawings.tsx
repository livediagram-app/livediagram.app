import type { ReactNode } from 'react';
import type { CleanupKind } from '@/lib/tab-cleanup';

// The Tidy Up popover's tile drawings (docs/specs/008-canvas/layout-cleanup.md "The popover"): each one a
// small picture of the layout its tile makes, so the choice is made by eye rather than by name. Boxes and
// arrows in the brand colours, drawn for light and dark alike. Decorative: the tile's name says it.

const W = 72;
const H = 44;

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

// The arrows between nodes, one path in a quieter ink.
function Links({ d }: { d: string }) {
  return (
    <path
      d={d}
      fill="none"
      className="stroke-slate-400 dark:stroke-slate-500"
      strokeWidth={1.25}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

function Frame({
  children,
  width = W,
  height = H,
}: {
  children: ReactNode;
  width?: number;
  height?: number;
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

// Smart: a flow that splits and joins again, the way most hand-drawn diagrams run.
function SmartDrawing() {
  return (
    <Frame>
      <Links d="M17 22h4c3 0 3-9 6-9h2M17 22h4c3 0 3 9 6 9h2M43 13h2c3 0 3 9 6 9h4M43 31h2c3 0 3-9 6-9" />
      <Node x={3} y={17.5} />
      <Node x={29} y={8.5} />
      <Node x={29} y={26.5} />
      <Node x={55} y={17.5} />
    </Frame>
  );
}

// Flowchart Down: rows from top to bottom.
function FlowDownDrawing() {
  return (
    <Frame>
      <Links d="M36 10v3c0 2-12 2-12 4v1M36 13c0 2 12 2 12 4v1M24 26v2c0 2 12 2 12 4M48 26v2c0 2-12 2-12 4" />
      <Node x={28} y={1} w={16} h={9} />
      <Node x={16} y={18} w={16} h={8} />
      <Node x={40} y={18} w={16} h={8} />
      <Node x={28} y={34} w={16} h={9} />
    </Frame>
  );
}

// Flowchart Right: columns from left to right.
function FlowRightDrawing() {
  return (
    <Frame>
      <Links d="M17 22h3c2 0 2-9 4-9h2M20 22c2 0 2 9 4 9h2M40 13h3c2 0 2 9 4 9h3M40 31h3c2 0 2-9 4-9" />
      <Node x={3} y={17.5} />
      <Node x={26} y={8.5} />
      <Node x={26} y={26.5} />
      <Node x={50} y={17.5} w={16} />
    </Frame>
  );
}

// Tree: a parent centred over its children, elbow joins.
function TreeDrawing() {
  return (
    <Frame>
      <Links d="M36 11v6M12 23v-6h48v6M36 17v6M24 34v-3h24v3" />
      <Node x={27} y={2} w={18} h={9} />
      <Node x={4} y={23} w={16} h={8} />
      <Node x={28} y={23} w={16} h={8} />
      <Node x={52} y={23} w={16} h={8} />
      <Node x={17} y={34} w={14} h={8} />
      <Node x={41} y={34} w={14} h={8} />
    </Frame>
  );
}

// Mindmap: one centre, branches all round it.
function MindmapDrawing() {
  return (
    <Frame>
      <Links d="M29 19c-6-6-9-9-14-10M29 25c-6 6-9 9-14 10M43 19c6-6 9-9 14-10M43 25c6 6 9 9 14 10M36 17v-6M36 27v6" />
      <Node x={27} y={17} w={18} h={10} />
      <Node x={1} y={4} w={14} h={8} />
      <Node x={1} y={32} w={14} h={8} />
      <Node x={57} y={4} w={14} h={8} />
      <Node x={57} y={32} w={14} h={8} />
      <Node x={30} y={2} w={12} h={8} />
      <Node x={30} y={34} w={12} h={8} />
    </Frame>
  );
}

// Auto-align: boxes sitting on a dot grid.
function AlignDrawing() {
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

export function TidyUpDrawing({ kind }: { kind: CleanupKind }) {
  switch (kind) {
    case 'smart':
      return <SmartDrawing />;
    case 'flow-down':
      return <FlowDownDrawing />;
    case 'flow-right':
      return <FlowRightDrawing />;
    case 'tree':
      return <TreeDrawing />;
    case 'mindmap':
      return <MindmapDrawing />;
    case 'align':
      return <AlignDrawing />;
  }
}
