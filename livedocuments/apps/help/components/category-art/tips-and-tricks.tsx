import { TipsAndTricksArt as Scene } from '@liveworkspace/help-site/art/scenes/tips-and-tricks';

// Tips and Tricks: the shared scene (docs/specs/018-help/help-pages.md "Category art"), with livedocuments's commands
// (the Command Palette article: the Slide Deck tool, Fit to Screen, zen mode) and the keys that put writing and a
// picture on a page without opening the palette (Keyboard Shortcuts).
export function TipsAndTricksArt() {
  return (
    <Scene
      commands={[
        { name: 'Slide Deck' },
        { name: 'Fit to Screen', keys: '⇧ 1' },
        { name: 'Enter zen mode', keys: 'Z' },
      ]}
      shortcuts={[
        { key: 'T', name: 'Text' },
        { key: 'N', name: 'Sticky note' },
        { key: '9', name: 'Image' },
      ]}
    />
  );
}
