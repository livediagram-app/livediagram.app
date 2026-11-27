// @vitest-environment jsdom
import { cleanup, fireEvent, render, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Item, ItemTypeDef } from '@liveplanner/items';
import type { PlanContextValue } from './PlanContext';

vi.mock('./duplicate-item', () => ({ duplicateItem: vi.fn() }));
vi.mock('./item-flag', () => ({ toggleFlag: vi.fn() }));
vi.mock('./link-existing', () => ({ linkExistingCard: vi.fn() }));
vi.mock('./copy-card-link', () => ({ copyCardLink: vi.fn() }));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('./ItemPanel', () => ({
  ItemPanelEmbedded: (p: { item: Item; onEditType: () => void }) => (
    <button type="button" data-embedded={p.item.id} onClick={p.onEditType} />
  ),
}));

import { copyCardLink } from './copy-card-link';
import { duplicateItem } from './duplicate-item';
import { toggleFlag } from './item-flag';
import { linkExistingCard } from './link-existing';
import { track } from '@/lib/telemetry';
import { itemPanelProps, useItemPanelReads } from './item-panel-wiring';
import { SessionCard } from '../session/SessionCard';

// docs/specs/026-plan/plan-board.md "Open an item" and docs/specs/026-plan/session-tabs.md "The card": the one wiring
// a board's floating card panel and a Session tab's embedded one share, so a card is worked on the same way in both.
afterEach(cleanup);

const story: ItemTypeDef = {
  id: 'story',
  label: 'Story',
  newTitle: 'New story',
  glyph: 'task',
  color: '#7c3aed',
  fields: ['title', 'status', 'parent', 'sev'],
  custom: [{ id: 'sev', label: 'Severity', kind: 'text', required: true }],
  statuses: ['todo', 'done'],
};
const card = (id: string, extra: Record<string, unknown> = {}): Item => ({
  id,
  type: 'story',
  key: 1,
  rank: id,
  fields: { title: id, status: 'todo', sev: 'high', labels: ['ux'], ...extra },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: { id: 'p', name: 'P', color: '#000' },
  updatedBy: { id: 'p', name: 'P', color: '#000' },
});

function ctxOf(extra: Partial<PlanContextValue> = {}) {
  const items = new Map([card('a'), card('b', { parent: 'a' })].map((i) => [i.id, i]));
  return {
    items,
    types: [story],
    statusTypes: [],
    statusNames: new Map([
      ['todo', 'To Do'],
      ['done', 'Done'],
    ]),
    people: [],
    canEditCards: true,
    canEdit: true,
    patchItem: vi.fn(async () => true),
    addItem: vi.fn(async () => {}),
    openItem: vi.fn(),
    openNewItem: vi.fn(),
    trashItem: vi.fn(),
    announce: vi.fn(),
    notify: vi.fn(),
    editType: vi.fn(),
    cardLink: (id: string) => `https://plan/${id}`,
    ...extra,
  } as unknown as PlanContextValue;
}

describe('useItemPanelReads', () => {
  it('reads the columns, the trail, the linking cards and the labels for the open card, nothing without one', () => {
    const ctx = ctxOf();
    const open = renderHook(() => useItemPanelReads(ctx, 'a', ['a'])).result.current;
    expect(open.statuses).toEqual([
      { status: 'todo', name: 'To Do' },
      { status: 'done', name: 'Done' },
    ]);
    expect(open.trail.map((i) => i.id)).toEqual(['a']);
    expect(open.labels).toEqual([{ label: 'ux', count: 2 }]);
    const none = renderHook(() => useItemPanelReads(ctx, undefined, [])).result.current;
    expect([none.trail, none.linkedGroups, none.labels]).toEqual([[], [], []]);
  });
});

describe('itemPanelProps', () => {
  const reads = { statuses: [], trail: [], linkedGroups: [], labels: [] };

  it('saves a field, clears one, and never empties a required one', async () => {
    const ctx = ctxOf();
    const props = itemPanelProps(ctx, card('a'), reads, vi.fn());
    await props.onSave('status', 'done');
    await props.onSave('parent', undefined);
    expect(ctx.patchItem).toHaveBeenNthCalledWith(1, 'a', { set: { status: 'done' } });
    expect(ctx.patchItem).toHaveBeenNthCalledWith(2, 'a', { clear: ['parent'] });
    await expect(props.onSave('sev', '')).resolves.toBe(false);
    expect(ctx.announce).toHaveBeenCalledWith('Severity is required on Story cards');
    expect(ctx.notify).toHaveBeenCalledWith('Severity is required on Story cards');
  });

  it('patches, retypes, opens, adds a linked card and links one', () => {
    const ctx = ctxOf();
    const props = itemPanelProps(ctx, card('a'), reads, vi.fn());
    props.onPatch({ set: { title: 'x' } });
    props.onType('story');
    props.onOpenItem('b', 'Trail' as never);
    expect(ctx.patchItem).toHaveBeenCalledWith('a', { type: 'story' });
    expect(ctx.openItem).toHaveBeenCalledWith('b', 'Trail');
    const group = { fieldId: 'parent', several: false } as never;
    props.onAddLinked!(group, 'story', { title: 'Child' });
    expect(ctx.addItem).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'story',
        fields: { title: 'Child', parent: 'a' },
        status: 'todo',
      }),
    );
    expect(ctx.openNewItem).toHaveBeenCalledWith(expect.any(String), 'ChildCard');
    expect(track).toHaveBeenCalledWith('Plan', 'Added', 'LinkedCard');
    props.onAddLinked!({ fieldId: 'blocks', several: true } as never, 'story');
    expect(ctx.addItem).toHaveBeenLastCalledWith(
      expect.objectContaining({ fields: { title: 'New story', blocks: ['a'] } }),
    );
    void props.onLinkExisting!(group, 'b', false);
    expect(linkExistingCard).toHaveBeenCalled();
  });

  it('trashes, duplicates, flags, archives and restores, copies a link and edits the type', () => {
    const ctx = ctxOf({ linkedActions: { x: 1 } as never });
    const close = vi.fn();
    const props = itemPanelProps(ctx, card('a'), reads, close);
    expect(props).toHaveProperty('linkedActions');
    props.onTrash();
    expect(ctx.trashItem).toHaveBeenCalledWith('a');
    props.onDuplicate();
    props.onFlag();
    expect([duplicateItem, toggleFlag].every((f) => vi.mocked(f).mock.calls.length === 1)).toBe(
      true,
    );
    props.onArchive();
    expect(ctx.patchItem).toHaveBeenLastCalledWith('a', { set: { archived: true } });
    expect(track).toHaveBeenCalledWith('Plan', 'Moved', 'Archive');
    itemPanelProps(ctx, card('z', { archived: true }), reads, close).onArchive();
    expect(ctx.patchItem).toHaveBeenLastCalledWith('z', { clear: ['archived'] });
    expect(ctx.announce).toHaveBeenLastCalledWith('Card restored');
    props.onCopyLink!();
    expect(copyCardLink).toHaveBeenCalledWith('https://plan/a', ctx.notify, 'a');
    props.onEditType!();
    expect(close).toHaveBeenCalled();
    expect(ctx.editType).toHaveBeenCalledWith({ id: 'story' });
    // No card links where the plan makes none.
    expect(
      itemPanelProps(ctxOf({ cardLink: undefined }), card('a'), reads, close),
    ).not.toHaveProperty('onCopyLink');
  });
});

describe('SessionCard', () => {
  it('embeds the card’s panel, which has nothing to close', () => {
    const ctx = ctxOf();
    const { container } = render(<SessionCard plan={ctx} item={card('a')} />);
    fireEvent.click(container.querySelector('[data-embedded="a"]')!);
    expect(ctx.editType).toHaveBeenCalledWith({ id: 'story' });
  });
});
