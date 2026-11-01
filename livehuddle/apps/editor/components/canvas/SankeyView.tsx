'use client';

// The Sankey diagram on the canvas (docs/specs/009-elements/sankey.md): bands as wide as the amount they
// carry, nodes in columns, labels facing inward. Everything about where things go comes from sankeyFrame in
// @livehuddle/document, which the exporter draws from too; this file adds what only a live canvas has:
// hovering a band or a node to lift it and read it, and the animations (Grow, Flow, Cascade, Pulse, Rise).
//
// The layout is memoised on what it depends on (the flows, the options, the box's size and the palette), so
// dragging the diagram around, or anything else re-rendering it, never lays it out again.

import { useId, useMemo, useState, type CSSProperties } from 'react';
import {
  animLoops,
  SANKEY_BAND_DIM_OPACITY,
  SANKEY_BAND_FOCUS_OPACITY,
  SANKEY_BAND_OPACITY,
  SANKEY_LOOPING_ANIMS,
  sankeyBandReadout,
  sankeyFrame,
  sankeyLabelHalo,
  sankeyNodeReadout,
  type SankeyLabel,
  type ShapeElement,
} from '@livehuddle/document';
import { animClass, animSpeedVars } from '@/lib/icons';
import { ChartReadout } from '@liveworkspace/workbench/components/primitives/ChartReadout';
import { useSankeyTourFocus } from '@liveworkspace/workbench/lib/sankey-tour-focus';

type Hover = { kind: 'band'; index: number } | { kind: 'node'; index: number };

// The hover target round a band is at least this thick, so a 1px flow can still be found with a mouse.
const MIN_BAND_HIT_PX = 8;

export function SankeyView({
  element,
  fontFamily,
  textColor,
  palette,
  editable,
  bare = false,
  onCanvas = false,
}: {
  element: ShapeElement;
  fontFamily?: string;
  textColor: string;
  palette?: readonly string[];
  // Whether this session may edit it, which only changes what the empty state says.
  editable: boolean;
  // Bands and nodes only: no labels and no hover, for a menu tile's miniature.
  bare?: boolean;
  // The diagram on the canvas (not a preview or a tile): the one the Sankey tour points at and lifts parts of
  // (docs/specs/007-editor/element-tours.md "The Sankey tour").
  onCanvas?: boolean;
}) {
  const {
    width,
    height,
    sankeyFlows,
    sankeyNodes,
    sankeyAlign,
    sankeyLinkColor,
    sankeyValueLabel,
    sankeyUnit,
    sankeyLeftover,
    sankeyLeftoverName,
    textSize,
    chartPalette,
  } = element;
  const frame = useMemo(
    () =>
      sankeyFrame(
        {
          width,
          height,
          sankeyFlows,
          sankeyNodes,
          sankeyAlign,
          sankeyLinkColor,
          sankeyValueLabel,
          sankeyUnit,
          sankeyLeftover,
          sankeyLeftoverName,
          textSize,
          chartPalette,
        } as ShapeElement,
        palette,
      ),
    [
      width,
      height,
      sankeyFlows,
      sankeyNodes,
      sankeyAlign,
      sankeyLinkColor,
      sankeyValueLabel,
      sankeyUnit,
      sankeyLeftover,
      sankeyLeftoverName,
      textSize,
      chartPalette,
      palette,
    ],
  );
  const [pointerHover, setHover] = useState<Hover | null>(null);
  // A tour step's lift draws as a hover does, and wins over a pointer left resting on another part (the step is
  // about its part); hover works as ever once the step ends.
  const tourFocus = useSankeyTourFocus(onCanvas && !bare ? element.id : null);

  const gradientBase = `lvd-sk-${useId().replace(/:/g, '')}`;
  const { w, h, layout, fontPx } = frame;
  // A lift past the diagram's parts (its flows edited under the step) draws nothing rather than reading past them.
  const tourHover: Hover | null =
    tourFocus && tourFocus.index < (tourFocus.part === 'band' ? layout.links : layout.nodes).length
      ? { kind: tourFocus.part, index: tourFocus.index }
      : null;
  const hover = tourHover ?? pointerHover;

  const anim = element.sankeyAnim;
  const loops = animLoops(anim, element.sankeyAnimRepeat, SANKEY_LOOPING_ANIMS);
  const animStyle = anim ? animSpeedVars('sankey', element.sankeyAnimSpeed, loops) : undefined;

  if (layout.links.length === 0) {
    return (
      <div
        className="absolute inset-0 flex items-center justify-center rounded-lg border border-dashed text-center"
        style={{ borderColor: `${textColor}55`, color: textColor, fontFamily, fontSize: fontPx }}
        role="img"
        aria-label={frame.summary}
      >
        <span className="px-3 opacity-60">
          {editable ? 'No flows yet. Double-click to add flows.' : 'No flows yet'}
        </span>
      </div>
    );
  }

  // What the hover lifts: a band alone, or every band touching a node, with that node and its neighbours.
  const lit = (bandIndex: number): boolean | null => {
    if (!hover) return null;
    const b = layout.links[bandIndex]!;
    return hover.kind === 'band'
      ? hover.index === bandIndex
      : b.source === hover.index || b.target === hover.index;
  };
  const nodeLit = (nodeIndex: number): boolean | null => {
    if (!hover) return null;
    if (hover.kind === 'node')
      return (
        hover.index === nodeIndex ||
        layout.links.some(
          (b) =>
            (b.source === hover.index && b.target === nodeIndex) ||
            (b.target === hover.index && b.source === nodeIndex),
        )
      );
    const b = layout.links[hover.index]!;
    return b.source === nodeIndex || b.target === nodeIndex;
  };
  const hoverProps = (key: Hover) => ({
    style: { pointerEvents: 'auto' as const },
    onPointerEnter: () => setHover(key),
    onPointerLeave: () =>
      setHover((prev) => (prev?.kind === key.kind && prev.index === key.index ? null : prev)),
  });

  const readout = (() => {
    if (!hover) return null;
    if (hover.kind === 'band') {
      const b = layout.links[hover.index]!;
      const r = sankeyBandReadout(layout, b, sankeyUnit, frame.leftover(b));
      return { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 - b.width / 2, ...r };
    }
    const n = layout.nodes[hover.index]!;
    const r = sankeyNodeReadout(n, sankeyUnit);
    return { x: (n.x0 + n.x1) / 2, y: n.y0, ...r };
  })();

  // Each node's column, left to right, which staggers Cascade, Pulse and Rise (a band takes its source's).
  // Plain, not memoised: it sits after the empty state's early return, and is at most SANKEY_MAX_NODES entries.
  const xs = [...new Set(layout.nodes.map((n) => n.x0))].sort((a, b) => a - b);
  const columnOf = new Map(layout.nodes.map((n) => [n.index, xs.indexOf(n.x0)]));
  // The staggered animations run off the svg's class; each part says its column.
  const staged = anim === 'cascade' || anim === 'pulse' || anim === 'rise';
  const col = (node: number) =>
    staged ? ({ '--lvd-sk-col': columnOf.get(node) ?? 0 } as CSSProperties) : undefined;

  const halo = sankeyLabelHalo(textColor);
  const transition = 'fill-opacity 150ms ease-out, opacity 150ms ease-out';

  return (
    <div className="absolute inset-0">
      {/* pointer-events-none: the element's own box takes the drag and the selection click; only the hover
          targets below switch pointer events back on, and a hover never stops a drag starting. */}
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${w} ${h}`}
        className={`pointer-events-none absolute inset-0 overflow-visible ${anim === 'flow' || staged ? `lvd-sankey-${anim}` : ''}`}
        style={anim === 'flow' || staged ? animStyle : undefined}
        role="img"
        aria-label={frame.summary}
      >
        <defs>
          {layout.links.map((b, i) => {
            const paint = frame.bandPaint(b);
            return paint.kind === 'gradient' ? (
              <linearGradient
                key={i}
                id={`${gradientBase}-${i}`}
                gradientUnits="userSpaceOnUse"
                x1={b.x0}
                y1={0}
                x2={b.x1}
                y2={0}
              >
                <stop offset={0} stopColor={paint.from} />
                <stop offset={1} stopColor={paint.to} />
              </linearGradient>
            ) : null;
          })}
        </defs>
        <g
          className={anim === 'grow' ? animClass('sankey', 'grow') : undefined}
          style={anim === 'grow' ? animStyle : undefined}
        >
          {layout.links.map((b, i) => {
            const paint = frame.bandPaint(b);
            const on = lit(i);
            return (
              <path
                key={i}
                d={b.path}
                className="lvd-sk-band"
                // The tour's anchors (sankey-element-tour-steps.ts).
                data-sankey-band={i}
                fill={paint.kind === 'gradient' ? `url(#${gradientBase}-${i})` : paint.color}
                fillOpacity={
                  on === null
                    ? SANKEY_BAND_OPACITY
                    : on
                      ? SANKEY_BAND_FOCUS_OPACITY
                      : SANKEY_BAND_DIM_OPACITY
                }
                style={{ transition, ...col(b.source) }}
              />
            );
          })}
          {anim === 'flow'
            ? layout.links.map((b, i) => (
                <path
                  key={i}
                  className="lvd-sankey-current"
                  d={b.centre}
                  fill="none"
                  stroke="#ffffff"
                  strokeOpacity={0.45}
                  strokeWidth={Math.max(1, Math.min(b.width * 0.45, 10))}
                  strokeLinecap="round"
                  strokeDasharray="6 18"
                />
              ))
            : null}
          {layout.nodes.map((n) => {
            const on = nodeLit(n.index);
            return (
              <rect
                key={n.index}
                x={n.x0}
                y={n.y0}
                width={n.x1 - n.x0}
                height={Math.max(1, n.y1 - n.y0)}
                rx={2}
                className="lvd-sk-node"
                data-sankey-node={n.index}
                fill={frame.nodeColor(n.index)}
                opacity={on === false ? 0.35 : 1}
                style={{ transition, ...col(n.index) }}
              />
            );
          })}
          {(bare ? [] : frame.labels.filter((l) => !l.hidden)).map((l) => (
            <g key={l.node} className="lvd-sk-label" style={col(l.node)}>
              <SankeyLabelText
                label={l}
                fontPx={fontPx}
                textColor={textColor}
                halo={halo}
                fontFamily={fontFamily}
                dim={nodeLit(l.node) === false}
              />
            </g>
          ))}
        </g>
        {/* Hover targets last, so they sit over the labels: a band's middle line, stroked transparent at the
            band's width (or MIN_BAND_HIT_PX for a thin one), then the nodes, which win where they overlap. */}
        {(bare ? [] : layout.links).map((b, i) => (
          <path
            key={`hit-${i}`}
            d={b.centre}
            fill="none"
            stroke="transparent"
            strokeWidth={Math.max(MIN_BAND_HIT_PX, b.width)}
            {...hoverProps({ kind: 'band', index: i })}
          />
        ))}
        {(bare ? [] : layout.nodes).map((n) => (
          <rect
            key={`hit-${n.index}`}
            x={n.x0 - 3}
            y={n.y0}
            width={n.x1 - n.x0 + 6}
            height={Math.max(MIN_BAND_HIT_PX, n.y1 - n.y0)}
            fill="transparent"
            {...hoverProps({ kind: 'node', index: n.index })}
          />
        ))}
      </svg>
      {readout ? (
        <ChartReadout
          leftPct={(readout.x / w) * 100}
          topPct={(readout.y / h) * 100}
          label={readout.title}
          value={readout.detail}
          // Grow inward from the outer thirds, so the readout stays over the diagram, never past its box.
          align={readout.x < w / 3 ? 'start' : readout.x > (2 * w) / 3 ? 'end' : 'center'}
        />
      ) : null}
    </div>
  );
}

function SankeyLabelText({
  label: l,
  fontPx,
  textColor,
  halo,
  fontFamily,
  dim,
}: {
  label: SankeyLabel;
  fontPx: number;
  textColor: string;
  halo: string;
  fontFamily?: string;
  dim: boolean;
}) {
  const common = {
    x: l.x,
    textAnchor: l.anchor,
    fill: textColor,
    fontFamily,
    stroke: halo,
    strokeWidth: 3,
    strokeOpacity: 0.75,
    strokeLinejoin: 'round' as const,
    paintOrder: 'stroke',
    dominantBaseline: 'central' as const,
    opacity: dim ? 0.4 : 1,
    style: { transition: 'opacity 150ms ease-out' },
  };
  if (!l.detail)
    return (
      <text {...common} y={l.y} fontSize={fontPx} fontWeight={600}>
        {l.name}
      </text>
    );
  if (l.inline)
    return (
      <text {...common} y={l.y} fontSize={fontPx}>
        <tspan fontWeight={600}>{l.name}</tspan>
        <tspan fillOpacity={0.72}> {l.detail}</tspan>
      </text>
    );
  const gap = fontPx * 0.6;
  return (
    <>
      <text {...common} y={l.y - gap} fontSize={fontPx} fontWeight={600}>
        {l.name}
      </text>
      <text {...common} y={l.y + gap} fontSize={fontPx * 0.92} fillOpacity={0.72}>
        {l.detail}
      </text>
    </>
  );
}
