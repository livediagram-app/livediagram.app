// User-Interface-category illustrations (docs/specs/018-help/help-app.md): where the editor's
// panels and fixed controls sit (the bottom bar with its tabs and quick
// controls, the bottom-right corner cluster), the selection toolbars, the
// element menu and the Map. Labels are the editor's own (apps/live:
// TabBar, ChromeControls, CanvasChrome, ZoomMenu, SelectionPopover,
// MultiSelectionToolbar, EditorContextMenu). Composed from the shared
// primitives so the house style holds.

import { Scene, Shape, Arrow, Panel, Label } from '@liveworkspace/help-site/art/primitives';
import { MenuCard, Strip } from './toolbar-layout';
import {
  BottomBar,
  CornerCluster,
  GLYPH,
  TabPill,
} from '@liveworkspace/help-site/art/illustrations/user-interface-chrome';

// These scenes are the shared ones (@liveworkspace/help-site/art/illustrations/user-interface-scenes), drawn as
// they are; the panel layout below is this app's own.
export {
  TabBar,
  ZoomControls,
  ContextualToolbar,
  MultiSelectToolbar,
  ElementContextMenu,
  Minimap,
} from '@liveworkspace/help-site/art/illustrations/user-interface-scenes';

// --- Scenes ------------------------------------------------------------------

/** The whole frame at a glance: the menu button card top-left, the palette strip across the
 *  top, a tool panel (Format) docked top-right under it, the corner cluster bottom-right, and the
 *  bottom bar. No Map: livedesign's tabs are all pages, which Contents lists instead. */
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
      <CornerCluster x={194} y={182} />
      <BottomBar y={220} w={420} />
    </Scene>
  );
}

/** The bottom bar's right-hand end as livedesign draws it (apps/live ChromeControls): Get Started (while a tour
 *  is on offer), Tools, Settings, then the appearance switch, an icon alone. Outlined to pick it out. */
export function QuickControls() {
  const y = 86;
  const mid = y + 15;
  return (
    <Scene w={420} h={130}>
      <Shape x={60} y={20} w={80} h={40} label="Idea" />
      <rect x={0} y={y} width={420} height={30} className="fill-slate-100" />
      <line x1={0} y1={y} x2={420} y2={y} className="stroke-slate-200" strokeWidth={1.5} />
      <TabPill x={14} y={y + 5} w={60} label="Tab 1" active />
      <Label x={88} y={mid} size={14} weight={600} tone="muted" anchor="middle">
        +
      </Label>
      {/* Get Started: a chip with the play glyph in an accent disc. */}
      <rect
        x={160}
        y={y + 6}
        width={78}
        height={18}
        rx={9}
        className="fill-white stroke-slate-200"
      />
      <circle cx={170} cy={mid} r={5.5} className="fill-brand-600" />
      <path d={`M168.5 ${mid - 2.5} l4 2.5 l-4 2.5 Z`} className="fill-white help-art-as-drawn" />
      <Label x={180} y={mid + 1} size={9.5} tone="body">
        Get Started
      </Label>
      {/* Tools: a toolbox. */}
      <g transform={`translate(256 ${mid})`}>
        <rect x={-6} y={-3.5} width={12} height={8.5} rx={1.5} {...GLYPH} />
        <path d="M-2 -3.5 V-5.4 h4 V-3.5 M-6 0 h12" {...GLYPH} />
      </g>
      <Label x={266} y={mid + 1} size={10} tone="body">
        Tools
      </Label>
      {/* Settings: sliders, never a cog. */}
      <g transform={`translate(310 ${mid})`}>
        <path
          d="M-7 -4 h3 M-1 -4 h8 M-7 0 h7 M3 0 h4 M-7 4 h2 M1 4 h6 M-2.5 -6 v4 M1.5 -2 v4 M-3 2 v4"
          {...GLYPH}
        />
      </g>
      <Label x={321} y={mid + 1} size={10} tone="body">
        Settings
      </Label>
      {/* The appearance switch, its icon alone. */}
      <g transform={`translate(386 ${mid})`}>
        <circle r={3} {...GLYPH} />
        <path
          d="M0 -7 v1.8 M0 7 v-1.8 M-7 0 h1.8 M7 0 h-1.8 M-5 -5 l1.3 1.3 M5 5 l-1.3 -1.3 M5 -5 l-1.3 1.3 M-5 5 l1.3 -1.3"
          {...GLYPH}
        />
      </g>
      <rect
        x={154}
        y={y + 3}
        width={252}
        height={24}
        rx={6}
        fill="none"
        className="stroke-brand-400"
        strokeWidth={1.5}
        strokeDasharray="4 3"
      />
    </Scene>
  );
}
