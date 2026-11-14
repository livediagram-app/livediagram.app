// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  articlesOf,
  layOutPages,
  newArticleNote,
  pagesOf,
  type ArticleBlock,
  type ArticleZoneBlock,
  type Element,
  type Tab,
} from '@livedocuments/document';
import {
  beginCanvasGesture,
  resetCanvasGesturesForTests,
} from '@liveworkspace/workbench/lib/canvas-gesture';
import { useArticleIntake } from './useArticleIntake';

const ctl = vi.hoisted(() => ({
  handle: null as null | {
    insertZone: ReturnType<typeof vi.fn>;
    moveZone: ReturnType<typeof vi.fn>;
  },
  released: false,
}));
const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));
vi.mock('@/lib/article/article-editor-store', () => ({
  articleHandleOf: () => ctl.handle,
  takeZoneReleased: () => ctl.released,
  forgetZonesReleased: vi.fn(),
}));

// docs/specs/007-editor/article-pages.md "Zones" and blueprints/article-pages.md "Zones", step 6: what the
// intake settles after this person's edit, through the hook as the editor runs it.
const para: ArticleBlock = { id: 'p', type: 'paragraph', runs: [{ text: 'Hello' }] };
const objectZone = (over: Partial<ArticleZoneBlock> = {}): ArticleZoneBlock => ({
  id: 'z',
  type: 'zone',
  zone: 'object',
  width: 100,
  height: 100,
  at: { page: 'a1', x: 100, y: 100 },
  ...over,
});
const tabOf = (
  elements: Element[],
  blocks: ArticleBlock[] = [para, objectZone()],
  extra: Partial<Tab> = {},
): Tab =>
  ({
    id: 't',
    name: 'Tab',
    elements,
    pages: [
      { id: 'a1', orientation: 'portrait', kind: 'article', flow: 'a' },
      { id: 'a2', orientation: 'portrait', kind: 'article', flow: 'a' },
    ],
    articles: { a: { blocks } },
    ...extra,
  }) as unknown as Tab;

const laid = layOutPages(pagesOf(tabOf([])));
const p1 = laid[0]!.rect;
const p2 = laid[1]!.rect;
const image = (id: string, x: number, y: number, w = 100, h = 100): Element => ({
  id,
  type: 'image',
  imageId: 'img',
  x,
  y,
  width: w,
  height: h,
});
const arrow = (id: string, x: number, y: number): Element => ({
  id,
  type: 'arrow',
  from: { kind: 'free', x, y },
  to: { kind: 'free', x: x + 40, y },
});
const inZone = image('o', p1.x + 100, p1.y + 100);

type Opts = { on?: boolean; editable?: boolean; withPages?: boolean };
function run(before: Tab, after: Tab, opts: Opts = {}, seq: number | null = 1) {
  const pages = layOutPages(pagesOf(before));
  const localEditSeq: { current: number } = { current: 0 };
  const tickTabs = vi.fn();
  const props = (tab: Tab) => ({
    activeTab: tab,
    on: opts.on ?? true,
    editable: opts.editable ?? true,
    pages: opts.withPages === false ? null : pages,
    localEditSeq,
    tickTabs,
  });
  const hook = renderHook((tab: Tab) => useArticleIntake(props(tab)), { initialProps: before });
  localEditSeq.current = (seq ?? undefined) as number;
  hook.rerender(after);
  const apply = (ts: Tab[]): Tab[] => (tickTabs.mock.calls.at(-1)![0] as (t: Tab[]) => Tab[])(ts);
  return { tickTabs, apply, hook, localEditSeq, props };
}

beforeEach(() => {
  ctl.handle = { insertZone: vi.fn(), moveZone: vi.fn() };
  ctl.released = false;
  track.mockClear();
});
afterEach(resetCanvasGesturesForTests);

describe('when the intake settles at all', () => {
  const before = tabOf([inZone]);
  const after = tabOf([inZone, arrow('x', p1.x + 700, p1.y + 700)]);

  it('does nothing for a view, a read-only tab, a tab not laid out, or a different tab', () => {
    for (const opts of [{ on: false }, { editable: false }, { withPages: false }]) {
      expect(run(before, after, opts).tickTabs).not.toHaveBeenCalled();
    }
    const other = { ...after, id: 'other' };
    expect(run(before, other).tickTabs).not.toHaveBeenCalled();
  });

  it('does nothing for a change that is not this person edit, or one that changed nothing', () => {
    expect(run(before, after, {}, 0).tickTabs).not.toHaveBeenCalled();
    const same = { ...before };
    expect(run(before, same).tickTabs).not.toHaveBeenCalled();
    // An edit sequence the editor has not set counts as zero.
    expect(run(before, after, {}, null).tickTabs).not.toHaveBeenCalled();
  });

  it('settles at the end of an element gesture, measured from its start', () => {
    const pages = layOutPages(pagesOf(before));
    const tickTabs = vi.fn();
    const seq = { current: 0 };
    const gone = tabOf([]);
    const { rerender } = renderHook(
      (tab: Tab) =>
        useArticleIntake({
          activeTab: tab,
          on: true,
          editable: true,
          pages,
          localEditSeq: seq,
          tickTabs,
        }),
      { initialProps: before },
    );
    let end = () => {};
    act(() => {
      end = beginCanvasGesture('move');
    });
    // Frame by frame, nothing is settled.
    rerender(after);
    expect(tickTabs).not.toHaveBeenCalled();
    rerender(gone);
    act(() => end());
    // The object's zone has no object any more: the gesture counts as one edit.
    expect(tickTabs).toHaveBeenCalled();
  });
});

describe('an object dragged off its zone', () => {
  // Another element stands by, untouched.
  const bystander = arrow('by', p1.x + 600, p1.y + 900);
  const before = tabOf([inZone, bystander]);
  const dragged = tabOf([image('o', p2.x + 300, p2.y + 300), bystander]);
  const landedRes = (index: number) => ({
    id: 'z',
    blocks: [para, objectZone({ at: undefined })],
    index,
    x: 50,
    y: 70,
  });

  it('moves its zone to where it was dropped, and the object follows', () => {
    ctl.handle!.moveZone.mockReturnValue(landedRes(1));
    const { apply, tickTabs } = run(before, dragged);
    expect(ctl.handle!.moveZone).toHaveBeenCalledWith('z', expect.any(Object));
    expect(tickTabs).toHaveBeenCalledTimes(1);
    const out = apply([dragged])[0]!;
    const zone = articlesOf(out).a!.blocks.find((b) => b.id === 'z') as ArticleZoneBlock;
    expect(zone.at).toEqual({ page: 'a2', x: 50, y: 70 });
    const o = out.elements[0] as Extract<Element, { x: number }>;
    expect([o.x, o.y]).toEqual([p2.x + 50, p2.y + 70]);
    expect(out.elements[1]).toBe(bystander);
    expect(track).toHaveBeenCalledWith('Element', 'Changed', 'ArticleZoneMoved');
  });

  it('puts the object back into its zone when the writing does not move it', () => {
    ctl.handle!.moveZone.mockReturnValue(null);
    const { apply } = run(before, dragged);
    const o = apply([dragged])[0]!.elements[0] as Extract<Element, { x: number }>;
    expect([o.x, o.y]).toEqual([p1.x + 100, p1.y + 100]);
    expect(track).not.toHaveBeenCalled();
  });

  it('puts it back too when the article has no editor open', () => {
    ctl.handle = null;
    const { apply } = run(before, dragged);
    const o = apply([dragged])[0]!.elements[0] as Extract<Element, { x: number }>;
    expect([o.x, o.y]).toEqual([p1.x + 100, p1.y + 100]);
  });

  it('leaves the object alone when its zone is gone from the tab it settles', () => {
    ctl.handle!.moveZone.mockReturnValue(null);
    const { apply } = run(before, dragged);
    const bare = tabOf([image('o', p2.x + 300, p2.y + 300)], [para]);
    expect(apply([bare])[0]!.elements[0]).toBe(bare.elements[0]);
  });

  it('leaves a locked tab, a different tab and a held article as they are', () => {
    ctl.handle!.moveZone.mockReturnValue(landedRes(1));
    const { apply } = run(before, dragged);
    const locked = { ...dragged, locked: true } as Tab;
    const other = { ...dragged, id: 'other' };
    const out = apply([locked, other]);
    expect(out[0]).toBe(locked);
    expect(out[1]).toBe(other);
    // The same tabs back: the tick changes nothing.
    const ts = [locked, other];
    expect(apply(ts)).toBe(ts);

    const heldBefore = tabOf([inZone], undefined, {
      pages: [
        { id: 'a1', orientation: 'portrait', kind: 'article', flow: 'a', locked: true },
        { id: 'a2', orientation: 'portrait', kind: 'article', flow: 'a' },
      ],
    });
    const heldDragged = { ...dragged, pages: heldBefore.pages } as Tab;
    ctl.handle!.moveZone.mockClear();
    run(heldBefore, heldDragged);
    expect(ctl.handle!.moveZone).not.toHaveBeenCalled();
  });
});

describe('a zone that left the writing', () => {
  const before = tabOf([inZone]);
  const after = tabOf([inZone], [para]);

  it('takes its elements with it', () => {
    const { apply } = run(before, after);
    expect(apply([after])[0]!.elements).toEqual([]);
  });

  it('keeps them when the zone was let go (Float), or the article is gone', () => {
    ctl.released = true;
    const floated = run(before, after);
    expect(floated.tickTabs).not.toHaveBeenCalled();
    ctl.released = false;
    const noArticle = { ...after, articles: {} } as Tab;
    const { apply } = run(before, noArticle);
    expect(apply([noArticle])[0]!.elements).toEqual([]);
  });
});

describe('margin notes whose marker or text was deleted', () => {
  const marker = newArticleNote('n1', 'comment', { x: p1.x + 700, y: p1.y + 700 }) as Element;
  const noted: ArticleBlock = {
    id: 'p',
    type: 'paragraph',
    runs: [{ text: 'Hello', note: 'n1' }],
  };

  it('leaves the text untinted when its marker is deleted', () => {
    const before = tabOf([marker], [noted]);
    const after = tabOf([], [noted]);
    const { apply } = run(before, after);
    const out = apply([after])[0]!;
    expect(JSON.stringify(articlesOf(out))).not.toContain('"note"');
  });

  it('takes the marker with the text that carried the note', () => {
    const before = tabOf([marker], [noted]);
    const after = tabOf([marker], [para]);
    const { apply } = run(before, after);
    expect(apply([after])[0]!.elements).toEqual([]);
  });
});

describe('elements added onto an article page', () => {
  const spot = { x: p1.x + 600, y: p1.y + 600 };
  const res = {
    id: 'new',
    blocks: [para, objectZone({ id: 'new', at: undefined })],
    index: 0,
    x: 60,
    y: 80,
  };

  it('takes a picture into a new object zone, and counts it', () => {
    ctl.handle!.insertZone.mockReturnValue(res);
    const after = tabOf([image('pic', spot.x, spot.y, 200, 100)], [para]);
    const { apply } = run(tabOf([], [para]), after);
    expect(ctl.handle!.insertZone).toHaveBeenCalledTimes(1);
    const out = apply([after])[0]!;
    const zone = articlesOf(out).a!.blocks.find((b) => b.id === 'new') as ArticleZoneBlock;
    expect(zone.at).toEqual({ page: 'a1', x: 60, y: 80 });
    expect(track).toHaveBeenCalledWith('Element', 'Added', 'ArticleObject');
  });

  it('takes arrows into a drawing zone, and counts it', () => {
    ctl.handle!.insertZone.mockReturnValue({
      ...res,
      blocks: [para, objectZone({ id: 'new', zone: 'drawing', at: undefined })],
    });
    const after = tabOf([arrow('a1', spot.x, spot.y), arrow('a2', spot.x, spot.y + 40)], [para]);
    run(tabOf([], [para]), after);
    expect(track).toHaveBeenCalledWith('Element', 'Added', 'ArticleDrawing');
  });

  it('leaves the elements loose when the article is gone by the time the zone lands', () => {
    ctl.handle!.insertZone.mockReturnValue(res);
    const after = tabOf([image('pic', spot.x, spot.y)], [para]);
    const { apply } = run(tabOf([], [para]), after);
    const gone = { ...after, pages: [] } as unknown as Tab;
    expect(apply([gone])[0]!.elements).toEqual(after.elements);
  });

  it('does nothing when the writing has no editor open, or declines the zone', () => {
    const after = tabOf([image('pic', spot.x, spot.y)], [para]);
    ctl.handle = null;
    expect(run(tabOf([], [para]), after).tickTabs).not.toHaveBeenCalled();
    ctl.handle = { insertZone: vi.fn().mockReturnValue(null), moveZone: vi.fn() };
    expect(run(tabOf([], [para]), after).tickTabs).not.toHaveBeenCalled();
  });

  it('settles writing without a zone in step with writing that holds one', () => {
    const second = { id: 'b1', orientation: 'portrait', kind: 'article', flow: 'b' };
    const withTwo = (elements: Element[]) =>
      tabOf(elements, [para, objectZone()], {
        pages: [...pagesOf(tabOf([])), second],
        articles: {
          a: { blocks: [para, objectZone()] },
          b: { blocks: [para] },
        },
      } as Partial<Tab>);
    const after = withTwo([{ ...inZone, x: p1.x + 120 } as Element]);
    const { apply } = run(withTwo([inZone]), after);
    const out = apply([after])[0]!;
    expect((out.elements[0] as Extract<Element, { x: number }>).x).toBe(p1.x + 100);
    expect(articlesOf(out).b!.blocks).toEqual([para]);
  });
});
