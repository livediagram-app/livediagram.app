import { describe, expect, it } from 'vitest';
import {
  MAX_ELEMENTS_PER_TAB,
  isValidElement,
  type ArrowElement,
  type Element,
} from '@livediagram/document';
import { LANDING_RULES } from './context';
import { landBoardScene, type LandOptions } from './land';
import type { SceneItem } from './scene';
import { boardScene, countingIds, inkStroke, sceneText } from './test-scenes';

// docs/specs/020-import-export/board-scene.md: the landing as a whole.
const options = (over: Partial<LandOptions> = {}): LandOptions => ({
  profile: 'whiteboard',
  placement: { kind: 'origin' },
  mintId: countingIds(),
  ...over,
});
const rect = (key: string, x = 0, over: Partial<SceneItem> = {}): SceneItem =>
  ({
    key,
    kind: 'shape',
    shape: 'rectangle',
    x,
    y: 0,
    width: 100,
    height: 50,
    stroke: inkStroke(),
    ...over,
  }) as SceneItem;
const arrow = (from?: string, to?: string): SceneItem => ({
  key: 'arrow',
  kind: 'connector',
  points: [
    { x: 100, y: 25 },
    { x: 300, y: 25 },
  ],
  stroke: inkStroke(),
  heads: { end: 'arrow' },
  from,
  to,
});

function landed(items: SceneItem[], over: Partial<LandOptions> = {}) {
  const r = landBoardScene(boardScene(items), options(over));
  if (!r.ok) throw new Error(r.message);
  return r;
}

describe('landBoardScene', () => {
  it('keeps the scene’s order, arrows among the rest, every element valid', () => {
    const r = landed([
      rect('a'),
      arrow('a', 'b'),
      rect('b', 300),
      {
        key: 't',
        kind: 'text',
        x: 0,
        y: 90,
        width: 40,
        height: 20,
        autoWidth: true,
        text: sceneText('Hi'),
      },
    ]);
    expect(r.elements.map((e) => e.type)).toEqual(['shape', 'arrow', 'shape', 'text']);
    expect(r.elements.every(isValidElement)).toBe(true);
  });

  it('mints fresh ids and pins arrows through the key map', () => {
    const r = landed([rect('a'), arrow('a', 'b'), rect('b', 300)]);
    const ids = r.elements.map((e) => e.id);
    expect(new Set(ids).size).toBe(3);
    expect(ids.every((id) => id.startsWith('id-'))).toBe(true);
    const a = r.elements[1] as ArrowElement;
    expect(a.from).toMatchObject({ kind: 'pinned', elementId: r.elements[0]!.id });
    expect(a.to).toMatchObject({ kind: 'pinned', elementId: r.elements[2]!.id });
  });

  it('keeps locks, safe links and rotation on boxes', () => {
    const r = landed([
      rect('a', 0, { locked: true, link: 'https://example.com', rotationDeg: -45 }),
    ]);
    expect(r.elements[0]).toMatchObject({
      locked: true,
      link: { kind: 'url', url: 'https://example.com' },
      rotation: 315,
    });
  });

  it('skips items without usable geometry and counts them', () => {
    const r = landed([
      rect('a', 0, { width: 0 }),
      rect('b', Number.NaN),
      { key: 'c', kind: 'ink', points: [], stroke: inkStroke() },
      { key: 'd', kind: 'connector', points: [{ x: 0, y: 0 }], stroke: inkStroke(), heads: {} },
      {
        key: 'e',
        kind: 'text',
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        autoWidth: true,
        text: sceneText(' '),
      },
      rect('ok'),
    ]);
    expect(r.elements).toHaveLength(1);
    expect(r.report.skipped).toEqual([
      { rule: LANDING_RULES.unsized, count: 4 },
      { rule: LANDING_RULES.emptyText, count: 1 },
    ]);
    expect(r.report.landed).toEqual({ shape: 1 });
  });

  it('counts what landed per kind and merges the parser’s notes with its own', () => {
    const scene = boardScene(
      [
        rect('a'),
        {
          key: 'i',
          kind: 'ink',
          points: [
            { x: 0, y: 0 },
            { x: 5, y: 5 },
          ],
          stroke: inkStroke({ stops: [{ hex: '#e03131' }] }),
        },
        {
          key: 'j',
          kind: 'ink',
          points: [
            { x: 0, y: 0 },
            { x: 5, y: 5 },
          ],
          stroke: inkStroke({ stops: [{ hex: '#e03131' }] }),
        },
      ],
      {
        notes: [
          { rule: 'Groups were dropped', count: 2 },
          { rule: LANDING_RULES.multicolourInk, count: 1 },
          { rule: 'Embeds were skipped', count: 3, kind: 'skipped' },
        ],
      },
    );
    const r = landBoardScene(scene, options());
    if (!r.ok) throw new Error('rejected');
    expect(r.report).toEqual({
      landed: { shape: 1, ink: 2 },
      degraded: [
        { rule: 'Groups were dropped', count: 2 },
        { rule: LANDING_RULES.multicolourInk, count: 3 },
      ],
      skipped: [{ rule: 'Embeds were skipped', count: 3 }],
    });
  });

  it('collects one image request per image', () => {
    const scene = boardScene(
      [
        { key: 'p', kind: 'image', x: 0, y: 0, width: 10, height: 10, asset: 'f' },
        { key: 'q', kind: 'image', x: 20, y: 0, width: 10, height: 10, asset: 'f' },
      ],
      { assets: [{ key: 'f', source: { kind: 'data-url', dataUrl: 'data:image/png;base64,AA' } }] },
    );
    const r = landBoardScene(scene, options());
    if (!r.ok) throw new Error('rejected');
    expect(r.imageRequests.map((q) => [q.elementId, q.key])).toEqual([
      [r.elements[0]!.id, 'f'],
      [r.elements[1]!.id, 'f'],
    ]);
  });

  it('centres the scene on a point', () => {
    const r = landed([rect('a', 0), rect('b', 300)], {
      placement: { kind: 'at', x: 1000, y: 1000 },
    });
    const [a, b] = r.elements as (Element & { x: number; y: number })[];
    expect(a!.x).toBe(800);
    expect(b!.x).toBe(1100);
    expect(a!.y).toBe(975);
  });

  it('keeps the scene’s coordinates at the origin', () => {
    const r = landed([rect('a', 40)]);
    expect((r.elements[0] as { x: number }).x).toBe(40);
  });

  it('refuses a scene with more items than the tab has room for, at the boundary', () => {
    const items = (n: number) => Array.from({ length: n }, (_, i) => rect(`r${i}`, i * 10));
    expect(landBoardScene(boardScene(items(3)), options({ room: 3 })).ok).toBe(true);
    const r = landBoardScene(boardScene(items(4)), options({ room: 3 }));
    expect(r).toEqual({
      ok: false,
      rejection: 'too-many-elements',
      message: 'This board has more than the 10,000 elements a tab can hold.',
    });
    expect(landBoardScene(boardScene(items(MAX_ELEMENTS_PER_TAB + 1)), options()).ok).toBe(false);
  });

  it('lands an empty scene as nothing', () => {
    const r = landed([]);
    expect(r.elements).toEqual([]);
    expect(r.report).toEqual({ landed: {}, degraded: [], skipped: [] });
  });
});

describe('the tab patch', () => {
  it('makes a whiteboard named after the scene, its pattern kept', () => {
    const r = landBoardScene(
      boardScene([], { title: ' Retro ', background: { pattern: 'dots' } }),
      options(),
    );
    expect(r.ok && r.tabPatch).toEqual({
      kind: 'whiteboard',
      name: 'Retro',
      backgroundPattern: 'grid',
    });
  });

  it('starts an untitled whiteboard on Grid as "Whiteboard"', () => {
    const r = landBoardScene(boardScene([]), options());
    expect(r.ok && r.tabPatch).toEqual({
      kind: 'whiteboard',
      name: 'Whiteboard',
      backgroundPattern: 'graph',
    });
  });

  it('gives a diagram tab the scene’s background colour', () => {
    const r = landBoardScene(
      boardScene([], { background: { colour: { hex: '#fff9db' } } }),
      options({ profile: 'diagram' }),
    );
    expect(r.ok && r.tabPatch).toEqual({ name: 'Whiteboard', backgroundColor: '#fff9db' });
  });
});
