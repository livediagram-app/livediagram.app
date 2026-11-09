// The Explorer's sections most visits never open load from their own chunks (liveworkspace/docs/specs/004-index/
// one-explorer.md "Cost and performance"): Inbox, Timeline, Invites, Gallery and Shape Libraries were static
// imports of Explorer.tsx, in every /explorer page's first load. A static import of any of them again, or of the
// Timeline view from a module the Explorer loads up front, passes every other test; this one fails.
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
    for (const module of [
      './InboxPane',
      './TimelinePane',
      './InvitesPane',
      '../library/LibraryViews',
    ])
      expect(imports, module).not.toContain(module);
  });

  it('each load from their own chunk', () => {
    const src = read('lazy-panes.ts');
    for (const module of [
      './InboxPane',
      './TimelinePane',
      './InvitesPane',
      '../library/LibraryViews',
    ])
      expect(src).toContain(`import('${module}')`);
  });

  // A Team's page and an item's history say what an event means without the whole Timeline view.
  it.each([
    'TeamActivity.tsx',
    '../library/HistoryDialog.tsx',
    '../panel/PanelLibraryTimeline.tsx',
  ])('%s reads the events’ words from their own module', (file) => {
    const imports = staticImports(read(file));
    expect(imports.some((m) => m.endsWith('/TimelinePane') || m === './TimelinePane')).toBe(false);
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
