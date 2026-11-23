'use client';

// The picker's preview as SVG (graph-sketch.ts lays it out): boxes with their labels, arrows, groups as frames, a
// sequence's lifelines. Scaled to fit its box, in the app's colours; livediagram draws the real diagram.
import { useId, useMemo } from 'react';
import type { DiagramSendGraph } from '@liveworkspace/index-client';
import { SKETCH_BOX_H, SKETCH_BOX_W, sketchGraph, type SketchBox } from './graph-sketch';

const LABEL_CHARS = 20;
const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function Box({ box }: { box: SketchBox }) {
  const { x, y } = box;
  const w = SKETCH_BOX_W;
  const h = SKETCH_BOX_H;
  const common = {
    className: 'fill-white stroke-brand-500 dark:fill-slate-900 dark:stroke-brand-400',
    strokeWidth: 1.5,
  };
  const shape =
    box.shape === 'diamond' ? (
      <polygon
        points={`${x + w / 2},${y} ${x + w},${y + h / 2} ${x + w / 2},${y + h} ${x},${y + h / 2}`}
        {...common}
      />
    ) : box.shape === 'circle' ? (
      <ellipse cx={x + w / 2} cy={y + h / 2} rx={w / 2} ry={h / 2} {...common} />
    ) : (
      <rect x={x} y={y} width={w} height={h} rx={box.shape === 'cylinder' ? 14 : 8} {...common} />
    );
  return (
    <g>
      {shape}
      <text
        x={x + w / 2}
        y={y + h / 2}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-slate-700 text-[12px] font-medium dark:fill-slate-100"
      >
        {cut(box.label, LABEL_CHARS)}
      </text>
    </g>
  );
}

export function DiagramSketch({ graph }: { graph: DiagramSendGraph }) {
  const sketch = useMemo(() => sketchGraph(graph), [graph]);
  const marker = `sketch-arrow-${useId().replace(/:/g, '')}`;
  return (
    <svg
      data-diagram-sketch=""
      role="img"
      aria-label={`A sketch of ${graph.nodes.length} boxes and ${graph.edges.length} arrows`}
      viewBox={`0 0 ${sketch.width} ${sketch.height}`}
      preserveAspectRatio="xMidYMid meet"
      className="h-full w-full"
    >
      <defs>
        <marker
          id={marker}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M0,0 L10,5 L0,10 z" className="fill-slate-400 dark:fill-slate-500" />
        </marker>
      </defs>
      {sketch.frames.map((f, i) => (
        <g key={`f${i}`}>
          <rect
            x={f.x}
            y={f.y}
            width={f.w}
            height={f.h}
            rx={10}
            className="fill-brand-50/60 stroke-brand-200 dark:fill-brand-500/5 dark:stroke-brand-500/30"
            strokeDasharray="4 3"
          />
        </g>
      ))}
      {sketch.lifelines.map((l, i) => (
        <line
          key={`l${i}`}
          x1={l.x1}
          y1={l.y1}
          x2={l.x2}
          y2={l.y2}
          strokeDasharray="3 4"
          className="stroke-slate-300 dark:stroke-slate-600"
        />
      ))}
      {sketch.lines.map((l, i) => (
        <g key={`e${i}`}>
          <line
            x1={l.x1}
            y1={l.y1}
            x2={l.x2}
            y2={l.y2}
            strokeWidth={1.5}
            markerEnd={`url(#${marker})`}
            {...(l.dashed ? { strokeDasharray: '5 4' } : {})}
            className="stroke-slate-400 dark:stroke-slate-500"
          />
          {l.label ? (
            <text
              x={(l.x1 + l.x2) / 2}
              y={(l.y1 + l.y2) / 2 - 5}
              textAnchor="middle"
              className="fill-slate-500 text-[10px] dark:fill-slate-400"
            >
              {cut(l.label, LABEL_CHARS)}
            </text>
          ) : null}
        </g>
      ))}
      {sketch.boxes.map((b) => (
        <Box key={b.id} box={b} />
      ))}
    </svg>
  );
}
