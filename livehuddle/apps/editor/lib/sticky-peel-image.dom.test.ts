// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// docs/specs/008-canvas/canvas-performance.md "A pan or zoom repaints no filter": the canvas root
// carries the peel's pictures as short blob URLs, made once per page.

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

async function load() {
  const made: Blob[] = [];
  vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => {
    made.push(b as Blob);
    return `blob:peel-${made.length}`;
  });
  return { mod: await import('@liveworkspace/workbench/lib/sticky-peel-image'), made };
}

describe('stickyPeelVars in the browser', () => {
  it('makes each variant a PNG once, as a blob URL border-image and an inset', async () => {
    const { mod, made } = await load();
    const vars = mod.stickyPeelVars();
    expect(made.map((b) => b.type)).toEqual(['image/png', 'image/png']);
    expect(vars['--lvd-sticky-peel']).toMatch(/^url\("blob:peel-1"\) 0 48 56 48 \/ /);
    expect(vars['--lvd-sticky-peel-dark']).toMatch(/^url\("blob:peel-2"\) /);
    expect(vars['--lvd-sticky-peel-inset']).toBe('0 -9px -11px');
    expect(vars['--lvd-sticky-peel-dark-inset']).toBe('0 -10px -13px');
    // The same object every time, so a render that spreads it changes no style.
    expect(mod.stickyPeelVars()).toBe(vars);
    expect(made).toHaveLength(2);
  });

  it('hands the vars to a render through the hook', async () => {
    const { mod } = await load();
    const { result } = renderHook(() => mod.useStickyPeelVars());
    expect(result.current).toBe(mod.stickyPeelVars());
  });
});
