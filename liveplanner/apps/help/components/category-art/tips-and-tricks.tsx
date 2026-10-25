import { TipsAndTricksArt as Scene } from '@liveworkspace/help-site/art/scenes/tips-and-tricks';

// Tips and Tricks: the shared scene (docs/specs/018-help/help-pages.md "Category art"), with liveplanner's commands
// and the keys that add and move cards on a board and edit a sheet's cells without touching the mouse.
export function TipsAndTricksArt() {
  return (
    <Scene
      commands={[
        { name: 'Create New Tab' },
        { name: 'Share Plan' },
        { name: 'Zen mode', keys: 'Z' },
      ]}
      shortcuts={[
        { key: 'N', name: 'New card', where: 'On a board' },
        { key: '⇧→', name: 'Move card', where: 'On a board' },
        { key: 'F2', name: 'Edit a cell', where: 'In a sheet' },
      ]}
    />
  );
}
