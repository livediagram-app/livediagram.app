// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { anchor, boardHtml, inkGroup, inkStroke } from './__fixtures__/board-markup';
import { apply } from './matrix';
import { isWhiteboardCanvas, readBoard } from './canvas';

const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html');

const stroke = inkStroke('s1', {
  points: [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
  ],
  width: 2,
  rgba: [0, 0, 0, 1],
});

describe('isWhiteboardCanvas', () => {
  it('recognises the export by its canvas content and anchors', () => {
    const doc = parse(
      boardHtml([anchor({ apikey: 'a', left: 0, top: 0, content: inkGroup([stroke]) })]),
    );
    expect(isWhiteboardCanvas(doc)).toBe(true);
  });

  it('rejects other HTML', () => {
    expect(isWhiteboardCanvas(parse('<html><body><div class="anchor">x</div></body></html>'))).toBe(
      false,
    );
  });
});

describe('readBoard', () => {
  it('reads anchors in stacking order with their ids and kinds', () => {
    const doc = parse(
      boardHtml([
        anchor({ apikey: 'k1', type: 'Note', left: 0, top: 0, content: '<p>a</p>' }),
        anchor({ apikey: 'k2', left: 5, top: 5, content: inkGroup([stroke]) }),
      ]),
    );
    const board = readBoard(doc);
    if (!board.ok) throw new Error(board.refusal);
    expect(board.items.map((i) => [i.id, i.kind])).toEqual([
      ['k1', 'Note'],
      ['k2', null],
    ]);
  });

  it('places an anchor by left, top and its matrix, origin at its corner', () => {
    const doc = parse(
      boardHtml([
        anchor({
          apikey: 'k1',
          left: 100,
          top: 200,
          transform: 'matrix(2, 0, 0, 2, -10, -20)',
          content: '<p>a</p>',
        }),
      ]),
    );
    const board = readBoard(doc);
    if (!board.ok) throw new Error(board.refusal);
    expect(apply(board.items[0]!.matrix, { x: 10, y: 10 })).toEqual({ x: 110, y: 200 });
  });

  it('mints an id for an anchor without one', () => {
    const doc = parse(
      boardHtml([
        '<div class="anchor canvasChildElement" style="left: 1px; top: 2px;"><div class="canvasChild"></div></div>',
      ]),
    );
    const board = readBoard(doc);
    expect(board.ok && board.items[0]!.id).toBe('item-1');
  });

  it('reads the board colour from the background', () => {
    const doc = parse(
      boardHtml([anchor({ apikey: 'a', left: 0, top: 0, content: '<p>a</p>' })], {
        background: '#fdf6e3',
      }),
    );
    const board = readBoard(doc);
    expect(board.ok && board.background).toBe('#fdf6e3');
  });

  it('reads an anchor nested in another as part of its parent, not as a board item', () => {
    const inner = anchor({ apikey: 'inner', type: 'Note', left: 0, top: 0, content: '<p>n</p>' });
    const doc = parse(boardHtml([anchor({ apikey: 'outer', left: 0, top: 0, content: inner })]));
    const board = readBoard(doc);
    expect(board.ok && board.items.map((i) => i.id)).toEqual(['outer']);
  });

  it('refuses a canvas with no items as empty', () => {
    const doc = parse(boardHtml([]));
    expect(readBoard(doc)).toEqual({ ok: false, refusal: 'empty-board' });
  });

  it('refuses a document that is not a Whiteboard canvas', () => {
    expect(readBoard(parse('<html><body><p>hi</p></body></html>'))).toEqual({
      ok: false,
      refusal: 'not-whiteboard',
    });
  });
});
