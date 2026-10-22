import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pagesOf, pageKindOf, pagesSharing, type Page, type Tab } from '@livedesign/document';
import { track } from '@/lib/telemetry';
import { appliedToAllMessage } from './pages-background-copy-edits';
import { pageEdits } from './page-edits';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// docs/specs/007-editor/pages-mode.md "Copying a background": Apply to All from the
// Background tab and the Format tool's page painting, each one edit with its notice.

const dusk = { kind: 'gradient' as const, from: '#1e1b4b', to: '#4c1d95', angle: 160 };
const slide = (id: string, extra: Partial<Page> = {}): Page => ({
  id,
  orientation: 'landscape',
  kind: 'slide',
  ...extra,
});

function harness(pages: Page[], tabId = 'deck', mayEdit = () => true) {
  let tabs = [{ id: tabId, name: 'Deck', elements: [], pages } as unknown as Tab];
  const commitTabs = vi.fn((map: (ts: Tab[]) => Tab[]) => {
    tabs = map(tabs);
  });
  const toastInfo = vi.fn();
  const edits = () =>
    pageEdits({
      tabId,
      tab: tabs[0]!,
      current: pagesOf(tabs[0]),
      elements: tabs[0]!.elements,
      commitTabs,
      onGoTo: vi.fn(),
      onLayoutPlaced: vi.fn(),
      toastInfo,
      mayEdit,
    });
  const backgrounds = () => Object.fromEntries(pagesOf(tabs[0]).map((p) => [p.id, p.background]));
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

  it('counts each page’s reach as the other pages of its kind, outside its own article', () => {
    const pages: Page[] = [
      slide('s1'),
      slide('s2'),
      slide('s3'),
      { id: 'i1', orientation: 'portrait', kind: 'infographic' },
      { id: 'a1', orientation: 'portrait', kind: 'article', flow: 'f1' },
      { id: 'a2', orientation: 'portrait', kind: 'article', flow: 'f1' },
      { id: 'b1', orientation: 'portrait', kind: 'article', flow: 'f2' },
    ];
    const h = harness(pages);
    const laid = pagesOf({ elements: [], pages } as unknown as Tab);
    for (const p of laid) {
      const own = pagesSharing(laid, p.id);
      const direct = laid.filter((q) => pageKindOf(q) === pageKindOf(p) && !own.has(q.id)).length;
      expect(h.edits().applyToAllReach(p.id), p.id).toBe(direct);
    }
    expect(h.edits().applyToAllReach('s1')).toBe(2);
    expect(h.edits().applyToAllReach('a1')).toBe(1);
  });

  it('says and counts nothing for someone who may no longer edit', () => {
    const h = harness(
      [slide('a', { background: { fill: dusk } }), slide('b')],
      'deck',
      () => false,
    );
    h.edits().applyBackgroundToAll('a');
    expect(h.edits().copyBackground('a', 'b')).toBe(false);
    expect(h.commitTabs).not.toHaveBeenCalled();
    expect(h.toastInfo).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
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
