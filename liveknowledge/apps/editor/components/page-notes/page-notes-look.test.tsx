// @vitest-environment jsdom
// docs/specs/030-knowledgebase/page-comments.md "Comments on the writing": the notes' style sheet drawn from the page
// as this editor draws it, a card's press bringing the words into view and opening the note, and the bar going with
// Escape, a press elsewhere and a scroll that takes the words away.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newArticleNote, type Element } from '@liveknowledge/document';
import {
  EditorChromeContext,
  createEditorChromeStore,
  type EditorContextValue,
} from '@/app/document/[id]/EditorContext';
import { resolveEditorCapabilities } from '@/lib/editor-capabilities';
import { PageNotesLook } from './PageNotesLook';
import { usePageNotes } from './usePageNotes';

const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));

const resolved = {
  ...newArticleNote('done', 'comment', { x: 0, y: 0 }),
  commentThread: {
    comments: [{ id: 'c', text: 'Fixed.', createdAt: 1, authorName: 'Sam', authorColor: '#000' }],
    resolved: true,
  },
} as unknown as Element;
const activeTab = {
  id: 't',
  elements: [resolved],
  articles: {
    f: { blocks: [{ id: 'b', type: 'paragraph', runs: [{ text: 'Done', note: 'done' }] }] },
  },
};
const rect = (top: number) =>
  ({ left: 400, top, width: 100, height: 20, right: 500, bottom: top + 20 }) as DOMRect;
let wordsTop = 300;

beforeEach(() => {
  wordsTop = 300;
  Range.prototype.getClientRects = function () {
    return [rect(wordsTop)] as unknown as DOMRectList;
  };
  Range.prototype.getBoundingClientRect = () => rect(wordsTop);
  vi.stubGlobal('requestAnimationFrame', (f: FrameRequestCallback) => {
    f(0);
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.getSelection()?.removeAllRanges();
  document.body.innerHTML = '';
});

function storeWith(openNote = vi.fn()) {
  return createEditorChromeStore({
    activeTab,
    can: resolveEditorCapabilities('edit'),
    pagesMode: { articles: { addReadingNote: vi.fn(() => true), openNote } },
  } as unknown as EditorContextValue);
}

function OpenFirst() {
  const { notes, open } = usePageNotes();
  return (
    <button type="button" onClick={() => open(notes[0]!)}>
      {notes.length} notes
    </button>
  );
}

describe('the notes around the writing', () => {
  it('draws the style sheet that takes a resolved note’s tint off', () => {
    render(
      <EditorChromeContext.Provider value={storeWith()}>
        <PageNotesLook />
      </EditorChromeContext.Provider>,
    );
    expect(document.querySelector('style[data-note-marks]')?.textContent).toContain(
      '[data-note-id="done"]',
    );
  });

  it('brings a note’s words into view and opens it from its card', () => {
    const openNote = vi.fn();
    const words = document.createElement('span');
    words.className = 'article-flow';
    words.innerHTML = '<span data-note-id="done">Done</span>';
    document.body.append(words);
    render(
      <EditorChromeContext.Provider value={storeWith(openNote)}>
        <OpenFirst />
      </EditorChromeContext.Provider>,
    );
    fireEvent.click(screen.getByRole('button', { name: '1 notes' }));
    expect(words.firstElementChild!.scrollIntoView).toHaveBeenCalled();
    expect(openNote).toHaveBeenCalledWith('done', 'comment');
    expect(track).toHaveBeenCalledWith('UI', 'Used', 'OpenNoteFromComments');
  });

  it('lets the bar go on Escape, a press elsewhere, and a scroll that takes the words away', async () => {
    document.body.innerHTML =
      '<div class="article-flow" data-readonly="" data-article-flow="f"><p id="p">Some words here</p></div>';
    render(
      <EditorChromeContext.Provider value={storeWith()}>
        <PageNotesLook />
      </EditorChromeContext.Provider>,
    );
    const show = async () => {
      const range = document.createRange();
      range.setStart(document.getElementById('p')!.firstChild!, 0);
      range.setEnd(document.getElementById('p')!.firstChild!, 4);
      document.getSelection()!.removeAllRanges();
      document.getSelection()!.addRange(range);
      act(() => {
        document.dispatchEvent(new PointerEvent('pointerup', { pointerType: 'mouse' }));
      });
      return screen.findByRole('toolbar');
    };
    await show();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('toolbar')).toBeNull();
    await show();
    act(() => {
      document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    });
    expect(screen.queryByRole('toolbar')).toBeNull();
    await show();
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    expect(screen.getByRole('toolbar')).toBeTruthy();
    wordsTop = -400;
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    expect(screen.queryByRole('toolbar')).toBeNull();
    await show();
    act(() => {
      document.getSelection()!.removeAllRanges();
      document.dispatchEvent(new Event('selectionchange'));
    });
    expect(screen.queryByRole('toolbar')).toBeNull();
  });
});
