// User-Interface-category illustrations (liveworkspace/docs/specs/017-help/help-centre.md): where the editor's
// panels and fixed controls sit (the bottom bar with its tabs and quick
// controls, the bottom-right corner cluster), the selection toolbars, the
// element menu and the Map. Labels are the editor's own (apps/editor:
// TabBar, ChromeControls, CanvasChrome, ZoomMenu, SelectionPopover,
// MultiSelectionToolbar, EditorContextMenu). Composed from the shared
// primitives so the house style holds.

import { Scene, Shape, Arrow, Panel } from '@liveworkspace/help-site/art/primitives';
import { EditorFrame } from './editor-chrome';

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

/** The whole frame at a glance: the logo and menu cards top-left, the palette strip across the top, Share and Sign
 *  In top-right with a tool panel (Laser) docked under them, the Map bottom-left, the corner cluster bottom-right, and
 *  the bottom bar. */
export function PanelLayout() {
  const W = 540;
  const H = 290;
  return (
    <Scene w={W} h={H}>
      <Shape x={196} y={74} w={84} h={42} label="Start" />
      <Shape x={196} y={150} w={84} h={42} accent label="Ship" />
      <Arrow from={[238, 116]} to={[238, 150]} />
      <Panel x={W - 8 - 104} y={42} w={104} h={70} title="LASER">
        {[0, 1].map((i) => (
          <rect
            key={i}
            x={W - 8 - 94}
            y={76 + i * 14}
            width={i === 0 ? 76 : 52}
            height={6}
            rx={3}
            className={i === 0 ? 'fill-brand-200' : 'fill-slate-200'}
          />
        ))}
      </Panel>
      <Panel x={8} y={H - 26 - 8 - 66} w={100} h={66} title="MAP">
        <rect x={34} y={H - 72} width={14} height={8} rx={2} className="fill-slate-300" />
        <rect x={34} y={H - 60} width={14} height={8} rx={2} className="fill-slate-300" />
        <rect
          x={24}
          y={H - 76}
          width={50}
          height={30}
          rx={3}
          fill="none"
          className="stroke-brand-500"
          strokeWidth={1.2}
        />
      </Panel>
      <EditorFrame w={W} h={H} tabs={['Overview', 'Flow']} />
    </Scene>
  );
}
