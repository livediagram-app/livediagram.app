// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PAGE_DESIGNS,
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
import type { TabStyleHome } from '@liveworkspace/workbench/components/dialogs/tab-style/tab-style-profile';
import type { TabLook } from '@/lib/tab-looks';
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
  {
    api = null,
    blocked = false,
    withHome = false,
  }: { api?: LibraryApi | null; blocked?: boolean; withHome?: boolean } = {},
) {
  const edits = {
    applySavedDesign: vi.fn(),
    blocked,
    setTabDesign: vi.fn(),
    tuneTabDesign: vi.fn(),
    setPageDesign: vi.fn(),
    tunePageDesign: vi.fn(),
  };
  const row = layOutPages([slide('a', pageDesign), slide('b')]);
  const background = { onAll: vi.fn(), onPage: vi.fn() };
  const home: TabStyleHome<TabLook> = {
    rows: (['theme', 'font', 'finish'] as const).map((panel) => ({
      panel,
      label: { theme: 'Colours', font: 'Text', finish: 'Finish' }[panel],
      value: 'Now',
      icon: null,
    })),
    onOpenPanel: vi.fn(),
    extra: null,
    fallback: null,
    applyLook: vi.fn(),
    openId: `open-${Math.random()}`,
    font: null,
    finish: 'flexible',
  };
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
    background: { page: row[0]!, onAll: background.onAll, onPage: background.onPage },
  };
  render(
    <LibraryProvider api={api} apartKinds={['page-design']}>
      <TabStylePagesContext.Provider value={pages}>
        <PageDesignPanel {...(withHome ? { home } : {})} />
      </TabStylePagesContext.Provider>
    </LibraryProvider>,
  );
  return Object.assign(edits, { background, home });
}

const q = (selector: string) => document.querySelector<HTMLElement>(selector)!;
const openLayer = (layer: 'design' | 'background') =>
  fireEvent.click(q(`[data-page-layer="${layer}"]`));
const allPagesSwitch = () => screen.getByRole('switch', { name: 'Affect All Pages' });
const openFineTune = async () => {
  fireEvent.click(q('[data-page-design-fine-tune-button]'));
  return within(await waitFor(() => q('[data-page-design-fine-tune]')));
};

describe('the Page Design home (canvas-and-theme-dialog.md "Page Design")', () => {
  it('shows Design and Background, the tab’s rows, Quick Picks and Affect All Pages, on by default', () => {
    open(undefined, undefined, { withHome: true });
    expect(q('[data-page-layer="design"]')).toBeTruthy();
    expect(q('[data-page-layer="background"]')).toBeTruthy();
    for (const key of ['theme', 'font', 'finish'])
      expect(q(`[data-page-layer="${key}"]`)).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Quick Picks' })).toBeTruthy();
    expect(allPagesSwitch().getAttribute('aria-checked')).toBe('true');
  });

  it('puts Keep Theme in Shuffle’s row, straight left of it, and hides it alone while Affect All Pages is off', async () => {
    open(undefined, undefined, { withHome: true });
    const shuffle = q('[data-page-design-quick-shuffle]');
    const keep = q('[data-page-design-keep-theme]');
    // One row: the same parent, Keep Theme first, Shuffle next to it.
    expect(keep.parentElement).toBe(shuffle.parentElement);
    expect(keep.nextElementSibling).toBe(shuffle);
    expect(keep.parentElement!.className).toContain('items-center');
    // Nothing left under the picks.
    const picks = screen.getByRole('region', { name: 'Quick Picks' });
    expect(picks.lastElementChild!.contains(shuffle)).toBe(true);
    const keepSwitch = within(keep).getByRole('switch', { name: 'Keep Theme' });
    fireEvent.click(keepSwitch);
    expect(
      (await screen.findByRole('switch', { name: 'Keep Theme' })).getAttribute('aria-checked'),
    ).toBe('true');
    fireEvent.click(allPagesSwitch());
    await waitFor(() => expect(document.querySelector('[data-page-design-keep-theme]')).toBeNull());
    expect(q('[data-page-design-quick-shuffle]').parentElement).toBe(
      q('[data-page-design-quick-controls]'),
    );
  });

  it('opens a tab row’s panel, and disables the tab’s rows while Affect All Pages is off', () => {
    const { home } = open(undefined, undefined, { withHome: true });
    fireEvent.click(q('[data-page-layer="font"]'));
    expect(home.onOpenPanel).toHaveBeenCalledWith('font');
    fireEvent.click(allPagesSwitch());
    expect(q('[data-page-layer="theme"]').hasAttribute('disabled')).toBe(true);
  });

  it('a Quick Pick on All Pages puts the look on the tab and the design and background on every page', () => {
    const { home, background } = open(undefined, undefined, { withHome: true });
    fireEvent.click(q('[data-page-design-quick]'));
    // One step: the look, design and background go together.
    expect(home.applyLook).not.toHaveBeenCalled();
    expect(background.onAll).toHaveBeenCalledWith(
      expect.objectContaining({ fill: expect.anything() }),
      expect.objectContaining({ id: expect.any(String) }),
      expect.objectContaining({ theme: expect.any(String), finish: expect.any(String) }),
    );
  });

  it('a Quick Pick on one page dresses that page alone and leaves the tab’s look', () => {
    const edits = open(undefined, undefined, { withHome: true });
    fireEvent.click(allPagesSwitch());
    fireEvent.click(q('[data-page-design-quick]'));
    expect(edits.home.applyLook).not.toHaveBeenCalled();
    expect(edits.background.onAll).not.toHaveBeenCalled();
    // The page's background and its own design in one step.
    expect(edits.background.onPage).toHaveBeenCalledWith(
      expect.objectContaining({ fill: expect.anything() }),
      expect.objectContaining({ id: expect.any(String) }),
    );
    expect(edits.setPageDesign).not.toHaveBeenCalled();
  });

  it('keeps Affect All Pages for the opening as screens come and go', () => {
    const first = open(undefined, undefined, { withHome: true });
    fireEvent.click(allPagesSwitch());
    cleanup();
    render(
      <TabStylePagesContext.Provider
        value={{
          kind: 'slide',
          newPageBackground: undefined,
          themeId: 'brand',
          units: 2,
          onSet: () => {},
          onApplyToEveryPage: () => {},
          design: {
            tabDesign: undefined,
            page: layOutPages([slide('a')])[0],
            pages: layOutPages([slide('a')]),
            elements: [],
            theme: {},
            tabFont: undefined,
            paperDark: false,
            edits: first,
          },
        }}
      >
        <PageDesignPanel home={first.home} />
      </TabStylePagesContext.Provider>,
    );
    expect(allPagesSwitch().getAttribute('aria-checked')).toBe('false');
  });
});

describe('the Design picker', () => {
  it('offers every design under its family’s chip, and a pick on All Pages reaches every page', () => {
    const edits = open();
    openLayer('design');
    expect(PAGE_DESIGNS.length).toBeGreaterThanOrEqual(40);
    fireEvent.click(q('[data-page-design-family="gradients"]'));
    fireEvent.click(q('[data-page-design-tile="aurora"]'));
    expect(edits.setTabDesign).toHaveBeenCalledWith({ id: 'aurora' }, { everyPage: true });
    // Gradients and Moving come last among the chips.
    const chips = [...document.querySelectorAll('[data-page-design-family]')].map((c) =>
      c.getAttribute('data-page-design-family'),
    );
    expect(chips.slice(-2)).toEqual(['gradients', 'moving']);
  });

  it('a moving background is the page’s one design, set in one step', () => {
    const edits = open({ id: 'grid' });
    openLayer('design');
    fireEvent.click(q('[data-page-design-family="moving"]'));
    fireEvent.click(document.querySelectorAll<HTMLElement>('[role="radio"]')[0]!);
    expect(edits.background.onAll).toHaveBeenCalledWith({
      fill: expect.objectContaining({ motion: expect.any(String) }),
    });
    expect(edits.setTabDesign).not.toHaveBeenCalled();
  });

  it('on one page sets the page’s own, and Use All Pages’ Design clears it', async () => {
    const edits = open({ id: 'aurora' }, { id: 'waves' });
    openLayer('design');
    fireEvent.click(allPagesSwitch());
    fireEvent.click(q('[data-page-design-family="organic"]'));
    expect(q('[data-page-design-tile="waves"]').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(q('[data-page-design-family="geometric"]'));
    fireEvent.click(q('[data-page-design-tile="grid"]'));
    expect(edits.setPageDesign).toHaveBeenCalledWith('a', expect.objectContaining({ id: 'grid' }));
    expect(edits.setTabDesign).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'Use All Pages’ Design' }));
    expect(edits.setPageDesign).toHaveBeenLastCalledWith('a', null);
  });

  it('tunes the worn design live from Fine Tune: a slider ticks, a switch is one step, Reset keeps it', async () => {
    const edits = open({ id: 'aurora', intensity: 0.5 });
    openLayer('design');
    const tune = await openFineTune();
    fireEvent.change(tune.getByRole('slider', { name: 'Intensity' }), { target: { value: '0.6' } });
    expect(edits.tuneTabDesign).toHaveBeenCalledWith({ id: 'aurora', intensity: 0.6 });
    fireEvent.click(tune.getByRole('switch', { name: 'Animate' }));
    expect(edits.setTabDesign).toHaveBeenCalledWith({
      id: 'aurora',
      intensity: 0.5,
      animate: true,
    });
    fireEvent.click(tune.getByRole('button', { name: 'Reset' }));
    expect(edits.setTabDesign).toHaveBeenLastCalledWith({ id: 'aurora' });
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
    openLayer('design');
    const saved = await screen.findByRole('region', { name: 'Saved' });
    fireEvent.click(within(saved).getByRole('button', { name: 'Brand Aurora, saved to My Work' }));
    expect(edits.applySavedDesign).toHaveBeenCalledWith({ id: 'aurora', scale: 1.4 }, null);
    fireEvent.click(allPagesSwitch());
    fireEvent.click(
      within(await screen.findByRole('region', { name: 'Saved' })).getByRole('button', {
        name: 'Team Waves, saved to Brand',
      }),
    );
    expect(edits.applySavedDesign).toHaveBeenLastCalledWith({ id: 'waves' }, 'a');
  });

  it('shows the saved tile the tab or the page wears as selected, as the catalogue’s tiles do', async () => {
    open({ id: 'aurora', scale: 1.4 }, { id: 'waves' }, { api: fakeApi() });
    openLayer('design');
    const saved = await screen.findByRole('region', { name: 'Saved' });
    const aurora = within(saved).getByRole('button', { name: 'Brand Aurora, saved to My Work' });
    const waves = within(saved).getByRole('button', { name: 'Team Waves, saved to Brand' });
    expect(aurora.getAttribute('aria-pressed')).toBe('true');
    expect(aurora.querySelector('.ring-brand-500')).toBeTruthy();
    expect(waves.getAttribute('aria-pressed')).toBe('false');
    expect(waves.querySelector('.ring-brand-500')).toBeNull();
    fireEvent.click(allPagesSwitch());
    const onPage = await screen.findByRole('region', { name: 'Saved' });
    const pressed = (name: string) =>
      within(onPage).getByRole('button', { name }).getAttribute('aria-pressed');
    expect(pressed('Team Waves, saved to Brand')).toBe('true');
    expect(pressed('Brand Aurora, saved to My Work')).toBe('false');
  });

  it('lets only whoever may tidy rename or delete: My Work’s owner, not a team’s member', async () => {
    const api = fakeApi();
    open({ id: 'aurora' }, undefined, { api });
    openLayer('design');
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
    openLayer('design');
    const tune = await openFineTune();
    fireEvent.click(tune.getByRole('button', { name: /Save This Design/ }));
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
    openLayer('design');
    const tune = await openFineTune();
    expect(tune.queryByRole('button', { name: /Save This Design/ })).toBeNull();
  });

  it('shows no Saved group and no Save without the Library', async () => {
    open({ id: 'aurora' });
    openLayer('design');
    const tune = await openFineTune();
    expect(tune.queryByRole('button', { name: /Save This Design/ })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Saved' })).toBeNull();
  });
});
