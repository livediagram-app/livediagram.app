import { describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livediagram/document';
import type { PresenceCoalescer } from '@liveworkspace/workbench/lib/presence-coalescer';
import { receiveRoomOp } from './room-op-receive';
import { createRemoteOpJournal } from './save-baseline';
import type { RoomConnectionOptions } from './useRoomConnection.types';

// A peer's `tab-saved` (docs/specs/006-document/delta-saves.md "A peer's save moves the base copy"): handed on with
// the tab as the autosave's baseline holds it, for a loaded tab only.

const DIGEST = 'c'.repeat(64);
const stored: Tab = { id: 't1', name: 'Board', elements: [] };

function receive(loaded: string[], receiveTabSaved?: RoomConnectionOptions['receiveTabSaved']) {
  const opts = {
    markSeen: vi.fn(),
    loadedTabIdsRef: { current: new Set(loaded) },
    saveBaseline: {
      tabs: { current: [stored] },
      name: { current: 'Doc' },
      journal: { current: createRemoteOpJournal() },
    },
    receiveTabSaved,
  } as unknown as RoomConnectionOptions;
  receiveRoomOp(
    'peer',
    { kind: 'tab-saved', tabId: 't1', rev: 4, digest: DIGEST },
    {} as PresenceCoalescer,
    opts,
    new Map(),
    new Map(),
  );
  return opts;
}

describe('a received tab-saved', () => {
  it('hands on the baseline tab, the revision and the digest', () => {
    const onSaved = vi.fn();
    const opts = receive(['t1'], onSaved);
    expect(onSaved).toHaveBeenCalledWith(stored, 4, DIGEST);
    // Not a document change: the journal does not move, so the autosave is not held back.
    expect(opts.saveBaseline.journal.current.next).toBe(0);
  });

  it('ignores a tab not loaded here, and does nothing without a handler', () => {
    const onSaved = vi.fn();
    receive([], onSaved);
    expect(onSaved).not.toHaveBeenCalled();
    expect(() => receive(['t1'])).not.toThrow();
  });
});

// docs/specs/013-workspace/share-roles.md "Losing access is explained": a session on a revoked pass leaves for the
// Explorer with the reason in the address, which the Explorer reads (liveworkspace's explorer-landing) and drops.
describe('a received share-revoked', () => {
  function revoke(code: string, sessionCode: string | null) {
    const assign = vi.fn();
    vi.stubGlobal('window', { location: { assign, reload: vi.fn() } });
    const opts = {
      markSeen: vi.fn(),
      sessionShareCodeRef: { current: sessionCode },
    } as unknown as RoomConnectionOptions;
    receiveRoomOp(
      'system',
      { kind: 'share-revoked', code },
      {} as PresenceCoalescer,
      opts,
      new Map(),
      new Map(),
    );
    vi.unstubAllGlobals();
    return assign;
  }

  it('sends the session on the revoked link to the Explorer, saying why in the address', () => {
    expect(revoke('c1', 'c1')).toHaveBeenCalledWith('/explorer?ended=revoked');
  });

  it('leaves every other session where it is', () => {
    expect(revoke('c1', 'c2')).not.toHaveBeenCalled();
    expect(revoke('c1', null)).not.toHaveBeenCalled();
  });
});

// Slides an agent appended (docs/specs/012-collaboration/presentation-mode.md "Slides an agent appends"): handed to
// the deck from the worker alone.
describe('a received deck-slides', () => {
  const slides = [{ id: 's1', tabId: 't1', elementIds: ['a'] }];
  function deliver(from: string, receiveDeckSlides?: RoomConnectionOptions['receiveDeckSlides']) {
    const opts = { markSeen: vi.fn(), receiveDeckSlides } as unknown as RoomConnectionOptions;
    receiveRoomOp(
      from,
      { kind: 'deck-slides', slides },
      {} as PresenceCoalescer,
      opts,
      new Map(),
      new Map(),
    );
  }

  it('hands the slides to the deck when the worker sent them, never from a peer', () => {
    const receiveDeckSlides = vi.fn();
    deliver('system', receiveDeckSlides);
    deliver('peer', receiveDeckSlides);
    expect(receiveDeckSlides).toHaveBeenCalledTimes(1);
    expect(receiveDeckSlides).toHaveBeenCalledWith(slides);
    expect(() => deliver('system')).not.toThrow();
  });
});
