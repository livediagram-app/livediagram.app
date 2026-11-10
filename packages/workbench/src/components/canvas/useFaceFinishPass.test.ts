// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearMarkerFace, drawMarkerFace, useFaceFinishPass } from './useFaceFinishPass';

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
});

// docs/specs/008-canvas/finish.md "Performance": a board's faces take together, so mounting a board reads every face
// before it writes into any. A read after a write is a layout the browser is forced to run.
describe('useFaceFinishPass on a board', () => {
  function board(n: number): HTMLElement[] {
    document.body.innerHTML = Array.from(
      { length: n },
      (_, i) =>
        `<div class="face" data-i="${i}" data-w="300" data-h="200" style="position:absolute">${card()}</div>`,
    ).join('');
    return [...document.querySelectorAll<HTMLElement>('.face')];
  }

  // Counts reads of a layout size made after a write since the last read: each one a forced layout.
  function countForcedLayouts(): { forced: () => number; reset: () => void; restore: () => void } {
    let dirty = false;
    let forced = 0;
    const read = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth')!;
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
      configurable: true,
      get(this: HTMLElement) {
        if (dirty) forced++;
        dirty = false;
        return read.get!.call(this) as number;
      },
    });
    const original = {
      appendChild: Node.prototype.appendChild,
      setAttribute: Element.prototype.setAttribute,
      after: Element.prototype.after,
    };
    Node.prototype.appendChild = function <T extends Node>(this: Node, child: T): T {
      dirty = true;
      return original.appendChild.call(this, child) as T;
    };
    Element.prototype.setAttribute = function (this: Element, name: string, value: string) {
      dirty = true;
      original.setAttribute.call(this, name, value);
    };
    Element.prototype.after = function (this: Element, ...nodes: (Node | string)[]) {
      dirty = true;
      original.after.apply(this, nodes);
    };
    return {
      forced: () => forced,
      reset: () => {
        dirty = false;
        forced = 0;
      },
      restore: () => {
        Object.defineProperty(HTMLElement.prototype, 'offsetWidth', read);
        Object.assign(Node.prototype, { appendChild: original.appendChild });
        Object.assign(Element.prototype, {
          setAttribute: original.setAttribute,
          after: original.after,
        });
      },
    };
  }

  it('reads every face before it draws any, so mounting forces no layout per face', async () => {
    for (const n of [1, 12, 40]) {
      const faces = board(n);
      const probe = countForcedLayouts();
      try {
        const hooks = faces.map((el, i) =>
          renderHook(() => useFaceFinishPass({ current: el }, 'marker', `el-${i}`)),
        );
        // Taken at the end of the task that mounted them, before the board is first painted.
        expect(document.querySelector('[data-marker-ink]')).toBeNull();
        probe.reset();
        await Promise.resolve();
        expect(document.querySelectorAll('[data-marker-ink]')).toHaveLength(n);
        expect(probe.forced()).toBe(0);
        for (const hook of hooks) hook.unmount();
        // Taken one face at a time, as before, each face after the first forced one.
        probe.reset();
        for (const [i, el] of faces.entries()) drawMarkerFace(el, `el-${i}`);
        expect(probe.forced()).toBe(n - 1);
      } finally {
        probe.restore();
      }
    }
  });

  it('draws what a single take draws', async () => {
    const [el] = board(1);
    const { unmount } = renderHook(() => useFaceFinishPass({ current: el! }, 'marker', 'el'));
    await Promise.resolve();
    const batched = el!.innerHTML;
    unmount();
    expect(el!.querySelector('[data-marker-ink]')).toBeNull();
    drawMarkerFace(el!, 'el');
    expect(el!.innerHTML).toBe(batched);
  });

  it('never draws a face that unmounted before its take', async () => {
    const [el] = board(1);
    const { unmount } = renderHook(() => useFaceFinishPass({ current: el! }, 'marker', 'el'));
    unmount();
    await Promise.resolve();
    expect(el!.querySelector('[data-marker-ink]')).toBeNull();
  });
});
