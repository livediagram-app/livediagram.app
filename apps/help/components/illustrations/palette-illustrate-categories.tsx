// Palette category scenes for the Components, Devices and Icons articles (docs/specs/018-help/help-app.md,
// drawing docs/specs/010-palette/palette-top-level-categories.md and docs/specs/010-palette/palette-category-browse.md).
//
// Drawn as the palette body (More's popover) shows them: a header band with the
// category dropdown on the right, then the category body. Components and
// Devices are rows (a glyph chip, the tile's caption and its one-line blurb),
// Components with its Web Elements group opened in place; Icons is a search
// box over a grid of category tiles. Captions and blurbs are the editor's own
// (palette-tile-defs.tsx, lib/icons.ts).

import type { ReactNode } from 'react';

import { Scene, Panel, Label } from './primitives';

const PX = 60;
const PW = 300;

/** The palette frame: the header band with the canvas-tool picker on the left
 *  and the category dropdown on the right, naming the open category. */
function PaletteFrame({
  category,
  h,
  sceneH,
  children,
}: {
  category: string;
  h: number;
  sceneH: number;
  children: ReactNode;
}) {
  const py = 12;
  return (
    <Scene w={420} h={sceneH} bg="plain">
      <Panel x={PX} y={py} w={PW} h={h}>
        {/* Canvas-tool picker */}
        <rect
          x={PX + 10}
          y={py + 9}
          width={40}
          height={22}
          rx={6}
          className="fill-slate-50 stroke-slate-200"
          strokeWidth={1.2}
        />
        <path
          d={`M${PX + 19} ${py + 14} l7 6 -3.4 0.6 1.8 3.4 -1.5 0.7 -1.8 -3.4 -2.6 2.2 z`}
          className="fill-slate-500"
        />
        <path
          d={`M${PX + 38} ${py + 18} l3 3 3 -3`}
          className="fill-none stroke-slate-400"
          strokeWidth={1.4}
        />
        {/* Category dropdown */}
        <rect
          x={PX + PW - 130}
          y={py + 9}
          width={120}
          height={22}
          rx={6}
          className="fill-slate-50 stroke-slate-200"
          strokeWidth={1.2}
        />
        <Label x={PX + PW - 120} y={py + 21} size={11} weight={600} tone="strong">
          {category}
        </Label>
        <path
          d={`M${PX + PW - 26} ${py + 18} l3 3 3 -3`}
          className="fill-none stroke-slate-400"
          strokeWidth={1.4}
        />
        <line
          x1={PX}
          y1={py + 40}
          x2={PX + PW}
          y2={py + 40}
          className="stroke-slate-200"
          strokeWidth={1.5}
        />
        {children}
      </Panel>
    </Scene>
  );
}

/** One palette row: a glyph chip, the caption, the blurb under it. */
function Row({
  x,
  y,
  name,
  blurb,
  glyph,
  open = false,
  count,
}: {
  x: number;
  y: number;
  name: string;
  blurb: string;
  glyph?: ReactNode;
  open?: boolean;
  count?: number;
}) {
  return (
    <g>
      {open && (
        <rect
          x={x - 4}
          y={y - 3}
          width={PW - 12}
          height={30}
          rx={7}
          className="fill-slate-50 stroke-slate-200"
          strokeWidth={1.2}
        />
      )}
      <rect
        x={x}
        y={y}
        width={24}
        height={24}
        rx={6}
        className="fill-brand-50 stroke-brand-200"
        strokeWidth={1.2}
      />
      <g transform={`translate(${x + 12} ${y + 12})`}>{glyph}</g>
      <Label x={x + 32} y={y + 6} size={11} weight={600} tone="strong">
        {name}
      </Label>
      <Label x={x + 32} y={y + 19} size={10} tone="muted">
        {blurb}
      </Label>
      {count !== undefined && (
        <g>
          <rect x={x + 120} y={y} width={18} height={12} rx={6} className="fill-slate-100" />
          <Label x={x + 129} y={y + 6.5} anchor="middle" size={10} weight={600} tone="muted">
            {String(count)}
          </Label>
        </g>
      )}
    </g>
  );
}

const g = { className: 'fill-none stroke-brand-600', strokeWidth: 1.4 } as const;

/** The Components category as Illustrate mode's palette shows it: the Web
 *  Elements group opened in place, its six components below it. (Illustrate
 *  leaves the category's Entity tile out, so the group is all there is.) */
export function ComponentsCategory() {
  const x = PX + 12;
  const rows: [string, string][] = [
    ['Banner', 'A themed title block for the top'],
    ['Callout', 'A note box with an icon and title'],
    ['Stat row', 'Three KPI cards side by side'],
    ['Process', 'Numbered steps joined by arrows'],
    ['Hero', 'A big image with a title card'],
    ['Header', 'A website-style nav bar'],
  ];
  return (
    <PaletteFrame category="Components" h={258} sceneH={282}>
      <Row
        x={x}
        y={56}
        name="Web Elements"
        blurb="Themed page sections"
        open
        count={6}
        glyph={<rect x={-6} y={-5} width={12} height={10} rx={2} {...g} />}
      />
      {rows.map(([name, blurb], i) => (
        <Row
          key={name}
          x={x + 14}
          y={92 + i * 30}
          name={name}
          blurb={blurb}
          glyph={
            i === 0 ? (
              <path d="M-6 -4h12v4h-12z" {...g} />
            ) : i === 2 ? (
              <path d="M-6 -3h3.4v6h-3.4zM-1.7 -3h3.4v6h-3.4zM2.6 -3h3.4v6h-3.4z" {...g} />
            ) : i === 3 ? (
              <path d="M-6 0h12M-4 0a1.6 1.6 0 1 0 0.01 0M4 0a1.6 1.6 0 1 0 0.01 0" {...g} />
            ) : (
              <rect x={-6} y={-4.5} width={12} height={9} rx={2} {...g} />
            )
          }
        />
      ))}
    </PaletteFrame>
  );
}

/** The Devices category: seven frames as rows, each named with what it is
 *  for. */
export function DevicesCategory() {
  const x = PX + 12;
  const rows: [string, string, ReactNode][] = [
    [
      'Browser',
      'A desktop web page frame',
      <rect key="b" x={-7} y={-5} width={14} height={10} rx={1.5} {...g} />,
    ],
    [
      'Monitor',
      'A full-screen desktop layout',
      <path key="m" d="M-7 -5h14v8h-14zM-2 6h4" {...g} />,
    ],
    ['Laptop', 'A portable-screen view', <path key="l" d="M-5 -5h10v7h-10zM-7 4h14" {...g} />],
    [
      'Phone',
      'A mobile app or page',
      <rect key="p" x={-3.5} y={-6} width={7} height={12} rx={1.6} {...g} />,
    ],
    [
      'Tablet',
      'A larger touch layout',
      <rect key="t" x={-5} y={-6} width={10} height={12} rx={1.6} {...g} />,
    ],
    [
      'Foldable',
      'A foldable phone, opened out',
      <path key="f" d="M-6 -5h12v10h-12zM0 -5v10" {...g} />,
    ],
    [
      'Watch',
      'A compact wearable screen',
      <rect key="w" x={-4} y={-4} width={8} height={8} rx={2.4} {...g} />,
    ],
  ];
  return (
    <PaletteFrame category="Devices" h={274} sceneH={298}>
      {rows.map(([name, blurb, glyph], i) => (
        <Row key={name} x={x} y={52 + i * 31} name={name} blurb={blurb} glyph={glyph} />
      ))}
    </PaletteFrame>
  );
}

/** The Icons category: a search box across the whole catalogue over a grid
 *  of category tiles, each wearing its first glyph. */
export function IconsCategory() {
  const cats = [
    'Animated',
    'Tech',
    'People',
    'Security',
    'Files',
    'Charts',
    'Arrows',
    'Furniture',
    'UI',
  ];
  // A tiny stand-in glyph per tile: line art in the accent.
  const glyphs: ReactNode[] = [
    <circle key="0" r={5} strokeDasharray="20 8" {...g} />,
    <path key="1" d="M-6 -4h12v3h-12zM-6 1h12v3h-12z" {...g} />,
    <path key="2" d="M0 -2a2.6 2.6 0 1 0 0.01 0M-5 6a5 5 0 0 1 10 0" {...g} />,
    <path key="3" d="M-4 -1h8v7h-8zM-2.4 -1v-2.4a2.4 2.4 0 0 1 4.8 0v2.4" {...g} />,
    <path key="4" d="M-4 -6h5l3 3v9h-8z" {...g} />,
    <path key="5" d="M-6 6v-4M-2 6v-9M2 6v-6M6 6v-11" {...g} />,
    <path key="6" d="M-6 0h11M2 -3l3 3-3 3" {...g} />,
    <path key="7" d="M-6 2h12v-4h-12zM-6 2v3M6 2v3" {...g} />,
    <path key="8" d="M-6 -5h12v10h-12zM-6 -2h12" {...g} />,
  ];
  const left = PX + 14;
  return (
    <PaletteFrame category="Icons" h={262} sceneH={286}>
      <rect
        x={left}
        y={52}
        width={PW - 28}
        height={24}
        rx={7}
        className="fill-slate-50 stroke-slate-200"
        strokeWidth={1.5}
      />
      <circle
        cx={left + 13}
        cy={64}
        r={4}
        className="fill-none stroke-slate-400"
        strokeWidth={1.5}
      />
      <path d={`M${left + 16} ${67} l4 4`} className="stroke-slate-400" strokeWidth={1.5} />
      <Label x={left + 26} y={65} size={10} tone="muted">
        Search icons
      </Label>
      {cats.map((c, i) => {
        const tx = left + (i % 3) * 92;
        const ty = 86 + Math.floor(i / 3) * 60;
        return (
          <g key={c}>
            <rect
              x={tx}
              y={ty}
              width={84}
              height={52}
              rx={9}
              className="fill-white stroke-slate-200"
              strokeWidth={1.5}
            />
            <g transform={`translate(${tx + 42} ${ty + 18})`}>{glyphs[i]}</g>
            <Label x={tx + 42} y={ty + 40} anchor="middle" size={10} weight={600} tone="body">
              {c}
            </Label>
          </g>
        );
      })}
    </PaletteFrame>
  );
}
