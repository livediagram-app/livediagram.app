import { beforeEach, describe, expect, it, vi } from 'vitest';
import { illustratePagesOf, type IllustratePage, type Tab } from '@livediagram/document';
import { track } from '@/lib/telemetry';
import { appliedToAllMessage } from './illustrate-background-copy-edits';
import { illustratePageEdits } from './illustrate-page-edits';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// docs/specs/007-editor/illustrate-pages.md "Copying a background": Apply to All from the
// Background tab and the Format tool's page painting, each one edit with its notice.

const dusk = { kind: 'gradient' as const, from: '#1e1b4b', to: '#4c1d95', angle: 160 };
const slide = (id: string, extra: Partial<IllustratePage> = {}): IllustratePage => ({
  id,
  orientation: 'landscape',
  kind: 'slide',
  ...extra,
});

function harness(pages: IllustratePage[], tabId = 'deck') {
  let tabs = [{ id: tabId, name: 'Deck', elements: [], pages } as unknown as Tab];
  const commitTabs = vi.fn((map: (ts: Tab[]) => Tab[]) => {
    tabs = map(tabs);
  });
  const toastInfo = vi.fn();
  const edits = () =>
    illustratePageEdits({
      tabId,
      tab: tabs[0]!,
      current: illustratePagesOf(tabs[0]!),
      elements: tabs[0]!.elements,
      commitTabs,
      onGoTo: vi.fn(),
      onLayoutPlaced: vi.fn(),
      toastInfo,
    });
  const backgrounds = () =>
    Object.fromEntries(illustratePagesOf(tabs[0]!).map((p) => [p.id, p.background]));
  return { edits, commitTabs, toastInfo, backgrounds };
}

beforeEach(() => vi.mocked(track).mockClear());

describe('Apply to All', () => {
  it('paints every other slide in one commit, tracked, and says so', () => {
    const h = harness([slide('a', { background: { fill: dusk } }), slide('b'), slide('c')]);
    expect(h.edits().applyToAllReach('a')).toBe(2);
    h.edits().applyBackgroundToAll('a');
    expect(h.commitTabs).toHaveBeenCalledTimes(1);
    expect(h.backgrounds()).toEqual({ a: { fill: dusk }, b: { fill: dusk }, c: { fill: dusk } });
    expect(track).toHaveBeenCalledWith('Tab', 'Changed', 'PageBackgroundAppliedToAll');
    expect(h.toastInfo).toHaveBeenCalledWith('Background applied to 2 slides.');
  });

  it('names the locked slides it left', () => {
    const h = harness([
      slide('a', { background: { fill: dusk } }),
      slide('b', { locked: true }),
      slide('c'),
    ]);
    h.edits().applyBackgroundToAll('a');
    expect(h.toastInfo).toHaveBeenCalledWith(
      'Background applied to 1 slide. 1 locked slide kept its own.',
    );
    expect(h.backgrounds().b).toBeUndefined();
  });

  it('reaches nothing, and does nothing, with no other page of the kind', () => {
    const h = harness([slide('a'), { id: 'i', orientation: 'portrait' }]);
    expect(h.edits().applyToAllReach('a')).toBe(0);
    h.edits().applyBackgroundToAll('a');
    expect(h.commitTabs).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
  });
});

describe('painting one page from another', () => {
  it('copies the background in one commit, tracked', () => {
    const h = harness([slide('a', { background: { fill: dusk, pattern: 'dots' } }), slide('b')]);
    expect(h.edits().copyBackground('a', 'b')).toBe(true);
    expect(h.commitTabs).toHaveBeenCalledTimes(1);
    expect(h.backgrounds().b).toEqual({ fill: dusk, pattern: 'dots' });
    expect(track).toHaveBeenCalledWith('Tab', 'Changed', 'PageBackgroundPainted');
  });

  it('refuses a locked page with a notice, writing nothing', () => {
    const h = harness([slide('a', { background: { fill: dusk } }), slide('b', { locked: true })]);
    expect(h.edits().copyBackground('a', 'b')).toBe(false);
    expect(h.commitTabs).not.toHaveBeenCalled();
    expect(h.toastInfo).toHaveBeenCalledWith(
      'That page is locked. Unlock it to change its background.',
    );
  });

  it('refuses a picture onto a logo page', () => {
    const h = harness([
      slide('a', { background: { fill: { kind: 'image', imageId: 'img-1' } } }),
      { id: 'l', orientation: 'portrait', kind: 'logo', size: 'logo' },
    ]);
    expect(h.edits().copyBackground('a', 'l')).toBe(false);
    expect(h.toastInfo).toHaveBeenCalledWith('A logo page takes no picture background.');
  });

  it('is no edit onto the source itself', () => {
    const h = harness([slide('a', { background: { fill: dusk } })]);
    expect(h.edits().copyBackground('a', 'a')).toBe(false);
    expect(h.commitTabs).not.toHaveBeenCalled();
  });
});

describe('appliedToAllMessage', () => {
  it('counts in the kind’s own words', () => {
    expect(appliedToAllMessage('slide', 35, 0)).toBe('Background applied to 35 slides.');
    expect(appliedToAllMessage('infographic', 1, 0)).toBe(
      'Background applied to 1 infographic page.',
    );
    expect(appliedToAllMessage('slide', 3, 2)).toBe(
      'Background applied to 3 slides. 2 locked slides kept their own.',
    );
    expect(appliedToAllMessage('slide', 0, 2)).toBe(
      'Every other slide is locked: 2 locked slides kept their own.',
    );
  });
});
