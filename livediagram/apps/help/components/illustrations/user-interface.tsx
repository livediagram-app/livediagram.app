// User-Interface-category illustrations (docs/specs/018-help/help-app.md): where the editor's
// panels and fixed controls sit (the bottom bar with its tabs and quick
// controls, the bottom-right corner cluster), the selection toolbars, the
// element menu and the Map. Labels are the editor's own (apps/editor:
// TabBar, ChromeControls, CanvasChrome, ZoomMenu, SelectionPopover,
// MultiSelectionToolbar, EditorContextMenu). Composed from the shared
// primitives so the house style holds.

import { Scene, Shape, Arrow, Panel } from '@liveworkspace/help-site/art/primitives';
import { MenuCard, Strip } from './toolbar-layout';
import {
  BottomBar,
  CornerCluster,
} from '@liveworkspace/help-site/art/illustrations/user-interface-chrome';

// These scenes are the shared ones (@liveworkspace/help-site/art/illustrations/user-interface-scenes), drawn as
// they are; the panel layout below is this app's own.
export {
  QuickControls,
  TabBar,
  ZoomControls,
  ContextualToolbar,
  MultiSelectToolbar,
  ElementContextMenu,
  Minimap,
} from '@liveworkspace/help-site/art/illustrations/user-interface-scenes';

// --- Scenes ------------------------------------------------------------------

/** The whole frame at a glance: the menu button card top-left, the palette strip across the
 *  top, a tool panel (Laser) docked top-right under it, the Map bottom-left, the corner cluster
 *  bottom-right, and the bottom bar. */
export function PanelLayout() {
  return (
    <Scene w={420} h={250}>
      <MenuCard x={12} y={12} />
      <Strip x={82} y={12} />
      <Panel x={318} y={56} w={90} h={66} title="LASER">
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
      <Panel x={12} y={150} w={92} h={58} title="MAP">
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
