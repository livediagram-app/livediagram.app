// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { Element, Tab } from '@livehuddle/document';
import { rollMashup } from '@/lib/look-mashup';
import { useTabCanvas } from './useTabCanvas';
import { loadTidyEngine } from '@/lib/tidy-engine';

// The tidiers load on demand (lib/tidy-engine.ts); these tests start with them loaded.
beforeAll(async () => {
  await loadTidyEngine();
});

const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', async (orig) => ({
  ...(await orig<typeof import('@/lib/telemetry')>()),
  track,
}));

// The tab's finish setters (docs/specs/008-canvas/finish.md "Where it is set").
const box = (id: string, over: Record<string, unknown> = {}): Element => ({
  id,
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  ...over,
});

function setup(elements: Element[], editsBlocked = false, notify = vi.fn()) {
  let tabs: Tab[] = [
    { id: 't1', name: 'One', elements },
    { id: 't2', name: 'Two', elements: [] },
  ];
  const commitTabs = vi.fn((map: (ts: Tab[]) => Tab[]) => {
    tabs = map(tabs);
  });
  let els = elements;
  const commit = vi.fn((map: (e: Element[]) => Element[]) => {
    els = map(els);
  });
  const { result } = renderHook(() =>
    useTabCanvas({
      notify,
      editsBlocked,
      activeId: 't1',
      activeTab: tabs[0]!,
      commit,
      commitTabs,
      tickTabs: vi.fn(),
      checkpointBurst: vi.fn(),
    }),
  );
  return { api: result.current, tabs: () => tabs, els: () => els, commit, commitTabs };
}

describe('useTabCanvas finish', () => {
  it('sets the active tab’s finish as one step, and tracks it', () => {
    track.mockClear();
    const h = setup([]);
    h.api.setTabFinish('sketch');
    expect(h.commitTabs).toHaveBeenCalledTimes(1);
    expect(h.tabs()[0]!.finish).toBe('sketch');
    expect(h.tabs()[1]!.finish).toBeUndefined();
    expect(track).toHaveBeenCalledWith('Tab', 'Changed', 'Finish');
  });

  it('makes every element follow the new finish, in the same step', () => {
    const h = setup([box('a', { finish: 'sketch' }), box('b')]);
    h.api.setTabFinish('professional');
    expect(h.commitTabs).toHaveBeenCalledTimes(1);
    for (const el of h.tabs()[0]!.elements) expect('finish' in el, el.id).toBe(false);
  });

  it('letters every element in the new font, and sizes every one at the new size', () => {
    const h = setup([box('a', { font: 'lora', textSize: 'sm' }), box('b')]);
    h.api.setTabFont('inter');
    expect(h.tabs()[0]!.font).toBe('inter');
    for (const el of h.tabs()[0]!.elements) expect('font' in el, el.id).toBe(false);
    h.api.setTabDefaultTextSize('lg');
    expect(h.tabs()[0]!.defaultTextSize).toBe('lg');
    for (const el of h.tabs()[0]!.elements)
      expect((el as { textSize?: string }).textSize, el.id).toBe('lg');
  });

  it('does nothing when edits are blocked (a Participant or Viewer)', () => {
    const h = setup([box('a', { finish: 'sketch' })], true);
    h.api.setTabFinish('professional');
    h.api.setTabFont('inter');
    h.api.setTabDefaultTextSize('lg');
    expect(h.commitTabs).not.toHaveBeenCalled();
  });
});

// Looks (docs/specs/011-theme/canvas-and-theme-dialog.md "Looks").
describe('useTabCanvas applyTabLook', () => {
  it('sets the theme, finish, font and pattern as one step, and tracks it', () => {
    track.mockClear();
    const h = setup([box('a')]);
    h.api.applyTabLook('boardroom');
    expect(h.commitTabs).toHaveBeenCalledTimes(1);
    const t = h.tabs()[0]!;
    expect([t.theme, t.finish, t.font, t.backgroundPattern]).toEqual([
      'steel',
      'professional',
      'inter',
      'blank',
    ]);
    expect(h.tabs()[1]!.theme).toBeUndefined();
    expect(track).toHaveBeenCalledWith('Tab', 'Changed', 'Look');
  });

  it("applies the Mashup card's random look whole, tracked as a Mashup", () => {
    track.mockClear();
    const h = setup([box('a')]);
    const mashup = rollMashup({ random: () => 0.5 });
    h.api.applyTabLook(mashup);
    expect(h.commitTabs).toHaveBeenCalledTimes(1);
    const t = h.tabs()[0]!;
    expect([t.theme, t.finish, t.font, t.backgroundPattern, t.backgroundOpacity]).toEqual([
      mashup.theme,
      mashup.finish,
      mashup.font,
      mashup.pattern,
      mashup.patternOpacity,
    ]);
    expect(track).toHaveBeenCalledWith('Tab', 'Changed', 'Mashup');
    expect(track).not.toHaveBeenCalledWith('Tab', 'Changed', 'Look');
  });

  it('ignores an unknown look and a blocked session', () => {
    const h = setup([box('a')]);
    h.api.applyTabLook('nope');
    expect(h.commitTabs).not.toHaveBeenCalled();
    const blocked = setup([box('a')], true);
    blocked.api.applyTabLook('everyday');
    expect(blocked.commitTabs).not.toHaveBeenCalled();
  });
});

// docs/specs/008-canvas/layout-cleanup.md "A tidy never trashes the work": the command palette's press is
// judged; one that would not help is refused with a notice and nothing is committed.
describe('useTabCanvas tidiers', () => {
  const tidy = [box('a', { width: 100, height: 50 }), box('b', { y: 200, width: 100, height: 50 })];
  const loop = [
    box('a', { width: 100, height: 50 }),
    box('b', { y: 200, width: 100, height: 50 }),
    box('c', { x: 300, y: 100, width: 100, height: 50 }),
    ...(['a>b', 'b>c', 'c>a'].map((id) => {
      const [from, to] = id.split('>');
      return {
        id,
        type: 'arrow',
        from: { kind: 'pinned', elementId: from, anchor: 's' },
        to: { kind: 'pinned', elementId: to, anchor: 'n' },
      };
    }) as Element[]),
  ];

  it('refuses Auto-align on a tab already on the grid, saying so', () => {
    const notify = vi.fn();
    const h = setup(tidy, false, notify);
    h.api.autoAlignTab();
    expect(h.commit).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith('Auto-align: the tab is already tidy, so nothing moved.');
  });

  it('refuses a mindmap of a loop, saying why', () => {
    const notify = vi.fn();
    const h = setup(loop, false, notify);
    h.api.autoLayoutTab('mindmap');
    expect(h.commit).not.toHaveBeenCalled();
    expect(notify.mock.calls[0]![0]).toMatch(/^Mindmap needs a centre to branch from/);
  });

  it('runs a judged press from the popover without judging it again', () => {
    const notify = vi.fn();
    const h = setup(tidy, false, notify);
    h.api.autoAlignTab({ judged: true });
    expect(h.commit).toHaveBeenCalledTimes(1);
    expect(notify).not.toHaveBeenCalled();
  });
});
