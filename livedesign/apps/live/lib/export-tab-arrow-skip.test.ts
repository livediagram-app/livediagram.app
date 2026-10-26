// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ArrowElement, ShapeElement, Tab } from '@livedesign/design';
import { renderTabToCanvas } from './export-tab';

// One arrow the browser can't draw is skipped and logged; the PNG / PDF still comes out with
// everything else (docs/specs/020-import-export/export-fidelity.md).

let rasterised: string[] = [];

beforeEach(() => {
  rasterised = [];
  const ctx = new Proxy(
    {},
    {
      get: (_, key) =>
        key === 'measureText' ? (text: string) => ({ width: text.length * 7 }) : () => undefined,
      set: () => true,
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as never);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  class FakeImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(value: string) {
      const svg = decodeURIComponent(value.slice('data:image/svg+xml;charset=utf-8,'.length));
      rasterised.push(svg);
      // The browser refuses any SVG holding the broken arrow's label.
      queueMicrotask(() => (svg.includes('BROKEN') ? this.onerror?.() : this.onload?.()));
    }
  }
  vi.stubGlobal('Image', FakeImage);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const box = (id: string, x: number): ShapeElement => ({
  id,
  type: 'shape',
  shape: 'square',
  x,
  y: 0,
  width: 100,
  height: 80,
});

const arrow = (id: string, label: string): ArrowElement => ({
  id,
  type: 'arrow',
  from: { kind: 'pinned', elementId: 'a', anchor: 'e' },
  to: { kind: 'pinned', elementId: 'b', anchor: 'w' },
  label,
});

describe('renderTabToCanvas with an arrow that fails to draw', () => {
  it('skips that arrow, logs it, and still draws the others', async () => {
    const tab = {
      id: 't',
      name: 'T',
      elements: [box('a', 0), box('b', 300), arrow('bad', 'BROKEN'), arrow('good', 'Fine')],
    } as unknown as Tab;
    await expect(renderTabToCanvas(tab, { fontCss: '' })).resolves.toBeDefined();
    expect(rasterised.some((svg) => svg.includes('Fine') && !svg.includes('BROKEN'))).toBe(true);
    expect(console.warn).toHaveBeenCalledWith('[export] arrow skipped', { elementId: 'bad' });
  });
});
