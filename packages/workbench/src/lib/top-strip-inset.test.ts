// @vitest-environment jsdom
// A page framed in a Pages editor centres below the top strip and a standing palette tray, so the tray never covers
// its header (liveworkspace/docs/specs/002-architecture/blueprints/template-examples.md).
import { afterEach, describe, expect, it } from 'vitest';
import { STANDING_TRAY_SELECTOR, topStripInset } from './top-strip-inset';

const box = (el: HTMLElement, r: { top: number; bottom: number }) => {
  el.getBoundingClientRect = () =>
    ({ left: 0, right: 1000, width: 1000, ...r, height: r.bottom - r.top }) as DOMRect;
  return el;
};

const el = (attrs: Record<string, string>, r: { top: number; bottom: number }) => {
  const node = document.createElement('div');
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return box(node, r);
};

const canvas = () => el({}, { top: 56, bottom: 900 });
const strip = () => el({ 'data-toolbar-palette': '' }, { top: 66, bottom: 120 });
const tray = (r = { top: 126, bottom: 160 }) =>
  el({ 'data-palette-tray': '', 'data-yields-to-mode': '' }, r);

afterEach(() => document.body.replaceChildren());

describe('topStripInset', () => {
  it('is 0 with nothing over the canvas', () => {
    const c = canvas();
    document.body.append(c);
    expect(topStripInset(c)).toBe(0);
  });

  it('is how far the strip reaches down', () => {
    const c = canvas();
    document.body.append(c, strip());
    expect(topStripInset(c)).toBe(120 - 56);
  });

  it('ignores a strip stood aside, hidden or in the lower half', () => {
    const c = canvas();
    const aside = strip();
    aside.style.visibility = 'hidden';
    document.body.append(c, aside);
    expect(topStripInset(c)).toBe(0);
    aside.remove();
    const hidden = strip();
    hidden.classList.add('hidden');
    document.body.append(hidden);
    expect(topStripInset(c)).toBe(0);
    hidden.remove();
    document.body.append(el({ 'data-toolbar-palette': '' }, { top: 800, bottom: 850 }));
    expect(topStripInset(c)).toBe(0);
  });

  it('reaches down to a standing tray under the strip, so the page header clears it', () => {
    const c = canvas();
    document.body.append(c, strip(), tray());
    expect(document.querySelector(STANDING_TRAY_SELECTOR)).not.toBeNull();
    expect(topStripInset(c)).toBe(160 - 56);
  });

  it('keeps no room for a passing mode message or a tray with no height', () => {
    const c = canvas();
    const passing = el(
      { 'data-palette-tray': '', 'data-mode-message': '' },
      { top: 126, bottom: 160 },
    );
    document.body.append(c, strip(), passing, tray({ top: 126, bottom: 126 }));
    expect(topStripInset(c)).toBe(120 - 56);
  });

  it('reaches down to the top-centre tray when there is no strip', () => {
    const c = canvas();
    document.body.append(c, tray({ top: 80, bottom: 114 }));
    expect(topStripInset(c)).toBe(114 - 56);
  });

  it('counts what stands under the strip only with the strip over the canvas', () => {
    const c = canvas();
    const options = el({ 'data-photo-options': '' }, { top: 124, bottom: 180 });
    document.body.append(c, options);
    expect(topStripInset(c, ['[data-photo-options]'])).toBe(0);
    document.body.append(strip());
    expect(topStripInset(c, ['[data-photo-options]', '[data-missing]'])).toBe(180 - 56);
    options.getBoundingClientRect = () =>
      ({ left: 0, right: 1000, width: 1000, top: 700, bottom: 760, height: 60 }) as DOMRect;
    expect(topStripInset(c, ['[data-photo-options]'])).toBe(120 - 56);
  });
});
