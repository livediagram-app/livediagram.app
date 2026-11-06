// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAX_ARTICLE_FOOTNOTE_TEXT } from '@livedocuments/document';
import { FootnoteNotes, type NotesHost, type NotePage } from './article-footnote-notes';

// docs/specs/007-editor/article-pages.md "Footnotes": the notes at each page's foot, edited in place.
let made: FootnoteNotes[] = [];
afterEach(() => {
  made.forEach((n) => n.destroy());
  made = [];
  document.body.replaceChildren();
});

function notesOf(editable = true) {
  const parent = document.createElement('div');
  document.body.append(parent);
  const on: NotesHost & Record<string, ReturnType<typeof vi.fn>> = {
    editable: vi.fn(() => editable),
    commit: vi.fn(),
    leave: vi.fn(),
    resize: vi.fn(),
    press: vi.fn(),
  };
  const notes = new FootnoteNotes(parent, on);
  made.push(notes);
  return { notes, on, parent };
}

const page = (index: number, notes: NotePage['notes']): NotePage => ({
  index,
  x: 30 + index * 400,
  bottom: 500,
  width: 300,
  maxHeight: 200,
  notes,
});
const textOf = (notes: FootnoteNotes, n: number) =>
  notes.host.querySelector<HTMLElement>(`li[data-n="${n}"] .article-footnote-text`)!;

describe('FootnoteNotes', () => {
  it("draws each page's notes at its foot, numbered, as a list called Footnotes", () => {
    const { notes } = notesOf();
    notes.render([
      page(0, [{ n: 1, text: 'One' }]),
      page(2, [
        { n: 2, text: '' },
        { n: 3, text: 'Three' },
      ]),
    ]);
    const boxes = notes.roots();
    expect(boxes).toHaveLength(2);
    expect(boxes[1]!.dataset.page).toBe('2');
    expect(boxes[1]!.getAttribute('aria-label')).toBe('Footnotes');
    expect(boxes[1]!.style.left).toBe('830px');
    expect(boxes[1]!.style.maxHeight).toBe('200px');
    expect([...boxes[1]!.querySelectorAll('li')].map((li) => li.textContent)).toEqual([
      '2',
      '3Three',
    ]);
    const empty = textOf(notes, 2);
    expect(empty.dataset.placeholder).toBe('Footnote');
    expect(empty.getAttribute('aria-label')).toBe('Footnote 2');
    expect(empty.getAttribute('role')).toBe('textbox');
    expect(empty.getAttribute('contenteditable')).not.toBe('false');
  });

  it('reuses its boxes as the layout changes, and never rewrites a note being typed in', () => {
    const { notes } = notesOf();
    notes.render([
      page(0, [
        { n: 1, text: 'One' },
        { n: 2, text: 'Two' },
      ]),
    ]);
    const box = notes.roots()[0];
    const text = textOf(notes, 1);
    text.focus();
    text.textContent = 'Typed';
    expect(notes.editing()).toEqual({ n: 1, text: 'Typed' });
    notes.render([page(1, [{ n: 1, text: 'One' }])]);
    expect(notes.roots()[0]).toBe(box);
    expect(text.textContent).toBe('Typed');
    expect(box!.querySelectorAll('li')).toHaveLength(1);
    notes.render([]);
    expect(notes.roots()).toEqual([]);
  });

  it('shows notes read-only to someone who may not write', () => {
    const { notes } = notesOf(false);
    notes.render([page(0, [{ n: 1, text: 'One' }])]);
    const text = textOf(notes, 1);
    expect(text.getAttribute('contenteditable')).toBe('false');
    expect(text.hasAttribute('role')).toBe(false);
    expect(text.hasAttribute('aria-label')).toBe(false);
    expect(text.previousElementSibling!.hasAttribute('aria-hidden')).toBe(false);
    expect(notes.focus(1)).toBe(false);
    expect(notes.editing()).toBeNull();
  });

  it('puts the caret in a note, and commits it as it is left', () => {
    const { notes, on } = notesOf();
    notes.render([page(0, [{ n: 1, text: 'One' }])]);
    expect(notes.focus(1)).toBe(true);
    expect(notes.focus(9)).toBe(false);
    const text = textOf(notes, 1);
    expect(document.activeElement).toBe(text);
    text.textContent = 'One\nmore';
    text.blur();
    expect(on.commit).toHaveBeenCalledWith(1, 'One more');
  });

  it('on Enter or Escape commits a note and goes back to its reference', () => {
    const { notes, on } = notesOf();
    notes.render([page(0, [{ n: 4, text: 'Four' }])]);
    notes.focus(4);
    const text = textOf(notes, 4);
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    text.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(true);
    expect(on.commit).toHaveBeenCalledWith(4, 'Four');
    expect(on.leave).toHaveBeenCalledWith(4);
    on.leave.mockClear();
    notes.focus(4);
    const outside = vi.fn();
    document.body.addEventListener('keydown', outside);
    text.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
    expect(on.leave).toHaveBeenCalledWith(4);
    // A key typed into a note never reaches the canvas's shortcuts.
    expect(outside).not.toHaveBeenCalled();
    // Keys elsewhere in the boxes go on as they were.
    const elsewhere = new KeyboardEvent('keydown', { key: 'a', bubbles: true });
    notes.roots()[0]!.dispatchEvent(elsewhere);
    expect(outside).toHaveBeenCalledTimes(1);
  });

  it('keeps a note to one line and to its length, and says its height may have changed', () => {
    const { notes, on } = notesOf();
    notes.render([page(0, [{ n: 1, text: '' }])]);
    const text = textOf(notes, 1);
    const line = new InputEvent('beforeinput', {
      inputType: 'insertParagraph',
      cancelable: true,
      bubbles: true,
    });
    text.dispatchEvent(line);
    expect(line.defaultPrevented).toBe(true);
    const typed = new InputEvent('beforeinput', {
      inputType: 'insertText',
      cancelable: true,
      bubbles: true,
    });
    text.dispatchEvent(typed);
    expect(typed.defaultPrevented).toBe(false);
    text.textContent = 'x'.repeat(MAX_ARTICLE_FOOTNOTE_TEXT + 5);
    text.dispatchEvent(new Event('input', { bubbles: true }));
    expect(text.textContent).toHaveLength(MAX_ARTICLE_FOOTNOTE_TEXT);
    expect(on.resize).toHaveBeenCalled();
    notes.roots()[0]!.dispatchEvent(new Event('input', { bubbles: true }));
    expect(on.resize).toHaveBeenCalledTimes(1);
  });

  it('keeps a press on the notes from the canvas', () => {
    const { notes, on, parent } = notesOf();
    notes.render([page(0, [{ n: 1, text: 'One' }])]);
    const canvas = vi.fn();
    parent.addEventListener('pointerdown', canvas);
    textOf(notes, 1).dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(on.press).toHaveBeenCalled();
    expect(canvas).not.toHaveBeenCalled();
  });

  it("measures each note once per text and look, taking the writing's look", () => {
    const { notes } = notesOf();
    const look = document.createElement('div');
    look.style.setProperty('--article-size', '16px');
    look.style.setProperty('color', 'red');
    notes.setVars(look);
    expect(notes.host.getAttribute('style')).toBe('--article-size: 16px');
    notes.setVars(look);
    const heights = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(18);
    expect(notes.heightsOf(['a', 'b', 'a'], 300)).toEqual({ head: 18, notes: [18, 18, 18] });
    const reads = heights.mock.calls.length;
    expect(notes.heightsOf(['b'], 300)).toEqual({ head: 18, notes: [18] });
    expect(heights.mock.calls.length).toBe(reads);
    // Another width measures again.
    notes.heightsOf(['b'], 200);
    expect(heights.mock.calls.length).toBeGreaterThan(reads);
    heights.mockRestore();
  });

  it('takes itself away', () => {
    const { notes, parent } = notesOf();
    notes.destroy();
    made = [];
    expect(parent.children).toHaveLength(0);
  });
});
