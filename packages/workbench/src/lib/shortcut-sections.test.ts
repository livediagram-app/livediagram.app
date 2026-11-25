import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { IN_EVERY_APP_SECTION } from './shortcut-sections';

// liveworkspace/docs/specs/022-interface-design/action-parity.md "Shortcuts": one section, the same in every editor's
// Keyboard list. The editors' lists are read from disk (a package never imports an app), so a new editor with a
// Keyboard list is checked as soon as it has one.
const ROOT = join(__dirname, '../../../..');

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function listed(dir: string): string[] {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

const LISTS = readdirSync(ROOT)
  .filter((name) => name.startsWith('live'))
  .flatMap((product) => {
    const apps = join(ROOT, product, 'apps');
    return listed(apps)
      .map((app) => join(apps, app, 'components/dialogs/shortcut-sections.ts'))
      .filter(isFile)
      .map((path) => ({ path: path.slice(ROOT.length + 1), text: readFileSync(path, 'utf8') }));
  });

describe('In Every App', () => {
  it('lists Search & Commands, Undo, Redo and reaching a toast, in that order', () => {
    expect(IN_EVERY_APP_SECTION).toEqual({
      heading: 'In Every App',
      rows: [
        { keys: ['⌘', 'K'], label: 'Search & Commands  (or ⌘ .)' },
        { keys: ['⌘', 'Z'], label: 'Undo' },
        { keys: ['⌘', '⇧', 'Z'], label: 'Redo  (or Ctrl Y)' },
        { keys: ['F6'], label: 'Reach a Toast’s Undo, While One Shows' },
      ],
    });
  });

  it('cannot be changed by an editor', () => {
    expect(Object.isFrozen(IN_EVERY_APP_SECTION)).toBe(true);
    expect(Object.isFrozen(IN_EVERY_APP_SECTION.rows)).toBe(true);
    for (const row of IN_EVERY_APP_SECTION.rows) {
      expect(Object.isFrozen(row)).toBe(true);
      expect(Object.isFrozen(row.keys)).toBe(true);
    }
  });
});

describe("every editor's Keyboard list", () => {
  it('reads every editor (guard against this test going blind)', () => {
    expect(LISTS.map((list) => list.path.split('/')[0]).sort()).toEqual([
      'livedesign',
      'livediagram',
      'livedocuments',
      'livehuddle',
      'liveknowledge',
      'liveplanner',
    ]);
  });

  it.each(LISTS.map((list) => [list.path, list.text] as const))(
    '%s opens with the shared section and restates none of it',
    (_path, text) => {
      expect(text).toContain("from '@liveworkspace/workbench/lib/shortcut-sections'");
      // The array's first entry is the shared section itself, not a copy of its rows.
      expect(text).toMatch(
        /SHORTCUT_SECTIONS:\s*readonly\s+ShortcutSection\[\]\s*=\s*\[\s*IN_EVERY_APP_SECTION,/,
      );
      for (const row of IN_EVERY_APP_SECTION.rows) {
        expect(text).not.toContain(`label: '${row.label}'`);
      }
      // Nor its types: every editor's rows are the shared ShortcutRow.
      expect(text).not.toMatch(/export type Shortcut(Row|Section) =/);
    },
  );
});
