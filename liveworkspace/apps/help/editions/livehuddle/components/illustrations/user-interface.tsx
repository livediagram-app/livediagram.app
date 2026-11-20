// User-Interface-category illustrations (liveworkspace/docs/specs/017-help/help-centre.md): where the editor's
// panels and fixed controls sit (the top corner cards, the bottom bar with its tabs and quick controls, the
// bottom-right corner cluster), the selection toolbars, the element menu and the Map. Labels are the editor's own
// (apps/editor: TabBar, ChromeControls, CanvasChrome, ZoomMenu, SelectionPopover, MultiSelectionToolbar,
// EditorContextMenu); the chrome is ./editor-chrome and the floor ./space-furniture.

import type { ReactNode } from 'react';
import { Label, Panel, Scene, SelectionBox } from '@liveworkspace/help-site/art/primitives';
import { PainterGlyph } from './palette-modes-parts';
import { GLYPH, DotsGlyph, IconButton } from './user-interface-chrome';
import {
  BAR_H,
  BottomBar,
  Card,
  CornerCluster,
  CORNER_W,
  STRIP_W,
  TopRow,
  topRowStripX,
} from './editor-chrome';
import { Desk, OfficeFloor, Plant, Room, Rug, Sofa } from './space-furniture';
import { PixelCharacter } from './pixel-character';

// --- Scenes ------------------------------------------------------------------

/** The Map panel, top-left at (x, y), 120 by 84: its title with help and minimise, a miniature of the floor and
 *  the green box of what you see. */
export function MapPanel({ x, y }: { x: number; y: number }) {
  const room = (rx: number, ry: number, w: number, h: number) => (
    <rect
      x={x + rx}
      y={y + ry}
      width={w}
      height={h}
      className="fill-amber-50 stroke-stone-300 help-art-as-drawn"
      strokeWidth={0.75}
    />
  );
  return (
    <g>
      <Panel x={x} y={y} w={120} h={84} title="MAP" />
      <Label x={x + 96} y={y + 11.5} size={8.5} tone="muted" anchor="middle">
        ?
      </Label>
      <path d={`M${x + 106} ${y + 11} h6`} className="stroke-slate-400" strokeWidth={1} />
      <rect x={x + 6} y={y + 27} width={108} height={51} rx={3} className="fill-slate-100" />
      {room(14, 32, 26, 16)}
      {room(44, 32, 30, 16)}
      {room(78, 32, 26, 16)}
      {room(14, 56, 26, 16)}
      {room(44, 56, 30, 16)}
      {room(78, 56, 26, 16)}
      <rect
        x={x + 36}
        y={y + 44}
        width={44}
        height={22}
        rx={2}
        className="fill-brand-500/15 stroke-brand-500"
        strokeWidth={1.2}
      />
    </g>
  );
}

/** The whole frame at a glance: the logo and menu cards top-left, the strip across the top, Share and Sign In
 *  top-right, the Map bottom-left, the corner cluster bottom-right and the bottom bar under it all. */
export function PanelLayout() {
  return (
    <Scene w={520} h={300}>
      <OfficeFloor x={150} y={52} />
      <PixelCharacter fx={330} fy={180} px={1.6} shirt="violet" />
      <TopRow w={520} />
      <MapPanel x={8} y={184} />
      <CornerCluster x={350} y={244} />
      <BottomBar y={300 - BAR_H} w={520} tabs={['Virtual Office']} />
    </Scene>
  );
}

/** The quick controls, close up: Tools and Settings named beside their icons, then notifications and the
 *  appearance switch, at the right-hand end of the bottom bar. */
export function QuickControls() {
  return (
    <Scene w={420} h={110}>
      <Room x={40} y={-30} w={240} h={84} name="" door="none" />
      <Desk x={70} y={14} chair={false} />
      <Plant cx={250} cy={30} />
      <BottomBar y={70} w={420} tabs={['Tab 1']} />
      <rect
        x={420 - 144}
        y={73}
        width={140}
        height={20}
        rx={6}
        fill="none"
        className="stroke-brand-500"
        strokeWidth={1}
        strokeDasharray="3 2"
      />
    </Scene>
  );
}

/** The bottom bar's tabs: the open tab with who is in it and its ⋯, another tab, a shut tab folder, the + button
 *  and the quick controls at the far end. */
export function TabBar() {
  const y = 84;
  return (
    <Scene w={500} h={110}>
      <Room x={150} y={-20} w={200} h={88} name="" door="none" />
      <Rug cx={250} cy={40} />
      <Sofa x={230} y={26} />
      <BottomBar y={y} w={500} tabs={['Lounge', 'Desks']} firstTabW={82} plusGap={50} />
      {/* Who is on the open tab, beside its name. */}
      <circle
        cx={55}
        cy={y + 15}
        r={4}
        className="fill-violet-500 dark:fill-violet-700 stroke-white"
        strokeWidth={1}
      />
      <circle
        cx={61}
        cy={y + 15}
        r={4}
        className="fill-emerald-500 dark:fill-emerald-700 stroke-white"
        strokeWidth={1}
      />
      {/* A shut tab folder: a shelf tinted in the folder's colour holding its name and a count. */}
      <path
        d={`M135 ${y + BAR_H} V${y + 9} a5 5 0 0 1 5 -5 H182 a5 5 0 0 1 5 5 V${y + BAR_H} Z`}
        className="fill-violet-50"
      />
      <Label
        x={142}
        y={y + 15.5}
        size={9}
        weight={650}
        className="fill-violet-700 dark:fill-violet-300"
      >
        Rooms
      </Label>
      <rect
        x={171}
        y={y + 9.5}
        width={11}
        height={11}
        rx={3.5}
        className="fill-violet-600 dark:fill-violet-300"
      />
      <Label
        x={176.5}
        y={y + 15.5}
        anchor="middle"
        size={7.5}
        weight={700}
        className="fill-white dark:fill-slate-950"
      >
        3
      </Label>
    </Scene>
  );
}

/** The corner cluster with the zoom presets open above the level: 25% to 150% and Fit to screen. */
export function ZoomControls() {
  const presets = ['25%', '50%', '75%', '100%', '125%', '150%'];
  const px = 318;
  const py = 14;
  return (
    <Scene w={420} h={230}>
      <Room x={20} y={30} w={200} h={130} name="Meeting Room" />
      <Desk x={60} y={70} />
      <Plant cx={190} cy={140} />
      <Card x={px} y={py} w={80} h={164} r={6}>
        {presets.map((p, i) => {
          const ry = py + 6 + i * 21;
          const on = p === '100%';
          return (
            <g key={p}>
              {on && (
                <rect x={px + 4} y={ry} width={72} height={19} rx={4} className="fill-brand-50" />
              )}
              <Label
                x={px + 40}
                y={ry + 10}
                size={9.5}
                weight={on ? 650 : 500}
                tone={on ? 'accent' : 'body'}
                anchor="middle"
              >
                {p}
              </Label>
            </g>
          );
        })}
        <line
          x1={px + 6}
          y1={py + 136}
          x2={px + 74}
          y2={py + 136}
          className="stroke-slate-100"
          strokeWidth={0.75}
        />
        <Label x={px + 40} y={py + 150} size={9.5} tone="body" anchor="middle">
          Fit to screen
        </Label>
      </Card>
      <CornerCluster x={420 - 8 - 162} y={196} highlight="zoom" />
    </Scene>
  );
}

/** The selection toolbar an Editor sees over one selected element, its top-left corner at (x, y), 34 tall: More,
 *  Add text, Duplicate, Format Painter, Bring to front, Send to back and Delete (Add Comment is in the More
 *  menu). `formatOn` draws Format Painter pressed, as while its brush is loaded. */
export function SelectionToolbar({
  x,
  y,
  formatOn = false,
}: {
  x: number;
  y: number;
  formatOn?: boolean;
}) {
  const buttons: { key: string; glyph: ReactNode }[] = [
    { key: 'more', glyph: <DotsGlyph x={0} y={0} /> },
    { key: 'text', glyph: <path d="M-5 -5 h10 M0 -5 v10" {...GLYPH} /> },
    {
      key: 'dup',
      glyph: (
        <g>
          <rect x={-5} y={-5} width={8} height={8} rx={1.5} {...GLYPH} />
          <rect x={-2} y={-2} width={8} height={8} rx={1.5} {...GLYPH} />
        </g>
      ),
    },
    { key: 'format', glyph: <PainterGlyph on={formatOn} /> },
    { key: 'front', glyph: <path d="M0 5 V-5 M-4 -1 L0 -5 L4 -1" {...GLYPH} /> },
    { key: 'back', glyph: <path d="M0 -5 V5 M-4 1 L0 5 L4 1" {...GLYPH} /> },
    { key: 'delete', glyph: <path d="M-5 -4 h10 M-3 -4 v9 h6 v-9 M-1.5 -6 h3" {...GLYPH} /> },
  ];
  return (
    <Panel x={x} y={y} w={selectionToolbarWidth()} h={34}>
      {buttons.map((b, i) => (
        <IconButton
          key={b.key}
          x={x + 6 + i * 30}
          y={y + 5}
          tone={b.key === 'format' && formatOn ? 'brand' : 'plain'}
        >
          {b.glyph}
        </IconButton>
      ))}
    </Panel>
  );
}

/** The width `SelectionToolbar` draws at: its seven buttons, 30 apart. */
function selectionToolbarWidth(): number {
  return 8 + 7 * 30;
}

/** One selected sofa with its toolbar above: the "Selected Sofa" caption, then the selection toolbar, Format
 *  Painter among its buttons. */
export function ContextualToolbar() {
  const tx = 92;
  const ty = 30;
  return (
    <Scene w={420} h={190}>
      <Room x={40} y={86} w={340} h={96} name="Lounge" door="none" />
      <Rug cx={208} cy={142} rx={44} ry={20} />
      <Sofa x={170} y={122} />
      <SelectionBox x={166} y={118} w={48} h={26} />
      <Label x={tx + 2} y={ty - 10} size={10} weight={600} tone="muted">
        Selected Sofa
      </Label>
      <SelectionToolbar x={tx} y={ty} />
    </Scene>
  );
}

/** A marquee selection of two desks and a plant, with the multi-select toolbar: More, Filter Selection,
 *  Duplicate, Export and Delete. */
export function MultiSelectToolbar() {
  const tx = 132;
  const ty = 30;
  const buttons: ReactNode[] = [
    <DotsGlyph key="more" x={0} y={0} />,
    <path key="filter" d="M-6 -5 h12 l-5 5 v5 l-2 -1 v-4 Z" {...GLYPH} />,
    <g key="dup">
      <rect x={-5} y={-5} width={8} height={8} rx={1.5} {...GLYPH} />
      <rect x={-2} y={-2} width={8} height={8} rx={1.5} {...GLYPH} />
    </g>,
    <path key="export" d="M0 3 V-6 M-4 -2 L0 -6 L4 -2 M-6 3 v3 h12 v-3" {...GLYPH} />,
    <path key="delete" d="M-5 -4 h10 M-3 -4 v9 h6 v-9 M-1.5 -6 h3" {...GLYPH} />,
  ];
  return (
    <Scene w={420} h={200}>
      <Room x={40} y={82} w={340} h={110} name="Desks" door="none" />
      <Desk x={110} y={120} />
      <Desk x={190} y={120} />
      <Plant cx={262} cy={140} />
      <SelectionBox x={104} y={112} w={170} h={44} />
      <Label x={tx + 2} y={ty - 10} size={10} weight={600} tone="muted">
        Selected Elements (3)
      </Label>
      <Panel x={tx} y={ty} w={8 + buttons.length * 30} h={34}>
        {buttons.map((g, i) => (
          <IconButton key={i} x={tx + 6 + i * 30} y={ty + 5}>
            {g}
          </IconButton>
        ))}
      </Panel>
    </Scene>
  );
}

/** The element menu for a sofa, as EditorContextMenu draws it: the quick bar across the top with Clear Styles'
 *  eraser at its right, then the collapsible sections, Arrange first, then Size, Rotation and the Appearance
 *  flyout. */
export function ElementContextMenu() {
  const sections: { label: string; flyout?: boolean }[] = [
    { label: 'Arrange' },
    { label: 'Size' },
    { label: 'Rotation' },
    { label: 'Appearance', flyout: true },
  ];
  const mx = 214;
  const my = 16;
  const bar = 28;
  return (
    <Scene w={420} h={170}>
      <Room x={20} y={30} w={180} h={120} name="Lounge" door="none" />
      <Rug cx={100} cy={96} rx={44} ry={20} />
      <Sofa x={80} y={76} />
      <SelectionBox x={76} y={72} w={48} h={26} />
      <Panel x={mx} y={my} w={160} h={bar + 8 + sections.length * 25}>
        <IconButton x={mx + 130} y={my + 4} size={22}>
          <path d="M1.5 -5.5 L5.5 -1.5 L-1 5 H-4.5 L-6 3.5 Z M-2 -2 l4 4" {...GLYPH} />
        </IconButton>
        <line
          x1={mx + 1}
          y1={my + bar + 1}
          x2={mx + 159}
          y2={my + bar + 1}
          className="stroke-slate-100"
          strokeWidth={0.75}
        />
        {sections.map((sec, i) => {
          const ry = my + bar + 5 + i * 25;
          const on = sec.label === 'Appearance';
          return (
            <g key={sec.label}>
              {on && (
                <rect x={mx + 4} y={ry} width={152} height={23} rx={5} className="fill-brand-50" />
              )}
              <Label
                x={mx + 14}
                y={ry + 12}
                size={10.5}
                weight={on ? 600 : 500}
                tone={on ? 'accent' : 'body'}
              >
                {sec.label}
              </Label>
              <path
                d={
                  sec.flyout
                    ? `M${mx + 142} ${ry + 8} l4 4 l-4 4`
                    : `M${mx + 140} ${ry + 10} l4 4 l4 -4`
                }
                className="stroke-slate-400"
                strokeWidth={1.2}
                fill="none"
                strokeLinecap="round"
              />
            </g>
          );
        })}
      </Panel>
    </Scene>
  );
}

/** The bottom-left Map: the floor in miniature with the green box of what you see, beside the floor itself. */
export function Minimap() {
  return (
    <Scene w={420} h={200}>
      <g transform="translate(150 20) scale(0.85)">
        <OfficeFloor x={0} y={0} />
      </g>
      <MapPanel x={12} y={104} />
    </Scene>
  );
}

/** A callout under the top corners: a dotted leader from the cards' foot down to its words. */
function Callout({ x, y, text }: { x: number; y: number; text: string }) {
  return (
    <g>
      <line
        x1={x}
        y1={39}
        x2={x}
        y2={y - 9}
        className="stroke-slate-300"
        strokeWidth={0.75}
        strokeDasharray="2 2"
      />
      <circle cx={x} cy={39} r={1.5} className="fill-slate-400" />
      <Label x={x} y={y} size={9.5} weight={600} anchor="middle" tone="body">
        {text}
      </Label>
    </g>
  );
}

/** The top of a shared Space as its owner sees it: the logo card and the menu card at the left, the palette strip
 *  between, and the corner card with Share and the account's initial. */
export function TopCorners() {
  const w = 520;
  const sx = topRowStripX(w);
  const cx = w - 8 - CORNER_W;
  return (
    <Scene w={w} h={96}>
      <TopRow w={w} initial="S" />
      <Callout x={48} y={66} text="Logo" />
      <Callout x={110} y={86} text="Menu" />
      <Callout x={sx + STRIP_W / 2} y={66} text="Palette" />
      <Callout x={cx + 14} y={86} text="Share" />
      <Callout x={cx + 40} y={66} text="Account" />
    </Scene>
  );
}
