// @vitest-environment jsdom

// A layout previewed on its page (docs/specs/007-editor/pages-mode.md "Hover previews the
// layout on the page"): the page's own words and pictures carried in, as placing it lands them.
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pagesOf, layOutPages, type Element } from '@livedocuments/document';
import { buildPageLayout } from '@livedocuments/templates';
import {
  InfographicLayoutPreview,
  LAYOUT_PREVIEW_IN_MS,
  LAYOUT_PREVIEW_OUT_MS,
  LayoutPreviewHost,
} from './InfographicLayoutPreview';
import { PageImageAccessProvider } from './page-image-access';

const fetched = vi.hoisted(() => vi.fn(async (_owner: string, id: string) => `blob:${id}`));
vi.mock('@/lib/api-client', () => ({
  apiFetchImageBlobUrl: fetched,
  releaseImageBlobUrl: () => {},
}));

afterEach(cleanup);

const pages = layOutPages(pagesOf({ pages: [{ id: 'p', orientation: 'portrait' }] }));
const page = pages[0]!;
const written = (): Element[] =>
  buildPageLayout('title', page).map((el) =>
    el.type === 'text' && el.label === 'Your big headline'
      ? { ...el, label: 'Q3 Results' }
      : el.type === 'image'
        ? { ...el, imageId: 'photo-1' }
        : el,
  );

describe('InfographicLayoutPreview', () => {
  it('shows the layout alone without the page content', () => {
    const { container } = render(<InfographicLayoutPreview page={page} layout="poster" />);
    expect(container.textContent).toContain('Make it bold');
  });

  it('carries the page words and pictures into the previewed layout', async () => {
    const { container } = render(
      <PageImageAccessProvider access={{ ownerId: 'o', documentId: 'd', shareCode: null }}>
        <InfographicLayoutPreview page={page} layout="poster" elements={written()} pages={pages} />
      </PageImageAccessProvider>,
    );
    expect(container.textContent).toContain('Q3 Results');
    expect(container.textContent).not.toContain('Make it bold');
    await act(async () => {});
    expect(fetched).toHaveBeenCalledWith('o', 'photo-1', { documentId: 'd', shareCode: null });
    expect(container.innerHTML).toContain('blob:photo-1');
  });
});

// Moving across the tiles reads as the page changing, not pictures swapping: the next layout settles in over the
// last, which fades out under it; leaving the tiles fades the preview away.
describe('LayoutPreviewHost', () => {
  const layers = (c: HTMLElement) => [...c.querySelectorAll('[data-layout-preview] > svg')];

  it('crossfades from one hovered layout to the next, then lets the old one go', () => {
    vi.useFakeTimers();
    try {
      const { container, rerender } = render(<LayoutPreviewHost page={page} layout="poster" />);
      expect(layers(container)).toHaveLength(1);
      rerender(<LayoutPreviewHost page={page} layout="title" />);
      expect(layers(container)).toHaveLength(2);
      expect(layers(container)[0]!.getAttribute('class')).toContain('opacity-0');
      act(() => {
        vi.advanceTimersByTime(LAYOUT_PREVIEW_OUT_MS);
      });
      expect(layers(container)).toHaveLength(1);
      expect(container.querySelector('[data-layout-preview]')!.getAttribute('data-layout-preview')).toBe('title');
    } finally {
      vi.useRealTimers();
    }
  });

  it('fades out as the hover ends, then is gone', () => {
    vi.useFakeTimers();
    try {
      const { container, rerender } = render(<LayoutPreviewHost page={page} layout="poster" />);
      rerender(<LayoutPreviewHost page={undefined} layout={undefined} />);
      const sheet = container.querySelector('[data-layout-preview]')!;
      expect(sheet.getAttribute('class')).toContain('opacity-0');
      act(() => {
        vi.advanceTimersByTime(LAYOUT_PREVIEW_OUT_MS);
      });
      expect(container.querySelector('[data-layout-preview]')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

it('keeps its literal durations in step with the exported timings', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync('components/canvas/InfographicLayoutPreview.tsx', 'utf8');
  expect(src).toContain(`duration-[${LAYOUT_PREVIEW_OUT_MS}ms]`);
  expect(src).toContain(`duration-[${LAYOUT_PREVIEW_IN_MS}ms]`);
});
