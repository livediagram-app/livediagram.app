// @vitest-environment jsdom

// A layout previewed on its page (docs/specs/007-editor/pages-mode.md "Hover previews the
// layout on the page"): the page's own words carried in, as placing it lands them.
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { pagesOf, layOutPages, type Element } from '@liveplanner/document';
import { buildPageLayout } from '@liveplanner/templates';
import { InfographicLayoutPreview } from './InfographicLayoutPreview';

afterEach(cleanup);

const pages = layOutPages(pagesOf({ pages: [{ id: 'p', orientation: 'portrait' }] }));
const page = pages[0]!;
const written = (): Element[] =>
  buildPageLayout('title', page).map((el) =>
    el.type === 'text' && el.label === 'Your big headline' ? { ...el, label: 'Q3 Results' } : el,
  );

describe('InfographicLayoutPreview', () => {
  it('shows the layout alone without the page content', () => {
    const { container } = render(<InfographicLayoutPreview page={page} layout="poster" />);
    expect(container.textContent).toContain('Make it bold');
  });

  it('carries the page words into the previewed layout', () => {
    const { container } = render(
      <InfographicLayoutPreview page={page} layout="poster" elements={written()} pages={pages} />,
    );
    expect(container.textContent).toContain('Q3 Results');
    expect(container.textContent).not.toContain('Make it bold');
  });
});
