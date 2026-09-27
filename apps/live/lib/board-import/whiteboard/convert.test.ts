// @vitest-environment jsdom
import { isValidElement } from '@livediagram/diagram';
import { describe, expect, it } from 'vitest';
import { anchor, boardHtml, inkGroup, inkStroke } from './__fixtures__/board-markup';
import { readBoard } from './canvas';
import { convertBoard } from './convert';
import { isStrokeDraft } from './fit';

const read = (anchors: string[]) => {
  const board = readBoard(new DOMParser().parseFromString(boardHtml(anchors), 'text/html'));
  if (!board.ok) throw new Error(board.refusal);
  return board;
};

const pen = (id: string, y: number, width = 2) =>
  inkStroke(id, {
    points: [
      { x: 0, y },
      { x: 50, y },
    ],
    width,
    rgba: [0, 0, 0, 1],
  });

describe('convertBoard', () => {
  it('turns every ink stroke into a stroke draft, counted per pen', () => {
    const board = read([
      anchor({
        apikey: 'ink1',
        left: 300,
        top: 200,
        content: inkGroup([pen('a', 0), pen('b', 10)]),
      }),
      anchor({
        apikey: 'ink2',
        left: 300,
        top: 400,
        content: inkGroup([
          inkStroke('h', {
            points: [
              { x: 0, y: 0 },
              { x: 60, y: 0 },
            ],
            width: 14,
            rgba: [255, 230, 0, 0.5],
            highlighter: true,
          }),
        ]),
      }),
    ]);
    const { items, tally } = convertBoard(board);
    expect(items.filter(isStrokeDraft)).toHaveLength(3);
    expect(tally.rows).toEqual([
      { kind: 'pen-stroke', imported: 2, degraded: {}, skipped: 0 },
      { kind: 'highlighter-stroke', imported: 1, degraded: {}, skipped: 0 },
    ]);
  });

  it('moves the board so its content starts at the origin', () => {
    const board = read([
      anchor({ apikey: 'ink', left: 300, top: 200, content: inkGroup([pen('a', 0)]) }),
    ]);
    const { items } = convertBoard(board);
    const draft = items.find(isStrokeDraft)!;
    const minX = Math.min(...draft.raw.map((p) => p.x));
    const minY = Math.min(...draft.raw.map((p) => p.y));
    expect([minX, minY]).toEqual([0, 0]);
  });

  it('counts degradations under their pen', () => {
    const board = read([
      anchor({ apikey: 'ink', left: 0, top: 0, content: inkGroup([pen('a', 0, 20)]) }),
    ]);
    expect(convertBoard(board).tally.rows).toEqual([
      { kind: 'pen-stroke', imported: 1, degraded: { 'width-clamped': 1 }, skipped: 0 },
    ]);
  });

  it('skips items it does not read yet, named by their Whiteboard kind', () => {
    const board = read([
      anchor({ apikey: 'l', type: 'LoopComponent', left: 0, top: 0, content: '<div></div>' }),
      anchor({ apikey: 'u', left: 0, top: 0, content: '<div></div>' }),
      anchor({ apikey: 'ink', left: 0, top: 0, content: inkGroup([pen('a', 0)]) }),
    ]);
    expect(convertBoard(board).tally.rows).toEqual([
      { kind: 'LoopComponent', imported: 0, degraded: {}, skipped: 1 },
      { kind: 'unknown', imported: 0, degraded: {}, skipped: 1 },
      { kind: 'pen-stroke', imported: 1, degraded: {}, skipped: 0 },
    ]);
  });

  it('keeps the board colour when it is not white', () => {
    const doc = new DOMParser().parseFromString(
      boardHtml([anchor({ apikey: 'ink', left: 0, top: 0, content: inkGroup([pen('a', 0)]) })], {
        background: '#1e293b',
      }),
      'text/html',
    );
    const board = readBoard(doc);
    if (!board.ok) throw new Error(board.refusal);
    expect(convertBoard(board).backgroundColor).toBe('#1e293b');
    expect(
      convertBoard(
        read([anchor({ apikey: 'i', left: 0, top: 0, content: inkGroup([pen('a', 0)]) })]),
      ).backgroundColor,
    ).toBeUndefined();
  });

  it('produces only valid elements once built', async () => {
    const { buildStroke } = await import('./fit');
    const board = read([
      anchor({
        apikey: 'ink',
        left: 10,
        top: 10,
        content: inkGroup([pen('a', 0), pen('b', 5, 30)]),
      }),
    ]);
    for (const item of convertBoard(board).items) {
      const el = isStrokeDraft(item) ? buildStroke(item, 0.35) : item;
      expect(isValidElement(el)).toBe(true);
    }
  });
});
