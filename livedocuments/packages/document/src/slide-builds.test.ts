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
  type ElementBuild,
} from './slide-builds';
import type { ArrowElement, Element, ShapeElement } from './index';

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
    for (let i = 0; i < 2000; i++) big.push(shape(`s${i}`, { order: (i % 50) + 1, effect: 'fade' }));
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

  it('resolves no slide when nothing builds', () => {
    const tab = { id: 't', name: 't', elements: [shape('a')] };
    expect(buildStepsOfTab([{ id: 's', tabId: 't', elementIds: ['a'] }], tab).size).toBe(0);
  });
});
