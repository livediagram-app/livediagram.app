import { describe, expect, it } from 'vitest';
import type { PlanBoardSetup } from './board';
import type { Item } from './item';
import {
  LINKED_AT_FIELD,
  LINKED_FIELD,
  LINKED_GONE_FIELD,
  LINKED_REV_FIELD,
  cardLink,
  cardStatusFor,
  collectingBoard,
  healLinkedCards,
  linkString,
  linkedCardCreate,
  linkedCardLeftPatch,
  linkedCardId,
  linkedCardsTrashedBy,
  unlinkedFields,
  parseLink,
  recordStatusOf,
  type LinkedRecord,
} from './linked-cards';

const setup: PlanBoardSetup = {
  title: 'Actions',
  columns: [
    { id: 'new', status: 'new', name: 'New' },
    { id: 'done', status: 'done', name: 'Done' },
    { id: 'wont-do', status: 'wont-do', name: 'Won’t Do' },
  ],
  doneColumnId: 'done',
  swimlaneBy: 'none',
  cardFields: [],
  hideWriting: false,
  collects: 'actions',
};

const sam = { id: 'p-sam', name: 'Sam', color: '#ff0000' };
const record = (over: Partial<LinkedRecord> = {}): LinkedRecord => ({
  id: '0b6c1a3e-2f41-4d4e-9d1c-7a0e3c5b9f11',
  tabId: 't1',
  elementId: 'e1',
  title: 'Confirm the retry budget',
  description: '',
  status: 'open',
  updatedAt: 100,
  assignee: sam,
  ...over,
});
const by = { id: 'x', name: 'X', color: '#000000' };
const card = (fields: Item['fields'], over: Partial<Item> = {}): Item => ({
  id: linkedCardId('actions', record().id),
  type: 'action',
  key: 1,
  rank: 'a0',
  fields,
  rev: 1,
  createdAt: 50,
  updatedAt: 50,
  createdBy: by,
  updatedBy: by,
  ...over,
});
const linkOf = (r: LinkedRecord) =>
  linkString({ kind: 'actions', tabId: r.tabId, elementId: r.elementId, recordId: r.id });
// A card that agrees with `r`, its baseline taken at r's stamp and its own revision 1.
const inSync = (r = record(), over: Item['fields'] = {}, item: Partial<Item> = {}) =>
  card(
    {
      title: r.title,
      status: 'new',
      assignee: sam,
      [LINKED_FIELD]: linkOf(r),
      [LINKED_AT_FIELD]: r.updatedAt,
      [LINKED_REV_FIELD]: 1,
      ...over,
    },
    item,
  );
// The card after someone changed it on the board: a revision past its baseline, stamped later.
const movedOnBoard = (over: Item['fields'], updatedAt = 300) =>
  inSync(record(), over, { rev: 2, updatedAt });
const NOW = 1_000;
const heal = (records: LinkedRecord[], items: Item[], s = setup) =>
  healLinkedCards({
    kind: 'actions',
    records,
    items: new Map(items.map((i) => [i.id, i])),
    setup: s,
    typeId: 'action',
    now: NOW,
  });
const base = (r: LinkedRecord, rev = 1) => ({
  [LINKED_AT_FIELD]: r.updatedAt,
  [LINKED_REV_FIELD]: rev + 1,
});

describe('linkedCardId', () => {
  it('is fixed by the record id, id-safe and within the id bounds', () => {
    const id = linkedCardId('actions', record().id);
    expect(id).toBe(linkedCardId('actions', record().id));
    expect(id).toMatch(/^[A-Za-z0-9_-]{6,32}$/);
    expect(id.startsWith('a')).toBe(true);
    expect(linkedCardId('actions', 'x')).toBe('ax____');
    expect(linkedCardId('actions', 'a/b c')).toBe('aabc__');
  });
});

describe('links', () => {
  it('round-trips a place and refuses anything else', () => {
    const place = { kind: 'actions' as const, tabId: 't', elementId: 'e', recordId: 'r' };
    expect(parseLink(linkString(place))).toEqual(place);
    expect(cardLink({ fields: { [LINKED_FIELD]: 'actions/t/e/r' } })).toEqual(place);
    expect(parseLink('decisions/t/e/r')).toBeNull();
    expect(parseLink('actions/t//r')).toBeNull();
    expect(parseLink('actions/t/e')).toBeNull();
    expect(parseLink(3)).toBeNull();
  });
});

describe('collectingBoard', () => {
  it('is the first board that collects the kind', () => {
    const plain = { setup: { ...setup, collects: undefined } };
    const a = { setup };
    const b = { setup };
    expect(collectingBoard([plain, a, b], 'actions')).toBe(a);
    expect(collectingBoard([plain], 'actions')).toBeUndefined();
  });
});

describe('status mapping', () => {
  // No column counts as done, whatever its name (Counts as Done off on each).
  const noDone: PlanBoardSetup = {
    ...setup,
    columns: setup.columns.map((c) => ({ ...c, done: false })),
  };
  const withDoing: PlanBoardSetup = {
    ...setup,
    columns: [
      setup.columns[0]!,
      { id: 'doing', status: 'doing', name: 'Doing' },
      ...setup.columns.slice(1),
    ],
  };
  it('reads columns before Done as open, Done as done and after it as Won’t Do', () => {
    expect(recordStatusOf(withDoing, 'new')).toBe('open');
    expect(recordStatusOf(withDoing, 'doing')).toBe('open');
    expect(recordStatusOf(withDoing, 'done')).toBe('done');
    expect(recordStatusOf(withDoing, 'wont-do')).toBe('wont-do');
    expect(recordStatusOf(withDoing, 'elsewhere')).toBeNull();
    expect(recordStatusOf(noDone, 'new')).toBeNull();
  });
  it('places each record status, keeping an open card in its open column', () => {
    expect(cardStatusFor(withDoing, 'open', undefined)).toBe('new');
    expect(cardStatusFor(withDoing, 'open', 'doing')).toBe('doing');
    expect(cardStatusFor(withDoing, 'open', 'done')).toBe('new');
    expect(cardStatusFor(withDoing, 'done', 'new')).toBe('done');
    expect(cardStatusFor(withDoing, 'wont-do', 'new')).toBe('wont-do');
    const noAfter = { ...setup, columns: setup.columns.slice(0, 2) };
    expect(cardStatusFor(noAfter, 'wont-do', 'new')).toBe('done');
    expect(cardStatusFor(noDone, 'done', 'new')).toBeUndefined();
  });
});

describe('linkedCardCreate', () => {
  it('makes the card with its fixed id, link, assignee and status', () => {
    const r = record({ description: 'Ask ops', status: 'done' });
    expect(linkedCardCreate('actions', r, setup, 'action')).toEqual({
      id: linkedCardId('actions', r.id),
      type: 'action',
      fields: {
        title: r.title,
        description: 'Ask ops',
        status: 'done',
        assignee: sam,
        [LINKED_FIELD]: linkOf(r),
        [LINKED_AT_FIELD]: 100,
        [LINKED_REV_FIELD]: 1,
      },
    });
  });
  it('clips a long title and names an empty one', () => {
    const made = linkedCardCreate(
      'actions',
      record({ title: 'x'.repeat(600), assignee: null }),
      setup,
      'action',
    );
    expect((made.fields['title'] as string).length).toBe(500);
    expect(made.fields['assignee']).toBeUndefined();
    expect(
      linkedCardCreate('actions', record({ title: '' }), setup, 'action').fields['title'],
    ).toBe('Action');
  });
});

describe('unlinkedFields', () => {
  it('drops the link and its baseline, keeping the rest', () => {
    const fields = { ...inSync().fields, [LINKED_GONE_FIELD]: true, due: '2026-11-01' };
    expect(unlinkedFields(fields)).toEqual({
      title: record().title,
      status: 'new',
      assignee: sam,
      due: '2026-11-01',
    });
  });
});

describe('linkedCardsTrashedBy', () => {
  const linked = inSync();
  const plain = card({ title: 'Plain', status: 'new' }, { id: 'plain1' });
  const store = { items: [linked, plain], rev: 1, nextKey: 3 };
  const trash = { set: { status: 'trash' } };
  it('names the linked cards a patch, a move or a batch sends to the Trash', () => {
    expect(linkedCardsTrashedBy({ kind: 'patch', id: linked.id, patch: trash }, store)).toEqual([
      linked,
    ]);
    expect(
      linkedCardsTrashedBy({ kind: 'move', id: linked.id, move: { status: 'trash' } }, store),
    ).toEqual([linked]);
    expect(
      linkedCardsTrashedBy(
        {
          kind: 'patches',
          patches: [
            { id: linked.id, patch: trash },
            { id: 'plain1', patch: trash },
          ],
        },
        store,
      ),
    ).toEqual([linked]);
  });
  it('ignores other writes, unlinked cards and cards already in the Trash', () => {
    expect(
      linkedCardsTrashedBy(
        { kind: 'patch', id: linked.id, patch: { set: { status: 'done' } } },
        store,
      ),
    ).toEqual([]);
    expect(linkedCardsTrashedBy({ kind: 'delete', id: linked.id }, store)).toEqual([]);
    expect(linkedCardsTrashedBy({ kind: 'patch', id: 'plain1', patch: trash }, store)).toEqual([]);
    const trashed = { ...store, items: [inSync(record(), { status: 'trash' })] };
    expect(linkedCardsTrashedBy({ kind: 'patch', id: linked.id, patch: trash }, trashed)).toEqual(
      [],
    );
  });
});

describe('linkedCardLeftPatch', () => {
  it('keeps the card on the board, where it is, as a card of its own', () => {
    const left = linkedCardLeftPatch(inSync(record(), { status: 'done' }))!;
    expect(left).toEqual({
      id: inSync().id,
      patch: { clear: ['linked', 'linkedAt', 'linkedRev'] },
    });
    expect(left.patch.set).toBeUndefined();
  });

  it('clears an old trashed-by-link mark too', () => {
    expect(
      linkedCardLeftPatch(inSync(record(), { [LINKED_GONE_FIELD]: true }))!.patch.clear,
    ).toContain(LINKED_GONE_FIELD);
  });

  it('leaves a card in the Trash, and one with no link, alone', () => {
    expect(linkedCardLeftPatch(inSync(record(), { status: 'trash' }))).toBeUndefined();
    expect(linkedCardLeftPatch(card(unlinkedFields(inSync().fields)))).toBeUndefined();
  });

  it('is linked again by the heal when its action comes back (an undo)', () => {
    const was = inSync(record());
    const kept = card(unlinkedFields(was.fields));
    const heal = healLinkedCards({
      kind: 'actions',
      records: [record()],
      items: new Map([[kept.id, kept]]),
      setup,
      typeId: 'action',
      now: 9,
    });
    expect(heal.creates).toEqual([]);
    expect(heal.patches[0]!.patch.set?.['linked']).toBe(was.fields['linked']);
  });
});

describe('healLinkedCards', () => {
  it('makes a card for a record that has none', () => {
    const h = heal([record()], []);
    expect(h.creates).toHaveLength(1);
    expect(h.patches).toEqual([]);
    expect(h.records).toEqual([]);
  });

  it('does nothing when they agree, whatever either side did meanwhile', () => {
    expect(heal([record()], [inSync()])).toEqual({ creates: [], patches: [], records: [] });
    // A due date added on the board moves the card's revision but disagrees on nothing: no write.
    expect(heal([record()], [movedOnBoard({ due: '2026-11-01' })]).patches).toEqual([]);
  });

  it('does nothing on a board with no columns', () => {
    expect(heal([record()], [], { ...setup, columns: [] }).creates).toEqual([]);
  });

  it('moves the card when the record changed since they last agreed', () => {
    const r = record({ status: 'done', updatedAt: 200 });
    const h = heal([r], [inSync()]);
    expect(h.patches).toEqual([
      { id: inSync().id, patch: { set: { status: 'done', ...base(r) } } },
    ]);
    expect(h.records).toEqual([]);
  });

  it('changes the record when the card changed since they last agreed, stamping a new baseline', () => {
    const h = heal([record()], [movedOnBoard({ status: 'wont-do', title: 'Renamed' })]);
    expect(h.records).toEqual([
      {
        id: record().id,
        tabId: 't1',
        elementId: 'e1',
        title: 'Renamed',
        status: 'wont-do',
        updatedAt: NOW,
      },
    ]);
    expect(h.patches).toEqual([
      { id: inSync().id, patch: { set: { [LINKED_AT_FIELD]: NOW, [LINKED_REV_FIELD]: 3 } } },
    ]);
  });

  it('trusts the baselines over the clocks', () => {
    // The record's browser runs far ahead of the server: the card moved since they agreed still wins.
    const ahead = record({ updatedAt: 9_999_999 });
    const moved = inSync(ahead, { status: 'done' }, { rev: 2, updatedAt: 300 });
    expect(heal([ahead], [moved]).records[0]).toMatchObject({ status: 'done' });
  });

  it('settles both sides having changed by the later stamp', () => {
    const r = record({ status: 'done', updatedAt: 400 });
    const moved = inSync(record(), { status: 'wont-do' }, { rev: 2, updatedAt: 300 });
    expect(heal([r], [moved]).patches[0]!.patch.set).toMatchObject({ status: 'done' });
    const later = inSync(record(), { status: 'wont-do' }, { rev: 2, updatedAt: 500 });
    expect(heal([r], [later]).records[0]).toMatchObject({ status: 'wont-do' });
  });

  it('carries a description either way, clearing an emptied one', () => {
    const r = record({ description: 'New detail', updatedAt: 200 });
    expect(heal([r], [inSync()]).patches[0]!.patch).toEqual({
      set: { description: 'New detail', ...base(r) },
    });
    const emptied = record({ updatedAt: 200 });
    expect(heal([emptied], [inSync(record(), { description: 'old' })]).patches[0]!.patch).toEqual({
      set: base(emptied),
      clear: ['description'],
    });
    expect(
      heal([record()], [movedOnBoard({ description: 'From the board' })]).records[0],
    ).toMatchObject({
      description: 'From the board',
    });
    const withText = record({ description: 'x' });
    const cleared = inSync(withText, {}, { rev: 2, updatedAt: 300 });
    expect(heal([withText], [cleared]).records[0]).toMatchObject({ description: '' });
  });

  it('never empties the record’s name from a card with no title', () => {
    const h = heal([record()], [movedOnBoard({ title: '', status: 'done' })]);
    expect(h.records[0]!.title).toBeUndefined();
    expect(h.records[0]!.status).toBe('done');
  });

  it('keeps the record’s assignee and place, whichever changed', () => {
    const lee = { id: 'p-lee', name: 'Lee', color: '#00ff00' };
    const moved = record({ assignee: lee, tabId: 't2' });
    expect(heal([moved], [movedOnBoard({})]).patches[0]!.patch).toEqual({
      set: {
        assignee: lee,
        [LINKED_FIELD]: linkOf(moved),
        [LINKED_AT_FIELD]: 100,
        [LINKED_REV_FIELD]: 3,
      },
    });
    expect(heal([record({ assignee: null })], [inSync()]).patches[0]!.patch).toEqual({
      set: base(record()),
      clear: ['assignee'],
    });
  });

  it('leaves a trashed card and a card in a status the board does not show', () => {
    expect(
      heal([record({ status: 'done', updatedAt: 200 })], [inSync(record(), { status: 'trash' })]),
    ).toEqual({
      creates: [],
      patches: [],
      records: [],
    });
    expect(
      heal([record({ status: 'done' })], [movedOnBoard({ status: 'elsewhere' })]).records,
    ).toEqual([]);
  });

  it('brings back a card the link put in the Trash once its record is back, and only that one', () => {
    const gone = inSync(record(), {
      status: 'trash',
      trashedFrom: 'done',
      [LINKED_GONE_FIELD]: true,
    });
    expect(heal([record()], [gone]).patches).toEqual([
      {
        id: gone.id,
        patch: { set: { status: 'done' }, clear: ['trashedFrom', LINKED_GONE_FIELD] },
      },
    ]);
    const noFrom = inSync(record(), { status: 'trash', [LINKED_GONE_FIELD]: true });
    expect(heal([record()], [noFrom]).patches[0]!.patch.set).toEqual({ status: 'new' });
  });

  it('reads Won’t Do in Done as agreeing on a board with nothing after Done', () => {
    const noAfter = { ...setup, columns: setup.columns.slice(0, 2) };
    const inDone = inSync(record(), { status: 'done' });
    expect(
      heal([record({ status: 'wont-do', updatedAt: 200 })], [inDone], noAfter).patches,
    ).toEqual([]);
  });

  it('reads open in Done as agreeing on a board whose first column is Done, so the heal settles', () => {
    const doneFirst = { ...setup, columns: setup.columns.slice(1) };
    // The card an open action starts with on such a board sits in Done, the board's first column.
    const made = heal([record()], [], doneFirst).creates[0]!;
    expect(made.fields['status']).toBe('done');
    const inDone = inSync(record(), { status: 'done' });
    expect(heal([record()], [inDone], doneFirst).patches).toEqual([]);
    expect(heal([record({ updatedAt: 200 })], [inDone], doneFirst).patches).toEqual([]);
  });
});
