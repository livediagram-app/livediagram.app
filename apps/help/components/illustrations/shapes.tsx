// Scenes for the Shapes articles (Shapes, Shape Markers, Style Presets): the right-click menu's
// Shape morph grid, the Text flyout's Markers section, and the Style flyout's Presets grid.
// Drawn from apps/live: COMMON_SHAPES (components/palette/context-menu-constants.ts), MARKER_LABELS
// (components/canvas/ShapeMarker.tsx) and the preset tiers (docs/specs/010-palette/style-presets.md).

import { Label, Scene, SelectionBox, Shape } from './primitives';

type Kind = 'rect' | 'circle' | 'diamond' | 'stadium' | 'parallelogram' | 'hexagon' | 'triangle';

/** One small outline glyph per morph target, centred on (0, 0). */
function KindGlyph({ kind, on }: { kind: Kind | 'cylinder'; on: boolean }) {
  const s = {
    className: on ? 'stroke-brand-600' : 'stroke-slate-500',
    strokeWidth: 1.5,
    fill: 'none',
    strokeLinejoin: 'round',
  } as const;
  switch (kind) {
    case 'rect':
      return <rect x={-7} y={-6} width={14} height={12} rx={1.5} {...s} />;
    case 'circle':
      return <circle r={6.5} {...s} />;
    case 'diamond':
      return <path d="M0 -7 L7 0 L0 7 L-7 0 Z" {...s} />;
    case 'stadium':
      return <rect x={-8} y={-5} width={16} height={10} rx={5} {...s} />;
    case 'parallelogram':
      return <path d="M-4 -5 H8 L4 5 H-8 Z" {...s} />;
    case 'hexagon':
      return <path d="M-4 -6 H4 L8 0 L4 6 H-4 L-8 0 Z" {...s} />;
    case 'triangle':
      return <path d="M0 -6 L7 6 H-7 Z" {...s} />;
    case 'cylinder':
      return (
        <path
          d="M-6 -4 a6 2.5 0 0 1 12 0 v8 a6 2.5 0 0 1 -12 0 Z M-6 -4 a6 2.5 0 0 0 12 0"
          {...s}
        />
      );
  }
}

/** A context-menu accordion heading, open. */
function SectionHeading({ x, y, w, title }: { x: number; y: number; w: number; title: string }) {
  return (
    <g>
      <Label x={x + 12} y={y + 11} size={11} weight={700} tone="strong">
        {title}
      </Label>
      <path
        d={`M${x + w - 18} ${y + 13} l4 -4 l4 4`}
        className="stroke-slate-400"
        strokeWidth={1.5}
        fill="none"
        strokeLinecap="round"
      />
    </g>
  );
}

/** Morphing in place: the right-click menu's Shape section, a 4 x 2 grid of the eight common
 *  kinds, with Cylinder hovered and the selected square previewing as a cylinder. */
export function ShapeMorphGrid() {
  const kinds: (Kind | 'cylinder')[] = [
    'rect',
    'circle',
    'diamond',
    'stadium',
    'parallelogram',
    'hexagon',
    'triangle',
    'cylinder',
  ];
  return (
    <Scene w={420} h={220}>
      {/* The selected shape, previewing the hovered kind. */}
      <Shape x={40} y={84} w={110} h={66} kind="cylinder" accent label="Orders" />
      <SelectionBox x={40} y={84} w={110} h={66} />
      {/* The menu's Shape section. */}
      <rect
        x={200}
        y={30}
        width={190}
        height={160}
        rx={10}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <SectionHeading x={200} y={38} w={190} title="Shape" />
      {kinds.map((k, i) => {
        const col = i % 4;
        const row = Math.floor(i / 4);
        const tx = 212 + col * 42;
        const ty = 66 + row * 42;
        const on = k === 'cylinder';
        const current = k === 'rect';
        return (
          <g key={k}>
            <rect
              x={tx}
              y={ty}
              width={36}
              height={36}
              rx={7}
              className={
                on
                  ? 'fill-brand-50 stroke-brand-300'
                  : current
                    ? 'fill-slate-100 stroke-slate-300'
                    : 'fill-slate-50 stroke-slate-200'
              }
              strokeWidth={1.5}
            />
            <g transform={`translate(${tx + 18} ${ty + 18})`}>
              <KindGlyph kind={k} on={on} />
            </g>
          </g>
        );
      })}
      <Label x={212} y={168} size={10} tone="muted">
        Hover to preview, click to keep
      </Label>
    </Scene>
  );
}

/** The Text flyout's Markers section: None and the five markers, then the Size row (Scale and
 *  three fixed sizes), beside a shape wearing the green marker. */
export function MarkersMenu() {
  const tiles: { label: string; glyph: 'none' | 'green' | 'orange' | 'red' | 'todo' | 'done' }[] = [
    { label: 'None', glyph: 'none' },
    { label: 'Green', glyph: 'green' },
    { label: 'Orange', glyph: 'orange' },
    { label: 'Red', glyph: 'red' },
    { label: 'To do', glyph: 'todo' },
    { label: 'Done', glyph: 'done' },
  ];
  const dot = {
    green: 'fill-emerald-500',
    orange: 'fill-amber-500',
    red: 'fill-rose-500',
  } as const;
  return (
    <Scene w={420} h={230}>
      {/* The shape the marker lands on, just left of its label. */}
      <Shape x={30} y={92} w={140} h={56} label="" />
      <circle cx={62} cy={120} r={7} className="fill-emerald-500" />
      <Label x={76} y={121} size={12} weight={500} tone="strong">
        On track
      </Label>
      {/* The Markers section. */}
      <rect
        x={206}
        y={14}
        width={190}
        height={204}
        rx={10}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <SectionHeading x={206} y={22} w={190} title="Markers" />
      {tiles.map((t, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const tx = 218 + col * 56;
        const ty = 48 + row * 52;
        const on = t.glyph === 'green';
        const cx = tx + 25;
        const cy = ty + 18;
        return (
          <g key={t.label}>
            <rect
              x={tx}
              y={ty}
              width={50}
              height={46}
              rx={7}
              className={on ? 'fill-brand-50 stroke-brand-300' : 'fill-slate-50 stroke-slate-200'}
              strokeWidth={1.5}
            />
            {t.glyph === 'none' && (
              <g className="stroke-slate-400" strokeWidth={1.5} fill="none">
                <circle cx={cx} cy={cy} r={7} />
                <path d={`M${cx - 5} ${cy + 5} L${cx + 5} ${cy - 5}`} />
              </g>
            )}
            {(t.glyph === 'green' || t.glyph === 'orange' || t.glyph === 'red') && (
              <circle cx={cx} cy={cy} r={7} className={dot[t.glyph]} />
            )}
            {(t.glyph === 'todo' || t.glyph === 'done') && (
              <g>
                <rect
                  x={cx - 7}
                  y={cy - 7}
                  width={14}
                  height={14}
                  rx={3}
                  className="fill-white stroke-slate-600"
                  strokeWidth={1.5}
                />
                {t.glyph === 'done' && (
                  <path
                    d={`M${cx - 4} ${cy} l3 3 l5 -6`}
                    className="stroke-slate-600"
                    strokeWidth={1.8}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
              </g>
            )}
            <Label x={cx} y={ty + 37} size={10} anchor="middle" tone={on ? 'accent' : 'muted'}>
              {t.label}
            </Label>
          </g>
        );
      })}
      <Label x={218} y={162} size={10} weight={600} tone="muted">
        Size
      </Label>
      {[0, 1, 2, 3].map((i) => {
        const tx = 218 + i * 42;
        const on = i === 0;
        return (
          <g key={i}>
            <rect
              x={tx}
              y={172}
              width={36}
              height={30}
              rx={6}
              className={on ? 'fill-brand-50 stroke-brand-300' : 'fill-slate-50 stroke-slate-200'}
              strokeWidth={1.5}
            />
            {i === 0 ? (
              // Scale: tracks the label's text size.
              <path
                d={`M${tx + 11} 193 L${tx + 25} 181 M${tx + 19} 181 H${tx + 25} V187`}
                className="stroke-brand-600"
                strokeWidth={1.5}
                fill="none"
                strokeLinecap="round"
              />
            ) : (
              Array.from({ length: i }).map((_, d) => (
                <circle
                  key={d}
                  cx={tx + 18 + (d - (i - 1) / 2) * 7}
                  cy={187}
                  r={2.4}
                  className="fill-slate-500"
                />
              ))
            )}
          </g>
        );
      })}
    </Scene>
  );
}

/** The Style flyout's Presets grid: twenty looks, four wide, in their four runs (the theme's
 *  own, the greys, the line treatments, the status set), then Reset to default. */
export function StylePresetsGrid() {
  // Each tile: a fill class, a stroke class, and a dash for the line treatments.
  type T = { fill: string; stroke: string; dash?: string; w?: number };
  const theme: T[] = [
    { fill: 'fill-white', stroke: 'stroke-brand-400' },
    { fill: 'fill-brand-50', stroke: 'stroke-brand-200' },
    { fill: 'fill-brand-100', stroke: 'stroke-brand-300' },
    { fill: 'fill-brand-500', stroke: 'stroke-brand-600' },
    { fill: 'fill-brand-700', stroke: 'stroke-brand-800', w: 3 },
  ];
  const greys: T[] = [
    { fill: 'fill-white', stroke: 'stroke-slate-300', dash: '3 2' },
    { fill: 'fill-white', stroke: 'stroke-slate-200' },
    { fill: 'fill-slate-100', stroke: 'stroke-slate-200' },
    { fill: 'fill-slate-400', stroke: 'stroke-slate-500' },
    { fill: 'fill-slate-800', stroke: 'stroke-slate-800' },
  ];
  const lines: T[] = [
    { fill: 'fill-white', stroke: 'stroke-brand-400', w: 1 },
    { fill: 'fill-white', stroke: 'stroke-brand-500', dash: '4 3' },
    { fill: 'fill-white', stroke: 'stroke-brand-500', dash: '1 3' },
    { fill: 'fill-white', stroke: 'stroke-brand-500', dash: '6 2 1 2' },
    { fill: 'fill-white', stroke: 'stroke-brand-600', w: 3.5 },
  ];
  const status: T[] = [
    { fill: 'fill-brand-100', stroke: 'stroke-brand-400' },
    { fill: 'fill-emerald-100', stroke: 'stroke-emerald-500' },
    { fill: 'fill-amber-100', stroke: 'stroke-amber-500' },
    { fill: 'fill-rose-100', stroke: 'stroke-rose-500' },
    { fill: 'fill-violet-100', stroke: 'stroke-violet-500' },
  ];
  const all = [...theme, ...greys, ...lines, ...status];
  return (
    <Scene w={420} h={250}>
      <rect
        x={150}
        y={10}
        width={196}
        height={232}
        rx={10}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <SectionHeading x={150} y={16} w={196} title="Presets" />
      <g className="help-art-as-drawn">
        {all.map((t, i) => {
          const col = i % 4;
          const row = Math.floor(i / 4);
          const tx = 164 + col * 44;
          const ty = 42 + row * 32;
          return (
            <rect
              key={i}
              x={tx}
              y={ty}
              width={36}
              height={24}
              rx={5}
              className={`${t.fill} ${t.stroke}`}
              strokeWidth={t.w ?? 1.8}
              strokeDasharray={t.dash}
            />
          );
        })}
      </g>
      {/* Reset to default */}
      <rect
        x={164}
        y={208}
        width={168}
        height={24}
        rx={6}
        className="fill-slate-50 stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={248} y={221} size={10} weight={600} anchor="middle" tone="body">
        Reset to default
      </Label>
      <Shape
        x={360}
        y={100}
        w={52}
        h={36}
        fill="fill-brand-500"
        stroke="stroke-brand-600"
        label="Key"
        labelTone="onAccent"
      />
    </Scene>
  );
}
