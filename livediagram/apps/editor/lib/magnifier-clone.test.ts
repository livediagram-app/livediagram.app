// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { cloneCanvasLayer } from './magnifier-clone';

// docs/specs/008-canvas/magnifier.md "Performance": the lens's copy of the drawn layer.
describe('cloneCanvasLayer', () => {
  const layer = () => {
    const el = document.createElement('div');
    el.setAttribute('data-canvas-content', '');
    el.style.transform = 'scale(1.5) translate(10px, 20px)';
    el.innerHTML = `
      <div data-element-id="a" class="box">Box A</div>
      <iframe class="embed" style="left: 40px" width="320" height="180" src="about:blank"></iframe>
      <video class="clip" style="width: 50%"></video>
      <svg><defs><marker id="m1"></marker></defs></svg>`;
    return el;
  };

  it('copies what is drawn, transform and all', () => {
    const copy = cloneCanvasLayer(layer());
    expect(copy.querySelector('[data-element-id="a"]')?.textContent).toBe('Box A');
    expect(copy.style.transform).toBe('scale(1.5) translate(10px, 20px)');
  });

  it('stands a still box in for each frame and video, the same size and place', () => {
    const copy = cloneCanvasLayer(layer());
    expect(copy.querySelector('iframe, video')).toBeNull();
    const frame = copy.querySelector<HTMLElement>('.embed')!;
    expect(frame.tagName).toBe('DIV');
    expect(frame.style.left).toBe('40px');
    expect(frame.style.width).toBe('320px');
    expect(frame.style.height).toBe('180px');
    expect(copy.querySelector<HTMLElement>('.clip')!.style.width).toBe('50%');
  });

  it('is a view, never a target', () => {
    const copy = cloneCanvasLayer(layer());
    expect(copy.hasAttribute('data-canvas-content')).toBe(false);
    expect(copy.hasAttribute('data-magnifier-copy')).toBe(true);
    expect(copy.getAttribute('aria-hidden')).toBe('true');
    expect(copy.style.pointerEvents).toBe('none');
  });

  it('leaves the original alone', () => {
    const original = layer();
    cloneCanvasLayer(original);
    expect(original.querySelector('iframe')).not.toBeNull();
    expect(original.hasAttribute('data-canvas-content')).toBe(true);
  });
});
