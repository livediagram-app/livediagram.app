// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  NOTE_BAR_GAP,
  NOTE_BAR_SIZE,
  inNoNoteSpot,
  noteBarSpot,
  noteKeyOf,
  readWritingOf,
  readingPick,
} from './reading-pick';

const rect = (left: number, top: number, width: number, height: number) =>
  ({ left, top, width, height, right: left + width, bottom: top + height }) as DOMRect;
const SCREEN = { width: 1200, height: 800 };

afterEach(() => {
  document.body.innerHTML = '';
});

function writing(editable: boolean) {
  document.body.innerHTML = `<div class="article-flow" ${editable ? 'contenteditable="true"' : 'data-readonly=""'}
    data-article-flow="f"><h1>Title</h1><p id="p">Some words to note</p>
    <table><tbody><tr><td id="cell">In a cell</td></tr></tbody></table></div><p id="out">Outside</p>`;
}
const textOf = (id: string) => document.getElementById(id)!.firstChild!;
function pick(startId: string, endId = startId) {
  const range = document.createRange();
  range.setStart(textOf(startId), 0);
  range.setEnd(textOf(endId), 4);
  return range;
}

describe('the words a reader picked', () => {
  it('finds the writing being read that holds them, and none while it is edited', () => {
    writing(false);
    expect(readWritingOf(pick('p'))?.dataset.articleFlow).toBe('f');
    expect(readWritingOf(pick('p', 'out'))).toBeNull();
    writing(true);
    expect(readWritingOf(pick('p'))).toBeNull();
  });

  it('takes no note in the Title or a table’s cell', () => {
    writing(false);
    expect(inNoNoteSpot(pick('p'))).toBe(false);
    expect(inNoNoteSpot(pick('cell'))).toBe(true);
    const title = document.createRange();
    title.selectNodeContents(document.querySelector('h1')!);
    expect(inNoNoteSpot(title)).toBe(true);
  });

  it('is nothing with no words picked', () => {
    expect(readingPick(null)).toBeNull();
    expect(readingPick(document.getSelection())).toBeNull();
  });
});

describe('where the bar stands', () => {
  it('sits above the first line, centred on the words', () => {
    const spot = noteBarSpot(
      {
        first: rect(500, 300, 200, 20),
        last: rect(500, 300, 200, 20),
        whole: rect(500, 300, 200, 20),
      },
      SCREEN,
    );
    expect(spot).toEqual({
      x: 600 - NOTE_BAR_SIZE.width / 2,
      y: 300 - NOTE_BAR_GAP - NOTE_BAR_SIZE.height,
      below: false,
    });
  });

  it('goes under the last line with no room above, and never off the screen', () => {
    const spot = noteBarSpot(
      { first: rect(0, 10, 40, 20), last: rect(0, 60, 40, 20), whole: rect(0, 10, 40, 70) },
      SCREEN,
    );
    expect(spot).toEqual({ x: NOTE_BAR_GAP, y: 80 + NOTE_BAR_GAP, below: true });
    const right = noteBarSpot(
      {
        first: rect(1180, 400, 20, 20),
        last: rect(1180, 400, 20, 20),
        whole: rect(1180, 400, 20, 20),
      },
      SCREEN,
    );
    expect(right.x).toBe(SCREEN.width - NOTE_BAR_SIZE.width - NOTE_BAR_GAP);
  });
});

describe('the keys', () => {
  const key = (code: string, mods: Partial<KeyboardEvent>) =>
    ({
      code,
      altKey: false,
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      ...mods,
    }) as KeyboardEvent;
  it('reads ⌘⌥M and ⌘⌥A on a Mac by the key’s place, Ctrl+Alt elsewhere', () => {
    expect(noteKeyOf(key('KeyM', { metaKey: true, altKey: true }), true)).toBe('comment');
    expect(noteKeyOf(key('KeyA', { metaKey: true, altKey: true }), true)).toBe('action');
    expect(noteKeyOf(key('KeyM', { ctrlKey: true, altKey: true }), false)).toBe('comment');
    expect(noteKeyOf(key('KeyM', { ctrlKey: true, altKey: true }), true)).toBeNull();
    expect(noteKeyOf(key('KeyM', { metaKey: true }), true)).toBeNull();
    expect(
      noteKeyOf(key('KeyM', { metaKey: true, altKey: true, shiftKey: true }), true),
    ).toBeNull();
    expect(noteKeyOf(key('KeyB', { metaKey: true, altKey: true }), true)).toBeNull();
  });
});
