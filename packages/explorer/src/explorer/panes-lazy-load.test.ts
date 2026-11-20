// The Explorer's sections most visits never open load from their own chunks (liveworkspace/docs/specs/004-index/
// one-explorer.md "Cost and performance"): Inbox, Invites, Gallery and Shape Libraries were static imports of
// Explorer.tsx, in every /explorer page's first load. A static import of any of them again, or of an item's History
// from a module the Explorer loads up front, passes every other test; this one fails.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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
    const src = read('Dialogs.tsx');
    expect(staticImports(src)).not.toContain('../library/HistoryDialog');
    expect(src).toContain("import('../library/HistoryDialog')");
  });

  // The team card loads with the team view (liveworkspace/docs/specs/010-site/blueprints/site.md "Performance and
  // limits"): no module the Explorer loads up front imports it statically.
  it('the team card is not a static import of the team view or the Home tiles', () => {
    for (const file of ['TeamPane.tsx', 'HomeSpaces.tsx', 'InvitesPane.tsx'])
      expect(staticImports(read(file)), file).not.toContain('../teams/TeamCard');
    expect(read('TeamPane.tsx')).toContain("import('../teams/TeamCard')");
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
