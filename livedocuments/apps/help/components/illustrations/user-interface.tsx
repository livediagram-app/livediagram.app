// User-Interface-category illustrations (docs/specs/018-help/help-app.md): where the editor's
// panels and fixed controls sit (the bottom bar with its tabs and quick
// controls, the bottom-right corner cluster), the selection toolbars, the
// element menu and the Map. Labels are the editor's own (apps/editor:
// TabBar, ChromeControls, CanvasChrome, ZoomMenu, SelectionPopover,
// MultiSelectionToolbar, EditorContextMenu). Composed from the shared
// primitives so the house style holds.

import { Scene, Shape, Arrow, Panel, Label } from '@liveworkspace/help-site/art/primitives';
import { MenuCard, Strip } from './toolbar-layout';
import { GLYPH, BottomBar } from '@liveworkspace/help-site/art/illustrations/user-interface-chrome';

// These scenes are the shared ones (@liveworkspace/help-site/art/illustrations/user-interface-scenes), drawn as
// they are; the panel layout and the corner cluster, zoom controls and Map below are this app's own.
export {
  QuickControls,
  TabBar,
  MultiSelectToolbar,
  ElementContextMenu,
} from '@liveworkspace/help-site/art/illustrations/user-interface-scenes';

// --- Fixed chrome ------------------------------------------------------------

// The glyphs, the bottom bar and its tabs are the shared help chrome; the corner cluster is this
// editor's own, with no paintbrush (Tab Style sits on each page's title bar).

/** The bottom-right corner cluster: Undo / Redo, Layers, then the zoom controls (minus, the
 *  level, plus). Tab Style is on each page's title bar. */
function CornerCluster({ x, y, level = '100%' }: { x: number; y: number; level?: string }) {
  return (
    <g>
      <Panel x={x} y={y} w={52} h={28}>
        <path d={`M${x + 10} ${y + 15} a6 6 0 1 1 3 5`} {...GLYPH} />
        <path d={`M${x + 8} ${y + 11} l2 4 l4 -2`} {...GLYPH} />
        <path d={`M${x + 42} ${y + 15} a6 6 0 1 0 -3 5`} {...GLYPH} />
        <path d={`M${x + 44} ${y + 11} l-2 4 l-4 -2`} {...GLYPH} />
      </Panel>
      <Panel x={x + 56} y={y} w={28} h={28}>
        <path
          d={`M${x + 63} ${y + 11} l7 -4 l7 4 l-7 4 Z M${x + 63} ${y + 16} l7 4 l7 -4`}
          {...GLYPH}
        />
      </Panel>
      <Panel x={x + 88} y={y} w={94} h={28}>
        <Label x={x + 102} y={y + 15} size={13} weight={700} tone="muted" anchor="middle">
          −
        </Label>
        <Label x={x + 135} y={y + 15} size={10} weight={600} tone="body" anchor="middle">
          {level}
        </Label>
        <Label x={x + 168} y={y + 15} size={13} weight={700} tone="muted" anchor="middle">
          +
        </Label>
      </Panel>
    </g>
  );
}

/** The whole frame at a glance: the menu button card top-left, the palette strip across the
 *  top, a tool panel (Format) docked top-right under it, the Map bottom-left, the corner cluster
 *  bottom-right, and the bottom bar. */
export function PanelLayout() {
  return (
    <Scene w={420} h={250}>
      <MenuCard x={12} y={12} />
      <Strip x={82} y={12} />
      <Panel x={318} y={56} w={90} h={66} title="FORMAT">
        {[0, 1].map((i) => (
          <rect
            key={i}
            x={328}
            y={88 + i * 14}
            width={i === 0 ? 62 : 44}
            height={6}
            rx={3}
            className={i === 0 ? 'fill-brand-200' : 'fill-slate-200'}
          />
        ))}
      </Panel>
      <Shape x={146} y={68} w={74} h={38} label="Start" />
      <Shape x={146} y={134} w={74} h={38} accent label="Ship" />
      <Arrow from={[183, 106]} to={[183, 134]} />
      <Panel x={12} y={150} w={92} h={58} title="CONTENTS">
        <rect x={36} y={182} width={14} height={8} rx={2} className="fill-slate-300" />
        <rect x={36} y={194} width={14} height={8} rx={2} className="fill-slate-300" />
        <rect
          x={28}
          y={178}
          width={46}
          height={26}
          rx={3}
          fill="none"
          className="stroke-brand-500"
          strokeWidth={1.4}
        />
      </Panel>
      <CornerCluster x={194} y={182} />
      <BottomBar y={220} w={420} />
    </Scene>
  );
}

/** The bottom-right cluster with the zoom presets open above the level:
 *  25% to 150% and Fit to screen. */
export function ZoomControls() {
  const presets = ['25%', '50%', '75%', '100%', '125%', '150%'];
  const px = 231;
  const py = 14;
  return (
    <Scene w={420} h={240}>
      <Shape x={40} y={60} w={110} h={52} label="Detail" />
      <Panel x={px} y={py} w={92} h={170}>
        {presets.map((p, i) => {
          const ry = py + 8 + i * 22;
          const on = p === '100%';
          return (
            <g key={p}>
              {on && (
                <rect x={px + 5} y={ry} width={82} height={20} rx={5} className="fill-brand-50" />
              )}
              <Label
                x={px + 46}
                y={ry + 11}
                size={10}
                weight={on ? 700 : 500}
                tone={on ? 'accent' : 'body'}
                anchor="middle"
              >
                {p}
              </Label>
            </g>
          );
        })}
        <line
          x1={px + 8}
          y1={py + 143}
          x2={px + 84}
          y2={py + 143}
          className="stroke-slate-200"
          strokeWidth={1.2}
        />
        <Label x={px + 46} y={py + 157} size={10} weight={500} tone="body" anchor="middle">
          Fit to screen
        </Label>
      </Panel>
      <CornerCluster x={110} y={198} />
    </Scene>
  );
}

/** The bottom-left Map panel: a zoomed-out outline of the canvas, the area
 *  outside your view dimmed, and a brand rectangle marking what you see. */
export function Minimap() {
  return (
    <Scene w={420} h={210}>
      {/* The canvas the map mirrors. */}
      <Shape x={196} y={26} w={68} h={38} label="A" />
      <Shape x={176} y={116} w={62} h={36} accent label="B" />
      <Shape x={300} y={116} w={62} h={36} kind="circle" label="C" />
      {/* Elbow connectors down out of A, splitting to B and C, one level arrowhead each. */}
      <path
        d="M230 64 V88 H207 V108 M230 88 H331 V108"
        className="fill-none stroke-brand-400"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Arrow from={[207, 106]} to={[207, 116]} tone="accent" />
      <Arrow from={[331, 106]} to={[331, 116]} tone="accent" />
      {/* The Map panel, bottom-left, with the current-view box. */}
      <Panel x={20} y={110} w={136} h={88} title="MAP">
        <rect x={26} y={136} width={124} height={56} rx={4} className="fill-slate-100" />
        <rect x={52} y={146} width={70} height={40} rx={3} className="fill-white" />
        {/* The miniature in the shapes' own colours, labels left out. */}
        <rect
          x={80}
          y={150}
          width={20}
          height={10}
          rx={2}
          className="fill-white stroke-brand-300"
          strokeWidth={1}
        />
        <rect x={68} y={172} width={17} height={9} rx={2} className="fill-brand-500" />
        <circle cx={112} cy={176} r={5} className="fill-white stroke-brand-300" strokeWidth={1} />
        <path
          d="M90 160 V166 H76 V172 M90 166 H112 V171"
          className="fill-none stroke-brand-300"
          strokeWidth={1}
        />
        <rect
          x={52}
          y={146}
          width={70}
          height={40}
          rx={3}
          fill="none"
          className="stroke-brand-500"
          strokeWidth={1.6}
        />
      </Panel>
    </Scene>
  );
}
