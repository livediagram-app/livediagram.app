import { describe, expect, it, vi } from 'vitest';
import {
  TOP_BUTTON_PX,
  FOOTER_PAD_PX,
  FOOTER_ROW_PX,
  buildIndicatorItems,
  clusterSize,
  indicatorBacking,
} from './indicator-items';

// docs/specs/008-canvas/element-indicators.md: the items an element carries, in order, and the
// size estimate placement runs on before anything is drawn.

const all = () =>
  buildIndicatorItems({
    outline: vi.fn(),
    tidy: vi.fn(),
    link: { onFollow: vi.fn(), destination: 'example.com' },
    note: vi.fn(),
    action: { onOpen: vi.fn(), assigneeName: 'Sam Reed', initials: 'SR', color: '#3e7be0' },
    comments: { count: 12, onOpen: vi.fn() },
  });

describe('buildIndicatorItems', () => {
  it('orders commands first, then link, note, action, comment', () => {
    expect(all().map((i) => i.kind)).toEqual([
      'outline',
      'tidy',
      'link',
      'note',
      'action',
      'comment',
    ]);
    expect(
      all()
        .filter((i) => i.command)
        .map((i) => i.kind),
    ).toEqual(['outline', 'tidy']);
  });

  it('names each button and carries what the footer and hover cards show', () => {
    const items = all();
    const by = (k: string) => items.find((i) => i.kind === k)!;
    expect(by('link').hoverCard?.description).toBe('example.com');
    expect(by('action')).toMatchObject({
      label: 'Open action',
      word: 'Action',
      assignee: { initials: 'SR' },
      hoverCard: { description: 'Assigned to Sam Reed' },
      dataAttr: 'data-action-trigger',
    });
    expect(by('comment')).toMatchObject({ label: 'Open 12 comments', count: 12 });
    const one = buildIndicatorItems({ comments: { count: 1, onOpen: vi.fn() } });
    expect(one[0]!.label).toBe('Open 1 comment');
  });

  it('falls back to a generic link description and leaves out what is absent', () => {
    const items = buildIndicatorItems({
      link: { onFollow: vi.fn() },
      comments: { count: 0, onOpen: vi.fn() },
    });
    expect(items.map((i) => i.kind)).toEqual(['link']);
    expect(items[0]!.hoverCard?.description).toBe('Open the linked destination.');
    expect(buildIndicatorItems({})).toEqual([]);
  });
});

describe('clusterSize', () => {
  it('is nothing for no items', () => {
    expect(clusterSize([], 'top')).toEqual({ width: 0, height: 0 });
  });

  it('sizes the Top cluster as square buttons, widened by a count', () => {
    const items = buildIndicatorItems({ note: vi.fn(), comments: { count: 12, onOpen: vi.fn() } });
    const size = clusterSize(items, 'top');
    expect(size.height).toBe(TOP_BUTTON_PX + 4);
    expect(size.width).toBeGreaterThan(2 * TOP_BUTTON_PX + 4);
  });

  it('makes the labelled footer wider than the compact one, commands as square buttons', () => {
    const items = all();
    const labelled = clusterSize(items, 'footer');
    const compact = clusterSize(items, 'footer-compact');
    expect(labelled.height).toBe(FOOTER_ROW_PX);
    expect(labelled.width).toBeGreaterThan(compact.width);
    const commandsOnly = buildIndicatorItems({ outline: vi.fn(), tidy: vi.fn() });
    expect(clusterSize(commandsOnly, 'footer').width).toBe(
      2 * TOP_BUTTON_PX + 10 + 2 * FOOTER_PAD_PX,
    );
  });
});

describe('indicatorBacking', () => {
  it('is the fill unless the element paints none', () => {
    expect(indicatorBacking('#fff')).toBe('#fff');
    expect(indicatorBacking('transparent')).toBeUndefined();
    expect(indicatorBacking('none')).toBeUndefined();
    expect(indicatorBacking(undefined)).toBeUndefined();
  });
});
