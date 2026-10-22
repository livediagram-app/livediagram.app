// @vitest-environment jsdom
// docs/specs/026-plan/plan-tabs.md "Figures from a Sheet": a sheet whose fetch failed says so, with a Retry, rather
// than loading for ever; so does one no arrived tab places once the rest have failed.
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Tab } from '@liveplanner/project';
import { tabsStateOf } from './dashboard-context';
import { useSheetRead } from './useSheetReader';

const store = vi.hoisted(() => ({
  status: vi.fn<(tabId: string) => string | undefined>(),
  loadTab: vi.fn(async () => {}),
  sheet: () => undefined,
  subscribe: () => () => {},
  getVersion: () => 0,
}));
vi.mock('@/hooks/sheets/useSheetsBridge', () => {
  const bridge = { locale: 'en-GB' };
  return { useSheetsBridgeContext: () => bridge };
});
vi.mock('@/components/sheets/sheet-store-client', () => ({ sheetStoreOf: () => store }));

const placing = {
  id: 't1',
  name: 'Budget',
  elements: [{ id: 'e', type: 'shape', shape: 'plan-sheet', planSheet: { sheetId: 'sh1' } }],
} as unknown as Tab;

describe('a sheet read for a Dashboard', () => {
  it('fails, with a Retry that fetches its tab again, when its tab’s sheets did not load', () => {
    store.status.mockReturnValue('error');
    const { result } = renderHook(() => useSheetRead('sh1', [placing], 'loaded'));
    expect(result.current).toMatchObject({ state: 'failed', name: 'Budget' });
    if (result.current.state === 'failed') result.current.retry();
    expect(store.loadTab).toHaveBeenCalledWith('t1', true);
  });

  it('fails when no arrived tab places it and the others failed, and loads while they are on their way', () => {
    store.status.mockReturnValue(undefined);
    const retryTabs = vi.fn();
    const failed = renderHook(() => useSheetRead('other', [placing], 'failed', retryTabs));
    expect(failed.result.current.state).toBe('failed');
    if (failed.result.current.state === 'failed') failed.result.current.retry();
    expect(retryTabs).toHaveBeenCalled();
    expect(renderHook(() => useSheetRead('other', [placing], 'loading')).result.current.state).toBe(
      'loading',
    );
    expect(renderHook(() => useSheetRead('other', [placing], 'loaded')).result.current.state).toBe(
      'gone',
    );
  });
});

describe('tabsStateOf', () => {
  it('is loading while any tab is, then failed if any failed, else loaded', () => {
    const tabs = [{ id: 'a' }, { id: 'b' }];
    expect(tabsStateOf(tabs, (id) => (id === 'a' ? 'failed' : 'loading'))).toBe('loading');
    expect(tabsStateOf(tabs, (id) => (id === 'a' ? 'failed' : 'loaded'))).toBe('failed');
    expect(tabsStateOf(tabs, () => 'loaded')).toBe('loaded');
  });
});
