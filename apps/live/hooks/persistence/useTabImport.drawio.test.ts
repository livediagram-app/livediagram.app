// @vitest-environment jsdom

// The draw.io path of useTabImport (docs/specs/020-import-export/drawio-import.md
// "Pages become tabs"): one commit for the whole import, new tabs marked
// loaded, telemetry once, and the report handed back to the dialog.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livediagram/document';
import { track } from '@/lib/telemetry';
import { useTabImport } from './useTabImport';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
// The pipeline's browser seam (canvas codec + gallery upload): stored as if uploaded.
const store = vi.fn(async () => ({
  ok: true as const,
  imageId: 'img-1',
  width: 1,
  height: 1,
  kind: 'uploaded' as const,
}));
vi.mock('@/lib/import-images/browser', () => ({
  createBrowserImportImageSession: vi.fn(() => ({ store })),
}));

const fixture = (name: string) =>
  readFileSync(join(__dirname, '../../lib/drawio/__fixtures__', name), 'utf8');

function setup(tabs: Tab[]) {
  let current = tabs;
  const deps = {
    tabs,
    ownerId: 'owner-1',
    documentId: null,
    createTab: (name: string): Tab => ({ id: crypto.randomUUID(), name, elements: [] }),
    markTabLoaded: vi.fn(),
    activeId: tabs[0]!.id,
    commitTabs: vi.fn((map: (ts: Tab[]) => Tab[]) => {
      current = map(current);
    }),
    setSelectedId: vi.fn(),
    setEditingId: vi.fn(),
    setFormatSourceId: vi.fn(),
    setImportError: vi.fn(),
    requestFit: vi.fn(),
    importScene: vi.fn(),
    importPlanItems: vi.fn(),
  };
  const { result } = renderHook(() => useTabImport(deps));
  return { deps, api: result.current, tabs: () => current };
}

describe('useTabImport, draw.io', () => {
  it('imports every page in one commit and reports what changed', async () => {
    const { deps, api, tabs } = setup([{ id: 'a', name: 'Board', elements: [] }]);
    const outcome = await api.importTextIntoActiveTab('drawio', fixture('multi-page.drawio'));
    expect(deps.commitTabs).toHaveBeenCalledOnce();
    expect(tabs().map((t) => t.name)).toEqual(['Overview', 'Detail', 'Scratch']);
    expect(tabs()[0]!.id).toBe('a');
    expect(deps.markTabLoaded.mock.calls.map(([id]) => id)).toEqual([tabs()[1]!.id, tabs()[2]!.id]);
    expect(deps.requestFit).toHaveBeenCalledOnce();
    expect(track).toHaveBeenCalledWith('Tab', 'Imported', 'Drawio');
    // The shared report: every element of the three pages counted by kind, with what changed.
    expect(outcome.status).toBe('done');
    const scene = outcome.status === 'done' ? outcome.scene : undefined;
    expect(Object.values(scene?.landed ?? {}).reduce((a, n) => a + (n ?? 0), 0)).toBe(17);
    // The page link on the first page points at the tab the second page became.
    const entry = tabs()[0]!.elements.find(
      (e) => 'label' in e && e.label === "Platform team's board",
    );
    expect(entry).toMatchObject({ link: { kind: 'tab', tabId: tabs()[1]!.id } });
  });

  it('refuses without touching the tabs', async () => {
    const { deps, api } = setup([{ id: 'a', name: 'Board', elements: [] }]);
    const outcome = await api.importTextIntoActiveTab('drawio', '{"type":"excalidraw"}');
    expect(outcome).toMatchObject({ status: 'error' });
    expect(deps.commitTabs).not.toHaveBeenCalled();
  });

  it('refuses a locked tab', async () => {
    const { api } = setup([{ id: 'a', name: 'Board', elements: [], locked: true }]);
    expect(await api.importTextIntoActiveTab('drawio', fixture('flowchart.drawio'))).toEqual({
      status: 'error',
      error: 'This tab is locked. Unlock it before importing.',
    });
  });

  it('stores embedded images through the import image pipeline before the tab changes', async () => {
    const { deps, api, tabs } = setup([{ id: 'a', name: 'Board', elements: [] }]);
    const progress = vi.fn();
    const outcome = await api.importTextIntoActiveTab(
      'drawio',
      fixture('cloud-architecture.drawio'),
      progress,
    );
    expect(store).toHaveBeenCalledOnce();
    expect(deps.commitTabs).toHaveBeenCalledOnce();
    const logo = tabs()[0]!.elements.find((e) => e.type === 'image' && e.alt === 'Team logo');
    expect(logo).toMatchObject({ imageId: 'img-1', naturalWidth: 1, naturalHeight: 1 });
    expect(progress).toHaveBeenLastCalledWith({ done: 1, total: 1 });
    expect(outcome).toMatchObject({
      status: 'done',
      images: { imported: 1, deduped: 0, placeholders: {} },
    });
  });
});
