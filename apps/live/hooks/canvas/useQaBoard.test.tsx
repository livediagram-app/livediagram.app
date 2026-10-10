// @vitest-environment jsdom

// Posting to a full Q&A board (docs/specs/012-collaboration/qa-board.md): the
// add is refused here and says so, so the composer keeps the draft.

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QA_MAX_NOTES, type QaNote, type ShapeElement } from '@livediagram/document';
import { apiQaAction } from '@/lib/api-client';
import { QA_BOARD_FULL_MESSAGE, useQaBoard } from './useQaBoard';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@/lib/api-client', () => ({ apiQaAction: vi.fn() }));

const board = (n: number): ShapeElement => ({
  id: 'qa',
  type: 'shape',
  shape: 'qa-board',
  x: 0,
  y: 0,
  width: 300,
  height: 300,
  qaNotes: Array.from(
    { length: n },
    (_, i) => ({ id: `n${i}`, text: 'q', voters: [] }) as unknown as QaNote,
  ),
});

const hook = (documentId: string | null, onError = vi.fn(), commitTabs = vi.fn()) =>
  renderHook(() =>
    useQaBoard({
      documentId,
      activeId: 't',
      selfParticipant: { id: 'me', name: 'Me', color: '#000', status: 'online' },
      sessionShareCode: null,
      applyRemoteTabs: vi.fn(),
      commitTabs,
      lastSavedTabsRef: { current: [] },
      onError,
    }),
  );

describe('useQaBoard addQaNote', () => {
  // The board filled up between this viewer's look and the post: the server answers with the board, the
  // note left out, and the person is told while the composer puts the draft back.
  it('reports a post the server refused at the cap', async () => {
    const full = board(QA_MAX_NOTES).qaNotes!;
    vi.mocked(apiQaAction).mockResolvedValueOnce({ notes: full, rev: 9, voterId: 'v' });
    const onError = vi.fn();
    const { result } = hook('d1', onError);
    const sent = result.current.addQaNote(board(QA_MAX_NOTES - 1), 'Why?', false);
    expect(sent).toBeInstanceOf(Promise);
    expect(await sent).toBe(false);
    expect(onError).toHaveBeenCalledWith(QA_BOARD_FULL_MESSAGE);
  });

  it('confirms a post the server took', async () => {
    vi.mocked(apiQaAction).mockImplementationOnce(async (_o, _d, _t, _e, action) => ({
      notes: [{ id: (action as { id: string }).id, text: 'Why?', at: 1, voters: [] }],
      rev: 1,
      voterId: 'v',
    }));
    const onError = vi.fn();
    const { result } = hook('d1', onError);
    expect(await result.current.addQaNote(board(0), 'Why?', false)).toBe(true);
    expect(onError).not.toHaveBeenCalled();
  });

  it('refuses a note on a full board, without sending it', async () => {
    const commitTabs = vi.fn();
    const { result } = hook(null, vi.fn(), commitTabs);
    expect(result.current.addQaNote(board(QA_MAX_NOTES), 'Why?', false)).toBe(false);
    expect(commitTabs).not.toHaveBeenCalled();
    expect(await result.current.addQaNote(board(0), 'Why?', false)).toBe(true);
  });
});
