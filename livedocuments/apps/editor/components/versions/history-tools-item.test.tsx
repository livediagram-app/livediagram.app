// @vitest-environment jsdom

// The footer's History (docs/specs/006-document/version-history.md "In the editor"; blueprint VH19).

import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));

import { useItemVersions } from '@liveworkspace/workbench/components/chrome/tools-door';
import {
  offersHistory,
  openHistoryFromFooter,
  useVersionHistoryInTools,
  type HistoryGate,
} from './history-tools-item';
import { closeVersionHistory, versionHistoryState } from '@/lib/version-history-store';

afterEach(() => {
  cleanup();
  closeVersionHistory();
});

const UP: HistoryGate = {
  documentId: 'd1',
  hydrated: true,
  offline: false,
  embed: false,
  workbench: false,
  welcomeOpen: false,
  community: false,
};

describe('offersHistory', () => {
  it('offers History on a stored document that is up, for every role', () => {
    expect(offersHistory(UP)).toBe(true);
  });

  it.each([
    ['no document', { documentId: null }],
    ['still loading', { hydrated: false }],
    ['in This Browser', { offline: true }],
    ['in an embed', { embed: true }],
    ['in a workbench frame', { workbench: true }],
    ['behind a welcome', { welcomeOpen: true }],
    ['to a Community visitor', { community: true }],
  ])('offers nothing %s', (_, change) => {
    expect(offersHistory({ ...UP, ...change })).toBe(false);
  });
});

describe('useVersionHistoryInTools', () => {
  it('offers Version History to History in Tools while it has a handler, calling the newest one', () => {
    const first = vi.fn();
    const second = vi.fn();
    const offered = renderHook(() => useItemVersions());
    const { rerender, unmount } = renderHook(({ open }) => useVersionHistoryInTools(open), {
      initialProps: { open: first as (() => void) | undefined },
    });
    const open = offered.result.current!;
    rerender({ open: second });
    expect(offered.result.current).toBe(open);
    open();
    expect(second).toHaveBeenCalledOnce();
    expect(first).not.toHaveBeenCalled();
    rerender({ open: undefined });
    expect(offered.result.current).toBeNull();
    unmount();
  });
});

describe('openHistoryFromFooter', () => {
  it('opens Version History on the open tab and counts it as the footer', () => {
    openHistoryFromFooter('t7');
    expect(versionHistoryState()).toEqual({ tabId: 't7' });
    expect(track).toHaveBeenCalledWith('Version', 'Opened', 'Footer');
  });
});
