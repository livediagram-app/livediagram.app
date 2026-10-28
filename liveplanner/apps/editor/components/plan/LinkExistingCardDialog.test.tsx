// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ARCHIVED_FIELD,
  ITEM_TYPES,
  TRASH_STATUS,
  linkedCardsOf,
  type Item,
  type ItemTypeDef,
} from '@liveplanner/items';
import { PlanProvider } from './PlanContext';
import { LinkedCardGroup } from './LinkedCards';
import { linkExistingCard } from './link-existing';

// docs/specs/026-plan/item-types.md "Link Existing": a Linked as section links a card already made.
const track = vi.fn<typeof import('@/lib/telemetry').track>();
vi.mock('@/lib/telemetry', () => ({ track: (...a: Parameters<typeof track>) => track(...a) }));

afterEach(() => {
  cleanup();
  track.mockClear();
});

const flush = () => act(async () => {});
const PERSON = { id: 'p', name: 'Sam Lee', color: '#2563eb' };
const person: ItemTypeDef = {
  id: 'person',
  label: 'Person',
  newTitle: 'New person',
  glyph: 'person',
  color: '#2563eb',
  fields: ['title', 'status'],
};
const owner = { id: 'f-owner', label: 'Owner', kind: 'card' as const, linkType: 'person' };
const objective: ItemTypeDef = {
  id: 'objective',
  label: 'Objective',
  newTitle: 'New objective',
  glyph: 'flag',
  color: '#16a34a',
  fields: ['title', 'status', 'f-owner'],
  custom: [owner],
};
// The same Owner field on a second type: one section, both types listed.
const keyResult: ItemTypeDef = { ...objective, id: 'kr', label: 'Key Result', newTitle: 'New KR' };
const TYPES = [...ITEM_TYPES, person, objective, keyResult];

let n = 0;
const card = (type: string, title: string, fields: Item['fields'] = {}, updatedAt = 0): Item => {
  n += 1;
  return {
    id: `c${n}`,
    type,
    key: n,
    rank: 'i',
    fields: { title, ...fields },
    rev: 1,
    createdAt: 0,
    updatedAt,
    createdBy: PERSON,
    updatedBy: PERSON,
  };
};

function world() {
  n = 0;
  const sam = card('person', 'Sam');
  const lee = card('person', 'Lee');
  const mine = card('objective', 'Grow revenue', { 'f-owner': sam.id });
  const theirs = card('objective', 'Hire two', { 'f-owner': lee.id }, 3);
  const orphan = card('objective', 'Ship it', { 'f-owner': 'gone' }, 2);
  const free = card('kr', 'Ten new customers', {}, 5);
  const archived = card('objective', 'Old goal', { [ARCHIVED_FIELD]: true });
  const trashed = card('objective', 'Binned goal', { status: TRASH_STATUS });
  const task = card('task', 'Not an owner field');
  const all = [sam, lee, mine, theirs, orphan, free, archived, trashed, task];
  return { sam, lee, mine, theirs, orphan, free, items: new Map(all.map((i) => [i.id, i])) };
}

function open({ canAdd = true, onLink = vi.fn(async () => true) } = {}) {
  const w = world();
  const [group] = linkedCardsOf(w.sam, w.items, TYPES);
  render(
    <PlanProvider value={{ items: w.items, types: TYPES } as never}>
      <LinkedCardGroup
        group={group!}
        target={w.sam}
        types={TYPES}
        statusNames={new Map()}
        canAdd={canAdd}
        onOpen={vi.fn()}
        onAdd={vi.fn()}
        onLinkExisting={onLink}
      />
    </PlanProvider>,
  );
  return { ...w, onLink };
}

const linkButton = () => screen.getByRole('button', { name: 'Link an existing card as Owner' });

describe('Link Existing', () => {
  it('sits after the New buttons, one per section, and opens the card picker', () => {
    open();
    const buttons = screen.getAllByRole('button').map((b) => b.textContent);
    expect(buttons.slice(-3)).toEqual(['New Objective', 'New Key Result', 'Link Existing']);
    fireEvent.click(linkButton());
    expect(screen.getByRole('dialog', { name: 'Link Existing Card' })).toBeTruthy();
    expect(screen.getByText('Pick a card to link to #1 Sam as Owner.')).toBeTruthy();
  });

  it('offers the field’s types newest first, never this card, one linked here, archived or trashed', () => {
    open();
    fireEvent.click(linkButton());
    const list = screen.getByRole('list', { name: 'Cards to link as Owner' });
    const rows = within(list).getAllByRole('button');
    expect(rows.map((r) => r.getAttribute('aria-label'))).toEqual([
      'Ten new customers, Key Result #6',
      'Hire two, Objective #4, Linked to #2 Lee',
      'Ship it, Objective #5, Linked to a missing card',
    ]);
    // Several types: each row names its type.
    expect(within(list).getByText('Key Result')).toBeTruthy();
    expect(within(list).getAllByText('Objective')).toHaveLength(2);
  });

  it('narrows by the search and says when nothing matches', () => {
    open();
    fireEvent.click(linkButton());
    const search = screen.getByRole('textbox', { name: 'Search cards' });
    fireEvent.change(search, { target: { value: '#4' } });
    expect(screen.getAllByRole('button', { name: /Objective #|Key Result #/ })).toHaveLength(1);
    fireEvent.change(search, { target: { value: 'key result' } });
    expect(screen.getByRole('button', { name: 'Ten new customers, Key Result #6' })).toBeTruthy();
    fireEvent.change(search, { target: { value: 'nothing like it' } });
    expect(screen.getByText('No cards match.')).toBeTruthy();
  });

  it('links a free card at once and closes', async () => {
    const { onLink, free } = open();
    fireEvent.click(linkButton());
    fireEvent.click(screen.getByRole('button', { name: 'Ten new customers, Key Result #6' }));
    await flush();
    expect(onLink).toHaveBeenCalledWith(free.id, false);
    expect(screen.queryByRole('dialog', { name: 'Link Existing Card' })).toBeNull();
  });

  it('asks before moving a card linked elsewhere; Cancel goes back, Move Here moves it', async () => {
    const { onLink, theirs } = open();
    fireEvent.click(linkButton());
    fireEvent.click(
      screen.getByRole('button', { name: 'Hire two, Objective #4, Linked to #2 Lee' }),
    );
    expect(screen.getByText('Move #4 Hire two?')).toBeTruthy();
    expect(
      screen.getByText(
        "It is linked as Owner to #2 Lee. Linking it here moves it, and it leaves #2 Lee's Linked as Owner.",
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onLink).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Link Existing Card' })).toBeTruthy();
    fireEvent.click(
      screen.getByRole('button', { name: 'Hire two, Objective #4, Linked to #2 Lee' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Move Here' }));
    await flush();
    expect(onLink).toHaveBeenCalledWith(theirs.id, true);
    expect(screen.queryByRole('dialog', { name: 'Link Existing Card' })).toBeNull();
  });

  it('asks before moving a card whose link is missing', () => {
    open();
    fireEvent.click(linkButton());
    fireEvent.click(
      screen.getByRole('button', { name: 'Ship it, Objective #5, Linked to a missing card' }),
    );
    expect(
      screen.getByText('It is linked as Owner to a missing card. Linking it here moves it.'),
    ).toBeTruthy();
  });

  it('stays open when the write is refused', async () => {
    open({ onLink: vi.fn(async () => false) });
    fireEvent.click(linkButton());
    fireEvent.click(screen.getByRole('button', { name: 'Ten new customers, Key Result #6' }));
    await flush();
    expect(screen.getByRole('dialog', { name: 'Link Existing Card' })).toBeTruthy();
  });

  it('says when there is nothing to link', () => {
    n = 0;
    const sam = card('person', 'Sam');
    const items = new Map([[sam.id, sam]]);
    const [group] = linkedCardsOf(sam, items, TYPES);
    render(
      <PlanProvider value={{ items, types: TYPES } as never}>
        <LinkedCardGroup
          group={group!}
          target={sam}
          types={TYPES}
          statusNames={new Map()}
          canAdd
          onOpen={vi.fn()}
          onAdd={vi.fn()}
          onLinkExisting={vi.fn()}
        />
      </PlanProvider>,
    );
    fireEvent.click(linkButton());
    expect(screen.getByText('No other Objective or Key Result cards to link.')).toBeTruthy();
  });

  // docs/specs/013-workspace/share-roles.md: an Editor and a Participant add and edit cards (canAdd, the session's
  // `can.planCards`); a Viewer sees neither New nor Link Existing.
  it('is not there for a Viewer', () => {
    open({ canAdd: false });
    expect(screen.queryByRole('button', { name: 'Link an existing card as Owner' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^New / })).toBeNull();
  });
});

describe('the Link Existing write', () => {
  const plan = (patchItem: (id: string, patch: unknown) => Promise<boolean>) => {
    const w = world();
    return { w, ctx: { items: w.items, patchItem: vi.fn(patchItem), announce: vi.fn() } };
  };
  const group = { fieldId: 'f-owner', label: 'Owner' };

  it('sets the picked card’s field to this card, one ordinary card write, and says so', async () => {
    const { w, ctx } = plan(async () => true);
    expect(await linkExistingCard(ctx, w.sam, group, w.theirs.id, true)).toBe(true);
    expect(ctx.patchItem).toHaveBeenCalledWith(w.theirs.id, { set: { 'f-owner': w.sam.id } });
    expect(ctx.announce).toHaveBeenCalledWith('Linked #4 as Owner');
    expect(track).toHaveBeenCalledWith('Plan', 'Linked', 'LinkedCardMoved');
    await linkExistingCard(ctx, w.sam, group, w.free.id, false);
    expect(track).toHaveBeenLastCalledWith('Plan', 'Linked', 'LinkedCard');
  });

  it('announces nothing when refused, and never writes a gone card or the card itself', async () => {
    const { w, ctx } = plan(async () => false);
    expect(await linkExistingCard(ctx, w.sam, group, w.free.id, false)).toBe(false);
    expect(ctx.announce).not.toHaveBeenCalled();
    ctx.patchItem.mockClear();
    expect(await linkExistingCard(ctx, w.sam, group, 'gone', false)).toBe(false);
    expect(await linkExistingCard(ctx, w.sam, group, w.sam.id, false)).toBe(false);
    expect(ctx.patchItem).not.toHaveBeenCalled();
  });
});
