// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearMarkerFace,
  drawMarkerFace as drawSharedFace,
} from '@liveworkspace/workbench/components/canvas/useFaceFinishPass';
import { PLAN_BOARD } from './plan-face-finish';

// The shared pass as liveplanner runs it: with the Plan board's hooks (plan-face-finish.ts).
const drawMarkerFace = (root: HTMLElement, id: string, pen?: 'marker' | 'pencil', page?: boolean) =>
  drawSharedFace(root, id, pen, page, PLAN_BOARD);

// docs/specs/008-canvas/finish.md "Marker", "Faces: frames and shapes". jsdom lays nothing out, so each box is given
// its size through data-w / data-h.
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
  delete (HTMLElement.prototype as { offsetWidth?: number }).offsetWidth;
  delete (HTMLElement.prototype as { offsetHeight?: number }).offsetHeight;
  document.body.innerHTML = '';
});

function face(inner: string): HTMLElement {
  document.body.innerHTML = `<div id="root" data-w="600" data-h="400" style="position:absolute">${inner}</div>`;
  return document.getElementById('root')!;
}

const card = (style = '', size = 'data-w="200" data-h="100"') =>
  `<div class="card" ${size} style="position:relative;border:1px solid rgb(200, 200, 200);border-radius:12px;${style}">Ship it</div>`;

describe('drawMarkerFace', () => {
  it('outlines a card in marker inside it and marks its own border to hide', () => {
    const root = face(card());
    expect(drawMarkerFace(root, 'el')).toBe(1);
    const el = root.querySelector('.card')!;
    expect(el.getAttribute('data-marker-drawn')).toBe('frame');
    const ink = el.querySelector('svg[data-marker-ink]')!;
    expect(ink.getAttribute('aria-hidden')).toBe('true');
    expect(ink.innerHTML).toContain('data-marker-part="frame"');
    expect(el.textContent).toBe('Ship it');
  });

  it('leaves a small box, a pill, a static box and an unbordered box plain', () => {
    const root = face(
      card('', 'data-w="30" data-h="20"') +
        card('border-radius:999px', 'data-w="120" data-h="40"') +
        card('position:static') +
        '<div data-w="200" data-h="100" style="position:relative">Plain</div>',
    );
    expect(drawMarkerFace(root, 'el')).toBe(0);
    expect(root.querySelector('[data-marker-ink]')).toBeNull();
  });

  it('skips a busy board card the browser is not drawing, and draws one it is (plan-board.md "A busy board")', () => {
    const root = face(
      `<div data-plan-card="" id="off"><div>${card()}</div></div><div data-plan-card="" id="on"><div>${card()}</div></div>`,
    );
    const shown = (el: Element) => el.closest('[data-plan-card]')?.id === 'on';
    Object.defineProperty(HTMLElement.prototype, 'checkVisibility', {
      configurable: true,
      value(this: HTMLElement) {
        return shown(this);
      },
    });
    try {
      expect(drawMarkerFace(root, 'el')).toBe(1);
      expect(root.querySelector('#on [data-marker-ink]')).not.toBeNull();
      expect(root.querySelector('#off [data-marker-ink]')).toBeNull();
    } finally {
      delete (HTMLElement.prototype as { checkVisibility?: unknown }).checkVisibility;
    }
  });

  it('never reads into a kept part or the hand-drawn body', () => {
    const root = face(`<div data-finish-keep="">${card()}</div>`);
    expect(drawMarkerFace(root, 'el')).toBe(0);
  });

  it('replaces the last take rather than adding to it, and clears to nothing', () => {
    const root = face(card() + card());
    drawMarkerFace(root, 'el');
    drawMarkerFace(root, 'el');
    expect(root.querySelectorAll('[data-marker-ink]')).toHaveLength(2);
    clearMarkerFace(root);
    expect(root.querySelector('[data-marker-ink], [data-marker-drawn]')).toBeNull();
  });

  it('draws the same ink for the same face', () => {
    const a = face(card());
    drawMarkerFace(a, 'el');
    const first = a.querySelector('[data-marker-ink]')!.innerHTML;
    drawMarkerFace(a, 'el');
    expect(a.querySelector('[data-marker-ink]')!.innerHTML).toBe(first);
  });

  it("colours the face's own box in, once, under its contents", () => {
    document.body.innerHTML =
      '<div id="root" data-w="400" data-h="200" style="position:absolute;background-color:rgb(14, 165, 233)">' +
      '<div class="inner" data-w="400" data-h="200" style="position:absolute;background-color:rgb(14, 165, 233)">Banner</div></div>';
    const root = document.getElementById('root')!;
    expect(drawMarkerFace(root, 'el')).toBe(1);
    const ink = root.querySelector(':scope > svg[data-marker-ink]') as SVGElement;
    expect(ink.innerHTML).toContain('data-marker-part="shape"');
    expect(ink.style.zIndex).toBe('-1');
    expect(root.style.isolation).toBe('isolate');
    expect(root.querySelector('.inner [data-marker-ink]')).toBeNull();
    clearMarkerFace(root);
    expect(root.style.isolation).toBe('');
  });

  it('leaves the own box of a body that fills its tab plain (the page)', () => {
    document.body.innerHTML =
      '<div id="root" data-w="400" data-h="200" style="position:absolute;background-color:rgb(241, 245, 249)"></div>';
    expect(drawMarkerFace(document.getElementById('root')!, 'el', 'marker', true)).toBe(0);
  });

  it('draws a part a face marks as a shape, pill or not (a progress bar)', () => {
    const root = face(
      '<div data-marker-shape="" data-w="200" data-h="24" style="position:relative;border-radius:999px;background-color:rgb(14, 165, 233)"></div>',
    );
    expect(drawMarkerFace(root, 'el')).toBe(1);
  });

  it('outlines a box framed by an inset ring and hides the ring', () => {
    const root = face(
      '<div class="ring" data-w="200" data-h="100" style="position:relative;box-shadow:rgb(203, 213, 225) 0px 0px 0px 1px inset"></div>',
    );
    expect(drawMarkerFace(root, 'el')).toBe(1);
    expect(root.querySelector('.ring')!.getAttribute('data-marker-drawn')).toBe('ring');
  });

  it('shades only shapes in pencil under Sketch, leaving frames to the wobble', () => {
    const root = face(card());
    expect(drawMarkerFace(root, 'el', 'pencil')).toBe(0);
  });

  it('keeps a card’s strokes when a part appears in another column, and seeds by the card', () => {
    const cardIn = (id: string) =>
      `<div data-plan-card="${id}" data-w="200" data-h="100" style="position:relative;border:1px solid rgb(200, 200, 200);border-radius:12px">${id}</div>`;
    const board = (extra: string) =>
      face(
        `<div data-plan-column="todo" data-plan-lane="">${extra}${cardIn('a')}</div>` +
          `<div data-plan-column="done" data-plan-lane="">${cardIn('b')}</div>`,
      );
    const inkOf = (root: HTMLElement, id: string) =>
      root.querySelector(`[data-plan-card="${id}"] svg[data-marker-ink]`)!.innerHTML;
    const before = board('');
    drawMarkerFace(before, 'el');
    const b = inkOf(before, 'b');
    const a = inkOf(before, 'a');
    // A hover control (an outlined box) appears at the top of the first column.
    const after = board(
      '<div data-w="200" data-h="60" style="position:relative;border:1px solid rgb(200, 200, 200)">Add</div>',
    );
    drawMarkerFace(after, 'el');
    expect(inkOf(after, 'b')).toBe(b);
    expect(inkOf(after, 'a')).toBe(a);
    // The same card dragged into the other column draws the same ink there.
    const moved = face(
      `<div data-plan-column="todo" data-plan-lane=""></div><div data-plan-column="done" data-plan-lane="">${cardIn('b')}${cardIn('a')}</div>`,
    );
    drawMarkerFace(moved, 'el');
    expect(inkOf(moved, 'a')).toBe(a);
  });
});
