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
import { isMirrorable } from '@/app/explorer/document-badges';
import { OFFLINE_OWNER_ID } from '@/lib/offline/offline-store';
import type { PaneDocument } from '@/app/explorer/views';

afterEach(cleanup);

const status = (over: Partial<DriveMirrorStatus> = {}): DriveMirrorStatus => ({
  ...DRIVE_STATUS_INITIAL,
  state: 'idle',
  lastSyncedAt: 1,
  mirrored: { mine: 100 },
  ...over,
});
const NOTICE = { kind: 'document' as const, ldId: 'mine', name: 'Plan', parentId: 'p' };

// Every flow the Explorer row meets (docs/specs/022-drive-mirror/drive-mirror.md,
// "The Explorer shows each document's sync").
const state = (over: Partial<DriveMirrorStatus>, savedAt: number, mirrorable = true, id = 'mine') =>
  documentSyncState(status(over), id, savedAt, mirrorable);

describe('documentSyncState', () => {
  it('is synced once the last save is in Drive', () => {
    expect(state({}, 100)).toBe('synced');
    expect(state({}, 90)).toBe('synced');
  });

  it('is waiting after an edit, syncing during a pass, synced once uploaded', () => {
    expect(state({}, 101)).toBe('waiting');
    expect(state({ state: 'syncing' }, 101)).toBe('syncing');
    expect(state({ state: 'syncing', mirrored: { mine: 101 } }, 101)).toBe('synced');
  });

  it('is waiting at once for a document the engine has not seen yet (new, duplicated, imported, moved out of a team, synced up from offline, restored)', () => {
    expect(state({}, 5, true, 'duplicate')).toBe('waiting');
    expect(state({ mirrored: { mine: null } }, 1)).toBe('waiting');
    expect(state({ state: 'syncing' }, 5, true, 'duplicate')).toBe('syncing');
  });

  it('says nothing for a document that is not mirrored (team, shared with you, offline)', () => {
    expect(state({}, 100, false)).toBeNull();
    // Moved into a team: still in the engine's last list, but the row knows.
    expect(state({ mirrored: { mine: 100 } }, 100, false)).toBeNull();
  });

  it('says nothing before Drive is known to be connected, or once it is not', () => {
    expect(state({ state: 'starting' }, 100)).toBeNull();
    expect(state({ state: 'disconnected' }, 100)).toBeNull();
  });

  it('says nothing until drive_items has been read, never guessing', () => {
    expect(state({ mirrored: null }, 100)).toBeNull();
    expect(state({ mirrored: null, state: 'syncing' }, 100)).toBeNull();
  });

  it('keeps saying what it knows while syncing is paused', () => {
    expect(state({ state: 'needs_reconnect' }, 100)).toBe('synced');
    expect(state({ state: 'needs_reconnect' }, 101)).toBe('waiting');
    expect(state({ state: 'needs_resume' }, 101)).toBe('waiting');
  });

  it('stays waiting while offline or rate-limited: it has not gone up yet', () => {
    expect(state({ error: 'offline' }, 101)).toBe('waiting');
    expect(state({ error: 'rate_limited' }, 101)).toBe('waiting');
    expect(state({ error: 'offline' }, 100)).toBe('synced');
  });

  it("says a document's upload failed, until a retry succeeds", () => {
    expect(state({ failed: ['mine'] }, 101)).toBe('failed');
    expect(state({ failed: ['mine'], state: 'syncing' }, 101)).toBe('failed');
    expect(state({ failed: [] }, 101)).toBe('waiting');
  });

  it('leaves a document with a folder notice to that notice', () => {
    expect(state({ notices: [NOTICE] }, 100)).toBeNull();
  });
});

function show(s: DriveMirrorStatus, savedAt: number, mirrorable = true) {
  render(
    <DriveMirrorContext.Provider value={{ ...DRIVE_MIRROR_OFF, mode: 'broker', status: s }}>
      <DocumentSyncMark documentId="mine" savedAt={savedAt} mirrorable={mirrorable} />
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
    cleanup();
    show(status({ failed: ['mine'] }), 101);
    expect(
      screen.getByRole('img', {
        name: "Couldn't sync to Google Drive. Trying again automatically.",
      }),
    ).toBeTruthy();
  });

  it('keeps every cloud quiet and still; only its symbol takes a colour and moves', () => {
    for (const [s, savedAt, colour, motion] of [
      [status(), 100, 'emerald', null],
      [status(), 101, 'blue', 'motion-safe:animate-sync-rise'],
      [status({ state: 'syncing' }), 101, 'blue', 'motion-safe:animate-sync-spin'],
      [status({ failed: ['mine'] }), 101, 'amber', null],
    ] as const) {
      show(s, savedAt);
      const mark = document.querySelector('[data-document-sync]')!;
      const clouds = mark.querySelectorAll('[data-sync-part="cloud"]');
      expect(clouds).toHaveLength(1);
      expect(clouds[0]!.getAttribute('class') ?? '').toBe('');
      const symbol = mark.querySelector('g[data-sync-part="symbol"]')!;
      expect(symbol.querySelectorAll('path').length).toBeGreaterThan(0);
      const cls = symbol.getAttribute('class') ?? '';
      expect(cls).toContain(`text-${colour}-600`);
      if (motion) expect(cls).toContain(motion);
      else expect(cls).not.toMatch(/animate-/);
      // Turns about its own centre, not the icon's corner.
      expect((symbol as SVGGElement).style.transformBox).toBe('fill-box');
      cleanup();
    }
  });

  it('renders nothing for a document that is not mirrored', () => {
    show(status(), 100, false);
    expect(document.querySelector('[data-document-sync]')).toBeNull();
  });
});

describe('isMirrorable', () => {
  const doc = (over: Partial<PaneDocument>) =>
    ({ id: 'd', name: 'Plan', ownerId: 'me', savedAt: 1, ...over }) as PaneDocument;
  it("is the user's own Personal Space document, saved in the cloud", () => {
    expect(isMirrorable(doc({}))).toBe(true);
    expect(isMirrorable(doc({ shareCode: 'abc' }))).toBe(true);
  });
  it('is not a team document, one shared with the user, or an offline one', () => {
    expect(isMirrorable(doc({ team: { id: 't', name: 'Team' } }))).toBe(false);
    expect(isMirrorable(doc({ shared: { ownerName: 'Ann', role: 'edit', shareCode: 'x' } }))).toBe(
      false,
    );
    expect(isMirrorable(doc({ ownerId: OFFLINE_OWNER_ID }))).toBe(false);
  });
});
