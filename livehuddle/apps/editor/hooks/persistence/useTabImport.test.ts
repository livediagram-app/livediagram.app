// @vitest-environment jsdom

// Import to Tab's two formats (docs/specs/020-import-export/README.md): a livehuddle tab's JSON replaces the active
// tab in one step, and an Excalidraw scene goes through the shared board-scene commit. The draw.io, Mermaid and
// Markdown imports are gone from livehuddle (Work Tracker #423, part 4).

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createShape, TAB_SCHEMA_VERSION, type Tab } from '@livehuddle/document';
import { excalidrawBuilder, excalidrawText } from '@/lib/excalidraw-fixtures';
import { useTabImport } from './useTabImport';

const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));

function setup(opts: { locked?: boolean } = {}) {
  let tabs: Tab[] = [{ id: 't1', name: 'Board', elements: [], locked: opts.locked }];
  const deps = {
    tabs,
    activeId: 't1',
    commitTabs: vi.fn((f: (ts: Tab[]) => Tab[]) => void (tabs = f(tabs))),
    setSelectedId: vi.fn(),
    setEditingId: vi.fn(),
    setFormatSourceId: vi.fn(),
    setImportError: vi.fn(),
    requestFit: vi.fn(),
    importScene: vi.fn(async () => ({ status: 'done' as const })),
  };
  const { result } = renderHook(() => useTabImport(deps));
  return { api: result.current, deps, landed: () => tabs[0]! };
}

function tabJson(elements: unknown[]): string {
  return JSON.stringify({
    kind: 'livehuddle.tab',
    schemaVersion: TAB_SCHEMA_VERSION,
    tab: { id: 'other', name: 'Exported', elements },
  });
}

describe('importing into a tab', () => {
  it('replaces the active tab with a JSON export in one step, with fresh ids, and frames it', async () => {
    const { api, deps, landed } = setup();
    const note = { ...createShape('square', 10, 20), id: 'n1', label: 'Agenda' };
    expect(await api.importTextIntoActiveTab('json', tabJson([note]))).toEqual({ status: 'done' });
    expect(deps.commitTabs).toHaveBeenCalledTimes(1);
    const tab = landed();
    expect(tab.id).toBe('t1');
    expect(tab.elements).toHaveLength(1);
    expect(tab.elements[0]).toMatchObject({ label: 'Agenda' });
    expect(tab.elements[0]!.id).not.toBe('n1');
    expect(deps.requestFit).toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith('Tab', 'Imported', 'JSON');
  });

  it('refuses text that is not a tab export, leaving the tab as it was', async () => {
    const { api, deps } = setup();
    expect(await api.importTextIntoActiveTab('json', 'not json')).toEqual({
      status: 'error',
      error: "File isn't valid JSON.",
    });
    expect(deps.commitTabs).not.toHaveBeenCalled();
  });

  it('lands an Excalidraw scene through the board-scene commit', async () => {
    const { api, deps } = setup();
    const b = excalidrawBuilder();
    const box = b.rectangle({ x: 0, y: 0, width: 160, height: 70 });
    const text = excalidrawText([box, b.label(box, 'Retro')], { type: 'excalidraw' });
    expect(await api.importTextIntoActiveTab('excalidraw', text)).toEqual({ status: 'done' });
    expect(deps.importScene).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith('Tab', 'Imported', 'Excalidraw');
  });

  it('reports an unreadable Excalidraw scene without committing', async () => {
    const { api, deps } = setup();
    const out = await api.importTextIntoActiveTab('excalidraw', '{"type":"nope"}');
    expect(out.status).toBe('error');
    expect(deps.importScene).not.toHaveBeenCalled();
  });

  it('refuses a locked tab, by paste or by file', async () => {
    const { api, deps } = setup({ locked: true });
    const locked = { status: 'error', error: 'This tab is locked. Unlock it before importing.' };
    expect(await api.importTextIntoActiveTab('json', tabJson([]))).toEqual(locked);
    expect(await api.importIntoActiveTab('excalidraw')).toEqual(locked);
    expect(deps.commitTabs).not.toHaveBeenCalled();
  });
});
