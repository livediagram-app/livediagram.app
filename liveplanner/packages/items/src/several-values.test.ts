import { describe, expect, it } from 'vitest';
import {
  cardKey,
  fieldCardIds,
  fieldPeople,
  holdsSeveral,
  linkedCardIds,
  personKey,
  severalValue,
  storedCardIds,
  storedPeople,
  swappedValues,
  toggledValues,
} from './several-values';
import { laneDropPatch, laneFieldsOf, projectBoard, type PlanBoardSetup } from './board';
import { validateFields } from './fields';
import { FIELD_VALUES_MAX } from './limits';
import { ITEM_TYPES, type ItemTypeDef } from './item-types';
import { readItemTypeCatalogue } from './type-catalogue';
import { isNotified, notifiedPeople } from './notify-fields';
import { linkableCards, linkedCardsOf, linkedValue, linkFieldsOfType } from './card-links';
import { customFieldText } from './card-text';
import { childIndexOf } from './calculated-fields';
import { searchCards, searchValues } from './card-search';
import { breakdownModel } from './plan-view-charts';
import { ganttLanes } from './plan-view-gantt';
import { resolveFields } from './plan-names';
import { boardCsvImport, boardCsvRows } from './board-csv';
import { applyCardTypeChanges } from './type-changes';
import { presetSetup } from './presets';
import type { Item } from './item';
import { item } from './test-items';

// docs/specs/026-plan/item-types.md "Holds Several": Person and Card fields holding several values.

const SAM = { id: 'p-sam', name: 'Sam', color: '#2563eb' };
const ANA = { id: 'p-ana', name: 'Ana', color: '#16a34a' };
const LEE = { id: 'p-lee', name: 'Lee', color: '#dc2626' };
const JO = { id: 'n-jo', name: 'Jo', color: '#9333ea' };

const map = (items: Item[]) => new Map(items.map((i) => [i.id, i]));
const setup: PlanBoardSetup = { ...presetSetup('kanban'), addTypes: undefined };
const todo = setup.columns[0]!.status;

const epic: ItemTypeDef = {
  id: 'epic',
  label: 'Epic',
  newTitle: 'New epic',
  glyph: 'flag',
  color: '#16a34a',
  fields: ['title', 'status'],
};
const story: ItemTypeDef = {
  id: 'story',
  label: 'Story',
  newTitle: 'New story',
  glyph: 'page',
  color: '#2563eb',
  fields: ['title', 'status', 'assignee', 'f-reviewers', 'f-owner', 'f-related', 'f-epic'],
  custom: [
    { id: 'f-reviewers', label: 'Reviewers', kind: 'person', multiple: true, notifies: true },
    { id: 'f-owner', label: 'Owner', kind: 'person' },
    { id: 'f-related', label: 'Related', kind: 'card', linkType: 'epic', multiple: true },
    { id: 'f-epic', label: 'Epic', kind: 'card', linkType: 'epic' },
  ],
};
const types = [epic, story, ...ITEM_TYPES];
const reviewers = story.custom![0]!;
const owner = story.custom![1]!;
const related = story.custom![2]!;
const single = story.custom![3]!;

describe('reading a field that holds several', () => {
  it('holds several only when switched on, on a Person or Card field', () => {
    expect(holdsSeveral(reviewers)).toBe(true);
    expect(holdsSeveral(owner)).toBe(false);
    expect(holdsSeveral({ kind: 'text', multiple: true })).toBe(false);
    expect(holdsSeveral(undefined)).toBe(false);
  });

  it('reads a single stored value as a list of one, and a list for one field as its first', () => {
    expect(storedPeople(SAM)).toEqual([SAM]);
    expect(storedPeople([SAM, ANA, SAM, 'x', null])).toEqual([SAM, ANA]);
    expect(storedPeople('Sam')).toEqual([]);
    expect(fieldPeople(reviewers, SAM)).toEqual([SAM]);
    expect(fieldPeople(reviewers, [SAM, ANA])).toEqual([SAM, ANA]);
    expect(fieldPeople(owner, [SAM, ANA])).toEqual([SAM]);
    expect(fieldPeople(undefined, SAM)).toEqual([SAM]);
    expect(storedCardIds('a')).toEqual(['a']);
    expect(storedCardIds(['a', 'b', 'a', '', 3])).toEqual(['a', 'b']);
    expect(storedCardIds(undefined)).toEqual([]);
    expect(fieldCardIds(related, 'a')).toEqual(['a']);
    expect(fieldCardIds(single, ['a', 'b'])).toEqual(['a']);
  });

  it('lists every card a field links to for rollups, and none for another kind', () => {
    const card = item({ title: 'S', 'f-related': ['e1', 'e2'], 'f-epic': 'e3' });
    expect(linkedCardIds(card, related)).toEqual(['e1', 'e2']);
    expect(linkedCardIds(card, single)).toEqual(['e3']);
    expect(linkedCardIds(card, owner)).toEqual([]);
  });

  it('stores a list for several, the first for one, and nothing when empty', () => {
    expect(severalValue(reviewers, [SAM, ANA])).toEqual([SAM, ANA]);
    expect(severalValue(owner, [SAM, ANA])).toEqual(SAM);
    expect(severalValue(reviewers, [])).toBeUndefined();
    const many = Array.from({ length: FIELD_VALUES_MAX + 3 }, (_, i) => `c${i}`);
    expect(severalValue(related, many)).toHaveLength(FIELD_VALUES_MAX);
  });

  it('toggles a value in or out, never past the most a field holds', () => {
    expect(toggledValues([SAM], ANA, personKey)).toEqual([SAM, ANA]);
    expect(toggledValues([SAM, ANA], SAM, personKey)).toEqual([ANA]);
    const full = Array.from({ length: FIELD_VALUES_MAX }, (_, i) => `c${i}`);
    expect(toggledValues(full, 'new', cardKey)).toEqual(full);
  });

  it('swaps the value a card left for the row it lands in', () => {
    expect(swappedValues([SAM, ANA], SAM, LEE, personKey)).toEqual([LEE, ANA]);
    expect(swappedValues([SAM, ANA], SAM, ANA, personKey)).toEqual([ANA]);
    expect(swappedValues([SAM], undefined, ANA, personKey)).toEqual([SAM, ANA]);
    expect(swappedValues([SAM], SAM, SAM, personKey)).toEqual([SAM]);
    expect(swappedValues(['a'], 'gone', 'b', cardKey)).toEqual(['a', 'b']);
  });
});

describe('storing several', () => {
  it('takes a list of people, each checked as the Assignee is', () => {
    expect(validateFields({ 'f-reviewers': [SAM, ANA] }, 'patch')).toEqual({
      ok: true,
      fields: { 'f-reviewers': [SAM, ANA] },
    });
    expect(validateFields({ 'f-reviewers': [SAM, { id: 'x', name: 'X' }] }, 'patch').ok).toBe(
      false,
    );
    const crowd = Array.from({ length: FIELD_VALUES_MAX + 1 }, (_, i) => ({ ...SAM, id: `p${i}` }));
    expect(validateFields({ 'f-reviewers': crowd }, 'patch').ok).toBe(false);
    // A list of card ids is a list of strings, as before.
    expect(validateFields({ 'f-related': ['a', 'b'] }, 'patch').ok).toBe(true);
    // Checklist rows still read as rows.
    expect(validateFields({ 'f-steps': [{ text: 'A', done: false }] }, 'patch').ok).toBe(true);
  });

  it('keeps the switch only as true on a Person or Card field', () => {
    const read = readItemTypeCatalogue({
      version: 1,
      types: [
        epic,
        {
          ...story,
          custom: [
            ...story.custom!,
            { id: 'f-note', label: 'Note', kind: 'text', multiple: true },
            { id: 'f-pair', label: 'Pair', kind: 'person', multiple: 'yes' },
          ],
          fields: [...story.fields, 'f-note', 'f-pair'],
        },
      ],
    });
    const custom = read!.types[1]!.custom!;
    expect(custom.find((f) => f.id === 'f-reviewers')?.multiple).toBe(true);
    expect(custom.find((f) => f.id === 'f-related')?.multiple).toBe(true);
    expect(custom.find((f) => f.id === 'f-owner')).not.toHaveProperty('multiple');
    expect(custom.find((f) => f.id === 'f-note')).not.toHaveProperty('multiple');
    expect(custom.find((f) => f.id === 'f-pair')).not.toHaveProperty('multiple');
  });
});

describe('notifying several', () => {
  it('tells each person a notifying field holds, never a custom person, once each', () => {
    const card = item({ title: 'S', assignee: SAM, 'f-reviewers': [ANA, SAM, JO, LEE] });
    expect(notifiedPeople(story, card)).toEqual([
      { fieldId: 'assignee', person: SAM },
      { fieldId: 'f-reviewers', person: ANA },
      { fieldId: 'f-reviewers', person: LEE },
    ]);
    expect(isNotified(story, card, LEE.id)).toBe(true);
    expect(isNotified(story, card, JO.id)).toBe(false);
  });

  it('reads a single stored person in a field holding several', () => {
    expect(notifiedPeople(story, item({ title: 'S', 'f-reviewers': ANA }))).toEqual([
      { fieldId: 'f-reviewers', person: ANA },
    ]);
  });
});

describe('lanes by a field that holds several', () => {
  const board = (field: string): PlanBoardSetup => ({
    ...setup,
    swimlaneBy: 'field',
    swimlaneField: field,
  });
  const e1 = item({ title: 'Billing', status: todo }, { type: 'epic', key: 901 });
  const e2 = item({ title: 'Search', status: todo }, { type: 'epic', key: 902 });

  it('offers the field and marks it as holding several', () => {
    const f = laneFieldsOf(types).find((x) => x.id === 'f-reviewers');
    expect(f).toMatchObject({ kind: 'person', several: true });
    expect(laneFieldsOf(types).find((x) => x.id === 'f-owner')).not.toHaveProperty('several');
  });

  it('puts a card in each of its people’s rows, and in No {Field} only with none', () => {
    const both = item(
      { title: 'Pair', status: todo, 'f-reviewers': [SAM, ANA] },
      { type: 'story' },
    );
    const one = item({ title: 'Solo', status: todo, 'f-reviewers': SAM }, { type: 'story' });
    const none = item({ title: 'None', status: todo }, { type: 'story' });
    const p = projectBoard(board('f-reviewers'), map([both, one, none]), undefined, types);
    expect(p.lanes.map((l) => l.label)).toEqual(['Ana', 'Sam', 'No Reviewers']);
    const cell = (key: string) =>
      p.columns[0]!.lanes.find((l) => l.laneKey === key)!.items.map((i) => i.fields['title']);
    expect(cell(p.lanes[0]!.key)).toEqual(['Pair']);
    expect(cell(p.lanes[1]!.key)).toEqual(expect.arrayContaining(['Pair', 'Solo']));
    expect(cell('')).toEqual(['None']);
    // The column still counts each card once.
    expect(p.columns[0]!.count).toBe(5 - 2);
  });

  it('puts a card in each linked card’s row, named by the card', () => {
    const s = item(
      { title: 'S', status: todo, 'f-related': [e2.id, e1.id, 'gone'] },
      { type: 'story' },
    );
    const p = projectBoard(board('f-related'), map([e1, e2, s]), undefined, types);
    // A missing card's row leads, as a single Card field's does (it has no number).
    expect(p.lanes.map((l) => l.label)).toEqual([
      'Missing card',
      'Billing',
      'Search',
      'No Related',
    ]);
    expect(p.columns[0]!.lanes.filter((l) => l.items.some((i) => i.id === s.id))).toHaveLength(3);
  });

  it('reads a list in a field holding one as its first value', () => {
    const s = item({ title: 'S', status: todo, 'f-owner': [ANA, SAM] }, { type: 'story' });
    const p = projectBoard(board('f-owner'), map([s]), undefined, types);
    expect(p.lanes.map((l) => l.label)).toEqual(['Ana', 'No Owner']);
  });

  it('swaps the row the card left for the one it lands in, keeping its others', () => {
    const s = item({ title: 'S', status: todo, 'f-reviewers': [SAM, ANA] }, { type: 'story' });
    const lee = item({ title: 'L', status: todo, 'f-reviewers': [LEE] }, { type: 'story' });
    const p = projectBoard(board('f-reviewers'), map([s, lee]), undefined, types);
    const row = (name: string) => p.lanes.find((l) => l.label === name)!;
    expect(laneDropPatch(row('Lee'), s, row('Sam'))).toEqual({
      set: { 'f-reviewers': [LEE, ANA] },
    });
    expect(laneDropPatch(row('Ana'), s, row('Sam'))).toEqual({ set: { 'f-reviewers': [ANA] } });
    expect(laneDropPatch(row('Lee'), s)).toEqual({ set: { 'f-reviewers': [SAM, ANA, LEE] } });
    expect(laneDropPatch(row('No Reviewers'), s, row('Sam'))).toEqual({ clear: ['f-reviewers'] });
    expect(laneDropPatch(row('Lee'))).toEqual({ set: { 'f-reviewers': [LEE] } });
  });

  it('swaps a linked card the same way', () => {
    const s = item({ title: 'S', status: todo, 'f-related': [e1.id] }, { type: 'story' });
    const t = item({ title: 'T', status: todo, 'f-related': e2.id }, { type: 'story' });
    const p = projectBoard(board('f-related'), map([e1, e2, s, t]), undefined, types);
    const row = (name: string) => p.lanes.find((l) => l.label === name)!;
    expect(laneDropPatch(row('Search'), s, row('Billing'))).toEqual({
      set: { 'f-related': [e2.id] },
    });
  });

  it('counts a card in each of its rows in filters, values, charts and Gantt lanes', () => {
    const a = item({ title: 'A', status: todo, 'f-reviewers': [SAM, ANA] }, { type: 'story' });
    const b = item({ title: 'B', status: todo, 'f-reviewers': [SAM] }, { type: 'story' });
    const values = searchValues([a, b], { by: 'field', field: 'f-reviewers' }, types);
    expect(values.map((v) => [v.label, v.count])).toEqual([
      ['Ana', 1],
      ['Sam', 2],
    ]);
    const ana = values[0]!.key;
    expect(
      searchCards([a, b], [{ by: 'field', field: 'f-reviewers', key: ana }], types).map(
        (c) => c.id,
      ),
    ).toEqual([a.id]);
    const chart = breakdownModel([a, b], new Map(), { by: 'field', field: 'f-reviewers' }, types);
    expect(chart.rows.map((r) => [r.label, r.total])).toEqual([
      ['Sam', 2],
      ['Ana', 1],
    ]);
    expect(chart.total).toBe(2);
    const measured = breakdownModel(
      [a, b],
      new Map(),
      { by: 'field', field: 'f-reviewers' },
      types,
      undefined,
      undefined,
      'estimate',
    );
    expect(measured.total).toBe(0);
    const lanes = ganttLanes(
      [a, b].map((it) => ({ item: it })) as never,
      'field',
      'f-reviewers',
      map([a, b]),
      types,
    );
    expect(lanes.map((l) => [l.lane?.label, l.rows.length])).toEqual([
      ['Ana', 1],
      ['Sam', 2],
    ]);
  });
});

describe('linking several cards', () => {
  const e1 = item({ title: 'Billing' }, { type: 'epic', key: 801 });
  const e2 = item({ title: 'Search' }, { type: 'epic', key: 802 });
  const s1 = item({ title: 'S1', 'f-related': [e1.id, e2.id] }, { type: 'story', key: 803 });
  const s2 = item(
    { title: 'S2', 'f-related': e1.id, 'f-epic': e2.id },
    { type: 'story', key: 804 },
  );
  const s3 = item({ title: 'S3', 'f-epic': e1.id }, { type: 'story', key: 805 });
  const items = map([e1, e2, s1, s2, s3]);

  it('names a link field that holds several', () => {
    expect(linkFieldsOfType(story).map((f) => [f.id, f.several ?? false])).toEqual([
      ['f-related', true],
      ['f-epic', false],
    ]);
  });

  it('lists every card whose list holds the target under Linked as', () => {
    const groups = linkedCardsOf(e1, items, types);
    const byField = Object.fromEntries(groups.map((g) => [g.fieldId, g.cards.map((c) => c.id)]));
    expect(byField).toEqual({ 'f-related': [s1.id, s2.id], 'f-epic': [s3.id] });
    expect(groups.find((g) => g.fieldId === 'f-related')?.several).toBe(true);
  });

  it('never offers to move a link for a field that holds several, and adds to the list', () => {
    const group = linkedCardsOf(e2, items, types).find((g) => g.fieldId === 'f-related')!;
    const offered = linkableCards(e2, group, items.values());
    expect(offered.map((o) => [o.card.id, o.elsewhere])).toEqual([
      [s2.id, null],
      [s3.id, null],
    ]);
    expect(linkedValue(s2, group, e2.id)).toEqual([e1.id, e2.id]);
    expect(linkedValue(s1, group, e2.id)).toEqual([e1.id, e2.id]);
    const one = linkedCardsOf(e1, items, types).find((g) => g.fieldId === 'f-epic')!;
    expect(linkedValue(s2, one, e1.id)).toBe(e1.id);
    expect(linkableCards(e1, one, items.values()).find((o) => o.card.id === s2.id)?.elsewhere).toBe(
      e2.id,
    );
  });

  it('counts each card in a list as a child', () => {
    const index = childIndexOf(items.values(), types);
    expect(index.get(e1.id)?.map((l) => l.item.id)).toEqual([s1.id, s2.id, s3.id]);
    expect(index.get(e2.id)?.map((l) => l.item.id)).toEqual([s1.id, s2.id]);
  });

  it('reads as every linked card’s title and every person’s name', () => {
    expect(customFieldText(related, [e1.id, 'gone'], items)).toBe('Billing, Missing card');
    expect(customFieldText(related, [], items)).toBeNull();
    expect(customFieldText(reviewers, [SAM, ANA])).toBe('Sam, Ana');
    expect(customFieldText(owner, [SAM, ANA])).toBe('Sam');
    expect(customFieldText(reviewers, [])).toBeNull();
  });
});

describe('agents and CSV', () => {
  const e1 = item({ title: 'Billing' }, { type: 'epic', key: 701 });
  const e2 = item({ title: 'Search' }, { type: 'epic', key: 702 });
  const naming = { statuses: [], items: [e1, e2, item({ title: 'X', assignee: SAM })] };

  it('takes a comma list or a list of names and numbers', () => {
    expect(resolveFields({ Reviewers: 'Sam, Ana', Related: '#701, #702' }, story, naming)).toEqual({
      ok: true,
      fields: {
        'f-reviewers': [SAM, expect.objectContaining({ id: 'n-ana', name: 'Ana' })],
        'f-related': [e1.id, e2.id],
      },
    });
    expect(resolveFields({ Reviewers: [SAM, 'Sam'], Related: ['#701'] }, story, naming)).toEqual({
      ok: true,
      fields: { 'f-reviewers': [SAM], 'f-related': [e1.id] },
    });
  });

  it('refuses an empty list, too many, a value of the wrong shape and an unknown card', () => {
    expect(resolveFields({ Reviewers: ' , ' }, story, naming)).toMatchObject({ ok: false });
    const crowd = Array.from({ length: FIELD_VALUES_MAX + 1 }, (_, i) => `P${i}`).join(',');
    expect(resolveFields({ Reviewers: crowd }, story, naming)).toMatchObject({ ok: false });
    expect(resolveFields({ Reviewers: [5] }, story, naming)).toMatchObject({ ok: false });
    expect(resolveFields({ Related: '#999' }, story, naming)).toMatchObject({ ok: false });
  });

  it('exports every name and linked title, and imports a comma list of names', () => {
    const board: PlanBoardSetup = { ...setup, addTypes: ['story'] };
    const s = item(
      {
        title: 'S',
        status: todo,
        'f-reviewers': [SAM, ANA],
        'f-related': [e1.id, e2.id],
        'f-owner': SAM,
      },
      { type: 'story' },
    );
    const rows = boardCsvRows(board, map([e1, e2, s]), types);
    const col = (name: string) => rows[1]![rows[0]!.indexOf(name)];
    expect(col('Reviewers')).toBe('Sam, Ana');
    expect(col('Related')).toBe('Billing, Search');
    expect(col('Owner')).toBe('Sam');
    const { creates } = boardCsvImport(
      [
        ['Title', 'Reviewers'],
        ['New', 'Sam, Ana, Nobody'],
        ['Empty', 'Nobody'],
      ],
      { setup: board, types, people: [SAM, ANA], room: 10 },
    );
    expect(creates[0]!.fields).toMatchObject({ 'f-reviewers': [SAM, ANA] });
    expect(creates[1]!.fields).not.toHaveProperty('f-reviewers');
  });

  it('sets the switch on a Person or Card field and refuses it on any other', () => {
    const statuses = [{ status: 'todo~a1', name: 'To Do' }];
    const r = applyCardTypeChanges(
      null,
      [
        {
          op: 'add',
          name: 'Review',
          custom: [
            { name: 'Reviewers', kind: 'person', multiple: true },
            { name: 'Pair', kind: 'person' },
          ],
        },
        {
          op: 'set',
          type: 'Review',
          editCustom: [
            { field: 'Reviewers', multiple: false },
            { field: 'Pair', multiple: true },
          ],
        },
      ],
      statuses,
    );
    if (!r.ok) throw new Error(r.message);
    expect(r.catalogue!.types[0]!.custom).toEqual([
      { id: 'f-reviewers', label: 'Reviewers', kind: 'person' },
      { id: 'f-pair', label: 'Pair', kind: 'person', multiple: true },
    ]);
    expect(
      applyCardTypeChanges(
        null,
        [{ op: 'add', name: 'Note', custom: [{ name: 'Area', kind: 'text', multiple: true }] }],
        statuses,
      ),
    ).toMatchObject({
      ok: false,
      message: '"Area" is a text field: only a person or card field holds several.',
    });
  });
});
