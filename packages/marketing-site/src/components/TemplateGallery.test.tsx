// @vitest-environment jsdom
// The template band: one shelf open, the rest folded into cards, a card opening its shelf in the open one's place.
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { TemplateGallery, type TemplateShelf } from './TemplateGallery';

type T = { kind: string };
const SHELVES: TemplateShelf<'popular' | 'flow', T>[] = [
  { id: 'popular', label: 'Blank Slate', templates: [{ kind: 'blank' }] },
  { id: 'flow', label: 'Flow', templates: [{ kind: 'a' }, { kind: 'b' }] },
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
function Tiles(props: {
  groups: TemplateShelf<'popular' | 'flow', T>[];
  onOpen: (id: 'popular' | 'flow') => void;
}) {
  return (
    <div>
      {props.groups.map((g) => (
        <button key={g.id} type="button" onClick={() => props.onOpen(g.id)}>
          Open {g.label}
        </button>
      ))}
    </div>
  );
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
      Tiles={Tiles}
      Card={Card}
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
    expect(screen.getByRole('button', { name: 'Open Flow' })).toBeTruthy();
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
    fireEvent.click(screen.getByRole('button', { name: 'Open Flow' }));
    const shelf = screen.getByTestId('shelf');
    expect(shelf.dataset.key).toBe('a,b');
    expect(shelf.dataset.reveal).toBe('true');
    expect(screen.getByRole('button', { name: 'Open Blank Slate' })).toBeTruthy();
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'auto' }));
  });

  it('leaves a shelf already on screen where it is', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 200,
      bottom: 400,
    } as DOMRect);
    renderGallery();
    fireEvent.click(screen.getByRole('button', { name: 'Open Flow' }));
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('falls back to the first shelf, and folds nothing when there is one', () => {
    renderGallery([SHELVES[1]!]);
    expect(screen.getByTestId('shelf').dataset.key).toBe('a,b');
    expect(screen.queryByRole('button')).toBeNull();
  });
});
