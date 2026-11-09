// The Explorer's dialogs load when first opened (liveworkspace/docs/specs/004-index/one-explorer.md "Cost and
// performance"). Share, Change Folder and the two defaults dialogs were static imports of Dialogs.tsx, about 28 KiB
// gzipped of /explorer's first load; a static import of any of them again passes every other test, and this one fails.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

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
  '../library/WebhooksDialog',
];

describe('the Explorer’s first load', () => {
  it.each(['Dialogs.tsx', 'lazy-dialogs.ts', 'menus.tsx'])(
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
});
