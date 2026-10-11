// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  POPULAR_TEMPLATE_KINDS,
  TEMPLATES,
  TEMPLATE_CATEGORIES,
  isInTemplateCategory,
  type TemplateCategory,
} from '@livediagram/templates';
import { TemplatePickerBrowse, type ShelfCategory } from './TemplatePickerBrowse';
import type { TemplateModeFilter } from './useTemplateModeFilter';

const trackMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track: trackMock }));

// The template step's shelf (docs/specs/008-canvas/canvas-and-palette.md "Templates section"):
// Popular open by default with Blank Diagram leading it, every category folded
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
// The mode filter at All: every template shows.
const ALL_MODES: TemplateModeFilter = {
  choice: 'all',
  options: ['all', 'diagram', 'draw', 'illustrate'],
  choose: () => {},
  shows: () => true,
  counts: { all: 0, diagram: 0, draw: 0, illustrate: 0, plan: 0, facilitate: 0 },
};
const popular = POPULAR_TEMPLATE_KINDS.map(byKind);
const categoryTemplates = (c: TemplateCategory) =>
  TEMPLATES.filter((t) => isInTemplateCategory(t.kind, c));

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
      modeFilter={ALL_MODES}
    />
  );
}

// The open shelf's heading is the first h3; "Explore More Categories" follows it.
const stage = () => screen.getAllByRole('heading', { level: 3 })[0]!;

describe('the template shelf', () => {
  it('opens on Popular, Blank Diagram first, with no separate blank tile', () => {
    render(<Shelf />);
    expect(stage().textContent).toContain('Popular');
    expect(POPULAR_TEMPLATE_KINDS[0]).toBe('blank');
    const cards = screen.getAllByRole('button', { pressed: true });
    expect(cards[0]!.textContent).toContain('Blank Diagram');
    expect(screen.queryByRole('button', { name: 'Browse Popular templates' })).toBeNull();
    // Every real category is a folded tile the e2e helpers can find by name.
    for (const c of TEMPLATE_CATEGORIES) {
      expect(screen.getByRole('button', { name: `Browse ${c.label} templates` })).toBeTruthy();
    }
  });

  it('lists the category tiles alphabetically by name, Popular staying the shelf above them', () => {
    render(<Shelf />);
    const names = screen
      .getAllByRole('button', { name: /^Browse .* templates$/ })
      .map((b) => b.getAttribute('aria-label')!.replace(/^Browse | templates$/g, ''));
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en')));
    expect(names).toHaveLength(TEMPLATE_CATEGORIES.length);
    expect(stage().textContent).toContain('Popular');
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

  it('counts as more templates only those the open shelf does not already show', () => {
    render(<Shelf />);
    fireEvent.click(screen.getByRole('button', { name: 'Browse Finance templates' }));
    const open = new Set(categoryTemplates('finance').map((t) => t.kind));
    const more = new Set(
      TEMPLATE_CATEGORIES.filter((c) => c.id !== 'finance')
        .flatMap((c) => categoryTemplates(c.id))
        .map((t) => t.kind)
        .filter((k) => !open.has(k)),
    );
    // Finance shares a template with Spreadsheets (an Invoice), so the two counts differ.
    expect(
      TEMPLATE_CATEGORIES.filter((c) => c.id !== 'finance').some((c) =>
        categoryTemplates(c.id).some((t) => open.has(t.kind)),
      ),
    ).toBe(true);
    expect(
      screen.getByText(
        `${TEMPLATE_CATEGORIES.length} more categories, ${more.size} more templates`,
      ),
    ).toBeTruthy();
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
    // The flip animates: the first row was already on show, the rest rise in.
    const rising = (li: HTMLElement) => li.className.includes('animate-card-rise');
    expect(cards.map(rising)).toEqual(popular.map((_, i) => i >= 3));

    // Opening a tile keeps it expanded.
    fireEvent.click(screen.getByRole('button', { name: 'Browse Technical templates' }));
    expect(stage().textContent).toContain('Technical');
    expect(screen.getByRole('button', { name: 'Show Fewer Templates' })).toBeTruthy();
    // A tile plays only the stage's own rise, not the flip's cascade.
    expect(document.querySelector('.animate-card-rise')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Show Fewer Templates' }));
    expect(trackMock).toHaveBeenCalledWith('UI', 'Toggled', 'TemplateShelfCollapsed');
    expect(
      screen.getByRole('button', { name: 'Next Technical templates', hidden: true }),
    ).toBeTruthy();
  });

  it('opens a picked category expanded on desktop, its tiles re-forming as a carousel', () => {
    setDesktop(true);
    render(<Shelf />);
    fireEvent.click(screen.getByRole('button', { name: 'Browse Plan and Track templates' }));
    expect(stage().textContent).toContain('Plan and Track');
    expect(screen.getByRole('button', { name: 'Show Fewer Templates' })).toBeTruthy();
    const cards = within(screen.getAllByRole('list')[0]!).getAllByRole('listitem');
    expect(cards).toHaveLength(categoryTemplates('planning').length);
    expect(screen.getByRole('button', { name: 'Next more categories', hidden: true })).toBeTruthy();
    // The stage has its own rise, so only the re-formed tiles cascade.
    expect(cards.some((li) => li.className.includes('animate-card-rise'))).toBe(false);
    const tiles = within(screen.getAllByRole('list')[1]!).getAllByRole('listitem');
    expect(tiles.every((li) => li.className.includes('animate-card-rise'))).toBe(true);
    // Not a toggle flip, so no toggle event.
    expect(trackMock).not.toHaveBeenCalled();
  });

  it('opens a picked category as the carousel on a phone', () => {
    setDesktop(false);
    render(<Shelf />);
    fireEvent.click(screen.getByRole('button', { name: 'Browse Plan and Track templates' }));
    expect(
      screen.getByRole('button', { name: 'Next Plan and Track templates', hidden: true }),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Next more categories', hidden: true })).toBeNull();
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
