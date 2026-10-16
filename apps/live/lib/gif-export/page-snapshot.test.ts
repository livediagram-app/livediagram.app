// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GifExportError } from './gif-export-error';
import { cropTransform, parseDelays, snapshotPage } from './page-snapshot';

// docs/specs/020-import-export/blueprints/animated-gif-export.md "The snapshot".
const rect = (left: number, top: number, width: number, height: number) =>
  ({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
  }) as DOMRect;

function canvas() {
  document.documentElement.className = 'dark reduce-motion';
  document.body.innerHTML = `
    <main data-canvas-root>
      <div data-canvas-content>
        <div data-illustrate-page-id="p1"><span class="spin">on p1</span></div>
        <div data-illustrate-page-id="p2"><span class="spin">on p2</span></div>
        <div data-element-id="near">near</div>
        <div data-element-id="far">far<div data-element-id="inner">inner</div></div>
        <div data-gif-omit><span class="spin">cursor</span></div>
        <div data-selection-grips>grips</div>
      </div>
    </main>`;
  const boxes: Record<string, DOMRect> = {
    p1: rect(100, 50, 400, 200),
    p2: rect(600, 50, 400, 200),
    near: rect(120, 60, 50, 50),
    far: rect(700, 60, 50, 50),
    root: rect(0, 0, 1200, 800),
  };
  for (const el of document.querySelectorAll<HTMLElement>('*')) {
    const key =
      el.getAttribute('data-illustrate-page-id') ??
      el.getAttribute('data-element-id') ??
      (el.hasAttribute('data-canvas-root') ? 'root' : null);
    el.getBoundingClientRect = () => (key && boxes[key]) || rect(0, 0, 0, 0);
  }
  // jsdom computes no animations: the .spin spans animate, a pseudo-element of the first one too.
  vi.spyOn(window, 'getComputedStyle').mockImplementation((el: Element, pseudo?: string | null) => {
    const spins = el.classList.contains('spin') && (!pseudo || el.textContent === 'on p1');
    return {
      animationName: spins ? 'spin' : 'none',
      animationDelay: spins ? '0s, -1.5s' : '0s',
      getPropertyValue: () => '',
    } as unknown as CSSStyleDeclaration;
  });
}
const options = {
  width: 800,
  height: 400,
  fontCss: '@font-face{font-family:X}',
  css: '.spin{animation:spin 1s infinite}',
  images: { dataUrl: async (u: string) => u },
};
const svgOf = (url: string) =>
  decodeURIComponent(url.replace('data:image/svg+xml;charset=utf-8,', ''));

afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.className = '';
});

describe('a page snapshot', () => {
  it('holds only this page, the elements on it and nothing of the editor', async () => {
    canvas();
    const svg = svgOf((await snapshotPage('p1', options)).urlAt(0));
    expect(svg).toContain('on p1');
    expect(svg).toContain('near');
    expect(svg).not.toContain('on p2');
    expect(svg).not.toContain('far');
    expect(svg).not.toContain('cursor');
    expect(svg).not.toContain('grips');
  });

  it('pins each animation, a pseudo-element’s too, at the frame’s moment', async () => {
    canvas();
    const snap = await snapshotPage('p1', options);
    expect(snap.animated).toBe(true);
    const svg = svgOf(snap.urlAt(500));
    expect(svg).toMatch(/\[data-gif-id="\d+"\]\{animation-delay:-500ms,-2000ms!important/);
    expect(svg).toMatch(/\[data-gif-id="\d+"\]::before\{animation-delay:-500ms,-2000ms!important/);
  });

  it('fits a page of another shape inside the frame, centred, never cropped', async () => {
    canvas();
    // p1 is 400 x 200 at (100, 50); a square 800 x 800 frame fits it at 2x, 200 px down.
    const svg = svgOf((await snapshotPage('p1', { ...options, height: 800 })).urlAt(0));
    expect(svg).toContain('transform:translate(-200px,100px) scale(2)');
  });

  it('carries the fonts and stylesheets, and the page’s classes without Reduce Motion', async () => {
    canvas();
    const svg = svgOf((await snapshotPage('p1', options)).urlAt(0));
    expect(svg).toContain('@font-face{font-family:X}');
    expect(svg).toContain('.spin{animation:spin 1s infinite}');
    expect(svg).toContain('class="dark"');
    expect(svg).not.toContain('reduce-motion');
  });

  it('crops to the page at the frame’s size', async () => {
    canvas();
    const svg = svgOf((await snapshotPage('p1', options)).urlAt(0));
    expect(svg).toContain('width="800" height="400"');
    expect(svg).toContain('transform:translate(-200px,-100px) scale(2)');
  });

  it('is still when nothing on the page moves', async () => {
    canvas();
    document.querySelector('[data-illustrate-page-id="p1"] .spin')!.classList.remove('spin');
    expect((await snapshotPage('p1', options)).animated).toBe(false);
  });

  it('fails as page-missing when the page is gone', async () => {
    canvas();
    await expect(snapshotPage('nope', options)).rejects.toEqual(new GifExportError('page-missing'));
  });
});

describe('snapshot maths', () => {
  it('reads a computed delay list in milliseconds', () => {
    expect(parseDelays('0s, -1.5s, 200ms, junk')).toEqual([0, -1500, 200, 0]);
  });

  it('puts the page’s corner at the origin', () => {
    expect(cropTransform({ left: 10, top: 20 }, { left: 0, top: 0 }, 1.5)).toBe(
      'translate(-15px,-30px) scale(1.5)',
    );
  });
});
