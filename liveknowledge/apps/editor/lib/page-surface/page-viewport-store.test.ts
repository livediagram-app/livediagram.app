// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPageViewportStore, pageViewportOf } from './page-viewport-store';
import { createViewportStore } from '@liveworkspace/workbench/lib/viewport-store';

// docs/specs/030-knowledgebase/blueprints/page-surface.md "The store": the view is locked, a move down the page is
// the scroll container's scroll, and a scroll tells no reader unless an element is being followed.
const LOCK = { zoom: 1, offset: { x: 100, y: 600 } };

function scrollerOf(max = 5000): HTMLElement {
  const el = document.createElement('div');
  let top = 0;
  Object.defineProperty(el, 'scrollTop', {
    get: () => top,
    set: (v: number) => {
      top = Math.max(0, Math.min(max, v));
    },
  });
  return el;
}

afterEach(() => vi.restoreAllMocks());

describe('createPageViewportStore', () => {
  it('answers the lock, and tells its readers when the lock changes and only then', () => {
    const store = createPageViewportStore({ followsScroll: () => false });
    const seen = vi.fn();
    const lockSeen = vi.fn();
    store.subscribe(seen);
    store.subscribeLock(lockSeen);
    store.lockTo(LOCK);
    expect(store.get()).toEqual(LOCK);
    expect(store.lock()).toEqual(LOCK);
    expect(seen).toHaveBeenCalledTimes(1);
    expect(lockSeen).toHaveBeenCalledTimes(1);
    store.lockTo({ zoom: 1, offset: { x: 100, y: 600 } });
    expect(seen).toHaveBeenCalledTimes(1);
    expect(lockSeen).toHaveBeenCalledTimes(1);
  });

  it('never takes a zoom, nor a sideways move', () => {
    const store = createPageViewportStore({ followsScroll: () => false });
    store.attach(scrollerOf());
    store.lockTo(LOCK);
    store.setZoom(2.5);
    store.setZoom((z) => z * 3);
    store.setView({ zoom: 0.2, offset: { x: -900, y: 600 } });
    store.setOffset({ x: 5000, y: 600 });
    expect(store.get()).toEqual(LOCK);
  });

  it('turns a move down the page into the scroll, and reads the view as it stands on screen', () => {
    const store = createPageViewportStore({ followsScroll: () => false });
    const scroller = scrollerOf();
    store.attach(scroller);
    store.lockTo(LOCK);
    store.setOffset({ x: 100, y: 200 });
    expect(scroller.scrollTop).toBe(400);
    expect(store.get()).toEqual({ zoom: 1, offset: { x: 100, y: 200 } });
    // The lock itself is where the canvas draws its world: it never moves with the scroll.
    expect(store.lock()).toEqual(LOCK);
    store.setOffset((was) => ({ x: was.x, y: was.y - 100 }));
    expect(scroller.scrollTop).toBe(500);
  });

  it('scales the scroll by the lock’s zoom on a narrow window', () => {
    const store = createPageViewportStore({ followsScroll: () => false });
    const scroller = scrollerOf();
    store.attach(scroller);
    store.lockTo({ zoom: 0.5, offset: { x: 0, y: 600 } });
    store.setOffset({ x: 0, y: 200 });
    expect(scroller.scrollTop).toBe(200);
    expect(store.get().offset.y).toBe(200);
  });

  it('holds a move inside what there is to scroll', () => {
    const store = createPageViewportStore({ followsScroll: () => false });
    const scroller = scrollerOf(300);
    store.attach(scroller);
    store.lockTo(LOCK);
    store.setOffset({ x: 100, y: 9000 });
    expect(scroller.scrollTop).toBe(0);
    store.setOffset({ x: 100, y: -9000 });
    expect(scroller.scrollTop).toBe(300);
    expect(store.get().offset.y).toBe(300);
  });

  it('tells no reader of a scroll while nothing is followed', () => {
    const frames = vi.spyOn(window, 'requestAnimationFrame');
    const store = createPageViewportStore({ followsScroll: () => false });
    const scroller = scrollerOf();
    store.attach(scroller);
    store.lockTo(LOCK);
    const seen = vi.fn();
    const lockSeen = vi.fn();
    store.subscribe(seen);
    store.subscribeLock(lockSeen);
    for (let i = 1; i <= 50; i++) {
      scroller.scrollTop = i * 40;
      scroller.dispatchEvent(new Event('scroll'));
    }
    expect(seen).not.toHaveBeenCalled();
    expect(lockSeen).not.toHaveBeenCalled();
    expect(frames).not.toHaveBeenCalled();
    // A handler that reads the view then still finds it where the page is scrolled to.
    expect(store.get().offset.y).toBe(600 - 2000);
  });

  it('tells the readers once a frame while an element is followed, never the lock’s', () => {
    let run: FrameRequestCallback | null = null;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      run = cb;
      return 1;
    });
    const store = createPageViewportStore({ followsScroll: () => true });
    const scroller = scrollerOf();
    store.attach(scroller);
    store.lockTo(LOCK);
    const seen = vi.fn();
    const lockSeen = vi.fn();
    store.subscribe(seen);
    store.subscribeLock(lockSeen);
    for (let i = 1; i <= 10; i++) {
      scroller.scrollTop = i * 40;
      scroller.dispatchEvent(new Event('scroll'));
    }
    expect(seen).not.toHaveBeenCalled();
    run!(0);
    expect(seen).toHaveBeenCalledTimes(1);
    expect(lockSeen).not.toHaveBeenCalled();
  });

  it('stops listening once detached', () => {
    const store = createPageViewportStore({ followsScroll: () => true });
    const scroller = scrollerOf();
    const detach = store.attach(scroller);
    store.lockTo(LOCK);
    detach();
    scroller.scrollTop = 400;
    scroller.dispatchEvent(new Event('scroll'));
    expect(store.get()).toEqual(LOCK);
    expect(store.scroller()).toBeNull();
  });

  it('is told apart from the shared, unlocked store', () => {
    expect(pageViewportOf(createViewportStore(1))).toBeNull();
    expect(pageViewportOf(undefined)).toBeNull();
    const store = createPageViewportStore({ followsScroll: () => false });
    expect(pageViewportOf(store)).toBe(store);
  });
});
