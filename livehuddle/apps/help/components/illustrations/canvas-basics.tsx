// Canvas basics illustrations (docs/specs/018-help/help-app.md): the palette strip and dock on the
// canvas, the multi-selection toolbar, the element menu's
// Font tiles, and the Colours, Text and Canvas panels of the Tab Style dialog.
// Each draws the real surface with its real labels: ToolbarPalette.tsx, CanvasChrome.tsx,
// MultiSelectionToolbar.tsx,
// TypographySections.tsx, CanvasThemeDialog.tsx, BackBar.tsx, ThemeBrowser.tsx, TextTab.tsx,
// and CanvasStyleControls.tsx. Composed from the shared primitives so
// the house style holds.

import type { ReactNode } from 'react';
import { Scene, Shape, Arrow, Panel, Label } from '@liveworkspace/help-site/art/primitives';
import {
  Caption,
  CarouselHeading,
  OptionBox,
  Slider,
  TabStylePanel,
} from '@liveworkspace/help-site/art/illustrations/tab-style-parts';
import { MenuCard, Strip } from './toolbar-layout';

// The Font tiles and the Text and Colours panels are drawn once for every product, in
// packages/help-site (art/illustrations/look-and-feel.tsx); this product's Canvas panel, with its
// floors, stays below.
export {
  ElementFontMenu,
  LookAndFeelFont,
  LookAndFeelTheme,
} from '@liveworkspace/help-site/art/illustrations/look-and-feel';

// --- The canvas and its palette ----------------------------------------------------------------

/** The canvas with the menu button and tab name top-left, the palette strip across the top
 *  (the canvas-tool and category dropdowns, the tiles, More and Search) and the bottom-right
 *  cluster (Undo and Redo, the Theme & canvas paintbrush, then the zoom controls). */
export function CanvasPaletteOverview() {
  const ink = { className: 'stroke-slate-500', strokeWidth: 1.4, fill: 'none' } as const;
  return (
    <Scene w={420} h={240}>
      <MenuCard x={8} y={14} />
      <Strip x={78} y={14} />
      <Shape x={60} y={72} w={76} h={42} label="Start" />
      <Shape x={176} y={66} w={60} h={54} kind="diamond" />
      <Shape x={168} y={146} w={76} h={36} accent label="Done" />
      <Arrow connector from={[136, 93]} to={[176, 93]} />
      <Arrow connector from={[206, 120]} to={[206, 146]} />
      {/* Bottom-right cluster: Undo and Redo, the paintbrush, then the zoom controls. */}
      <g transform="translate(32 0)">
        <rect
          x={150}
          y={198}
          width={60}
          height={30}
          rx={7}
          className="fill-white stroke-slate-200"
          strokeWidth={1.5}
        />
        <line x1={180} y1={204} x2={180} y2={222} className="stroke-slate-200" strokeWidth={1.2} />
        <path d="M170 209 h-8 l3 -3 M162 209 l3 3 M162 209 h5 a4.5 4.5 0 0 1 0 9 h-2" {...ink} />
        <path d="M190 209 h8 l-3 -3 M198 209 l-3 3 M198 209 h-5 a4.5 4.5 0 0 0 0 9 h2" {...ink} />
        <rect
          x={218}
          y={198}
          width={34}
          height={30}
          rx={7}
          className="fill-white stroke-slate-200"
          strokeWidth={1.5}
        />
        <path
          d="M227 220 c3 0 4 -2 4 -4 l7 -9 a2 2 0 0 1 3 2 l-8 8 c0 2 -2 3 -6 3 Z"
          className="fill-brand-400 stroke-slate-500"
          strokeWidth={1.2}
          strokeLinejoin="round"
        />
      </g>
      <rect
        x={292}
        y={198}
        width={114}
        height={30}
        rx={7}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={310} y={214} anchor="middle" size={14} weight={700} tone="muted">
        −
      </Label>
      <Label x={349} y={214} anchor="middle" size={11} weight={600} tone="body">
        100%
      </Label>
      <Label x={388} y={214} anchor="middle" size={14} weight={700} tone="muted">
        +
      </Label>
    </Scene>
  );
}

// --- Selecting many ----------------------------------------------------------------------------

/** A multi-selection with its floating toolbar: More, Filter Selection, Duplicate, Export
 *  and Delete, over the union of the selected elements. */
export function MultiSelectionBar() {
  const bx = 104;
  const by = 46;
  const ink = 'fill-none stroke-slate-500';
  // The toolbar's buttons are icon-only: More, Filter Selection (the funnel), Duplicate,
  // Export and Delete, in that order.
  const icons: ReactNode[] = [
    <g key="more" className="fill-slate-500">
      <circle cx={-5} cy={0} r={1.6} />
      <circle cx={0} cy={0} r={1.6} />
      <circle cx={5} cy={0} r={1.6} />
    </g>,
    <path
      key="filter"
      d="M-6 -5 H6 L1.5 1 V6 L-1.5 4 V1 Z"
      className={ink}
      strokeWidth={1.5}
      strokeLinejoin="round"
    />,
    <g key="dup" className={ink} strokeWidth={1.5}>
      <rect x={-6} y={-6} width={8} height={8} rx={1.5} />
      <rect x={-2} y={-2} width={8} height={8} rx={1.5} />
    </g>,
    <path
      key="export"
      d="M0 3 V-6 M-3.5 -2.5 L0 -6 L3.5 -2.5 M-6 2 V6 H6 V2"
      className={ink}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />,
    <path
      key="delete"
      d="M-6 -4 H6 M-2 -4 V-6 H2 V-4 M-4.5 -4 L-3.5 6 H3.5 L4.5 -4"
      className={ink}
      strokeWidth={1.5}
      strokeLinejoin="round"
    />,
  ];
  return (
    <Scene w={420} h={220}>
      <Shape x={72} y={120} w={70} h={42} />
      <Shape x={176} y={116} w={70} h={50} kind="circle" />
      <Shape x={282} y={120} w={70} h={42} kind="diamond" />
      <Arrow connector from={[142, 141]} to={[176, 141]} />
      {[
        [72, 120, 70, 42],
        [176, 116, 70, 50],
        [282, 120, 70, 42],
      ].map(([x, y, w, h], i) => (
        <rect
          key={i}
          x={x! - 3}
          y={y! - 3}
          width={w! + 6}
          height={h! + 6}
          rx={8}
          className="fill-none stroke-brand-500"
          strokeWidth={1.8}
        />
      ))}
      <Panel x={bx} y={by} w={181} h={36}>
        {icons.map((icon, i) => (
          <g key={i} transform={`translate(${bx + 20 + i * 35} ${by + 18})`}>
            {icon}
          </g>
        ))}
        <line
          x1={bx + 72}
          y1={by + 8}
          x2={bx + 72}
          y2={by + 28}
          className="stroke-slate-200"
          strokeWidth={1.5}
        />
      </Panel>
    </Scene>
  );
}

// --- Floors ------------------------------------------------------------------------------------

// Each floor's two tones (light, dark) and a motif in its third, as the editor draws them
// (docs/specs/011-theme/floors.md), reduced to fit a 84 by 13 preview strip.
const FLOOR_ART: Record<string, { light: [string, string]; dark: [string, string]; d: string }> = {
  None: { light: ['#ffffff', '#ffffff'], dark: ['#1e293b', '#1e293b'], d: '' },
  Carpet: {
    light: ['#e9e4dc', '#d6cec2'],
    dark: ['#2b2926', '#3a3632'],
    d: 'M8 4h1v1h-1zM20 9h1v1h-1zM31 3h1v1h-1zM44 8h1v1h-1zM57 5h1v1h-1zM69 10h1v1h-1zM78 4h1v1h-1z',
  },
  'Carpet Tiles': {
    light: ['#e2e6ea', '#d1d6dc'],
    dark: ['#262a2f', '#1c1f23'],
    d: 'M21 0v13M42 0v13M63 0v13',
  },
  Wood: {
    light: ['#e9d9c1', '#cfb894'],
    dark: ['#3b3026', '#231b14'],
    d: 'M0 6.5h84M30 0v6.5M70 0v6.5M12 6.5v6.5M52 6.5v6.5',
  },
  Parquet: {
    light: ['#e7d7bd', '#ccb490'],
    dark: ['#3d3127', '#241b14'],
    d: 'M14 0v13M28 0v13M42 4.3h14M42 8.6h14M56 0v13M70 0v13M0 4.3h14M0 8.6h14M70 4.3h14M70 8.6h14',
  },
  Tiles: {
    light: ['#eff1ee', '#dadddb'],
    dark: ['#2a2e32', '#202326'],
    d: 'M0 6.5h84M14 0v13M28 0v13M42 0v13M56 0v13M70 0v13',
  },
  Marble: {
    light: ['#f2f1ee', '#d3d0c9'],
    dark: ['#26282c', '#45494f'],
    d: 'M0 3C20 9 34 1 52 7S74 12 84 10',
  },
  Terrazzo: {
    light: ['#efece6', '#c9a996'],
    dark: ['#2a2928', '#4f4d4a'],
    d: 'M6 3h2v2h-2zM18 8h2v2h-2zM29 4h2v2h-2zM40 9h2v2h-2zM52 3h2v2h-2zM63 7h2v2h-2zM75 4h2v2h-2z',
  },
  Concrete: { light: ['#e3e2df', '#d0cecb'], dark: ['#2a2b2d', '#1c1d1f'], d: 'M42 0v13' },
  Decking: {
    light: ['#ddccb3', '#bfad90'],
    dark: ['#3a3129', '#1e1915'],
    d: 'M0 4.3h84M0 8.6h84M36 0v4.3M64 4.3v4.3M20 8.6v4.4',
  },
  Paving: {
    light: ['#dfdcd5', '#cdc9c1'],
    dark: ['#343539', '#242528'],
    d: 'M0 6.5h84M24 0v6.5M54 0v6.5M10 6.5v6.5M40 6.5v6.5M70 6.5v6.5',
  },
  Cobbles: {
    light: ['#dfdbd3', '#d0cbc2'],
    dark: ['#343538', '#242527'],
    d: 'M0 4.3h84M0 8.6h84M12 0v4.3M30 0v4.3M48 0v4.3M66 0v4.3M21 4.3v4.3M39 4.3v4.3M57 4.3v4.3M75 4.3v4.3M12 8.6v4.4M30 8.6v4.4M48 8.6v4.4M66 8.6v4.4',
  },
  Grass: {
    light: ['#d8e6c6', '#bdd2a2'],
    dark: ['#1f2b1f', '#2e3f2c'],
    d: 'M6 11l1-4M15 10l-1-4M24 12l1-5M33 10l1-4M42 11l-1-4M51 12l1-5M60 10l1-4M69 11l-1-4M78 12l1-5',
  },
  Sand: {
    light: ['#efe5d1', '#ddcfb4'],
    dark: ['#2f2a21', '#3b3529'],
    d: 'M0 5q10-3 21 0t21 0t21 0t21 0M0 10q10-3 21 0t21 0t21 0t21 0',
  },
  Mud: {
    light: ['#ddd0bf', '#c8b7a0'],
    dark: ['#2c251e', '#3e342a'],
    d: 'M12 6h2v2h-2zM31 9h2v2h-2zM47 4h2v2h-2zM66 8h2v2h-2z',
  },
};

/** A floor, drawn inside a tile's preview strip (`x`, `y`, 84 by 13), in light and dark. */
function FloorArt({ kind, x, y }: { kind: string; x: number; y: number }) {
  const art = FLOOR_ART[kind];
  if (!art) return null;
  const half = (tones: [string, string], className: string) => (
    <g className={className} transform={`translate(${x} ${y})`}>
      <rect width={84} height={13} rx={3} fill={tones[0]} />
      {art.d ? (
        <path d={art.d} stroke={tones[1]} fill={tones[1]} strokeWidth={0.8} strokeLinecap="round" />
      ) : null}
    </g>
  );
  return (
    <>
      {half(art.light, 'dark:hidden')}
      {half(art.dark, 'hidden dark:inline')}
    </>
  );
}

/** A floor tile in the Canvas panel's carousel: the floor drawn, then its name. */
function PatternTile({
  x,
  y,
  kind,
  on = false,
}: {
  x: number;
  y: number;
  kind: string;
  on?: boolean;
}) {
  return (
    <OptionBox x={x} y={y} w={96} h={34} on={on} label={kind}>
      <FloorArt kind={kind} x={x + 6} y={y + 4} />
    </OptionBox>
  );
}

/** The Canvas panel: the first page of floors (nine on a wide screen), the Canvas colour, and the
 *  Strength and Size sliders. */
export function LookAndFeelCanvas() {
  const floors = [
    'None',
    'Carpet',
    'Carpet Tiles',
    'Wood',
    'Parquet',
    'Tiles',
    'Marble',
    'Terrazzo',
    'Concrete',
  ];
  return (
    <TabStylePanel panel="Canvas" h={300} sceneH={324}>
      <CarouselHeading y={98} label="FLOOR" />
      {floors.map((p, i) => (
        <PatternTile
          key={p}
          x={60 + (i % 3) * 102}
          y={106 + Math.floor(i / 3) * 38}
          kind={p}
          on={p === 'Carpet Tiles'}
        />
      ))}
      <Caption x={60} y={244}>
        COLOURS
      </Caption>
      <rect
        x={60}
        y={256}
        width={18}
        height={18}
        rx={4}
        className="fill-white stroke-slate-300"
        strokeWidth={1.3}
      />
      <Label x={84} y={265} size={10} tone="body">
        Canvas
      </Label>
      <Slider x={220} y={244} w={140} t={1} label="Strength" readout="100%" />
      <Slider x={220} y={274} w={140} t={1 / 3} label="Size" readout="100%" />
    </TabStylePanel>
  );
}
