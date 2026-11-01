import { describe, expect, it } from 'vitest';
import {
  blockedLabel,
  blockerIdsOf,
  blocksFieldsOf,
  blocksHeading,
  blocksValueChanged,
  blockingCycleOf,
  blockingIndexOf,
  blockingLoop,
  blockingLoopMessage,
  hasBlocksFields,
  isBlocksField,
  openBlockersOf,
} from './blocked-by';
import { ITEM_TYPES, type CustomFieldDef, type ItemTypeDef } from './item-types';
import { readItemTypeCatalogue } from './type-catalogue';
import { applyCardTypeChanges } from './type-changes';
import { linkedCardsOf, linkFieldsOfType } from './card-links';
import { TRASH_STATUS } from './board';
import { ARCHIVED_FIELD, type Item } from './item';
import { item } from './test-items';

// docs/specs/026-plan/item-types.md "Blocked By": a Card field with Blocks on holds the cards that block the card.

const BLOCKED_BY: CustomFieldDef = {
  id: 'f-blocked-by',
  label: 'Blocked By',
  kind: 'card',
  linkType: 'task',
  multiple: true,
  blocks: true,
};
const RELATED: CustomFieldDef = {
  id: 'f-related',
  label: 'Related',
  kind: 'card',
  linkType: 'task',
  multiple: true,
};
const BASE = ITEM_TYPES.find((t) => t.id === 'task')!;
const TASK: ItemTypeDef = {
  ...BASE,
  fields: [...BASE.fields, BLOCKED_BY.id, RELATED.id],
  custom: [...(BASE.custom ?? []), BLOCKED_BY, RELATED],
};
const TYPES: readonly ItemTypeDef[] = [TASK, ...ITEM_TYPES.filter((t) => t.id !== 'task')];
const done = (s: string | undefined) => s === 'done';
const map = (items: Item[]) => new Map(items.map((i) => [i.id, i]));
const card = (title: string, blockers: string[] = [], extra: Record<string, unknown> = {}) =>
  item({
    title,
    status: 'todo',
    ...(blockers.length ? { [BLOCKED_BY.id]: blockers } : {}),
    ...extra,
  } as Item['fields']);

describe('Blocks fields', () => {
  it('is a Card field with blocks on, offered by the type', () => {
    expect(isBlocksField(BLOCKED_BY)).toBe(true);
    expect(isBlocksField(RELATED)).toBe(false);
    expect(isBlocksField({ kind: 'text', blocks: true })).toBe(false);
    expect(blocksFieldsOf(TASK)).toEqual([BLOCKED_BY]);
    // A field taken off the type blocks nothing.
    expect(blocksFieldsOf({ ...TASK, fields: BASE.fields })).toEqual([]);
    expect(hasBlocksFields(TYPES)).toBe(true);
    expect(hasBlocksFields(ITEM_TYPES)).toBe(false);
  });

  it('reads every blocker id once, never the card itself', () => {
    const a = card('A');
    const b = card('B', ['x1', 'x2', 'x1']);
    expect(blockerIdsOf(b, TASK)).toEqual(['x1', 'x2']);
    expect(blockerIdsOf({ ...a, fields: { ...a.fields, [BLOCKED_BY.id]: [a.id] } }, TASK)).toEqual(
      [],
    );
    // A Related field's cards are no blockers.
    expect(blockerIdsOf(card('C', [], { [RELATED.id]: ['x1'] }), TASK)).toEqual([]);
  });

  it('keeps the switch only as true on a Card field when the catalogue is read', () => {
    const cat = readItemTypeCatalogue({
      version: 1,
      types: [
        {
          id: 'job',
          label: 'Job',
          color: '#2563eb',
          glyph: 'flag',
          fields: ['title', 'f-a', 'f-b', 'f-c'],
          custom: [
            { id: 'f-a', label: 'A', kind: 'card', linkType: 'job', blocks: true },
            { id: 'f-b', label: 'B', kind: 'text', blocks: true },
            { id: 'f-c', label: 'C', kind: 'card', linkType: 'job', blocks: 'yes' },
          ],
        },
      ],
    });
    expect(cat!.types[0]!.custom!.map((f) => f.blocks)).toEqual([true, undefined, undefined]);
  });

  it('names what a write changed: a Blocks value, of either type', () => {
    const a = card('A', ['x1']);
    expect(blocksValueChanged(TYPES, a, a)).toBeNull();
    expect(
      blocksValueChanged(TYPES, a, { ...a, fields: { ...a.fields, [BLOCKED_BY.id]: ['x2'] } }),
    ).toBe(BLOCKED_BY.id);
    expect(blocksValueChanged(TYPES, undefined, a)).toBe(BLOCKED_BY.id);
    expect(blocksValueChanged(TYPES, card('Fresh'), a)).toBe(BLOCKED_BY.id);
    expect(blocksValueChanged(TYPES, undefined, card('B'))).toBeNull();
    // A Related value is no Blocks value.
    expect(
      blocksValueChanged(TYPES, a, { ...a, fields: { ...a.fields, [RELATED.id]: ['x'] } }),
    ).toBe(null);
    // Changing type keeps the stored value, so it changes nothing.
    expect(blocksValueChanged(TYPES, a, { ...a, type: 'bug' })).toBeNull();
    // Clearing it from a card whose type no longer offers it is still a change.
    const { [BLOCKED_BY.id]: _gone, ...rest } = a.fields;
    expect(blocksValueChanged(TYPES, a, { ...a, type: 'bug', fields: rest })).toBe(BLOCKED_BY.id);
  });

  it('marks Linked as groups and link fields that block', () => {
    expect(linkFieldsOfType(TASK).find((f) => f.id === BLOCKED_BY.id)).toMatchObject({
      blocks: true,
      several: true,
    });
    expect(linkFieldsOfType(TASK).find((f) => f.id === RELATED.id)?.blocks).toBeUndefined();
    const a = card('A');
    const b = card('B', [a.id]);
    const groups = linkedCardsOf(a, map([a, b]), TYPES);
    expect(groups.find((g) => g.fieldId === BLOCKED_BY.id)).toMatchObject({
      blocks: true,
      cards: [b],
    });
    expect(groups.find((g) => g.fieldId === RELATED.id)?.blocks).toBeUndefined();
  });

  it('labels the badge and the mirror', () => {
    expect(blockedLabel(1)).toBe('Blocked by 1 open card');
    expect(blockedLabel(3)).toBe('Blocked by 3 open cards');
    expect(blocksHeading('Blocked By')).toBe('Blocks');
    expect(blocksHeading(' blocked by ')).toBe('Blocks');
    expect(blocksHeading('Waiting On')).toBe('Blocks (Waiting On)');
  });
});

describe('the blocking index', () => {
  it('counts open blockers, ignores done, trashed, archived and missing ones', () => {
    const open = card('Open');
    const finished = card('Finished', [], { status: 'done' });
    const trashed = card('Trashed', [], { status: TRASH_STATUS });
    const archived = card('Archived', [], { [ARCHIVED_FIELD]: true });
    const b = card('B', [open.id, finished.id, trashed.id, archived.id, 'missing', open.id]);
    const index = blockingIndexOf([open, finished, trashed, archived, b], TYPES, done);
    expect(openBlockersOf(index, b.id)).toBe(1);
    expect(index.blockers.get(b.id)).toEqual([open, finished]);
    expect(index.blocks.get(open.id)).toEqual([b]);
    expect(index.blocks.get(finished.id)).toEqual([b]);
    expect(openBlockersOf(index, open.id)).toBe(0);
    expect(index.blockers.has(open.id)).toBe(false);
  });

  it('clears itself once every blocker is done', () => {
    const a = card('A', [], { status: 'done' });
    const b = card('B', [a.id]);
    expect(openBlockersOf(blockingIndexOf([a, b], TYPES, done), b.id)).toBe(0);
  });

  it('reads no trashed card as blocked, and lists no archived card in a mirror', () => {
    const a = card('A');
    const gone = card('Gone', [a.id], { status: TRASH_STATUS });
    const shelved = card('Shelved', [a.id], { [ARCHIVED_FIELD]: true });
    const later = card('Later', [a.id]);
    const index = blockingIndexOf([later, a, gone, shelved], TYPES, done);
    expect(index.open.has(gone.id)).toBe(false);
    expect(openBlockersOf(index, shelved.id)).toBe(1);
    expect(index.blocks.get(a.id)).toEqual([later]);
  });

  it('sorts a mirror by number, and skips types with no Blocks field', () => {
    const a = card('A');
    const late = card('Late', [a.id]);
    const early = card('Early', [a.id]);
    const bug = item({ title: 'Bug', [BLOCKED_BY.id]: [a.id] }, { type: 'bug' });
    const index = blockingIndexOf([early, late, a, bug], TYPES, done);
    expect(index.blocks.get(a.id)!.map((c) => c.key)).toEqual([late.key, early.key]);
    expect(index.blockers.has(bug.id)).toBe(false);
  });

  it('costs nothing for a catalogue without a Blocks field', () => {
    const index = blockingIndexOf([card('A', ['x'])], ITEM_TYPES, done);
    expect(index.blockers.size + index.blocks.size + index.open.size).toBe(0);
  });
});

describe('loops', () => {
  it('finds the chain a new blocker would close', () => {
    const a = card('Website');
    const b = card('Launch', [a.id]);
    const c = card('Copy', [b.id]);
    const items = map([a, b, c]);
    // A blocked by B: B already waits on A.
    expect(blockingLoop(items, TYPES, a.id, b.id)).toEqual([b, a]);
    expect(blockingLoop(items, TYPES, a.id, c.id)).toEqual([c, b, a]);
    expect(blockingLoop(items, TYPES, c.id, a.id)).toBeNull();
    expect(blockingLoop(items, TYPES, a.id, a.id)).toBeNull();
    expect(blockingLoop(items, TYPES, a.id, 'missing')).toBeNull();
    // A chain through a card that is gone ends there.
    const d = card('D', ['gone']);
    expect(blockingLoop(map([a, d]), TYPES, a.id, d.id)).toBeNull();
  });

  it('says the chain in words', () => {
    const a = card('Website');
    const b = card('Launch');
    const c = card('');
    expect(blockingLoopMessage([b, a])).toBe(
      `#${b.key} Launch already waits on #${a.key} Website, so it can't block it.`,
    );
    expect(blockingLoopMessage([b, { ...a, key: undefined }])).toBe(
      `#${b.key} Launch already waits on Website, so it can't block it.`,
    );
    expect(blockingLoopMessage([b, c, a])).toBe(
      `#${b.key} Launch already waits on #${a.key} Website through #${c.key} Untitled, so it can't block it.`,
    );
  });

  it('refuses a write only for a link it adds', () => {
    const a = card('A');
    const b = card('B', [a.id]);
    const closing = { ...a, fields: { ...a.fields, [BLOCKED_BY.id]: [b.id] } };
    expect(blockingCycleOf([a, b], TYPES, [{ before: a, next: closing }])).toEqual({
      itemId: a.id,
      chain: [b, closing],
    });
    // Removing a link never is, nor a write touching none.
    const freed = { ...b, fields: { title: 'B' } };
    expect(blockingCycleOf([a, b], TYPES, [{ before: b, next: freed }])).toBeNull();
    expect(blockingCycleOf([a, b], TYPES, [])).toBeNull();
    // Two new links sharing an upstream card read it once, and close nothing.
    const c = card('C');
    const b1 = card('B1', [c.id]);
    const b2 = card('B2', [c.id]);
    const x = card('X');
    const both = { ...x, fields: { ...x.fields, [BLOCKED_BY.id]: [b1.id, b2.id] } };
    expect(blockingCycleOf([c, b1, b2, x], TYPES, [{ before: x, next: both }])).toBeNull();
    expect(blockingCycleOf([a, b], ITEM_TYPES, [{ before: a, next: closing }])).toBeNull();
  });

  it('lets a loop already in the plan stand, refusing only what adds to it', () => {
    const a = card('A');
    const b = card('B', [a.id]);
    const looped = { ...a, fields: { ...a.fields, [BLOCKED_BY.id]: [b.id] } };
    const c = card('C');
    // Another link on A, to a card outside the loop, passes; the old loop ends the walk.
    const more = { ...looped, fields: { ...looped.fields, [BLOCKED_BY.id]: [b.id, c.id] } };
    expect(blockingCycleOf([looped, b, c], TYPES, [{ before: looped, next: more }])).toBeNull();
    // C blocked by A now closes a new loop through it.
    const into = { ...c, fields: { ...c.fields, [BLOCKED_BY.id]: [looped.id] } };
    const withC = { ...more };
    expect(blockingCycleOf([withC, b, c], TYPES, [{ before: c, next: into }])?.itemId).toBe(c.id);
  });

  it('checks every change of a batch against the others, and a create', () => {
    const a = card('A');
    const b = card('B');
    const aOnB = { ...a, fields: { ...a.fields, [BLOCKED_BY.id]: [b.id] } };
    const bOnA = { ...b, fields: { ...b.fields, [BLOCKED_BY.id]: [a.id] } };
    expect(
      blockingCycleOf([a, b], TYPES, [
        { before: a, next: aOnB },
        { before: b, next: bOnA },
      ]),
    ).not.toBeNull();
    // A create put back with its id, which another card already waits on.
    const waiting = card('W', ['back1']);
    const back = { ...card('Back', [waiting.id]), id: 'back1' };
    expect(blockingCycleOf([waiting], TYPES, [{ next: back }])).toEqual({
      itemId: 'back1',
      chain: [waiting, back],
    });
    expect(blockingCycleOf([waiting], TYPES, [{ next: card('Fresh', [waiting.id]) }])).toBeNull();
  });

  it('follows trashed and archived cards too', () => {
    const a = card('A');
    const b = card('B', [a.id], { status: TRASH_STATUS });
    const closing = { ...a, fields: { ...a.fields, [BLOCKED_BY.id]: [b.id] } };
    expect(blockingCycleOf([a, b], TYPES, [{ before: a, next: closing }])).not.toBeNull();
  });
});

describe('the switch through agents', () => {
  const statuses = [{ status: 'todo~a1', name: 'To Do' }];
  it('sets Blocks on a Card field, holding several with it, and stops it', () => {
    const r = applyCardTypeChanges(
      null,
      [
        { op: 'add', name: 'Job' },
        {
          op: 'set',
          type: 'Job',
          addCustom: [
            { name: 'Blocked By', kind: 'card', linkType: 'Job', blocks: true },
            { name: 'Waits', kind: 'card', linkType: 'Job' },
          ],
        },
        {
          op: 'set',
          type: 'Job',
          editCustom: [
            { field: 'Blocked By', blocks: false },
            { field: 'Waits', blocks: true },
          ],
        },
      ],
      statuses,
    );
    if (!r.ok) throw new Error(r.message);
    const custom = r.catalogue!.types[0]!.custom!;
    expect(custom[0]).toMatchObject({ multiple: true });
    expect(custom[0]!.blocks).toBeUndefined();
    expect(custom[1]).toMatchObject({ blocks: true, multiple: true });
  });

  it('refuses Blocks on any other kind', () => {
    for (const change of [
      { op: 'add' as const, name: 'Note', custom: [{ name: 'Area', kind: 'text', blocks: true }] },
    ])
      expect(applyCardTypeChanges(null, [change], statuses)).toMatchObject({
        ok: false,
        message: '"Area" is a text field: only a card field blocks.',
      });
    const added = applyCardTypeChanges(
      null,
      [{ op: 'add', name: 'Note', custom: [{ name: 'Area', kind: 'text' }] }],
      statuses,
    );
    if (!added.ok) throw new Error(added.message);
    expect(
      applyCardTypeChanges(
        added.catalogue,
        [{ op: 'set', type: 'Note', editCustom: [{ field: 'Area', blocks: true }] }],
        statuses,
      ),
    ).toMatchObject({ ok: false, message: '"Area" is a text field: only a card field blocks.' });
  });
});
