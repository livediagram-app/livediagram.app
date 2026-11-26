// @vitest-environment jsdom
// docs/specs/030-knowledgebase/page-comments.md "Comments on the writing", "Share roles (comments on the writing)", as
// the editor draws them: an Editor, a Participant and an edit link's guest (each `can.takePart`) get the reading
// selection bar, its keys and the selection menu's rows; a Viewer and a view link's visitor get none of them, and read
// the notes listed under Comments like everyone. The room and the api gate the element threads as they always have.
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { canNoteHere } from '@liveworkspace/workbench/components/selection-menu/selection-note-entry';
import { createElementAction } from '@liveknowledge/document';
import {
  EditorChromeContext,
  createEditorChromeStore,
  type EditorContextValue,
} from '@/app/document/[id]/EditorContext';
import { resolveEditorCapabilities } from '@/lib/editor-capabilities';
import type { PageNote } from '@/lib/page-notes/page-notes';
import { PageCommentsView } from '@/components/page-comments/PageComments';
import { ReadingNoteBar } from './ReadingNoteBar';

const NOW = Date.UTC(2026, 10, 26, 12);
const LEVELS = {
  editor: 'edit',
  participant: 'participate',
  'edit-link guest': 'participate',
  viewer: 'view',
  'view-link visitor': 'view',
} as const;
type Who = keyof typeof LEVELS;
const WRITERS = ['editor', 'participant', 'edit-link guest'] as const;
const READERS = ['viewer', 'view-link visitor'] as const;

const rect = (left: number, top: number, width: number, height: number) =>
  ({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
  }) as DOMRect;

beforeEach(() => {
  // jsdom lays nothing out: the words get boxes, a frame runs at once.
  Range.prototype.getClientRects = function () {
    return [rect(400, 300, 120, 20)] as unknown as DOMRectList;
  };
  Range.prototype.getBoundingClientRect = () => rect(400, 300, 120, 20);
  vi.stubGlobal('requestAnimationFrame', (f: FrameRequestCallback) => {
    f(0);
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.getSelection()?.removeAllRanges();
  document.body.innerHTML = '';
});

function drawBar(who: Who) {
  const addReadingNote = vi.fn(() => true);
  const store = createEditorChromeStore({
    can: resolveEditorCapabilities(LEVELS[who]),
    pagesMode: { articles: { addReadingNote } },
  } as unknown as EditorContextValue);
  const host = document.createElement('div');
  host.innerHTML =
    '<div class="article-flow" data-readonly="" data-article-flow="f"><p id="p">The release train leaves on Tuesday.</p></div>';
  document.body.appendChild(host);
  const view = render(
    <EditorChromeContext.Provider value={store}>
      <ReadingNoteBar />
    </EditorChromeContext.Provider>,
  );
  const writing = host.querySelector<HTMLElement>('.article-flow')!;
  const pickWords = () => {
    const text = document.getElementById('p')!.firstChild!;
    const range = document.createRange();
    range.setStart(text, 4);
    range.setEnd(text, 17);
    const sel = document.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);
  };
  return { ...view, addReadingNote, writing, pickWords };
}

describe('the reading selection bar, by role', () => {
  for (const who of WRITERS)
    it(`shows Comment and Add Action to ${who === 'editor' ? 'an' : 'a'} ${who} once the press lets go`, async () => {
      const { addReadingNote, pickWords } = drawBar(who);
      pickWords();
      act(() => {
        document.dispatchEvent(new PointerEvent('pointerup', { pointerType: 'mouse' }));
      });
      const bar = await screen.findByRole('toolbar', { name: 'Comment on these words' });
      fireEvent.click(within(bar).getByRole('button', { name: /^Add Action/ }));
      expect(addReadingNote).toHaveBeenCalledWith('f', 'action');
      expect(screen.queryByRole('toolbar')).toBeNull();
    });

  it('floats no bar over a touch’s words: the docked menu carries the rows', () => {
    const { pickWords, writing } = drawBar('editor');
    pickWords();
    act(() => {
      document.dispatchEvent(new PointerEvent('pointerup', { pointerType: 'touch' }));
    });
    expect(screen.queryByRole('toolbar')).toBeNull();
    expect(canNoteHere(writing)).toBe(true);
  });

  it('puts a comment on the words with ⌘⌥M (Ctrl+Alt+M), no bar needed', () => {
    const { addReadingNote, pickWords } = drawBar('participant');
    pickWords();
    const mac = /Mac|iPhone|iPad/.test(navigator.platform);
    fireEvent.keyDown(document, { code: 'KeyM', altKey: true, metaKey: mac, ctrlKey: !mac });
    expect(addReadingNote).toHaveBeenCalledWith('f', 'comment');
  });

  for (const who of READERS)
    it(`offers a ${who} nothing: no bar, no keys, no menu rows`, () => {
      const { addReadingNote, pickWords, writing } = drawBar(who);
      pickWords();
      act(() => {
        document.dispatchEvent(new PointerEvent('pointerup', { pointerType: 'mouse' }));
      });
      fireEvent.keyDown(document, { code: 'KeyM', altKey: true, metaKey: true, ctrlKey: true });
      expect(screen.queryByRole('toolbar')).toBeNull();
      expect(addReadingNote).not.toHaveBeenCalled();
      expect(canNoteHere(writing)).toBe(false);
    });
});

const COMMENT: PageNote = {
  id: 'n1',
  kind: 'comment',
  quote: 'release train',
  open: true,
  count: 2,
  latest: {
    id: 'c2',
    text: 'Moved to Wednesday.',
    createdAt: NOW - 60_000,
    authorName: 'Sam',
    authorColor: '#f97316',
  },
  action: null,
};
const ACTION: PageNote = {
  id: 'n2',
  kind: 'action',
  quote: 'Tuesday',
  open: true,
  count: 0,
  latest: null,
  action: {
    ...createElementAction({
      name: 'Confirm the date',
      description: '',
      assignee: { userId: 'u2', name: 'Sam Lee' },
      teamId: 't',
      assigner: { id: 'u1', name: 'Priya' },
    }),
    due: '2026-11-20',
  },
};
const DETACHED: PageNote = { ...COMMENT, id: 'n3', quote: null };
const RESOLVED: PageNote = { ...COMMENT, id: 'n4', open: false, quote: 'Ask Sam' };

function drawList(who: Who, notes: readonly PageNote[]) {
  const onOpenNote = vi.fn();
  render(
    <PageCommentsView
      status="ready"
      threads={[]}
      canWrite={resolveEditorCapabilities(LEVELS[who]).takePart}
      ownKey="key_me"
      now={NOW}
      change={vi.fn(async () => true)}
      notes={notes}
      onOpenNote={onOpenNote}
    />,
  );
  return onOpenNote;
}

describe('the notes listed under Comments', () => {
  for (const who of [...WRITERS, ...READERS])
    it(`lists them for ${who === 'editor' ? 'an' : 'a'} ${who}, counted with the open threads`, () => {
      const open = drawList(who, [COMMENT, ACTION, DETACHED, RESOLVED]);
      expect(screen.getByRole('heading', { name: /Comments/ }).textContent).toBe('Comments3');
      const card = screen.getByRole('button', { name: 'Comment on “release train”' });
      expect(card.textContent).toContain('Moved to Wednesday.');
      expect(card.textContent).toContain('2 comments');
      fireEvent.click(card);
      expect(open).toHaveBeenCalledWith(COMMENT);
    });

  it('shows an action’s assignee and a past due day, and a detached note as detached', () => {
    drawList('viewer', [ACTION, DETACHED]);
    const action = screen.getByRole('button', { name: 'Action on “Tuesday”' });
    expect(action.textContent).toContain('Sam Lee');
    expect(action.querySelector('[data-note-due="past"]')).not.toBeNull();
    const detached = screen.getByRole('button', { name: 'Comment, its words were deleted' });
    expect(detached.textContent).toContain('Detached');
  });

  it('folds a resolved note under Resolved, with the resolved threads', () => {
    drawList('editor', [RESOLVED]);
    expect(screen.getByText('1 Resolved')).toBeTruthy();
    expect(
      screen.queryByText('Questions, corrections and context for this page go here.'),
    ).toBeNull();
  });
});
