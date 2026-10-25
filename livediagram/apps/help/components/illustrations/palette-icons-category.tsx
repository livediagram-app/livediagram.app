// The palette category scene for the Icons article (docs/specs/018-help/help-app.md,
// drawing docs/specs/010-palette/palette-top-level-categories.md and docs/specs/010-palette/palette-category-browse.md).
//
// Drawn as the palette body (More's popover) shows it: a header band with the
// category dropdown on the right, then a search box over a grid of category tiles.
// Captions are the editor's own (lib/icons.ts).

import type { ReactNode } from 'react';

import { Scene, Panel, Label } from '@liveworkspace/help-site/art/primitives';

const PX = 60;
const PW = 300;

// A tile glyph's line art, in the accent.
const g = { className: 'fill-none stroke-brand-600', strokeWidth: 1.4 } as const;

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
    <path key="3" d="M0 -6l5 2v3c0 4-3 6-5 7c-2-1-5-3-5-7v-3z" {...g} />,
    <path key="4" d="M-6 -4h4l2 2h6v8h-12z" {...g} />,
    <path key="5" d="M-6 6v-4M-2 6v-9M2 6v-6M6 6v-11" {...g} />,
    <path key="6" d="M-6 0h11M2 -3l3 3-3 3" {...g} />,
    <path key="7" d="M-6 2h12v-4h-12zM-6 2v3M6 2v3" {...g} />,
    <g key="8">
      <circle r={2.2} {...g} />
      <path
        d="M0 -6v2M0 4v2M-6 0h2M4 0h2M-4.2 -4.2l1.4 1.4M2.8 2.8l1.4 1.4M-4.2 4.2l1.4 -1.4M2.8 -2.8l1.4 -1.4"
        {...g}
      />
    </g>,
  ];
  const left = PX + 14;
  return (
    <PaletteFrame category="Icons" h={330} sceneH={354}>
      <rect
        x={left}
        y={58}
        width={PW - 28}
        height={24}
        rx={7}
        className="fill-slate-50 stroke-slate-200"
        strokeWidth={1.5}
      />
      <circle
        cx={left + 13}
        cy={70}
        r={4}
        className="fill-none stroke-slate-400"
        strokeWidth={1.5}
      />
      <path d={`M${left + 16} ${73} l4 4`} className="stroke-slate-400" strokeWidth={1.5} />
      <Label x={left + 26} y={71} size={10} tone="muted">
        Search icons
      </Label>
      {cats.map((c, i) => {
        // Two to a row, short and wide, as the app lays its category tiles out.
        const tx = left + (i % 2) * 140;
        const ty = 94 + Math.floor(i / 2) * 50;
        return (
          <g key={c}>
            <rect
              x={tx}
              y={ty}
              width={132}
              height={44}
              rx={9}
              className="fill-white stroke-slate-200"
              strokeWidth={1.5}
            />
            <g transform={`translate(${tx + 66} ${ty + 15})`}>{glyphs[i]}</g>
            <Label x={tx + 66} y={ty + 34} anchor="middle" size={10} weight={500} tone="body">
              {c}
            </Label>
          </g>
        );
      })}
    </PaletteFrame>
  );
}
