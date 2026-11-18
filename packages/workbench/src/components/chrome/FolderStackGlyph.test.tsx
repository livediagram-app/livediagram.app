// @vitest-environment jsdom

// A tab folder's stacked glyph (docs/specs/006-document/tab-folders.md "Tab bar rendering"): one folder per tab up to
// three, each behind cut away where the ones in front sit, and a joining layer slides out unless motion is reduced.

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FOLDER_STACK_MAX, FolderStackGlyph, folderStackLayers } from './FolderStackGlyph';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const svg = (c: HTMLElement) => c.querySelector('svg[data-folder-stack]') as SVGSVGElement;
const layers = (c: HTMLElement) =>
  Array.from(c.querySelectorAll('[data-folder-layer]')).map((g) =>
    g.getAttribute('data-folder-layer'),
  );

describe('folderStackLayers', () => {
  it('draws one layer per tab, at least one and at most three', () => {
    expect([0, 1, 2, 3, 4, 50, 2.7].map(folderStackLayers)).toEqual([1, 1, 2, 3, 3, 3, 2]);
    expect(FOLDER_STACK_MAX).toBe(3);
  });
});

describe('FolderStackGlyph', () => {
  it('draws a single folder at the size it is given, with no masks', () => {
    const { container } = render(<FolderStackGlyph count={1} />);
    expect(svg(container).getAttribute('data-folder-stack')).toBe('1');
    expect(svg(container).getAttribute('width')).toBe('14');
    expect(svg(container).getAttribute('aria-hidden')).toBe('true');
    expect(layers(container)).toEqual(['0']);
    expect(container.querySelector('mask')).toBeNull();
    expect(svg(container).style.marginTop).toBe('');
  });

  it('paints back to front, each layer behind fainter and cut by every layer in front', () => {
    const { container } = render(<FolderStackGlyph count={7} />);
    expect(layers(container)).toEqual(['2', '1', '0']);
    const masks = Array.from(container.querySelectorAll('mask'));
    expect(masks).toHaveLength(2);
    // The second layer is cut by the front one; the third by both in front of it.
    expect(masks.map((m) => m.querySelectorAll('path').length)).toEqual([2, 1]);
    const g = (k: number) => container.querySelector(`[data-folder-layer="${k}"]`)!;
    expect(g(0).getAttribute('mask')).toBeNull();
    expect(g(1).getAttribute('mask')).toBe(`url(#${masks[1]!.id})`);
    expect(g(2).getAttribute('mask')).toBe(`url(#${masks[0]!.id})`);
    expect(Number(g(2).getAttribute('opacity'))).toBeLessThan(Number(g(1).getAttribute('opacity')));
    // Wider and taller than one folder by the two steps behind it.
    const width = Number(svg(container).getAttribute('width'));
    expect(width).toBeGreaterThan(14);
    // The layers behind rise above the line, so the front folder sits where a single one does.
    expect(parseFloat(svg(container).style.marginTop)).toBeCloseTo(14 - width, 3);
  });

  it('gives each glyph its own mask ids', () => {
    const { container } = render(
      <>
        <FolderStackGlyph count={2} />
        <FolderStackGlyph count={2} />
      </>,
    );
    const ids = Array.from(container.querySelectorAll('mask')).map((m) => m.id);
    expect(new Set(ids).size).toBe(2);
  });

  it('slides a joining layer out from behind, and not on first paint', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: false })),
    );
    const animate = vi.fn();
    Object.defineProperty(SVGElement.prototype, 'animate', { value: animate, configurable: true });
    const { rerender } = render(<FolderStackGlyph count={1} />);
    expect(animate).not.toHaveBeenCalled();
    rerender(<FolderStackGlyph count={3} />);
    expect(animate).toHaveBeenCalledTimes(2);
    rerender(<FolderStackGlyph count={2} />);
    expect(animate).toHaveBeenCalledTimes(2);
    delete (SVGElement.prototype as { animate?: unknown }).animate;
  });

  it('adds a layer at once under reduced motion', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true })),
    );
    const animate = vi.fn();
    Object.defineProperty(SVGElement.prototype, 'animate', { value: animate, configurable: true });
    const { rerender, container } = render(<FolderStackGlyph count={1} />);
    rerender(<FolderStackGlyph count={2} />);
    expect(animate).not.toHaveBeenCalled();
    expect(layers(container)).toEqual(['1', '0']);
    delete (SVGElement.prototype as { animate?: unknown }).animate;
  });

  it('adds a layer without sliding where the browser cannot animate', () => {
    vi.stubGlobal('matchMedia', undefined);
    const { rerender, container } = render(<FolderStackGlyph count={2} />);
    rerender(<FolderStackGlyph count={3} />);
    expect(layers(container)).toEqual(['2', '1', '0']);
  });
});
