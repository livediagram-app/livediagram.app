import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  buildOf,
  nextBuildOrder,
  presentedBuild,
  slideBuildOrders,
  stepBuild,
  takesBuild,
  withBuild,
  slideElementsOf,
  buildStepsOfTab,
  badgedBuildSteps,
  type ElementBuild,
} from './slide-builds';
import type { ArrowElement, Element, Page, ShapeElement, Tab } from './index';
import { layOutPages } from './page-layout';

const shape = (id: string, build?: ElementBuild | Record<string, unknown>): ShapeElement =>
  ({
    id,
    type: 'shape',
    shape: 'square',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    ...(build ? { build } : {}),
  }) as ShapeElement;

const arrow = (
  id: string,
  from: string,
  to: string,
  toKind: 'pinned' | 'on-arrow' | 'free' = 'pinned',
): ArrowElement =>
  ({
    id,
    type: 'arrow',
    from: { kind: 'pinned', elementId: from, anchor: 'right' },
    to:
      toKind === 'pinned'
        ? { kind: 'pinned', elementId: to, anchor: 'left' }
        : toKind === 'on-arrow'
          ? { kind: 'on-arrow', arrowId: to, t: 0.5 }
          : { kind: 'free', x: 0, y: 0 },
  }) as unknown as ArrowElement;

const ids = (els: readonly Element[]) => els.map((e) => e.id);

describe('buildOf', () => {
  it('reads a build and is lenient on a bad one', () => {
    expect(buildOf(shape('a', { order: 2, effect: 'rise' }))).toEqual({ order: 2, effect: 'rise' });
    expect(buildOf(shape('a', { order: 1, effect: 'spin' }))).toEqual({
      order: 1,
      effect: 'appear',
    });
    expect(buildOf(shape('a', { order: 0, effect: 'fade' }))).toBeUndefined();
    expect(buildOf(shape('a', { order: 1.5, effect: 'fade' }))).toBeUndefined();
    expect(buildOf(shape('a', { order: '1', effect: 'fade' }))).toBeUndefined();
    expect(buildOf({ ...shape('a'), build: 'fade' } as unknown as Element)).toBeUndefined();
    expect(buildOf(shape('a'))).toBeUndefined();
  });

  it('never reads one on an arrow or a margin note', () => {
    const a = { ...arrow('x', 'a', 'b'), build: { order: 1, effect: 'fade' } } as Element;
    expect(buildOf(a)).toBeUndefined();
    expect(takesBuild(a)).toBe(false);
    const note = { id: 'n', type: 'article-note', build: { order: 1, effect: 'fade' } };
    expect(buildOf(note as unknown as Element)).toBeUndefined();
    expect(takesBuild(shape('a'))).toBe(true);
  });
});

describe('slideBuildOrders and nextBuildOrder', () => {
  it('lists distinct orders lowest first, gaps meaning nothing', () => {
    const els = [
      shape('a', { order: 9, effect: 'fade' }),
      shape('b'),
      shape('c', { order: 1, effect: 'rise' }),
      shape('d', { order: 4, effect: 'appear' }),
      shape('e', { order: 4, effect: 'fade' }),
    ];
    expect(slideBuildOrders(els)).toEqual([1, 4, 9]);
    expect(nextBuildOrder(els)).toBe(10);
    expect(nextBuildOrder([shape('a')])).toBe(1);
  });
});

describe('withBuild', () => {
  it('sets and removes a build, leaving an arrow as it is', () => {
    const set = withBuild(shape('a'), { order: 3, effect: 'fade' });
    expect(set.build).toEqual({ order: 3, effect: 'fade' });
    expect('build' in withBuild(set, null)).toBe(false);
    const a = arrow('x', 'a', 'b');
    expect(withBuild(a, { order: 1, effect: 'fade' })).toBe(a);
  });
});

describe('presentedBuild', () => {
  const slide = [
    shape('title'),
    shape('one', { order: 1, effect: 'fade' }),
    shape('two', { order: 2, effect: 'rise' }),
    shape('three', { order: 3, effect: 'appear' }),
    arrow('one-two', 'one', 'two'),
    arrow('title-one', 'title', 'one'),
    arrow('free', 'title', '', 'free'),
    arrow('on-arrow', 'title', 'one-two', 'on-arrow'),
  ];

  it('shows the unbuilt elements first, then each build in turn', () => {
    expect(ids(presentedBuild(slide, 0).shown)).toEqual(['title', 'free']);
    expect(ids(presentedBuild(slide, 1).shown)).toEqual(['title', 'one', 'title-one', 'free']);
    expect(ids(presentedBuild(slide, 3).shown)).toEqual(ids(slide));
  });

  it('brings an arrow in with the later of its ends, and one pinned to it with it', () => {
    expect(ids(presentedBuild(slide, 0).entering)).toEqual([]);
    expect(ids(presentedBuild(slide, 1).entering)).toEqual(['one', 'title-one']);
    expect(ids(presentedBuild(slide, 2).entering)).toEqual(['two', 'one-two', 'on-arrow']);
    expect(ids(presentedBuild(slide, 3).entering)).toEqual(['three']);
  });

  it('clamps a step past the slide, and shows a slide with no builds whole', () => {
    expect(ids(presentedBuild(slide, 9).shown)).toEqual(ids(slide));
    expect(ids(presentedBuild(slide, -2).shown)).toEqual(['title', 'free']);
    const plain = [shape('a'), shape('b')];
    expect(presentedBuild(plain, 0)).toEqual({ shown: plain, entering: [] });
  });

  it('stays linear on a large slide', () => {
    const big: Element[] = [];
    for (let i = 0; i < 2000; i++)
      big.push(shape(`s${i}`, { order: (i % 50) + 1, effect: 'fade' }));
    for (let i = 1; i < 2000; i++) big.push(arrow(`a${i}`, `s${i - 1}`, `s${i}`));
    expect(cpuMsOf(() => presentedBuild(big, 25))).toBeLessThan(cpuBudgetMs(60));
  });
});

describe('stepBuild', () => {
  const at = (shown: number) => ({ slideId: 's', shown });

  it('presents three builds in four steps forward', () => {
    expect(stepBuild(at(0), 3, 1)).toEqual({ slideId: 's', shown: 1, entering: true });
    expect(stepBuild(at(2), 3, 1)).toEqual({ slideId: 's', shown: 3, entering: true });
    expect(stepBuild(at(3), 3, 1)).toBeNull();
  });

  it('takes builds back, then leaves', () => {
    expect(stepBuild(at(3), 3, -1)).toEqual({ slideId: 's', shown: 2, entering: false });
    expect(stepBuild(at(1), 3, -1)).toEqual({ slideId: 's', shown: 0, entering: false });
    expect(stepBuild(at(0), 3, -1)).toBeNull();
  });

  it('clamps a position a peer left past the slide', () => {
    expect(stepBuild(at(5), 2, -1)).toEqual({ slideId: 's', shown: 1, entering: false });
    expect(stepBuild(at(5), 2, 1)).toBeNull();
    expect(stepBuild(at(0), 0, 1)).toBeNull();
  });
});

describe('slideElementsOf', () => {
  it("answers the elements of the tab's first slide holding the element, else null", () => {
    const els = [shape('a'), shape('b'), shape('c')];
    const tab = { id: 't', name: 't', elements: els };
    const slides = [
      { id: 'other', tabId: 'u', elementIds: ['a'] },
      { id: 's1', tabId: 't', elementIds: ['a', 'b'] },
      { id: 's2', tabId: 't', elementIds: ['c'] },
    ];
    expect(ids(slideElementsOf(slides, tab, 'b')!)).toEqual(['a', 'b']);
    expect(ids(slideElementsOf(slides, tab, 'c')!)).toEqual(['c']);
    expect(slideElementsOf(slides, tab, 'zzz')).toBeNull();
  });
});

describe('buildStepsOfTab', () => {
  it("numbers each built element by its place among its slide's steps", () => {
    const els = [
      shape('a', { order: 4, effect: 'fade' }),
      shape('b', { order: 9, effect: 'fade' }),
      shape('c'),
      shape('d', { order: 2, effect: 'rise' }),
      shape('off', { order: 1, effect: 'rise' }),
    ];
    const tab = { id: 't', name: 't', elements: els };
    const slides = [
      { id: 'u', tabId: 'u', elementIds: ['a'] },
      { id: 's1', tabId: 't', elementIds: ['a', 'b', 'c'] },
      { id: 's2', tabId: 't', elementIds: ['a', 'd'] },
      { id: 's3', tabId: 't', elementIds: ['c'] },
    ];
    expect([...buildStepsOfTab(slides, tab)]).toEqual([
      ['a', 1],
      ['b', 2],
      ['d', 1],
    ]);
  });

  it('numbers the built elements on a page slide by the page under their centre', () => {
    const pages = [
      { id: 'p1', kind: 'slide', size: 'slide', orientation: 'landscape' },
      { id: 'p2', kind: 'slide', size: 'slide', orientation: 'landscape' },
    ] as Page[];
    const [r1, r2] = layOutPages(pages).map((p) => p.rect);
    const at = (id: string, r: { x: number; y: number }, order: number) => ({
      ...shape(id, { order, effect: 'fade' }),
      x: r.x + 10,
      y: r.y + 10,
    });
    const tab = {
      id: 't',
      name: 't',
      pages,
      elements: [
        at('a', r1!, 7),
        at('b', r1!, 3),
        at('c', r2!, 5),
        at('off', { x: -9e5, y: 0 }, 1),
      ],
    } as unknown as Tab;
    const slides = [
      { id: 's1', tabId: 't', elementIds: [], pageId: 'p1' },
      { id: 's2', tabId: 't', elementIds: [], pageId: 'p2' },
      { id: 's3', tabId: 't', elementIds: [], pageId: 'gone' },
    ];
    expect([...buildStepsOfTab(slides, tab)]).toEqual([
      ['a', 2],
      ['b', 1],
      ['c', 1],
    ]);
  });

  it('resolves no slide when nothing builds', () => {
    const tab = { id: 't', name: 't', elements: [shape('a')] };
    expect(buildStepsOfTab([{ id: 's', tabId: 't', elementIds: ['a'] }], tab).size).toBe(0);
  });

  it('shows one badge for elements overlapping at the same step, keeping the one drawn first', () => {
    const box = (id: string, x: number, y: number, w: number, h = w) => ({
      ...shape(id),
      x,
      y,
      width: w,
      height: h,
    });
    const els = [
      box('circle', 0, 0, 200),
      box('icon', 70, 70, 60),
      box('apart', 600, 0, 50),
      box('other-step', 10, 10, 20),
      box('wide', 0, 300, 5000, 40),
      box('under-wide', 4000, 310, 20),
      box('after-wide', 4500, 290, 20, 20),
      box('later-wide', 0, 330, 4000, 4000),
      box('far', 9000, 9000, 10),
      box('vast', 0, 9000, 4000, 4000),
      box('in-vast', 100, 9100, 20),
      box('unbuilt', 0, 0, 10),
    ];
    const steps = new Map([
      ['circle', 1],
      ['icon', 1],
      ['apart', 1],
      ['other-step', 2],
      ['wide', 3],
      ['under-wide', 3],
      ['after-wide', 3],
      ['later-wide', 3],
      ['far', 4],
      ['vast', 4],
      ['in-vast', 4],
    ]);
    expect([...badgedBuildSteps(steps, els)]).toEqual([
      ['circle', 1],
      ['apart', 1],
      ['other-step', 2],
      ['wide', 3],
      ['far', 4],
      ['vast', 4],
    ]);
    expect(badgedBuildSteps(new Map(), els).size).toBe(0);
  });

  it('files 2,000 badges within an edit budget', () => {
    const els: Element[] = [];
    for (let i = 0; i < 2000; i++)
      els.push({ ...shape(`e${i}`), x: (i % 50) * 120, y: Math.floor(i / 50) * 120 });
    const steps = new Map(els.map((e, i) => [e.id, (i % 3) + 1]));
    let shown = new Map<string, number>();
    const ms = cpuMsOf(() => {
      shown = badgedBuildSteps(steps, els);
    });
    expect(shown.size).toBe(2000);
    expect(ms).toBeLessThan(cpuBudgetMs(40));
  });

  it('numbers 2,000 elements across 40 slides within an edit budget', () => {
    const els: Element[] = [];
    for (let i = 0; i < 2000; i++) els.push(shape(`e${i}`, { order: (i % 5) + 1, effect: 'fade' }));
    const tab = { id: 't', name: 't', elements: els };
    const slides = Array.from({ length: 40 }, (_, s) => ({
      id: `s${s}`,
      tabId: 't',
      elementIds: els.slice(s * 50, s * 50 + 50).map((e) => e.id),
    }));
    let steps = new Map<string, number>();
    const ms = cpuMsOf(() => {
      steps = buildStepsOfTab(slides, tab);
    });
    expect(steps.size).toBe(2000);
    expect(ms).toBeLessThan(cpuBudgetMs(40));
  });
});
