// The Explorer's dialogs load when first opened (liveworkspace/docs/specs/004-index/one-explorer.md "Cost and
// performance"). Share, Change Folder and the two defaults dialogs were static imports of Dialogs.tsx, about 28 KiB
// gzipped of /explorer's first load; a static import of any of them again passes every other test, and this one fails.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { preloadExplorerDialogs } from './lazy-dialogs';

const read = (path: string) => readFileSync(join(__dirname, path), 'utf8');
// A re-export (`export { x } from '…'`) loads its module as surely as an import does.
const staticImports = (src: string) =>
  [...src.matchAll(/^(?:import|export)\s+(?!type\b)[^;]*?from\s+'([^']+)'/gms)].map((m) => m[1]!);

const LAZY = [
  '../dialogs/ShareDialog',
  '../dialogs/ShareDialogWithCommunity',
  '../dialogs/MoveToFolderDialog',
  '../defaults/DefaultFolders',
  '../defaults/UseAsDefaultDialog',
  '../library/HistoryDialog',
];

describe('the Explorer’s first load', () => {
  it.each(['Dialogs.tsx', 'OpenDialog.tsx', 'lazy-dialogs.ts', 'menus.tsx'])(
    '%s imports no dialog statically',
    (file) => {
      const imports = staticImports(read(file));
      for (const module of LAZY) expect(imports, module).not.toContain(module);
    },
  );

  it('loads each of the menus’ dialogs from its own chunk', () => {
    const src = read('lazy-dialogs.ts');
    for (const module of LAZY.slice(2).filter((m) => !m.startsWith('../library/')))
      expect(src).toContain(`import('${module}')`);
    expect(src).toContain("import('../dialogs/ShareDialog')");
  });

  // The open dialog's switch, the confirmations, Change Folder's spaces and This Browser's dialogs, and New Team's form,
  // were static imports of the Explorer, about 10 KiB gzipped of /explorer's first load (liveworkspace/docs/specs/
  // 010-site/blueprints/site.md "Performance and limits").
  it('draws the open dialog from its own chunk, the shell importing none of it', () => {
    const shell = staticImports(read('Dialogs.tsx'));
    expect(shell.sort()).toEqual(['./context', './lazy-dialogs', './when-idle', 'react'].sort());
    expect(read('lazy-dialogs.ts')).toContain("import('./OpenDialog')");
    for (const file of ['Explorer.tsx', '../panel/ExplorerPanel.tsx'])
      expect(staticImports(read(file)), file).not.toContain('./OpenDialog');
  });

  it('loads New Team’s dialog when it opens, from every opener', () => {
    for (const file of ['Sidebar.tsx', 'HomeSpaces.tsx', 'InvitesPane.tsx', '../panel/Rail.tsx'])
      expect(staticImports(read(file)), file).not.toContain('../teams/NewTeamDialog');
    expect(read('lazy-dialogs.ts')).toContain("import('../teams/NewTeamDialog')");
  });

  it('Trash and Shared With Me ask their confirmation from its own chunk', () => {
    for (const file of ['TrashPane.tsx', 'SharedList.tsx']) {
      const imports = staticImports(read(file));
      expect(imports, file).toContain('./lazy-dialogs');
      expect(read(file), file).not.toMatch(
        /import \{[^}]*\bConfirmDialog\b[^}]*\} from '@liveworkspace\/ui'/,
      );
    }
    expect(read('lazy-dialogs.ts')).toContain("import('@liveworkspace/ui/confirm-dialog')");
  });

  it('nothing the first load keeps imports the placement browser for its constants', () => {
    // Dialogs.tsx once took ARCHIVED_PLACEMENT from PlacementBrowser.tsx, carrying the whole browser up front.
    for (const file of ['Dialogs.tsx', 'lazy-dialogs.ts', 'menus.tsx', 'Explorer.tsx'])
      expect(staticImports(read(file)), file).not.toContain('../dialogs/PlacementBrowser');
  });
});

describe('preloadExplorerDialogs', () => {
  it('fetches the open dialog’s code and New Team’s, and never rejects', async () => {
    await expect(preloadExplorerDialogs()).resolves.toBeUndefined();
  });
});
