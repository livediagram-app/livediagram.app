// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSticky, type Element } from '@livehuddle/document';
import { storedPinnedArrow } from '@/test/retired-elements';
import { resolveEditorCapabilities } from '@/lib/editor-capabilities';
import { EditorAnchoredPopovers } from './EditorAnchoredPopovers';

// A stored arrow is a retired element whose placeholder card takes comments, a note and an action as a box does
// (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 4; blueprints/DEFAULTS.md D28). The
// card carries the arrow's id, so the popovers anchor to it.

let ctx: Record<string, unknown>;
vi.mock('@/app/document/[id]/EditorContext', () => ({ useEditorContext: () => ctx }));

const box = { ...createSticky(0, 0), id: 'a' } as Element;
const thread = {
  resolved: false,
  comments: [
    {
      id: 'c1',
      text: 'Why does this call out?',
      createdAt: 1,
      authorName: 'Sam',
      authorColor: '#3b82f6',
      authorId: 'other',
    },
  ],
};

function open(arrow: Element, over: Record<string, unknown> = {}) {
  ctx = {
    activeTab: { id: 't1', elements: [box, arrow] },
    isReadOnly: false,
    can: resolveEditorCapabilities({ level: 'edit', adderKey: null }),
    documentId: null,
    selfParticipant: { id: 'me', name: 'Me' },
    sessionShareCode: null,
    commentThreadOpenId: null,
    addComment: vi.fn(),
    deleteComment: vi.fn(),
    resolveThread: vi.fn(),
    unresolveThread: vi.fn(),
    closeComments: vi.fn(),
    noteOpenId: null,
    setNote: vi.fn(),
    closeNote: vi.fn(),
    actionPopoverOpenId: null,
    closeActionPopover: vi.fn(),
    assignActionFor: null,
    assignActionId: null,
    openAssignActionDialog: vi.fn(),
    closeAssignActionDialog: vi.fn(),
    saveAction: vi.fn(),
    completeAction: vi.fn(),
    reopenAction: vi.fn(),
    wontDoAction: vi.fn(),
    deleteAction: vi.fn(),
    teams: [],
    accountUserId: null,
    setDocumentTeamId: vi.fn(),
    accountDisplayName: null,
    documentTeamId: null,
    emailEnabled: false,
    ...over,
  };
  render(<EditorAnchoredPopovers />);
}

// The card on the canvas: what the popovers measure to sit beside.
function addCard(id: string) {
  const card = document.createElement('div');
  card.dataset.elementId = id;
  document.body.appendChild(card);
}

beforeEach(() => {
  ctx = {};
  addCard('ar');
});
afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

describe('EditorAnchoredPopovers on a stored arrow', () => {
  it('opens its stored thread from the card, and adds a comment to the arrow', async () => {
    const arrow = storedPinnedArrow('ar', 'a', 'e', 'a', 'w', { commentThread: thread });
    open(arrow, { commentThreadOpenId: 'ar' });
    // The popovers load on first use (next/dynamic).
    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Why does this call out?')).toBeTruthy();
    const box = screen.getByRole('textbox', { name: 'Add a comment' });
    fireEvent.change(box, { target: { value: 'It reads the cache' } });
    fireEvent.keyDown(box, { key: 'Enter', ctrlKey: true });
    const add = ctx.addComment as ReturnType<typeof vi.fn>;
    expect(add).toHaveBeenCalledOnce();
    expect(add.mock.calls[0]!.slice(0, 2)).toEqual(['ar', 'It reads the cache']);
  });

  it('opens its note for editing', async () => {
    open(storedPinnedArrow('ar', 'a', 'e', 'a', 'w', { note: 'Ask about retries' }), {
      noteOpenId: 'ar',
    });
    // The note popover heads itself Note.
    expect(await screen.findByText('Note')).toBeTruthy();
  });

  it('closes a thread whose arrow is gone, as for any element', () => {
    const closeComments = vi.fn();
    ctx = {};
    open(box, { commentThreadOpenId: 'ar', closeComments });
    expect(closeComments).toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
