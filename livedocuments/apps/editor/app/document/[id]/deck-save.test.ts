import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api-client';
import { DocumentTrashedError } from '@/lib/document-trashed';
import {
  DECK_SAVE_FAILED_MESSAGE,
  DECK_TOO_LARGE_MESSAGE,
  deckSaveFailureMessage,
  sendDeckSave,
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

describe('sendDeckSave', () => {
  const settle = () => new Promise((r) => setTimeout(r, 0));

  it('sends the base, then is the next base', async () => {
    const base = { current: 'B0' as string | null };
    const send = vi.fn(async () => {});
    const showError = vi.fn();
    sendDeckSave(base, 'D1', send, showError);
    expect(send).toHaveBeenCalledWith('B0');
    expect(base.current).toBe('D1');
    await settle();
    expect(base.current).toBe('D1');
    expect(showError).not.toHaveBeenCalled();
  });

  it('puts the base back and says so when the save fails', async () => {
    const base = { current: 'B0' as string | null };
    const showError = vi.fn();
    sendDeckSave(
      base,
      'D1',
      () => Promise.reject(new ApiError('save', 413, 'payload_too_large')),
      showError,
    );
    await settle();
    expect(base.current).toBe('B0');
    expect(showError).toHaveBeenCalledWith(DECK_TOO_LARGE_MESSAGE);
  });

  it('keeps a newer base a later save moved on to', async () => {
    const base = { current: 'B0' as string | null };
    let fail: (err: unknown) => void = () => {};
    sendDeckSave(base, 'D1', () => new Promise((_, reject) => (fail = reject)), vi.fn());
    sendDeckSave(base, 'D2', async () => {}, vi.fn());
    fail(new TypeError('Failed to fetch'));
    await settle();
    expect(base.current).toBe('D2');
  });

  it('shows nothing for a document in the Trash', async () => {
    const showError = vi.fn();
    sendDeckSave(
      { current: null },
      'D1',
      () => Promise.reject(new DocumentTrashedError('d1')),
      showError,
    );
    await settle();
    expect(showError).not.toHaveBeenCalled();
  });
});
