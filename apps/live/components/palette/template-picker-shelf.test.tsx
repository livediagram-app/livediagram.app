// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  POPULAR_TEMPLATE_KINDS,
  TEMPLATES,
  TEMPLATE_CATEGORIES,
  templateCategory,
  type TemplateCategory,
} from '@livediagram/templates';
import { TemplatePickerBrowse, type ShelfCategory } from './TemplatePickerBrowse';

const trackMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track: trackMock }));

// The template step's shelf (docs/specs/008-canvas/canvas-and-palette.md "Templates section"):
// Popular open by default with Blank Canvas leading it, every category folded
// beneath as a "Browse <name> templates" tile, and a tile swapping its shelf in.

// jsdom has neither; the carousel measures its track and the shelf scrolls
// itself into view.
globalThis.ResizeObserver ??= class {
  observe() {}
  disconnect() {}
  unobserve() {}
} as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= () => {};
Element.prototype.scrollTo ??= () => {};

const byKind = (kind: string) => TEMPLATES.find((t) => t.kind === kind)!;
const popular = POPULAR_TEMPLATE_KINDS.map(byKind);
const categoryTemplates = (c: TemplateCategory) =>
  TEMPLATES.filter((t) => t.kind !== 'blank' && templateCategory(t.kind) === c);

function Shelf({ initialExpanded = false }: { initialExpanded?: boolean }) {
  const [open, setOpen] = useState<ShelfCategory | null>(null);
  const [expanded, setExpanded] = useState(initialExpanded);
  return (
    <TemplatePickerBrowse
      showIdentity={false}
      templateQuery=""
      setTemplateQuery={() => {}}
      templateFilter=""
      filteredTemplates={[]}
      openCategory={open}
      setOpenCategory={setOpen}
      shelfExpanded={expanded}
      setShelfExpanded={setExpanded}
      popularTemplates={popular}
      categoryTemplates={categoryTemplates}
      templateKind="blank"
      onTemplateCommit={vi.fn()}
    />
  );
}

// The open shelf's heading is the first h3; "Explore More Categories" follows it.
const stage = () => screen.getAllByRole('heading', { level: 3 })[0]!;

describe('the template shelf', () => {
  it('opens on Popular, Blank Canvas first, with no separate blank tile', () => {
    render(<Shelf />);
    expect(stage().textContent).toContain('Popular');
    expect(POPULAR_TEMPLATE_KINDS[0]).toBe('blank');
    const cards = screen.getAllByRole('button', { pressed: true });
    expect(cards[0]!.textContent).toContain('Blank Canvas');
    expect(screen.queryByRole('button', { name: 'Browse Popular templates' })).toBeNull();
    // Every real category is a folded tile the e2e helpers can find by name.
    for (const c of TEMPLATE_CATEGORIES) {
      expect(screen.getByRole('button', { name: `Browse ${c.label} templates` })).toBeTruthy();
    }
  });

  it('swaps an opened tile into the stage and folds Popular into the tiles', () => {
    render(<Shelf />);
    fireEvent.click(screen.getByRole('button', { name: 'Browse Technical templates' }));
    expect(stage().textContent).toContain('Technical');
    expect(screen.getByRole('button', { name: 'Browse Popular templates' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Browse Technical templates' })).toBeNull();
    const list = screen.getAllByRole('list')[0]!;
    expect(within(list).getAllByRole('listitem')).toHaveLength(
      categoryTemplates('technical').length,
    );
  });

  it('lists only real templates in Popular', () => {
    for (const kind of POPULAR_TEMPLATE_KINDS) expect(byKind(kind)).toBeDefined();
    expect(new Set(POPULAR_TEMPLATE_KINDS).size).toBe(POPULAR_TEMPLATE_KINDS.length);
  });
});

// The expand toggle inverts the flow on desktop: every card of the open shelf,
// the other categories as the carousel.
describe('the expand toggle', () => {
  const setDesktop = (matches: boolean) => {
    window.matchMedia = ((query: string) => ({
      matches,
      media: query,
      addEventListener() {},
      removeEventListener() {},
    })) as unknown as typeof window.matchMedia;
  };
  afterEach(() => {
    // @ts-expect-error jsdom has no matchMedia; restore that.
    delete window.matchMedia;
    trackMock.mockClear();
  });

  it('sits beside the carousel arrows and, on desktop, inverts the flow', () => {
    setDesktop(true);
    render(<Shelf />);
    // Collapsed: the open shelf is the carousel, the categories a grid.
    expect(
      screen.getByRole('button', { name: 'Next Popular templates', hidden: true }),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Next more categories', hidden: true })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Show All Templates' }));
    expect(trackMock).toHaveBeenCalledWith('UI', 'Toggled', 'TemplateShelfExpanded');
    // Expanded: every Popular card at once, and the categories are the carousel.
    expect(
      screen.queryByRole('button', { name: 'Next Popular templates', hidden: true }),
    ).toBeNull();
    const cards = within(screen.getAllByRole('list')[0]!).getAllByRole('listitem');
    expect(cards).toHaveLength(popular.length);
    expect(screen.getByRole('button', { name: 'Next more categories', hidden: true })).toBeTruthy();

    // Opening a tile keeps the flow inverted.
    fireEvent.click(screen.getByRole('button', { name: 'Browse Technical templates' }));
    expect(stage().textContent).toContain('Technical');
    expect(screen.getByRole('button', { name: 'Show Fewer Templates' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Show Fewer Templates' }));
    expect(trackMock).toHaveBeenCalledWith('UI', 'Toggled', 'TemplateShelfCollapsed');
    expect(
      screen.getByRole('button', { name: 'Next Technical templates', hidden: true }),
    ).toBeTruthy();
  });

  it('never inverts on a phone, even with the flag held', () => {
    setDesktop(false);
    render(<Shelf initialExpanded />);
    expect(
      screen.getByRole('button', { name: 'Next Popular templates', hidden: true }),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Next more categories', hidden: true })).toBeNull();
    // The toggle is CSS-hidden below `sm`.
    expect(screen.getByRole('button', { name: 'Show All Templates' }).className).toMatch(
      /(^| )hidden( |$)/,
    );
  });
});
