// The Explorer's sections most visits never open load from their own chunks (liveworkspace/docs/specs/004-index/
// one-explorer.md "Cost and performance"): Inbox, Invites, Gallery and Shape Libraries were static imports of
// Explorer.tsx, in every /explorer page's first load. A static import of any of them again, or of an item's History
// from a module the Explorer loads up front, passes every other test; this one fails.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { preloadExplorerPanesWhenIdle } from './lazy-panes';

const read = (path: string) => readFileSync(join(__dirname, path), 'utf8');
const staticImports = (src: string) =>
  [...src.matchAll(/^(?:import|export)\s+(?!type\b)[^;]*?from\s+'([^']+)'/gms)].map((m) => m[1]!);

describe('the Explorer’s sections', () => {
  it('are not static imports of the Explorer', () => {
    const imports = staticImports(read('Explorer.tsx'));
    for (const module of ['./InboxPane', './InvitesPane', '../library/LibraryViews'])
      expect(imports, module).not.toContain(module);
  });

  it('each load from their own chunk', () => {
    const src = read('lazy-panes.ts');
    for (const module of ['./InboxPane', './InvitesPane', '../library/LibraryViews'])
      expect(src).toContain(`import('${module}')`);
  });

  // History loads when it is first opened (livediagram/docs/specs/013-workspace/history.md "Speed").
  it('History is not a static import of the dialogs', () => {
    const src = read('OpenDialog.tsx');
    expect(staticImports(src)).not.toContain('../library/HistoryDialog');
    expect(src).toContain("import('../library/HistoryDialog')");
  });

  // The team card loads with the team view (liveworkspace/docs/specs/010-site/blueprints/site.md "Performance and
  // limits"): no module the Explorer loads up front imports it statically.
  it('the team page and card are not static imports of the team view or the Home tiles', () => {
    for (const file of ['TeamPane.tsx', 'HomeSpaces.tsx', 'InvitesPane.tsx']) {
      expect(staticImports(read(file)), file).not.toContain('../teams/TeamCard');
      expect(staticImports(read(file)), file).not.toContain('../teams/page/TeamView');
    }
    expect(read('TeamPane.tsx')).toContain("import('../teams/page/TeamView')");
  });
});

// Offline's view, the Details layout and the lens's chips left the first load (liveworkspace/docs/specs/010-site/
// blueprints/site.md "Performance and limits"): /explorer had reached its budget on main.
describe('Offline, Details and the lens’s chips', () => {
  const src = join(__dirname, '..');
  const sources = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return entry.name === 'test' ? [] : sources(path);
      return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
    });
  // Every static import in the package's code, as the path it resolves to from src/.
  const importsOf = (target: string) =>
    sources(src).filter((file) =>
      staticImports(readFileSync(file, 'utf8')).some(
        (spec) => spec.startsWith('.') && relative(src, join(file, '..', spec)) === target,
      ),
    );

  it('no module imports them statically', () => {
    expect(importsOf('explorer/Lens')).toEqual([]);
    expect(importsOf('explorer/DetailsView')).toEqual([]);
    expect(importsOf('explorer/ThisBrowserPane')).toEqual([]);
    // The Trash's view and Archived's band (Work Tracker 1492) pushed /explorer over its budget as static imports.
    expect(importsOf('explorer/TrashPane')).toEqual([]);
    expect(importsOf('explorer/ShelfIntro')).toEqual([join(src, 'explorer/TrashPane.tsx')]);
  });

  it('each loads from its own chunk', () => {
    expect(read('lazy-lens.tsx')).toContain("import('./Lens')");
    expect(read('lazy-panes.ts')).toContain("import('./DetailsView')");
    expect(read('lazy-panes.ts')).toContain("import('./ThisBrowserPane')");
    expect(read('lazy-panes.ts')).toContain("import('./TrashPane')");
    expect(read('lazy-panes.ts')).toContain("import('./ShelfIntro')");
  });

  it('the guard sees a static import', () => {
    // It would pass on an empty tree: ItemsPane's own static import of the lazy lens is found.
    expect(importsOf('explorer/lazy-lens')).toContain(join(src, 'explorer/ItemsPane.tsx'));
  });
});

describe('preloadExplorerPanesWhenIdle', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('waits for an idle moment, and an unmount before it cancels', () => {
    const request = vi.fn(() => 7);
    const cancel = vi.fn();
    vi.stubGlobal('requestIdleCallback', request);
    vi.stubGlobal('cancelIdleCallback', cancel);
    const stop = preloadExplorerPanesWhenIdle();
    expect(request).toHaveBeenCalledOnce();
    stop();
    expect(cancel).toHaveBeenCalledWith(7);
  });

  it('falls back to a timer where the browser has no idle callback', () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestIdleCallback', undefined);
    const stop = preloadExplorerPanesWhenIdle();
    expect(vi.getTimerCount()).toBe(1);
    stop();
    expect(vi.getTimerCount()).toBe(0);
  });
});
