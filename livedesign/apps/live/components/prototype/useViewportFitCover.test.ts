// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { useViewportFitCover, withViewportFitCover } from './useViewportFitCover';

// docs/specs/007-editor/wireframe-pages.md "Safe areas on a phone": the player takes viewport-fit=cover while open.
afterEach(() => document.head.querySelector('meta[name="viewport"]')?.remove());

const viewport = (content: string) => {
  const meta = document.createElement('meta');
  meta.name = 'viewport';
  meta.content = content;
  document.head.append(meta);
  return meta;
};

describe('withViewportFitCover', () => {
  it('adds the cover fit, replacing any fit already named', () => {
    expect(withViewportFitCover('width=device-width, initial-scale=1')).toBe(
      'width=device-width, initial-scale=1, viewport-fit=cover',
    );
    expect(withViewportFitCover('width=device-width, Viewport-Fit = contain,initial-scale=1')).toBe(
      'width=device-width, initial-scale=1, viewport-fit=cover',
    );
    expect(withViewportFitCover('')).toBe('viewport-fit=cover');
  });

  it('reads a long run of commas and spaces well inside a frame', () => {
    const long = `${' ,'.repeat(50_000)}width=device-width`;
    expect(cpuMsOf(() => withViewportFitCover(long))).toBeLessThan(cpuBudgetMs(50));
  });
});

describe('useViewportFitCover', () => {
  it('covers while on, and gives the viewport back as it was', () => {
    const meta = viewport('width=device-width, initial-scale=1');
    const { rerender, unmount } = renderHook(({ on }) => useViewportFitCover(on), {
      initialProps: { on: true },
    });
    expect(meta.content).toBe('width=device-width, initial-scale=1, viewport-fit=cover');
    rerender({ on: false });
    expect(meta.content).toBe('width=device-width, initial-scale=1');
    rerender({ on: true });
    unmount();
    expect(meta.content).toBe('width=device-width, initial-scale=1');
  });

  it('does nothing while off, or where the page has no viewport meta', () => {
    const meta = viewport('width=device-width');
    renderHook(() => useViewportFitCover(false));
    expect(meta.content).toBe('width=device-width');
    meta.remove();
    expect(() => renderHook(() => useViewportFitCover(true))).not.toThrow();
  });

  it('covers a viewport meta with no content, and empties it again', () => {
    const meta = document.createElement('meta');
    meta.name = 'viewport';
    document.head.append(meta);
    const { unmount } = renderHook(() => useViewportFitCover(true));
    expect(meta.content).toBe('viewport-fit=cover');
    unmount();
    expect(meta.content).toBe('');
  });
});
