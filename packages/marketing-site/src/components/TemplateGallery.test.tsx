// @vitest-environment jsdom
// The template band: one shelf open, the rest folded into cards, a card opening its shelf in the open one's place, and
// the folded shelves' templates as plain links rather than cards.
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { TemplateGallery, type TemplateShelf } from './TemplateGallery';

type T = { kind: string; title: string };
const t = (kind: string, title: string): T => ({ kind, title });
const SHELVES: TemplateShelf<'popular' | 'flow' | 'team', T>[] = [
  { id: 'popular', label: 'Blank Slate', templates: [t('blank', 'Blank')] },
  { id: 'flow', label: 'Flow', templates: [t('b', 'Bravo'), t('a', 'Alpha')] },
  // Cross-listed: Alpha is on Flow too.
  { id: 'team', label: 'Team', templates: [t('a', 'Alpha'), t('c', 'Charlie')] },
];

function Carousel(props: {
  label: string;
  count: number;
  itemsKey: string;
  reveal?: boolean;
  children: ReactNode;
}) {
  return (
    <div data-testid="shelf" data-key={props.itemsKey} data-reveal={String(props.reveal)}>
      <h3>
        {props.label} ({props.count})
      </h3>
      <ul>{props.children}</ul>
    </div>
  );
}
function Preview(props: { kind: string }) {
  return <span data-testid="preview" data-kind={props.kind} />;
}
function Card(props: { template: T; source: 'Home.Gallery' }) {
  return (
    <a href={`/new?template=${props.template.kind}`}>{`${props.template.kind} ${props.source}`}</a>
  );
}

const renderGallery = (shelves = SHELVES) =>
  render(
    <TemplateGallery
      shelves={shelves}
      initial="popular"
      eyebrow="One canvas, many jobs"
      lead="Every template is here."
      Carousel={Carousel}
      Preview={Preview}
      Card={Card}
      href={(t) => `/new?template=${t.kind}&from=index`}
    />,
  );

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('TemplateGallery', () => {
  it('opens the initial shelf on load and folds the rest, standing still', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    renderGallery();
    expect(screen.getByText('One canvas, many jobs')).toBeTruthy();
    expect(screen.getByText('Every template is here.')).toBeTruthy();
    const shelf = screen.getByTestId('shelf');
    expect(shelf.dataset.key).toBe('blank');
    expect(shelf.dataset.reveal).toBe('false');
    expect(screen.getByText('blank Home.Gallery')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Show\s*Flow\s*2 templates/ })).toBeTruthy();
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('opens a folded shelf in the open one’s place and scrolls it into view', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      top: -400,
      bottom: -100,
    } as DOMRect);
    renderGallery();
    fireEvent.click(screen.getByRole('button', { name: /Show\s*Flow\s*2 templates/ }));
    const shelf = screen.getByTestId('shelf');
    expect(shelf.dataset.key).toBe('b,a');
    expect(shelf.dataset.reveal).toBe('true');
    expect(screen.getByRole('button', { name: /Show\s*Blank Slate\s*1 template/ })).toBeTruthy();
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'auto' }));
  });

  it('leaves a shelf already on screen where it is', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 200,
      bottom: 400,
    } as DOMRect);
    renderGallery();
    fireEvent.click(screen.getByRole('button', { name: /Show\s*Flow\s*2 templates/ }));
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('draws no cards for a folded shelf, listing its templates as plain links once each, A to Z', () => {
    const { container } = renderGallery();
    // Only Blank Slate's card; Flow and Team are category cards, their templates links in the index.
    expect(screen.getAllByText(/Home\.Gallery$/).map((a) => a.textContent)).toEqual([
      'blank Home.Gallery',
    ]);
    // Each folded category's card fans its own previews (only the front one in the first paint).
    const tiles = screen.getAllByRole('button', { name: /Show/ });
    expect(
      tiles.map((b) =>
        [...b.querySelectorAll<HTMLElement>('[data-testid="preview"]')].map((p) => p.dataset.kind),
      ),
    ).toEqual([['a'], ['c']]);
    expect(screen.getByText('2 more categories, 3 more templates')).toBeTruthy();
    const index = container.querySelector('details');
    expect(index?.open).toBe(false);
    expect(index?.querySelector('summary')?.textContent).toBe('Every Template A to Z3');
    const links = [...(index?.querySelectorAll('a') ?? [])];
    expect(links.map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['Alpha', '/new?template=a&from=index'],
      ['Bravo', '/new?template=b&from=index'],
      ['Charlie', '/new?template=c&from=index'],
    ]);
  });

  it('renders a shelf’s cards when it opens, and its templates leave the index', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    const { container } = renderGallery();
    fireEvent.click(screen.getByRole('button', { name: /Show\s*Team\s*2 templates/ }));
    expect(screen.getByText('a Home.Gallery')).toBeTruthy();
    expect(screen.getByText('c Home.Gallery')).toBeTruthy();
    const links = [...(container.querySelector('details')?.querySelectorAll('a') ?? [])];
    expect(links.map((a) => a.textContent)).toEqual(['Blank', 'Bravo']);
    expect(screen.getByText('2 more categories, 3 more templates')).toBeTruthy();
  });

  it('names a lone folded shelf and its one template in the singular', () => {
    renderGallery([SHELVES[0]!, { id: 'flow', label: 'Flow', templates: [t('a', 'Alpha')] }]);
    expect(screen.getByText('1 more category, 1 more template')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Show\s*Flow\s*1 template$/ })).toBeTruthy();
  });

  it('falls back to the first shelf, and folds nothing when there is one', () => {
    renderGallery([SHELVES[1]!]);
    expect(screen.getByTestId('shelf').dataset.key).toBe('b,a');
    expect(screen.queryByRole('button')).toBeNull();
  });
});
