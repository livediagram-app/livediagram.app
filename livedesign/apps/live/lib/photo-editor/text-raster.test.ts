import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TextLayer } from '@livedesign/photo-engine';
import { drawText } from './text-raster';

const FSI = '⁨';
const PDI = '⁩';

function layer(text: string): TextLayer {
  return {
    id: 't',
    name: 'T',
    layerKind: 'text',
    text: {
      text,
      font: 'inter',
      size: 12,
      weight: 400,
      colour: '#000000',
      align: 'left',
      at: { x: 0, y: 0 },
    },
  };
}

/** The lines drawText hands the canvas, from a stub 2D context (Node has no canvas). */
function drawnLines(text: string): string[] {
  const drawn: string[] = [];
  const ctx = {
    font: '',
    fillStyle: '',
    textBaseline: '',
    textAlign: '',
    measureText: (t: string) => ({ width: t.length * 6 }),
    fillText: (t: string) => drawn.push(t),
    getImageData: (_x: number, _y: number, w: number, h: number) => ({
      data: new Uint8ClampedArray(w * h * 4),
    }),
  };
  vi.stubGlobal(
    'OffscreenCanvas',
    class {
      getContext() {
        return ctx;
      }
    },
  );
  drawText(layer(text));
  return drawn;
}

afterEach(() => vi.unstubAllGlobals());

describe('drawText', () => {
  it('isolates a right-to-left line so it reads from its first strong letter', () => {
    expect(drawnLines('שלום עולם!\nHello')).toEqual([`${FSI}שלום עולם!${PDI}`, 'Hello']);
  });
});
