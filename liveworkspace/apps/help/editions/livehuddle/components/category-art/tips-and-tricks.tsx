import { TipsAndTricksArt as Scene } from '@liveworkspace/help-site/art/scenes/tips-and-tricks';

// Tips and Tricks: the shared scene (liveworkspace/docs/specs/017-help/help-centre.md "Category art"), with livehuddle's commands
// and the single-key shortcuts that switch between Edit and Walk or drop a note without touching the palette.
export function TipsAndTricksArt() {
  return (
    <Scene
      commands={[
        { name: 'Zoom to fit', keys: '⇧ 1' },
        { name: 'Next editor mode', keys: '⇧ D' },
        { name: 'Search & commands', keys: '⌘ K' },
      ]}
      shortcuts={[
        { key: 'E', name: 'Edit' },
        { key: 'W', name: 'Walk' },
        { key: 'N', name: 'Sticky note' },
      ]}
    />
  );
}
