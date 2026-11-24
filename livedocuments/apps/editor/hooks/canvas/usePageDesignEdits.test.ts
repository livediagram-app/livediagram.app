// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PAGE_DESIGN_SETS,
  pageDesignIdOf,
  pagesOf,
  tabPageDesignOf,
  type Element,
  type Page,
  type Tab,
} from '@livedocuments/document';
import { pageDesignEdits } from './usePageDesignEdits';

const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', async (orig) => ({
  ...(await orig<typeof import('@/lib/telemetry')>()),
  track,
}));

const slide = (id: string, extra: Partial<Page> = {}): Page => ({
  id,
  orientation: 'landscape',
  size: 'slide',
  kind: 'slide',
  ...extra,
});

// The Page Design panel's edits (docs/specs/011-theme/canvas-and-theme-dialog.md "Page Design"), and the share roles:
// an Editor's session edits; a Participant's or Viewer's (edits blocked) changes nothing.
function setup(pages: Page[], editsBlocked = false, elements: Element[] = []) {
  let tabs: Tab[] = [{ id: 't1', name: 'One', elements, pages }];
  const commitTabs = vi.fn((map: (ts: Tab[]) => Tab[]) => {
    tabs = map(tabs);
  });
  const tickTabs = vi.fn((map: (ts: Tab[]) => Tab[]) => {
    tabs = map(tabs);
  });
  const checkpointBurst = vi.fn();
  const notify = vi.fn();
  const make = () =>
    pageDesignEdits({
      editsBlocked,
      activeId: 't1',
      activeTab: tabs[0]!,
      commitTabs,
      tickTabs,
      checkpointBurst,
      notify,
    });
  return { make, tab: () => tabs[0]!, commitTabs, tickTabs, checkpointBurst, notify };
}

beforeEach(() => track.mockClear());

describe('page design edits', () => {
  it('picks the tab design as one step, and tracks a pick and a tune apart', () => {
    const s = setup([slide('a'), slide('b')]);
    s.make().setTabDesign({ id: 'aurora' });
    expect(tabPageDesignOf(s.tab())?.id).toBe('aurora');
    expect(s.commitTabs).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith('Tab', 'Changed', 'PageDesign');
    track.mockClear();
    s.make().setTabDesign({ id: 'aurora', animate: true });
    expect(track).toHaveBeenCalledWith('Tab', 'Changed', 'PageDesignAnimated');
    expect(track).not.toHaveBeenCalledWith('Tab', 'Changed', 'PageDesign');
    s.make().setTabDesign(null);
    expect(tabPageDesignOf(s.tab())).toBeUndefined();
  });

  it('tunes by ticks under one burst checkpoint', () => {
    // Well after any tune an earlier test made.
    vi.useFakeTimers({ now: Date.now() + 60_000, toFake: ['Date'] });
    const s = setup([slide('a')]);
    s.make().tuneTabDesign({ id: 'waves', intensity: 0.4 });
    s.make().tuneTabDesign({ id: 'waves', intensity: 0.3 });
    expect(s.checkpointBurst).toHaveBeenCalledWith('pageDesign');
    expect(s.tickTabs).toHaveBeenCalledTimes(2);
    expect(s.commitTabs).not.toHaveBeenCalled();
    expect(tabPageDesignOf(s.tab())?.intensity).toBe(0.3);
    // A drag's ticks are one telemetry event.
    expect(track.mock.calls.filter((c) => c[2] === 'PageDesignTuned')).toHaveLength(1);
    vi.useRealTimers();
  });

  it('sets, clears and opts a page out, and refuses a locked page with a notice', () => {
    const s = setup([slide('a'), slide('b', { locked: true })]);
    s.make().setPageDesign('a', { id: 'starfield' });
    expect(pageDesignIdOf(pagesOf(s.tab())[0]!, undefined)).toBe('starfield');
    s.make().setPageDesign('a', 'none');
    expect(pagesOf(s.tab())[0]!.design).toEqual({ id: 'none' });
    s.make().setPageDesign('a', null);
    expect(pagesOf(s.tab())[0]!.design).toBeUndefined();
    s.commitTabs.mockClear();
    s.make().setPageDesign('b', { id: 'starfield' });
    expect(s.commitTabs).not.toHaveBeenCalled();
    expect(s.notify).toHaveBeenCalledWith(expect.stringContaining('locked'));
  });

  it('applies a design set as one step: theme, design and a layout on each empty slide', async () => {
    const s = setup([slide('a'), slide('b')]);
    const set = PAGE_DESIGN_SETS[0]!;
    await s.make().applyDesignSet(set.id);
    expect(s.commitTabs).toHaveBeenCalledTimes(1);
    expect(s.tab().theme).toBe(set.theme);
    expect(tabPageDesignOf(s.tab())?.id).toBe(set.design.id);
    expect(s.tab().elements.length).toBeGreaterThan(0);
    expect(track).toHaveBeenCalledWith('Tab', 'Changed', 'PageDesignSet');
  });

  it.each(['Participant', 'Viewer'])('changes nothing in a %s’s session', async () => {
    const s = setup([slide('a')], true);
    const e = s.make();
    e.setTabDesign({ id: 'aurora' });
    e.tuneTabDesign({ id: 'aurora' });
    e.setPageDesign('a', { id: 'aurora' });
    e.tunePageDesign('a', { id: 'aurora' });
    await e.applyDesignSet(PAGE_DESIGN_SETS[0]!.id);
    expect(s.commitTabs).not.toHaveBeenCalled();
    expect(s.tickTabs).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
  });
});
