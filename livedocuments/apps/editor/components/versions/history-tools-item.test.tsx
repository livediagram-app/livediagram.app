// @vitest-environment jsdom

// The footer's History (docs/specs/006-document/version-history.md "In the editor"; blueprint VH19).

import { cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));

import {
  historyToolsItem,
  offersHistory,
  openHistoryFromFooter,
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

describe('historyToolsItem', () => {
  it('is the Tools menu’s Version History row, in Versioning, opening it when picked', () => {
    const onOpen = vi.fn();
    const item = historyToolsItem(onOpen);
    expect(item).toMatchObject({ id: 'history', group: 'versions', label: 'Version History' });
    item.onSelect(null);
    expect(onOpen).toHaveBeenCalledOnce();
  });
});

describe('openHistoryFromFooter', () => {
  it('opens Version History on the open tab and counts it as the footer', () => {
    openHistoryFromFooter('t7');
    expect(versionHistoryState()).toEqual({ tabId: 't7' });
    expect(track).toHaveBeenCalledWith('Version', 'Opened', 'Footer');
  });
});
