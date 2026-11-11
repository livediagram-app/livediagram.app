// Layer illustrations for the Canvas articles on Layers, Organising and Merging Layers, Hiding,
// Locking and Dimming Layers, and Layer Order and Opacity (docs/specs/018-help/help-app.md). Each
// draws the real surface with its real labels: the Layers panel's rows and footer
// (panels/LayersPanel.tsx, panels/LayerRow.tsx), a row's menu (panels/LayerRowMenu.tsx), and the
// element menu's Layer category (palette/EditorContextMenu.tsx, palette/MoveToLayerRow.tsx).
import { Scene } from '../primitives';
import {
  LayeredCanvas,
  LayersPanel,
  thumbBackground,
  thumbEmpty,
  thumbFlow,
  thumbNotes,
} from './layers-parts';

export { ElementLayerMenuScene, LayerRowMenuScene } from './layers-menus';

export function LayersPanelScene() {
  return (
    <Scene w={436} h={264}>
      <LayeredCanvas />
      <LayersPanel
        x={206}
        y={14}
        rows={[
          { name: 'Review notes', count: 2, thumb: thumbNotes },
          { name: 'Checkout flow', count: 3, active: true, thumb: thumbFlow },
          { name: 'Layer 3', thumb: thumbEmpty },
          { name: 'Background', count: 1, locked: true, thumb: thumbBackground },
        ]}
      />
    </Scene>
  );
}

/** The same canvas with the Review notes layer hidden: its eye is struck through, its row fades,
 *  and its notes are gone from the canvas while everything else stays. */
export function LayerHiddenScene() {
  return (
    <Scene w={436} h={224}>
      <LayeredCanvas showNotes={false} />
      <LayersPanel
        x={206}
        y={14}
        rows={[
          { name: 'Review notes', count: 2, hidden: true, thumb: thumbNotes },
          { name: 'Checkout flow', count: 3, active: true, thumb: thumbFlow },
          { name: 'Background', count: 1, locked: true, thumb: thumbBackground },
        ]}
      />
    </Scene>
  );
}
