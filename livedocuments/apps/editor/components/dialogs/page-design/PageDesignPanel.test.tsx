// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PAGE_DESIGNS,
  PAGE_DESIGN_SETS,
  layOutPages,
  type Page,
  type PageDesign,
  type PageDesignOverride,
} from '@livedocuments/document';
import { TabStylePagesContext, type TabStylePages } from '../tab-style-pages';
import { PageDesignPanel } from './PageDesignPanel';

afterEach(cleanup);

const slide = (id: string, design?: PageDesignOverride): Page => ({
  id,
  orientation: 'landscape',
  size: 'slide',
  kind: 'slide',
  ...(design ? { design } : {}),
});

function open(tabDesign?: PageDesign, pageDesign?: PageDesignOverride) {
  const edits = {
    setTabDesign: vi.fn(),
    tuneTabDesign: vi.fn(),
    setPageDesign: vi.fn(),
    tunePageDesign: vi.fn(),
    applyDesignSet: vi.fn(async () => {}),
  };
  const row = layOutPages([slide('a', pageDesign), slide('b')]);
  const pages: TabStylePages = {
    kind: 'slide',
    newPageBackground: undefined,
    themeId: 'brand',
    units: 2,
    onSet: () => {},
    onApplyToEveryPage: () => {},
    design: {
      tabDesign,
      page: row[0],
      pages: row,
      elements: [],
      theme: {},
      tabFont: undefined,
      paperDark: false,
      edits,
    },
  };
  render(
    <TabStylePagesContext.Provider value={pages}>
      <PageDesignPanel />
    </TabStylePagesContext.Provider>,
  );
  return edits;
}

describe('the Page Design panel', () => {
  it('offers None and every design, grouped by family, and a pick applies it to the tab', async () => {
    const edits = open();
    const grid = screen.getByRole('region', { name: 'Designs' });
    for (const d of PAGE_DESIGNS)
      expect(within(grid).getByRole('button', { name: d.label })).toBeTruthy();
    expect(PAGE_DESIGNS.length).toBeGreaterThanOrEqual(40);
    expect(within(grid).getByRole('button', { name: 'None' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    fireEvent.click(within(grid).getByRole('button', { name: 'Aurora' }));
    expect(edits.setTabDesign).toHaveBeenCalledWith({ id: 'aurora' });
    // No design worn: no Fine Tune.
    expect(screen.queryByRole('region', { name: 'Fine Tune' })).toBeNull();
  });

  it('applies a design set in one press', () => {
    const edits = open();
    const sets = screen.getByRole('region', { name: 'Design Sets' });
    fireEvent.click(
      within(sets).getByRole('button', { name: new RegExp(PAGE_DESIGN_SETS[1]!.label) }),
    );
    expect(edits.applyDesignSet).toHaveBeenCalledWith(PAGE_DESIGN_SETS[1]!.id);
  });

  it('tunes the worn design live: a slider ticks, a switch is one step, Reset keeps the design', async () => {
    const edits = open({ id: 'aurora', intensity: 0.5 });
    const tune = await screen.findByRole('region', { name: 'Fine Tune' });
    fireEvent.change(within(tune).getByRole('slider', { name: 'Intensity' }), {
      target: { value: '0.6' },
    });
    expect(edits.tuneTabDesign).toHaveBeenCalledWith({ id: 'aurora', intensity: 0.6 });
    fireEvent.click(within(tune).getByRole('switch', { name: 'Animate' }));
    expect(edits.setTabDesign).toHaveBeenCalledWith({
      id: 'aurora',
      intensity: 0.5,
      animate: true,
    });
    fireEvent.click(within(tune).getByRole('button', { name: 'Reset' }));
    expect(edits.setTabDesign).toHaveBeenLastCalledWith({ id: 'aurora' });
    expect(within(tune).getByRole('switch', { name: 'Bold Title and Section Pages' })).toBeTruthy();
    expect(within(tune).getByRole('switch', { name: 'Flow Across Pages' })).toBeTruthy();
  });

  it('on This Page sets the page’s own, hides the sets, and Use the Tab’s Design clears it', async () => {
    const edits = open({ id: 'aurora' }, { id: 'waves' });
    fireEvent.click(screen.getByRole('button', { name: 'This Page' }));
    expect(screen.queryByRole('region', { name: 'Design Sets' })).toBeNull();
    const grid = screen.getByRole('region', { name: 'Designs' });
    expect(within(grid).getByRole('button', { name: 'Waves' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    fireEvent.click(within(grid).getByRole('button', { name: 'No Design' }));
    expect(edits.setPageDesign).toHaveBeenCalledWith('a', 'none');
    fireEvent.click(await screen.findByRole('button', { name: 'Use the Tab’s Design' }));
    expect(edits.setPageDesign).toHaveBeenLastCalledWith('a', null);
    // The page's design has no tab switches.
    const tune = screen.getByRole('region', { name: 'Fine Tune' });
    expect(within(tune).queryByRole('switch', { name: 'Flow Across Pages' })).toBeNull();
  });
});
