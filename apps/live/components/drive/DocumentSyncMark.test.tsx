// @vitest-environment jsdom

// A document's sync mark on its Explorer row
// (docs/specs/022-drive-mirror/drive-mirror.md, "The Explorer shows each document's sync").

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { DriveMirrorStatus } from '@/lib/drive/engine';
import {
  DRIVE_MIRROR_OFF,
  DRIVE_STATUS_INITIAL,
  DriveMirrorContext,
  documentSyncState,
} from './drive-mirror-context';
import { DocumentSyncMark } from './DocumentSyncMark';

afterEach(cleanup);

const status = (over: Partial<DriveMirrorStatus> = {}): DriveMirrorStatus => ({
  ...DRIVE_STATUS_INITIAL,
  state: 'idle',
  lastSyncedAt: 1,
  mirrored: { mine: 100 },
  ...over,
});
const NOTICE = { kind: 'document' as const, ldId: 'mine', name: 'Plan', parentId: 'p' };

describe('documentSyncState', () => {
  it('is synced once the last save is in Drive', () => {
    expect(documentSyncState(status(), 'mine', 100)).toBe('synced');
    expect(documentSyncState(status(), 'mine', 90)).toBe('synced');
  });

  it('is waiting while a newer save is not in Drive yet, syncing during a pass', () => {
    expect(documentSyncState(status(), 'mine', 101)).toBe('waiting');
    expect(documentSyncState(status({ mirrored: { mine: null } }), 'mine', 1)).toBe('waiting');
    expect(documentSyncState(status({ state: 'syncing' }), 'mine', 101)).toBe('syncing');
    expect(documentSyncState(status({ state: 'syncing' }), 'mine', 100)).toBe('synced');
  });

  it('says nothing for a document that is not mirrored, or when Drive is not connected', () => {
    expect(documentSyncState(status(), 'team-doc', 1)).toBeNull();
    expect(documentSyncState(status({ state: 'disconnected' }), 'mine', 100)).toBeNull();
    expect(documentSyncState(status({ state: 'needs_reconnect' }), 'mine', 100)).toBeNull();
  });

  it('leaves a document with a folder notice to that notice', () => {
    expect(documentSyncState(status({ notices: [NOTICE] }), 'mine', 100)).toBeNull();
  });
});

function show(s: DriveMirrorStatus, savedAt: number) {
  render(
    <DriveMirrorContext.Provider value={{ ...DRIVE_MIRROR_OFF, mode: 'broker', status: s }}>
      <DocumentSyncMark documentId="mine" savedAt={savedAt} />
    </DriveMirrorContext.Provider>,
  );
}

describe('DocumentSyncMark', () => {
  it('names each state for screen readers and on hover', () => {
    show(status(), 100);
    expect(screen.getByRole('img', { name: 'Synced to Google Drive' })).toBeTruthy();
    cleanup();
    show(status(), 101);
    expect(screen.getByRole('img', { name: 'Waiting to sync to Google Drive' })).toBeTruthy();
    cleanup();
    show(status({ state: 'syncing' }), 101);
    expect(screen.getByRole('img', { name: 'Syncing to Google Drive…' })).toBeTruthy();
  });

  it('keeps every cloud quiet and colours only its symbol: the check green, the arrows blue', () => {
    const parts = (state: string) =>
      [...document.querySelectorAll(`[data-document-sync="${state}"] svg path`)].map((p) => ({
        part: p.getAttribute('data-sync-part'),
        cls: p.getAttribute('class') ?? '',
      }));
    for (const [s, savedAt, colour] of [
      [status(), 100, 'emerald'],
      [status(), 101, 'blue'],
      [status({ state: 'syncing' }), 101, 'blue'],
    ] as const) {
      show(s, savedAt);
      const state = document
        .querySelector('[data-document-sync]')!
        .getAttribute('data-document-sync')!;
      const all = parts(state);
      expect(all.filter((p) => p.part === 'cloud')).toHaveLength(1);
      for (const p of all) {
        if (p.part === 'cloud') expect(p.cls).toBe('');
        else expect(p.cls).toContain(`text-${colour}-600`);
      }
      cleanup();
    }
  });

  it('renders nothing for a document that is not mirrored', () => {
    show(status({ mirrored: {} }), 100);
    expect(document.querySelector('[data-document-sync]')).toBeNull();
  });
});
