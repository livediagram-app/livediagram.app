// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { canNoteHere, selectionNoteVerb, setSelectionNoteEntry } from './selection-note-entry';

let unregister = () => {};
afterEach(() => unregister());

describe('the selection menu’s note entry', () => {
  const writing = document.createElement('div');

  it('offers nothing in an app that registered none', () => {
    expect(canNoteHere(writing)).toBe(false);
    expect(selectionNoteVerb(writing, 'comment')).toBeNull();
  });

  it('offers the verbs only while the app says these words may take a note', () => {
    const note = vi.fn();
    let may = true;
    unregister = setSelectionNoteEntry({ canNote: () => may, note });
    expect(canNoteHere(writing)).toBe(true);
    selectionNoteVerb(writing, 'action')!();
    expect(note).toHaveBeenCalledWith('action', writing);
    may = false;
    expect(selectionNoteVerb(writing, 'comment')).toBeNull();
  });

  it('is taken away by its own unregister, never by a stale one', () => {
    const first = setSelectionNoteEntry({ canNote: () => true, note: vi.fn() });
    unregister = setSelectionNoteEntry({ canNote: () => true, note: vi.fn() });
    first();
    expect(canNoteHere(writing)).toBe(true);
    unregister();
    expect(canNoteHere(writing)).toBe(false);
  });
});
