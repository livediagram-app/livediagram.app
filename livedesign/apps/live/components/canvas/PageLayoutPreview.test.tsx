// @vitest-environment jsdom

// A layout previewed on its page (docs/specs/007-editor/pages-mode.md "Hover previews the
// layout on the page"): the page's own words carried in, as placing it lands them.
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pagesOf, layOutPages, type Element } from '@livedesign/design';
import { buildPageLayout } from '@livedesign/templates';
import { PageLayoutPreview } from './PageLayoutPreview';
import { PageImageAccessProvider } from './page-image-access';

vi.mock('@/lib/api-client', () => ({
  apiFetchImageBlobUrl: vi.fn(async (_owner: string, id: string) => `blob:${id}`),
  releaseImageBlobUrl: () => {},
}));

afterEach(cleanup);

const pages = layOutPages(
  pagesOf({ pages: [{ id: 'p', orientation: 'portrait', size: 'logo', kind: 'logo' }] }),
);
const page = pages[0]!;
const written = (): Element[] =>
  buildPageLayout('logo-icon-above', page).map((el) =>
    el.type === 'text' && el.label === 'Brand' ? { ...el, label: 'Acme' } : el,
  );

describe('PageLayoutPreview', () => {
  it('shows the layout alone without the page content', () => {
    const { container } = render(<PageLayoutPreview page={page} layout="logo-stacked" />);
    expect(container.textContent).toContain('BRAND');
  });

  it('carries the page words into the previewed layout', () => {
    const { container } = render(
      <PageImageAccessProvider access={{ ownerId: 'o', designId: 'd', shareCode: null }}>
        <PageLayoutPreview page={page} layout="logo-stacked" elements={written()} pages={pages} />
      </PageImageAccessProvider>,
    );
    expect(container.textContent).toContain('ACME');
    expect(container.textContent).not.toContain('BRAND');
  });
});
