import { TipsAndTricksArt as Scene } from '@liveworkspace/help-site/art/scenes/tips-and-tricks';

// Tips and Tricks: the shared scene (docs/specs/018-help/help-pages.md "Category art"), with livedesign's commands
// (the Command Palette article: the Format Painter, Fit to Screen, zen mode) and the drawing keys (Keyboard
// Shortcuts: P the Freehand pencil, F a Frame, 6 the Shape Pen).
export function TipsAndTricksArt() {
  return (
    <Scene
      commands={[
        { name: 'Format Painter' },
        { name: 'Fit to Screen', keys: '⇧ 1' },
        { name: 'Enter zen mode', keys: 'Z' },
      ]}
      shortcuts={[
        { key: 'P', name: 'Freehand' },
        { key: 'F', name: 'Frame' },
        { key: '6', name: 'Shape Pen' },
      ]}
    />
  );
}
