// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PageBackground, PageImageFill } from '@livedesign/design';

// docs/specs/007-editor/pages-mode.md "Image backgrounds", Blur: which copy a page sheet's picture asks for.
const asked = vi.hoisted(() => [] as [string | undefined, number][]);
vi.mock('@liveworkspace/workbench/hooks/canvas/useBlurredPageImage', () => ({
  useBlurredPageImage: (src: string | undefined, _page: unknown, sigma: number) => {
    asked.push([src, sigma]);
    return src && sigma > 0 ? 'blob:soft' : null;
  },
}));
const { usePageSheetImage } = await import('./usePageSheetImage');

const picture = (over: Partial<PageImageFill> = {}): PageBackground => ({
  fill: { kind: 'image', imageId: 'img-1', tone: '#203040', ...over },
});
const size = { width: 1000, height: 500 };
const sources = (id: string) => (id === 'img-1' ? 'blob:sharp' : undefined);
const shown = (bg: PageBackground | undefined) =>
  renderHook(() => usePageSheetImage(bg, size, sources)).result.current;

describe('usePageSheetImage', () => {
  it('asks for a copy at the stored strength of the page size, and paints it', () => {
    asked.length = 0;
    // Blur 0.5 of 4% of the short side (500): sigma 10.
    expect(shown(picture({ blur: 0.5 }))).toBe('blob:soft');
    expect(asked.at(-1)).toEqual(['blob:sharp', 10]);
  });

  it('leaves a sharp picture, a hover preview and a page with no picture to the sheet', () => {
    expect(shown(picture())).toBeUndefined();
    expect(shown(picture({ blur: 0.5, preview: 'https://api.openverse.org/t/1' }))).toBeUndefined();
    expect(shown({ fill: { kind: 'solid', color: '#ffffff' } })).toBeUndefined();
    expect(shown(undefined)).toBeUndefined();
  });
});
