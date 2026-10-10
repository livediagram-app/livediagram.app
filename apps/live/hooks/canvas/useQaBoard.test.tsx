// @vitest-environment jsdom

// Posting to a full Q&A board (docs/specs/012-collaboration/qa-board.md): the
// add is refused here and says so, so the composer keeps the draft.

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QA_MAX_NOTES, type QaNote, type ShapeElement } from '@livediagram/document';
import { useQaBoard } from './useQaBoard';

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

describe('useQaBoard addQaNote', () => {
  it('refuses a note on a full board, without sending it', () => {
    const commitTabs = vi.fn();
    const { result } = renderHook(() =>
      useQaBoard({
        documentId: null,
        activeId: 't',
        selfParticipant: { id: 'me', name: 'Me', color: '#000', status: 'online' },
        sessionShareCode: null,
        applyRemoteTabs: vi.fn(),
        commitTabs,
        lastSavedTabsRef: { current: [] },
        onError: vi.fn(),
      }),
    );
    expect(result.current.addQaNote(board(QA_MAX_NOTES), 'Why?', false)).toBe(false);
    expect(commitTabs).not.toHaveBeenCalled();
    expect(result.current.addQaNote(board(0), 'Why?', false)).toBe(true);
  });
});
