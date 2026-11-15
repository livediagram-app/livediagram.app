// @vitest-environment jsdom

// The header's History (docs/specs/006-document/version-history.md "In the editor"; blueprint VH19).

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));

import { HistoryHeaderButton, offersHistory, type HistoryGate } from './HistoryHeaderButton';
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

describe('HistoryHeaderButton', () => {
  it('opens Version History on the open tab and counts it', () => {
    render(<HistoryHeaderButton activeTabId="t7" />);
    fireEvent.click(screen.getByRole('button', { name: 'History' }));
    expect(versionHistoryState()).toEqual({ tabId: 't7' });
    expect(track).toHaveBeenCalledWith('Version', 'Opened', 'Header');
  });
});
