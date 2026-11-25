// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PAGE_DESIGNS,
  PAGE_DESIGN_SETS,
  layOutPages,
  type Page,
  type PageDesign,
  type PageDesignOverride,
  savedDesignPreview,
} from '@livedocuments/document';
import type { LibraryItemSummary, LibraryListResponse } from '@liveworkspace/media';
import { LibraryProvider } from '@liveworkspace/workbench/components/library/LibraryProvider';
import type { LibraryApi } from '@liveworkspace/workbench/lib/library/library-api';
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

function open(
  tabDesign?: PageDesign,
  pageDesign?: PageDesignOverride,
  { api = null, blocked = false }: { api?: LibraryApi | null; blocked?: boolean } = {},
) {
  const edits = {
    applySavedDesign: vi.fn(),
    blocked,
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
    <LibraryProvider api={api} apartKinds={['page-design']}>
      <TabStylePagesContext.Provider value={pages}>
        <PageDesignPanel />
      </TabStylePagesContext.Provider>
    </LibraryProvider>,
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

// docs/specs/011-theme/page-designs.md "Saved designs".
describe('saved designs', () => {
  const summary = (over: Partial<LibraryItemSummary>): LibraryItemSummary => ({
    id: 'd1',
    scope: 'personal',
    teamId: null,
    folder: '',
    title: 'Brand Aurora',
    width: 160,
    height: 100,
    kinds: ['page-design'],
    preview: savedDesignPreview({ id: 'aurora', scale: 1.4 }),
    app: 'livedocuments.app',
    createdAt: 2,
    updatedAt: 2,
    ...over,
  });
  const LIST: LibraryListResponse = {
    items: [
      summary({}),
      summary({
        id: 'd2',
        scope: 'team',
        teamId: 't1',
        title: 'Team Waves',
        createdAt: 1,
        preview: savedDesignPreview({ id: 'waves' }),
      }),
    ],
    teams: [{ id: 't1', name: 'Brand', role: 'member' }],
    hidden: 0,
    legacy: { unavailable: [], copied: [], writable: true },
  };
  const fakeApi = (): LibraryApi => ({
    list: vi.fn(async () => LIST),
    save: vi.fn(async () => LIST.items[0]!),
    place: vi.fn(),
    rename: vi.fn(async () => LIST.items[0]!),
    renameFolder: vi.fn(),
    remove: vi.fn(async () => {}),
  });

  it('shows them as their own group, and a click applies one to the tab or the page', async () => {
    const edits = open({ id: 'aurora' }, undefined, { api: fakeApi() });
    const saved = await screen.findByRole('region', { name: 'Saved' });
    fireEvent.click(within(saved).getByRole('button', { name: 'Brand Aurora, saved to My Work' }));
    expect(edits.applySavedDesign).toHaveBeenCalledWith({ id: 'aurora', scale: 1.4 }, null);
    fireEvent.click(screen.getByRole('button', { name: 'This Page' }));
    fireEvent.click(
      within(await screen.findByRole('region', { name: 'Saved' })).getByRole('button', {
        name: 'Team Waves, saved to Brand',
      }),
    );
    expect(edits.applySavedDesign).toHaveBeenLastCalledWith({ id: 'waves' }, 'a');
  });

  it('shows the saved tile the tab or the page wears as selected, as the catalogue’s tiles do', async () => {
    open({ id: 'aurora', scale: 1.4 }, { id: 'waves' }, { api: fakeApi() });
    const saved = await screen.findByRole('region', { name: 'Saved' });
    const aurora = within(saved).getByRole('button', { name: 'Brand Aurora, saved to My Work' });
    const waves = within(saved).getByRole('button', { name: 'Team Waves, saved to Brand' });
    expect(aurora.getAttribute('aria-pressed')).toBe('true');
    expect(aurora.querySelector('.ring-brand-500')).toBeTruthy();
    expect(waves.getAttribute('aria-pressed')).toBe('false');
    expect(waves.querySelector('.ring-brand-500')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'This Page' }));
    const onPage = await screen.findByRole('region', { name: 'Saved' });
    const pressed = (name: string) =>
      within(onPage).getByRole('button', { name }).getAttribute('aria-pressed');
    expect(pressed('Team Waves, saved to Brand')).toBe('true');
    expect(pressed('Brand Aurora, saved to My Work')).toBe('false');
  });

  it('lets only whoever may tidy rename or delete: My Work’s owner, not a team’s member', async () => {
    const api = fakeApi();
    open({ id: 'aurora' }, undefined, { api });
    const saved = await screen.findByRole('region', { name: 'Saved' });
    expect(within(saved).getByRole('button', { name: 'More for Brand Aurora' })).toBeTruthy();
    expect(within(saved).queryByRole('button', { name: 'More for Team Waves' })).toBeNull();
    fireEvent.click(within(saved).getByRole('button', { name: 'More for Brand Aurora' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Delete/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(api.remove).toHaveBeenCalledWith('d1'));
  });

  it('saves the design as tuned from Fine Tune, to My Work or a team', async () => {
    const api = fakeApi();
    open({ id: 'aurora', scale: 1.4 }, undefined, { api });
    const tune = await screen.findByRole('region', { name: 'Fine Tune' });
    fireEvent.click(within(tune).getByRole('button', { name: /Save This Design/ }));
    await screen.findByRole('heading', { name: 'Save This Design' });
    fireEvent.click(await screen.findByRole('radio', { name: /Brand/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(api.save).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: 'team',
          teamId: 't1',
          title: 'Aurora, tuned',
          elements: [{ id: 'design', type: 'page-design', design: { id: 'aurora', scale: 1.4 } }],
        }),
      ),
    );
  });

  it.each(['Participant', 'Viewer'])('offers a %s no Save This Design', async () => {
    open({ id: 'aurora' }, undefined, { api: fakeApi(), blocked: true });
    const tune = await screen.findByRole('region', { name: 'Fine Tune' });
    expect(within(tune).queryByRole('button', { name: /Save This Design/ })).toBeNull();
  });

  it('shows no Saved group and no Save without the Library', async () => {
    open({ id: 'aurora' });
    const tune = await screen.findByRole('region', { name: 'Fine Tune' });
    expect(within(tune).queryByRole('button', { name: /Save This Design/ })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Saved' })).toBeNull();
  });
});
