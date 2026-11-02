import { TipsAndTricksArt as Scene } from '@liveworkspace/help-site/art/scenes/tips-and-tricks';

// Tips and Tricks: the shared scene (docs/specs/018-help/help-pages.md "Category art"), with livehuddle's commands
// and the single-key shortcuts that drop a shape without touching the palette.
export function TipsAndTricksArt() {
  return (
    <Scene
      commands={[
        { name: 'Zoom to fit', keys: '⇧ 1' },
        { name: 'Next editor mode', keys: '⇧ D' },
        { name: 'Zen mode', keys: 'Z' },
      ]}
      shortcuts={[
        { key: 'R', name: 'Square' },
        { key: 'T', name: 'Text' },
        { key: 'N', name: 'Sticky note' },
      ]}
    />
  );
}
