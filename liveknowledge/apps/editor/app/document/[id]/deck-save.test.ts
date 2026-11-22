import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api-client';
import { DocumentTrashedError } from '@/lib/document-trashed';
import {
  DECK_SAVE_FAILED_MESSAGE,
  DECK_TOO_LARGE_MESSAGE,
  deckSaveFailureMessage,
  deckSaveQueue,
} from './deck-save';
import { SAVE_FORBIDDEN_MESSAGE, SAVE_SIGNED_OUT_MESSAGE } from './save-failure';

// docs/specs/012-collaboration/speaker-note-cards.md "Saving": a refused or failed deck save says so, and the next save
// is built on the deck last stored.

describe('deckSaveFailureMessage', () => {
  it('says a deck past the cap is too long, and the rest as a tab save does', () => {
    expect(deckSaveFailureMessage(new ApiError('save', 413, 'payload_too_large'))).toBe(
      DECK_TOO_LARGE_MESSAGE,
    );
    expect(deckSaveFailureMessage(new ApiError('save', 403, 'forbidden'))).toBe(
      SAVE_FORBIDDEN_MESSAGE,
    );
    expect(deckSaveFailureMessage(new ApiError('save', 401, null))).toBe(SAVE_SIGNED_OUT_MESSAGE);
    expect(deckSaveFailureMessage(new ApiError('save', 503, null))).toBe(DECK_SAVE_FAILED_MESSAGE);
    expect(deckSaveFailureMessage(new TypeError('Failed to fetch'))).toBe(DECK_SAVE_FAILED_MESSAGE);
  });

  it('says nothing for a document in the Trash, which the autosave reports', () => {
    expect(deckSaveFailureMessage(new DocumentTrashedError('d1'))).toBeNull();
  });
});

describe('deckSaveQueue', () => {
  const settle = () => new Promise((r) => setTimeout(r, 0));
  // A send the test settles by hand, recording the base it was built on.
  function controlled() {
    const sent: { base: string | null; ok: () => void; fail: (err: unknown) => void }[] = [];
    const send = (base: string | null) =>
      new Promise<void>((ok, fail) => sent.push({ base, ok: () => ok(), fail }));
    return { sent, send };
  }

  it('moves the base on only once a save lands', async () => {
    const base = { current: 'B0' as string | null };
    const { sent, send } = controlled();
    deckSaveQueue(base, vi.fn()).save('D1', send);
    expect(sent.map((s) => s.base)).toEqual(['B0']);
    expect(base.current).toBe('B0');
    sent[0]!.ok();
    await settle();
    expect(base.current).toBe('D1');
  });

  it('holds a newer save until the one in flight fails, then builds it on the deck last stored', async () => {
    const base = { current: 'B0' as string | null };
    const showError = vi.fn();
    const queue = deckSaveQueue(base, showError);
    const { sent, send } = controlled();
    queue.save('D1', send);
    queue.save('D2', send);
    queue.save('D3', send);
    // One at a time: D2 and D3 wait, and only the newest of them goes.
    expect(sent).toHaveLength(1);
    sent[0]!.fail(new TypeError('Failed to fetch'));
    await settle();
    expect(showError).toHaveBeenCalledWith(DECK_SAVE_FAILED_MESSAGE);
    expect(sent.map((s) => s.base)).toEqual(['B0', 'B0']);
    sent[1]!.ok();
    await settle();
    expect(base.current).toBe('D3');
    expect(sent).toHaveLength(2);
  });

  it('builds the waiting save on the one in flight once that lands', async () => {
    const base = { current: 'B0' as string | null };
    const queue = deckSaveQueue(base, vi.fn());
    const { sent, send } = controlled();
    queue.save('D1', send);
    queue.save('D2', send);
    sent[0]!.ok();
    await settle();
    expect(sent.map((s) => s.base)).toEqual(['B0', 'D1']);
  });

  it('sends an unload save at once on the deck last stored, never waiting', async () => {
    const base = { current: 'B0' as string | null };
    const queue = deckSaveQueue(base, vi.fn());
    const { sent, send } = controlled();
    queue.save('D1', send);
    queue.save('D2', send, { unload: true });
    expect(sent.map((s) => s.base)).toEqual(['B0', 'B0']);
    sent[1]!.fail(new TypeError('Failed to fetch'));
    await settle();
  });

  it('keeps a base a load moved meanwhile, and shows nothing for a trashed document', async () => {
    const base = { current: 'B0' as string | null };
    const showError = vi.fn();
    const queue = deckSaveQueue(base, showError);
    const { sent, send } = controlled();
    queue.save('D1', send);
    base.current = 'Other';
    sent[0]!.ok();
    await settle();
    expect(base.current).toBe('Other');
    queue.save('D2', send);
    sent[1]!.fail(new DocumentTrashedError('d1'));
    await settle();
    expect(showError).not.toHaveBeenCalled();
  });
});
