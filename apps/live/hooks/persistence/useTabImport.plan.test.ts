// @vitest-environment jsdom

// The JSON path of useTabImport with a tab export's Plan items (docs/specs/026-plan/items.md "Copies and
// exports"): the tab lands first, then its items; refused cards are reported, the tab still imported.

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TAB_SCHEMA_VERSION, type Tab } from '@livediagram/document';
import { planCardsFailure, useTabImport } from './useTabImport';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const person = { id: 'p', name: 'Sam', color: '#2563eb' };
const item = {
  id: 'item-1',
  type: 'task',
  key: 1,
  rank: 'i',
  fields: { title: 'Ship', status: 'todo' },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: person,
  updatedBy: person,
};
const fileOf = (items?: unknown[]) =>
  JSON.stringify({
    kind: 'livediagram.tab',
    schemaVersion: TAB_SCHEMA_VERSION,
    exportedAt: 0,
    tab: { id: 'src', name: 'Plan', elements: [] },
    ...(items ? { items } : {}),
  });

function setup(failed: number) {
  const tabs: Tab[] = [{ id: 'a', name: 'Here', elements: [] }];
  const order: string[] = [];
  const deps = {
    tabs,
    ownerId: 'owner-1',
    documentId: 'doc-1',
    createTab: (name: string): Tab => ({ id: crypto.randomUUID(), name, elements: [] }),
    markTabLoaded: vi.fn(),
    activeId: 'a',
    commitTabs: vi.fn(() => void order.push('tab')),
    setSelectedId: vi.fn(),
    setEditingId: vi.fn(),
    setFormatSourceId: vi.fn(),
    setImportError: vi.fn(),
    requestFit: vi.fn(),
    importScene: vi.fn(),
    importPlanItems: vi.fn(async () => {
      order.push('items');
      return { added: failed ? 0 : 1, skipped: 0, failed };
    }),
  };
  const { result } = renderHook(() => useTabImport(deps));
  return { deps, api: result.current, order };
}

describe('useTabImport, JSON with Plan items', () => {
  it('lands the tab, then its items', async () => {
    const { deps, api, order } = setup(0);
    expect(await api.importTextIntoActiveTab('json', fileOf([item]))).toEqual({ status: 'done' });
    expect(order).toEqual(['tab', 'items']);
    expect(deps.importPlanItems).toHaveBeenCalledWith({ items: [item], itemTypes: null });
  });

  it('reports the cards the store refused, the tab still imported', async () => {
    const { api, order } = setup(3);
    expect(await api.importTextIntoActiveTab('json', fileOf([item]))).toEqual({
      status: 'done',
      failures: [planCardsFailure(3)],
    });
    expect(order).toEqual(['tab', 'items']);
    expect(planCardsFailure(1).message).toMatch(/^1 card couldn't/);
  });

  it('adds no items for a file without them', async () => {
    const { deps, api } = setup(0);
    await api.importTextIntoActiveTab('json', fileOf());
    expect(deps.importPlanItems).not.toHaveBeenCalled();
  });
});
