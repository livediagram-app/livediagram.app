// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MARKER_FACE_MAX_FRAMES,
  MARKER_FACE_MAX_PARTS,
} from '@liveworkspace/element-model/marker-face';
import { SKETCH_INK_SETTLE_MS } from './settle-watch';
import {
  drawMarkerFace,
  markerFaceTake,
  useFaceFinishPass,
  type FaceFinishBoard,
} from './useFaceFinishPass';

// The hooks a board of cards hands the shared pass (FaceFinishBoard: liveplanner's Plan board, its
// docs/specs/008-canvas/blueprints/finish.md "Faces in their finish"). A face given none (the other four editors) keeps
// the pass exactly as it was. jsdom lays nothing out, so each box is given its size through data-w / data-h.
const size = (key: 'offsetWidth' | 'offsetHeight', attr: string) =>
  Object.defineProperty(HTMLElement.prototype, key, {
    configurable: true,
    get(this: HTMLElement) {
      return Number(this.getAttribute(attr) ?? 0);
    },
  });

beforeEach(() => {
  size('offsetWidth', 'data-w');
  size('offsetHeight', 'data-h');
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete (HTMLElement.prototype as { offsetWidth?: number }).offsetWidth;
  delete (HTMLElement.prototype as { offsetHeight?: number }).offsetHeight;
  document.body.innerHTML = '';
});

function face(inner: string): HTMLElement {
  document.body.innerHTML = `<div id="root" data-w="2000" data-h="2000" style="position:absolute">${inner}</div>`;
  return document.getElementById('root')!;
}

const card = (attrs = '', style = '', box = 'data-w="200" data-h="100"') =>
  `<div class="card" ${box} ${attrs} style="position:relative;border:1px solid rgb(200, 200, 200);border-radius:12px;${style}">Ship it</div>`;

const inkOf = (el: Element) => el.querySelector(':scope > [data-marker-ink]')?.innerHTML;

describe('a board counts its frames apart', () => {
  it(`draws a face's frames past MARKER_FACE_MAX_PARTS (${MARKER_FACE_MAX_PARTS}) only when given a board`, () => {
    const n = MARKER_FACE_MAX_PARTS + 30;
    const root = face(Array.from({ length: n }, () => card()).join(''));
    expect(drawMarkerFace(root, 'el')).toBe(MARKER_FACE_MAX_PARTS);
    expect(drawMarkerFace(root, 'el', 'marker', false, {})).toBe(n);
  });

  it(`stops at MARKER_FACE_MAX_FRAMES (${MARKER_FACE_MAX_FRAMES}) frames once its other parts are spent too`, () => {
    const root = face(Array.from({ length: MARKER_FACE_MAX_FRAMES + 5 }, () => card()).join(''));
    expect(drawMarkerFace(root, 'el', 'marker', false, {})).toBe(MARKER_FACE_MAX_FRAMES);
  });

  it("counts a table's rules among its other parts", () => {
    const cells = Array.from(
      { length: 3 },
      (_, i) =>
        `<div data-w="100" data-h="40" style="position:absolute;left:${i * 100}px;top:0;border-right:3px solid rgb(0, 0, 0)"></div>`,
    ).join('');
    const root = face(`<div data-marker-grid="">${cells}</div>${card()}`);
    // Rules are read from layout jsdom does not have; the face still draws its card.
    expect(drawMarkerFace(root, 'el', 'marker', false, {})).toBe(
      drawMarkerFace(root, 'el', 'marker', false),
    );
  });
});

describe('a part marked a frame (data-marker-frame)', () => {
  it('is outlined under the least size of a frame, and when round', () => {
    const short = 'data-w="200" data-h="36"';
    const pill = 'data-w="120" data-h="40"';
    expect(drawMarkerFace(face(card('', '', short)), 'el')).toBe(0);
    expect(drawMarkerFace(face(card('', 'border-radius:999px', pill)), 'el')).toBe(0);
    const root = face(
      card('data-marker-frame=""', '', short) +
        card('data-marker-frame=""', 'border-radius:999px', pill),
    );
    expect(drawMarkerFace(root, 'el')).toBe(2);
    for (const el of root.querySelectorAll('.card'))
      expect(el.getAttribute('data-marker-drawn')).toBe('frame');
  });
});

describe("a board's owners seed their parts", () => {
  const board: FaceFinishBoard = {
    ownerOf: (root, el) => {
      const owner = el.closest('[data-owner]');
      return owner && root.contains(owner) ? (owner.getAttribute('data-owner') ?? '') : '';
    },
  };
  const owned = (key: string) => card(`data-owner="${key}"`);

  it("keeps an owner's ink when a part comes in before it elsewhere", () => {
    const before = face(owned('b'));
    drawMarkerFace(before, 'el', 'marker', false, board);
    const alone = inkOf(before.querySelector('[data-owner="b"]')!);
    const after = face(owned('a') + owned('b'));
    drawMarkerFace(after, 'el', 'marker', false, board);
    expect(inkOf(after.querySelector('[data-owner="b"]')!)).toBe(alone);
    // Without owners, its place in the whole face seeds it: the part before it moves its strokes.
    drawMarkerFace(after, 'el');
    expect(inkOf(after.querySelector('[data-owner="b"]')!)).not.toBe(alone);
  });

  it('seeds the parts of no owner by their order among themselves', () => {
    const root = face(card() + owned('a') + card());
    expect(drawMarkerFace(root, 'el', 'marker', false, board)).toBe(3);
    const [first, , last] = [...root.querySelectorAll('.card')];
    expect(inkOf(first!)).not.toBe(inkOf(last!));
  });
});

// IntersectionObserver stand-in: the test reports what is in view by hand.
class FakeObserver {
  static all: FakeObserver[] = [];
  watched = new Set<Element>();
  readonly callback: (entries: IntersectionObserverEntry[]) => void;
  constructor(callback: (entries: IntersectionObserverEntry[]) => void) {
    this.callback = callback;
    FakeObserver.all.push(this);
  }
  observe(el: Element) {
    this.watched.add(el);
  }
  disconnect() {
    this.watched.clear();
  }
}

describe("a board's unseen parts", () => {
  let seen: Set<Element>;
  const board: FaceFinishBoard = {
    unseen: (el) => el.classList.contains('card') && !seen.has(el),
  };
  beforeEach(() => {
    seen = new Set();
    FakeObserver.all = [];
    vi.stubGlobal('IntersectionObserver', FakeObserver);
  });

  it('are left unread and handed back once the face is read', () => {
    const root = face(card() + card());
    const [a, b] = [...root.querySelectorAll('.card')];
    seen.add(a!);
    const onUnseen = vi.fn();
    const take = markerFaceTake(root, 'el', 'marker', false, undefined, board, onUnseen);
    take.prepare?.();
    take.read()()?.();
    expect(onUnseen).toHaveBeenCalledWith([b]);
    expect(a!.querySelector('[data-marker-ink]')).not.toBeNull();
    expect(b!.querySelector('[data-marker-ink]')).toBeNull();
  });

  it('are taken once they scroll into view and pause, with no observer for a face given no unseen hook', async () => {
    vi.useFakeTimers();
    const root = face(card() + card());
    const { unmount } = renderHook(() =>
      useFaceFinishPass({ current: root }, 'marker', 'el', { board }),
    );
    await act(async () => {});
    expect(root.querySelector('[data-marker-ink]')).toBeNull();
    const cards = [...root.querySelectorAll('.card')];
    expect([...FakeObserver.all[0]!.watched]).toEqual(cards);
    for (const el of cards) seen.add(el);
    FakeObserver.all[0]!.callback(
      cards.map(
        (target) => ({ target, isIntersecting: true }) as unknown as IntersectionObserverEntry,
      ),
    );
    await vi.advanceTimersByTimeAsync(SKETCH_INK_SETTLE_MS * 2);
    for (const el of cards) expect(el.querySelector('[data-marker-ink]')).not.toBeNull();
    unmount();
    expect(FakeObserver.all[0]!.watched.size).toBe(0);

    FakeObserver.all = [];
    const plain = renderHook(() =>
      useFaceFinishPass({ current: face(card()) }, 'marker', 'el', { board: {} }),
    );
    await act(async () => {});
    expect(FakeObserver.all).toHaveLength(0);
    plain.unmount();
  });
});

describe("a board's ignore", () => {
  it('never re-takes the face on a change it names, and still does on any other', async () => {
    vi.useFakeTimers();
    const root = face(card());
    const board: FaceFinishBoard = {
      ignore: (r) => r.type === 'attributes' && r.attributeName === 'data-hovered',
    };
    const { unmount } = renderHook(() =>
      useFaceFinishPass({ current: root }, 'marker', 'el', { board }),
    );
    await act(async () => {});
    const ink = root.querySelector('[data-marker-ink]');
    expect(ink).not.toBeNull();
    const el = root.querySelector('.card')!;
    for (let i = 0; i < 5; i++) {
      el.toggleAttribute('data-hovered');
      await vi.advanceTimersByTimeAsync(16);
    }
    await vi.advanceTimersByTimeAsync(2000);
    expect(root.querySelector('[data-marker-ink]')).toBe(ink);
    el.setAttribute('data-other', '');
    await vi.advanceTimersByTimeAsync(2000);
    expect(root.querySelector('[data-marker-ink]')).not.toBe(ink);
    unmount();
  });
});
