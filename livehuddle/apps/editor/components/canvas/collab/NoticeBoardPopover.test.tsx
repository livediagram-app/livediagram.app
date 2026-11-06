// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NoticeNote, ShapeElement } from '@livehuddle/document';

// docs/specs/009-elements/social-pieces.md "Notice Board": a pin and an unpin are each one delta, never a
// whole-element commit, so an Editor moving the board in the same moment cannot carry the old notes over a new one.

const { state } = vi.hoisted(() => ({
  state: { ctx: null as Record<string, unknown> | null },
}));
vi.mock('@/app/document/[id]/EditorContext', () => ({
  useOptionalEditorContext: () => state.ctx,
}));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

import { NoticeBoardPopover } from './NoticeBoardPopover';

const ADDER = 'a'.repeat(32);
const note = (id: string, by: string, at = 1): NoticeNote => ({
  id,
  text: `note ${id}`,
  author: 'Sam',
  by,
  at,
});
const board = (notes: NoticeNote[]): ShapeElement => ({
  id: 'nb',
  type: 'shape',
  shape: 'notice-board',
  x: 0,
  y: 0,
  width: 176,
  height: 128,
  noticeNotes: notes,
});

function editor(level: 'edit' | 'participate' | 'view', over: Record<string, unknown> = {}) {
  return {
    can: { level },
    participating: level === 'participate',
    adderKey: level === 'participate' ? ADDER : null,
    selfParticipant: { id: 'p1', name: 'Me', color: '#f00' },
    applyElementDelta: vi.fn(),
    commitElements: vi.fn(),
    ...over,
  };
}

function open(element: ShapeElement) {
  const anchor = document.createElement('button');
  document.body.appendChild(anchor);
  return render(<NoticeBoardPopover element={element} anchor={anchor} onClose={() => {}} />);
}

beforeEach(() => {
  state.ctx = editor('participate');
});
afterEach(() => vi.clearAllMocks());

describe('NoticeBoardPopover', () => {
  it("pins a Participant's note as one notice-pin delta signed with its adder key", () => {
    open(board([]));
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: '  Lunch at 1  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pin Note' }));
    const ctx = state.ctx!;
    expect(ctx.commitElements).not.toHaveBeenCalled();
    expect(ctx.applyElementDelta).toHaveBeenCalledTimes(1);
    const [elementId, delta] = (ctx.applyElementDelta as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(elementId).toBe('nb');
    expect(delta).toMatchObject({
      kind: 'notice-pin',
      note: { text: 'Lunch at 1', author: 'Me', by: ADDER },
    });
  });

  it("unpins a Participant's own note by id and signer, and offers no Unpin on another's", () => {
    open(board([note('theirs', 'b'.repeat(32), 1), note('mine', ADDER, 2)]));
    const unpins = screen.getAllByRole('button', { name: 'Unpin' });
    expect(unpins).toHaveLength(1);
    fireEvent.click(unpins[0]!);
    expect(state.ctx!.applyElementDelta).toHaveBeenCalledWith('nb', {
      kind: 'notice-unpin',
      noteId: 'mine',
      by: ADDER,
    });
    expect(state.ctx!.commitElements).not.toHaveBeenCalled();
  });

  it("lets an Editor unpin anyone's note, naming that note's signer", () => {
    state.ctx = editor('edit');
    open(board([note('theirs', 'b'.repeat(32))]));
    fireEvent.click(screen.getByRole('button', { name: 'Unpin' }));
    expect(state.ctx.applyElementDelta).toHaveBeenCalledWith('nb', {
      kind: 'notice-unpin',
      noteId: 'theirs',
      by: 'b'.repeat(32),
    });
  });

  it('shows a Viewer the notes with no add box and no Unpin', () => {
    state.ctx = editor('view');
    open(board([note('theirs', 'b'.repeat(32))]));
    expect(screen.queryByRole('button', { name: 'Pin Note' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Unpin' })).toBeNull();
  });
});
