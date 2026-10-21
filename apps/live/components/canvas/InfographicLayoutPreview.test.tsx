// @vitest-environment jsdom

// A layout previewed on its page (docs/specs/007-editor/pages-mode.md "Hover previews the
// layout on the page"): the page's own words and pictures carried in, as placing it lands them.
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pagesOf, layOutPages, type Element } from '@liveplanner/document';
import { buildPageLayout } from '@liveplanner/templates';
import { InfographicLayoutPreview } from './InfographicLayoutPreview';
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
