// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearMarkerFace, drawMarkerFace } from './useFaceFinishPass';

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
});
