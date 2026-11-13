// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
      // Holding the face still changes only its transitions, never its layout.
      if (name !== 'data-marker-taking') dirty = true;
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

// docs/specs/008-canvas/finish.md "Marker": a take reads every part as it rests. A border with a colour transition
// eases back from the transparent mark the take just cleared, so read mid-fade it has no colour at all.
describe('a take', () => {
  // A computed style whose border reads transparent, as mid-fade, unless the face is held still.
  function fading(root: HTMLElement) {
    const read = window.getComputedStyle.bind(window);
    return vi.spyOn(window, 'getComputedStyle').mockImplementation((el, pseudo) => {
      const css = read(el, pseudo);
      if (!(el instanceof HTMLElement) || !el.classList.contains('card')) return css;
      if (root.hasAttribute('data-marker-taking')) return css;
      return new Proxy(css, {
        get: (target, key) =>
          key === 'getPropertyValue'
            ? (name: string) =>
                name.endsWith('-color') ? 'rgba(0, 0, 0, 0)' : target.getPropertyValue(name)
            : key === 'borderTopColor'
              ? 'rgba(0, 0, 0, 0)'
              : (Reflect.get(target, key) as unknown),
      });
    });
  }

  it('draws a part whose border is mid-fade, reading it held still', () => {
    const root = face(card('transition:border-color 180ms'));
    drawMarkerFace(root, 'el');
    const resting = root.querySelector('.card svg[data-marker-ink]')!.innerHTML;
    const spy = fading(root);
    try {
      expect(drawMarkerFace(root, 'el')).toBe(1);
    } finally {
      spy.mockRestore();
    }
    expect(root.querySelector('.card')!.getAttribute('data-marker-drawn')).toBe('frame');
    expect(root.querySelector('.card svg[data-marker-ink]')!.innerHTML).toBe(resting);
  });

  it('reads every part held still and before any mark, then lets go', () => {
    const root = face(card() + card() + card());
    const read = window.getComputedStyle.bind(window);
    const reads: { held: boolean; marked: number }[] = [];
    const spy = vi.spyOn(window, 'getComputedStyle').mockImplementation((el, pseudo) => {
      if (el instanceof HTMLElement && el.classList.contains('card'))
        reads.push({
          held: root.hasAttribute('data-marker-taking'),
          marked: root.querySelectorAll('[data-marker-ink]').length,
        });
      return read(el, pseudo);
    });
    try {
      expect(drawMarkerFace(root, 'el')).toBe(3);
    } finally {
      spy.mockRestore();
    }
    const firstMarks = reads.findIndex((r) => r.marked > 0);
    // Three reads before any mark, then each mark's style read once with the face still held.
    expect(firstMarks).toBe(3);
    expect(reads.every((r) => r.held)).toBe(true);
    expect(root.hasAttribute('data-marker-taking')).toBe(false);
  });

  it('lets go of the face when a read throws', () => {
    const root = face(card());
    const spy = vi.spyOn(window, 'getComputedStyle').mockImplementation(() => {
      throw new Error('gone');
    });
    try {
      expect(() => drawMarkerFace(root, 'el')).toThrow('gone');
    } finally {
      spy.mockRestore();
    }
    expect(root.hasAttribute('data-marker-taking')).toBe(false);
  });

  it('lets go of the face when a write throws', () => {
    const root = face(card());
    const append = Node.prototype.appendChild;
    Node.prototype.appendChild = () => {
      throw new Error('full');
    };
    try {
      expect(() => drawMarkerFace(root, 'el')).toThrow('full');
    } finally {
      Node.prototype.appendChild = append;
    }
    expect(root.hasAttribute('data-marker-taking')).toBe(false);
  });

  it('reads the grid rules it marks back before letting go', () => {
    const root = face(
      '<div data-marker-grid="" data-w="200" data-h="60" style="position:relative">' +
        '<div data-w="100" data-h="30" style="border-right:1px solid rgb(10, 10, 10);border-bottom:1px solid rgb(10, 10, 10)"></div>' +
        '</div>',
    );
    const read = window.getComputedStyle.bind(window);
    let heldReads = 0;
    const spy = vi.spyOn(window, 'getComputedStyle').mockImplementation((el, pseudo) => {
      if (el instanceof HTMLElement && el.hasAttribute('data-marker-rules')) heldReads++;
      return read(el, pseudo);
    });
    // jsdom lays nothing out: each box sits in its parent at 0, 0.
    Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
      configurable: true,
      get(this: HTMLElement) {
        return this.parentElement;
      },
    });
    try {
      drawMarkerFace(root, 'el');
    } finally {
      spy.mockRestore();
      delete (HTMLElement.prototype as { offsetParent?: Element }).offsetParent;
    }
    expect(root.querySelector('[data-marker-rules]')).not.toBeNull();
    expect(heldReads).toBe(1);
  });

  it.each([
    ['livedocuments', 'livedocuments/apps/editor'],
    ['livedesign', 'livedesign/apps/live'],
    ['livediagram', 'livediagram/apps/editor'],
    ['livehuddle', 'livehuddle/apps/editor'],
  ])('holds every transition while it reads in %s (face-finish.css)', (_, app) => {
    const css = readFileSync(join(__dirname, '../../../../..', app, 'app/face-finish.css'), 'utf8');
    expect(css).toMatch(
      /\[data-marker-taking\],\s*\[data-marker-taking\] \*\s*\{\s*transition: none !important;/,
    );
  });
});

// docs/specs/008-canvas/finish.md "Marker": the pointer's own feedback (hover chrome, data-face-hover) changes nothing
// the pass draws, so it never takes the face again.
describe('useFaceFinishPass and hover chrome', () => {
  afterEach(() => vi.useRealTimers());

  it('never re-takes the face as hover chrome comes and goes, and still does on a real change', async () => {
    vi.useFakeTimers();
    const root = face(`${card()}<div data-face-hover=""></div>`);
    const { unmount } = renderHook(() => useFaceFinishPass({ current: root }, 'marker', 'el'));
    await act(async () => {});
    const ink = root.querySelector('[data-marker-ink]');
    expect(ink).not.toBeNull();
    const chrome = root.querySelector('[data-face-hover]')!;
    for (let i = 0; i < 5; i++) {
      // A trigger shown under the pointer, restyled, then hidden again.
      const trigger = document.createElement('button');
      trigger.setAttribute('data-w', '24');
      trigger.setAttribute('data-h', '24');
      trigger.setAttribute('style', 'position:relative;border:1px solid red');
      chrome.appendChild(trigger);
      trigger.setAttribute('style', 'position:relative;border:1px solid blue');
      await vi.advanceTimersByTimeAsync(16);
      trigger.remove();
    }
    // Hover chrome added and removed whole, as React mounts it.
    const whole = document.createElement('div');
    whole.setAttribute('data-face-hover', '');
    root.appendChild(whole);
    whole.remove();
    await vi.advanceTimersByTimeAsync(2000);
    expect(root.querySelector('[data-marker-ink]')).toBe(ink);
    expect(root.querySelector('[data-face-hover] [data-marker-ink]')).toBeNull();

    root.querySelector('.card')!.textContent = 'Shipped';
    await vi.advanceTimersByTimeAsync(2000);
    const after = root.querySelector('[data-marker-ink]');
    expect(after).not.toBeNull();
    expect(after).not.toBe(ink);
    expect(root.hasAttribute('data-marker-taking')).toBe(false);
    unmount();
    expect(root.hasAttribute('data-marker-taking')).toBe(false);
  });
});
