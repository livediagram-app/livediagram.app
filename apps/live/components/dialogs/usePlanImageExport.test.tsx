// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livediagram/document';
import { usePlanImageExport } from './usePlanImageExport';

// docs/specs/026-plan/plan-tabs.md "Export": the image waits for the Sheets it draws, and a read that fails still
// lets the export go ahead, the Sheets drawn as frames.

const read = vi.hoisted(() => ({ models: vi.fn() }));
vi.mock('@/components/plan/PlanContext', () => ({ usePlan: () => null }));
vi.mock('@/hooks/sheets/useSheetsBridge', () => {
  const bridge = { locale: 'en' };
  return { useSheetsBridgeContext: () => bridge };
});
vi.mock('@/lib/export-tab', () => ({ renderTabToSvg: () => '<svg/>' }));
vi.mock('@/components/sheets/sheet-store-client', () => ({
  sheetStoreOf: () => ({ loadTab: async () => {} }),
}));
vi.mock('@/lib/export-plan/plan-export-sheets', () => ({
  sheetTabsToLoad: () => ['t'],
  sheetModelsFor: read.models,
  sheetMetricsFor: () => new Map(),
}));

const sheet = {
  id: 's',
  type: 'shape',
  shape: 'plan-sheet',
  x: 0,
  y: 0,
  width: 400,
  height: 300,
  planSheet: { sheetId: 'a1b2c3d4e5f60718' },
};
const tab = { id: 't', name: 'Budget', kind: 'sheet', elements: [sheet] } as unknown as Tab;

describe('usePlanImageExport', () => {
  it('is ready once the Sheets are read', async () => {
    read.models.mockReturnValue(new Map());
    const { result } = renderHook(() => usePlanImageExport(tab, [tab]));
    await waitFor(() => expect(result.current.ready).toBe(true));
  });

  it('settles when reading the Sheets fails, never holding the export', async () => {
    read.models.mockImplementation(() => {
      throw new Error('engine');
    });
    const { result } = renderHook(() => usePlanImageExport(tab, [tab]));
    expect(result.current.ready).toBe(false);
    await waitFor(() => expect(result.current.ready).toBe(true));
  });

  it('reads a malformed stored Dashboard as one with nothing on it, never throwing', () => {
    for (const dashboard of [{ rows: [{ fill: true }] }, {}]) {
      const bad = { id: 'd', name: 'Overview', kind: 'dashboard', elements: [], dashboard };
      const t = bad as unknown as Tab;
      expect(() => renderHook(() => usePlanImageExport(t, [t]))).not.toThrow();
    }
  });
});
