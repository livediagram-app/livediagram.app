// @vitest-environment jsdom

// Icons and stickers under Sketch in WebKit (docs/specs/008-canvas/finish.md "In WebKit"): the art drawn once into
// still pictures through the wobble, over the live art kept hidden, re-taken once the art settles.

import { act, cleanup, render } from '@testing-library/react';
import { useSyncExternalStore } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SKETCH_ART_FILTER_ID } from '@livedesign/design';
import {
  SKETCH_ART_PICTURE_MARGIN,
  SKETCH_ART_PICTURE_MAX_PX,
  SKETCH_ART_PICTURE_MAX_SCALE,
  SketchArtPicture,
  sketchArtPictureCopy,
  sketchArtPictureMarkup,
  sketchArtRasterScale,
} from './SketchArtPicture';
import { SKETCH_INK_SETTLE_MS } from '@liveworkspace/workbench/components/canvas/settle-watch';

// jsdom lays nothing out: every <svg> here is 24 x 24 unless a test says otherwise.
let size = 24;
beforeEach(() => {
  size = 24;
  for (const prop of ['clientWidth', 'clientHeight'])
    Object.defineProperty(SVGElement.prototype, prop, { configurable: true, get: () => size });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  for (const prop of ['clientWidth', 'clientHeight'])
    delete (SVGElement.prototype as unknown as Record<string, unknown>)[prop];
});

function svgOf(markup: string): SVGSVGElement {
  const host = document.createElement('div');
  host.innerHTML = markup;
  document.body.append(host);
  return host.querySelector('svg')!;
}

const decode = (src: string) => decodeURIComponent(src.split(',').slice(1).join(','));

describe('sketchArtPictureMarkup', () => {
  it('wraps the drawing at its laid-out size in the wobble, with a margin for it to reach into', () => {
    const markup = sketchArtPictureMarkup(
      svgOf('<svg viewBox="0 0 24 24" class="h-full w-full"><path d="M0 0L24 24"/></svg>'),
    )!;
    const m = 24 * SKETCH_ART_PICTURE_MARGIN;
    expect(markup).toContain(`viewBox="${-m} ${-m} ${24 + 2 * m} ${24 + 2 * m}"`);
    expect(markup).toContain(`<filter id="${SKETCH_ART_FILTER_ID}"`);
    expect(markup).toContain(`<g filter="url(#${SKETCH_ART_FILTER_ID})">`);
    expect(markup).toContain('width="24" height="24"');
    expect(markup).toContain('viewBox="0 0 24 24"');
    expect(markup).not.toContain('class=');
  });

  it('writes in the colours CSS gave it, which a picture cannot see', () => {
    const svg = svgOf(
      '<svg stroke="currentColor" style="color: rgb(1, 2, 3)"><rect class="fill-slate-300" fill="var(--x)"/></svg>',
    );
    const markup = sketchArtPictureMarkup(svg)!;
    expect(markup).toContain('color="rgb(1, 2, 3)"');
    expect(markup).not.toContain('var(--x)');
    expect(markup).not.toContain('class=');
  });

  it('carries no ids, so the live art keeps its own', () => {
    const markup = sketchArtPictureMarkup(
      svgOf('<svg id="a"><defs><linearGradient id="g"/></defs><rect/></svg>'),
    )!;
    expect(markup).not.toMatch(/id="(a|g)"/);
  });

  it('has nothing to draw before the drawing has a size', () => {
    size = 0;
    expect(sketchArtPictureMarkup(svgOf('<svg><rect/></svg>'))).toBeNull();
  });
});

describe('sketchArtRasterScale', () => {
  it("lays a picture out for the screen's pixels at the current zoom", () => {
    expect(sketchArtRasterScale(48, 1)).toBe(1);
    expect(sketchArtRasterScale(48, 2.5)).toBe(3);
  });

  it('stops at the most scale and the longest side', () => {
    expect(sketchArtRasterScale(48, 9)).toBe(SKETCH_ART_PICTURE_MAX_SCALE);
    const side = SKETCH_ART_PICTURE_MAX_PX / (1 + 2 * SKETCH_ART_PICTURE_MARGIN) / 2;
    expect(sketchArtRasterScale(side, 3)).toBe(2);
  });

  it('never lays a picture out under its size', () => {
    expect(sketchArtRasterScale(5000, 3)).toBe(1);
    expect(sketchArtRasterScale(48, 0.5)).toBe(1);
  });
});

describe('sketchArtPictureCopy', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('swaps each top-level drawing for a box laid out as it was, holding its picture', () => {
    const live = document.createElement('div');
    live.innerHTML =
      '<div class="absolute inset-0"><svg class="h-full w-full" style="width: 40px"><svg><rect/></svg></svg></div>';
    const copy = sketchArtPictureCopy(live)!;
    expect(copy.querySelector('svg')).toBeNull();
    const pictures = copy.querySelectorAll('img');
    expect(pictures).toHaveLength(1);
    const box = pictures[0]!.parentElement!;
    expect(box.getAttribute('class')).toBe('h-full w-full');
    expect(box.getAttribute('style')).toContain('width: 40px');
    expect(decode(pictures[0]!.src)).toContain('<rect');
    expect(copy.querySelector('.absolute.inset-0')).not.toBeNull();
  });

  it("lays the picture out at the screen's scale, past the box by the margin, and shrinks it back", () => {
    vi.stubGlobal('devicePixelRatio', 3);
    const live = document.createElement('div');
    live.innerHTML = '<svg><rect/></svg>';
    const picture = sketchArtPictureCopy(live)!.querySelector('img')!;
    const style = picture.getAttribute('style')!;
    const m = 100 * SKETCH_ART_PICTURE_MARGIN;
    expect(style).toContain(`left:${-m}%`);
    expect(style).toContain(`width:${(100 + 2 * m) * 3}%`);
    expect(style).toContain(`scale(${1 / 3})`);
    // The wobble is in the picture's units, so laying it out larger changes nothing but its sharpness.
    expect(decode(picture.src)).toContain('baseFrequency="0.12"');
  });

  it('leaves art that animates live: a still picture would freeze it', () => {
    const live = document.createElement('div');
    live.innerHTML = '<svg><rect/></svg>';
    live.getAnimations = () => [{} as Animation];
    expect(sketchArtPictureCopy(live)).toBeNull();
  });

  it('waits for every drawing to have a size', () => {
    size = 0;
    const live = document.createElement('div');
    live.innerHTML = '<svg><rect/></svg>';
    expect(sketchArtPictureCopy(live)).toBeNull();
  });
});

/** A count the test moves on from outside React, read through a store. */
function createCount(initial: number) {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    read: () => value,
    bump: () => {
      value++;
      for (const listener of listeners) listener();
    },
  };
}

describe('SketchArtPicture', () => {
  const pictureOf = (container: HTMLElement) =>
    container.querySelector('[data-sketch-art-picture]')!;
  const hiderOf = (container: HTMLElement) =>
    pictureOf(container).nextElementSibling as HTMLElement;

  it('draws the picture over the live art, which it hides', () => {
    const { container } = render(
      <SketchArtPicture>
        <svg>
          <rect />
        </svg>
      </SketchArtPicture>,
    );
    expect(pictureOf(container).querySelectorAll('img')).toHaveLength(1);
    expect(pictureOf(container).getAttribute('aria-hidden')).toBe('true');
    expect(hiderOf(container).style.visibility).toBe('hidden');
    expect(hiderOf(container).querySelector('rect')).not.toBeNull();
  });

  it('shows the live art while there is no picture to draw', () => {
    size = 0;
    const { container } = render(
      <SketchArtPicture>
        <svg>
          <rect />
        </svg>
      </SketchArtPicture>,
    );
    expect(pictureOf(container).childElementCount).toBe(0);
    expect(hiderOf(container).style.visibility).toBe('');
  });

  it('redraws the picture once changed art settles, and keeps it when nothing changed', async () => {
    vi.useFakeTimers();
    const count = createCount(1);
    function Dots() {
      const n = useSyncExternalStore(count.subscribe, count.read);
      return (
        <svg>
          {Array.from({ length: n }, (_, i) => (
            <circle key={i} r={i} />
          ))}
        </svg>
      );
    }
    const { container } = render(
      <SketchArtPicture>
        <Dots />
      </SketchArtPicture>,
    );
    const first = pictureOf(container).querySelector('img')!;
    expect(decode(first.src).match(/<circle/g)).toHaveLength(1);
    await act(async () => count.bump());
    await act(async () => vi.advanceTimersByTime(SKETCH_INK_SETTLE_MS - 1));
    expect(pictureOf(container).querySelector('img')).toBe(first);
    await act(async () => vi.advanceTimersByTime(1));
    const second = pictureOf(container).querySelector('img')!;
    expect(decode(second.src).match(/<circle/g)).toHaveLength(2);
    // An attribute set to what it already was is a change with nothing new to draw: the picture stays.
    const circle = hiderOf(container).querySelector('circle')!;
    await act(async () => circle.setAttribute('r', '0'));
    await act(async () => vi.advanceTimersByTime(SKETCH_INK_SETTLE_MS));
    expect(pictureOf(container).querySelector('img')).toBe(second);
  });

  it('takes the picture away when it unmounts', () => {
    const { container, unmount } = render(
      <SketchArtPicture>
        <svg>
          <rect />
        </svg>
      </SketchArtPicture>,
    );
    const picture = pictureOf(container);
    unmount();
    expect(picture.childElementCount).toBe(0);
  });
});
