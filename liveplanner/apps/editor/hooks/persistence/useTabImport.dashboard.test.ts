// @vitest-environment jsdom

// A Dashboard tab's Import (docs/specs/026-plan/plan-tabs.md "Import and Export of a Dashboard"): only a Dashboard
// tab's own JSON replaces it, its slots following the elements' new ids; anything else is refused and the tab is
// left as it was.

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TAB_SCHEMA_VERSION, type Element, type Tab } from '@liveplanner/project';
import { mergeImportedTab } from '@/lib/import-merge';
import { NOT_A_DASHBOARD, remintTabElements, useTabImport } from './useTabImport';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const view = {
  id: 'view-1',
  type: 'shape',
  shape: 'plan-view',
  x: 0,
  y: 0,
  width: 720,
  height: 400,
  planView: { view: 'priority-matrix' },
} as unknown as Element;

const layoutOf = (elementId: string) => ({
  rows: [
    {
      id: 'r1',
      height: 320,
      slots: [
        { id: 's1', span: 6, content: { type: 'element' as const, elementId } },
        { id: 's2', span: 6, content: { type: 'note' as const, title: 'Hello', text: '' } },
      ],
    },
  ],
});

const fileOf = (tab: Partial<Tab>) =>
  JSON.stringify({
    kind: 'liveplanner.tab',
    schemaVersion: TAB_SCHEMA_VERSION,
    exportedAt: 0,
    tab: { id: 'src', name: 'Overview', elements: [], ...tab },
  });

function setup(receiving: Tab) {
  let tabs: Tab[] = [receiving];
  const deps = {
    tabs,
    activeId: receiving.id,
    commitTabs: vi.fn((f: (ts: Tab[]) => Tab[]) => void (tabs = f(tabs))),
    setSelectedId: vi.fn(),
    setEditingId: vi.fn(),
    setFormatSourceId: vi.fn(),
    setImportError: vi.fn(),
    requestFit: vi.fn(),
    importPlanItems: vi.fn(async () => ({ added: 0, skipped: 0, failed: 0 })),
  };
  const { result } = renderHook(() => useTabImport(deps));
  return { api: result.current, deps, landed: () => tabs[0]! };
}

const dashboard: Tab = {
  id: 'dash',
  name: 'Overview',
  kind: 'dashboard',
  elements: [],
  dashboard: { rows: [{ id: 'old', height: 320, slots: [{ id: 'x', span: 12 }] }] },
};

describe('importing into a Dashboard tab', () => {
  it('lands a Dashboard’s JSON with its rows, the slots following the new element ids', async () => {
    const { api, landed } = setup(dashboard);
    const file = fileOf({ kind: 'dashboard', elements: [view], dashboard: layoutOf('view-1') });
    expect(await api.importTextIntoActiveTab(file)).toEqual({ status: 'done' });
    const tab = landed();
    expect(tab.id).toBe('dash');
    expect(tab.kind).toBe('dashboard');
    const newId = tab.elements[0]!.id;
    expect(newId).not.toBe('view-1');
    expect(tab.dashboard!.rows[0]!.slots[0]!.content).toEqual({
      type: 'element',
      elementId: newId,
    });
    expect(tab.dashboard!.rows[0]!.slots[1]!.content).toMatchObject({ type: 'note' });
  });

  it('refuses a tab that is not a Dashboard, leaving the dashboard as it was', async () => {
    const { api, deps, landed } = setup(dashboard);
    expect(await api.importTextIntoActiveTab(fileOf({ elements: [] }))).toEqual({
      status: 'error',
      error: NOT_A_DASHBOARD,
    });
    expect(deps.commitTabs).not.toHaveBeenCalled();
    expect(landed()).toBe(dashboard);
  });

  it('refuses text that is not JSON', async () => {
    const { api, deps } = setup(dashboard);
    expect(await api.importTextIntoActiveTab('flowchart TD\n A-->B')).toEqual({
      status: 'error',
      error: "File isn't valid JSON.",
    });
    expect(deps.commitTabs).not.toHaveBeenCalled();
  });
});

describe('remintTabElements', () => {
  it('re-mints the elements and leaves a tab without a layout without one', () => {
    const out = remintTabElements({ elements: [view] });
    expect(out.elements[0]!.id).not.toBe('view-1');
    expect('dashboard' in out).toBe(false);
  });

  it('reads a forged layout safely before following the ids', () => {
    const out = remintTabElements({
      elements: [view],
      dashboard: { rows: [{ id: 'r', height: 99999, slots: [{ id: 's', span: 12 }] }] },
    });
    expect(out.dashboard.rows[0]!.height).toBe(1200);
  });
});

describe('mergeImportedTab and a Dashboard', () => {
  it('takes the imported layout only from a Dashboard', () => {
    const plain = mergeImportedTab(dashboard, { id: 'x', name: 'x', elements: [] });
    expect(plain.dashboard).toBe(dashboard.dashboard);
    const layout = layoutOf('v');
    const merged = mergeImportedTab(dashboard, {
      id: 'x',
      name: 'x',
      kind: 'dashboard',
      elements: [],
      dashboard: layout,
    });
    expect(merged.dashboard).toEqual(layout);
  });
});
