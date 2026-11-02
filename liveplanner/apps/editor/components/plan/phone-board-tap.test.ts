// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { centreTappedColumn, centredScrollLeft, tappedColumn } from './phone-board';

// docs/specs/026-plan/plan-board.md "On a phone": a tap on a column's empty space glides it to the centre.
const ATTR = 'data-plan-column';

function board(): HTMLElement {
  document.body.innerHTML = `
    <div id="body">
      <div data-plan-column="todo" id="head"><span id="name">To Do</span><button id="cog">cog</button></div>
      <div data-plan-column="todo" id="cell">
        <div role="list"><div data-plan-card="c1"><span id="title">A card</span></div></div>
        <button id="add">Add card</button>
        <input id="field" />
      </div>
      <div id="outside"></div>
    </div>`;
  return document.getElementById('body')!;
}
const el = (id: string) => document.getElementById(id);

describe('tappedColumn', () => {
  it("finds the column for a tap on its cell's empty space or its header", () => {
    board();
    expect(tappedColumn(el('cell'), ATTR)).toBe('todo');
    expect(tappedColumn(el('name'), ATTR)).toBe('todo');
  });

  it('ignores a tap on a card, a button or a field, and one outside every column', () => {
    board();
    for (const id of ['title', 'cog', 'add', 'field', 'outside']) {
      expect(tappedColumn(el(id), ATTR)).toBeNull();
    }
    expect(tappedColumn(null, ATTR)).toBeNull();
  });
});

describe('centredScrollLeft', () => {
  const body = { left: 0, scrollLeft: 0, clientWidth: 390, scrollWidth: 1300 };
  it("puts the column's centre at the view's centre", () => {
    // A 302 px column starting at 400 px: its centre (551) to the view's (195).
    expect(centredScrollLeft(body, { left: 400, width: 302 })).toBe(356);
  });
  it('never scrolls past either end', () => {
    expect(centredScrollLeft(body, { left: 12, width: 302 })).toBe(0);
    expect(centredScrollLeft(body, { left: 2000, width: 302 })).toBe(910);
  });
});

describe('centreTappedColumn', () => {
  afterEach(() => vi.restoreAllMocks());

  function setUp(reduce: boolean) {
    const body = board();
    Object.defineProperties(body, {
      clientWidth: { value: 390 },
      scrollWidth: { value: 1300 },
    });
    body.scrollTo = vi.fn();
    vi.spyOn(body, 'getBoundingClientRect').mockReturnValue({ left: 0 } as DOMRect);
    vi.spyOn(el('head')!, 'getBoundingClientRect').mockReturnValue({
      left: 400,
      width: 302,
    } as DOMRect);
    window.matchMedia = vi.fn().mockReturnValue({ matches: reduce }) as never;
    return body;
  }

  it('glides across only, never giving a top, so the board keeps its place down the column', () => {
    const body = setUp(false);
    expect(centreTappedColumn(el('cell'), body, ATTR)).toBe(true);
    expect(body.scrollTo).toHaveBeenCalledWith({ left: 356, behavior: 'smooth' });
  });

  it('jumps under reduced motion', () => {
    const body = setUp(true);
    centreTappedColumn(el('cell'), body, ATTR);
    expect(body.scrollTo).toHaveBeenCalledWith({ left: 356, behavior: 'auto' });
  });

  it('leaves a tap on a card or a control alone', () => {
    const body = setUp(false);
    expect(centreTappedColumn(el('title'), body, ATTR)).toBe(false);
    expect(centreTappedColumn(el('add'), body, ATTR)).toBe(false);
    expect(body.scrollTo).not.toHaveBeenCalled();
  });
});
