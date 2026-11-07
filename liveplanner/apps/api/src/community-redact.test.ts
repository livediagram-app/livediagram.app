// What a Community post's link may see of a plan (docs/specs/025-community/community.md "Viewing a post's plan"):
// every rule in community-redact.ts, on the shapes the reads, the copy and the drawing hand it. Nobody who works on
// the plan, nobody who voted or commented, and no answer a form collected reaches a stranger.
import { describe, expect, it } from 'vitest';
import type { Item, ItemTypeCatalogue, ItemTypeDef } from '@liveplanner/items';
import type { SheetJson } from '@liveplanner/sheets';
import {
  COMMUNITY_PERSON,
  isResponseCard,
  redactItemForCommunity,
  redactItemRowForCommunity,
  redactItemsForCommunity,
  redactPlanTabDataForCommunity,
  redactPlanTabForCommunity,
  redactSheetCellRowsForCommunity,
  redactSheetForCommunity,
  responseSheetIds,
} from './community-redact';

const ADA = { id: 'p-ada', name: 'Ada', color: '#f97316' };
const BOB = { id: 'p-bob', name: 'Bob', color: '#22c55e' };

// A card type with a People field, a Votes field, a Comments field and a plain text field.
const TASK = {
  id: 'task',
  label: 'Task',
  newTitle: 'New task',
  glyph: 'item',
  color: '#000',
  fields: ['title', 'status', 'assignee', 'reviewer', 'notes'],
  custom: [
    { id: 'reviewer', label: 'Reviewer', kind: 'person' },
    { id: 'upvotes', label: 'Upvotes', kind: 'votes' },
    { id: 'talk', label: 'Talk', kind: 'comments' },
    { id: 'notes', label: 'Notes', kind: 'text' },
  ],
} as unknown as ItemTypeDef;
const CATALOGUE = { version: 1, types: [TASK] } as unknown as ItemTypeCatalogue;

const card = (over: Partial<Item> = {}): Item => ({
  id: 'i1',
  type: 'task',
  key: 1,
  rank: 'a',
  fields: {
    title: 'Ship it',
    status: 'doing',
    assignee: ADA,
    votes: ['p-ada', 'p-bob'],
    comments: 'thread-1',
    reviewer: BOB,
    upvotes: ['p-bob'],
    talk: 'thread-2',
    notes: 'Before Friday',
    // A person in a field no type names still names someone.
    stray: [ADA, BOB],
    spent: {
      people: { 'p-ada': 30 },
      entries: [
        { by: 'p-ada', minutes: 30, at: 1 },
        { by: 'p-bob', minutes: 15, at: 2 },
        { by: 'p-ada', minutes: 5, at: 3 },
      ],
      running: [{ by: 'p-ada', since: 4 }],
    },
  } as unknown as Item['fields'],
  rev: 1,
  createdAt: 1,
  updatedAt: 2,
  createdBy: ADA,
  updatedBy: BOB,
  openComments: 3,
  ...over,
});

describe('a card', () => {
  it('keeps its content, and loses its people, votes, threads and comment count', () => {
    const out = redactItemForCommunity(card(), [TASK]);
    expect(out.fields).toEqual({
      title: 'Ship it',
      status: 'doing',
      notes: 'Before Friday',
      spent: {
        people: {},
        entries: [
          { by: 'p1', minutes: 30, at: 1 },
          { by: 'p2', minutes: 15, at: 2 },
          { by: 'p1', minutes: 5, at: 3 },
        ],
        running: [],
      },
    });
    expect(out.createdBy).toEqual(COMMUNITY_PERSON);
    expect(out.updatedBy).toEqual(COMMUNITY_PERSON);
    expect('openComments' in out).toBe(false);
    const wire = JSON.stringify(out);
    for (const name of ['Ada', 'Bob', 'p-ada', 'p-bob', 'thread-1', 'thread-2']) {
      expect(wire).not.toContain(name);
    }
  });

  it('reads an unknown type as the fallback, still dropping every built-in people field', () => {
    const out = redactItemForCommunity(card({ type: 'gone' }), []);
    expect(out.fields).not.toHaveProperty('assignee');
    expect(out.fields).not.toHaveProperty('votes');
    // A custom field of a type that no longer exists is not known to be people, unless it holds one.
    expect(out.fields).toHaveProperty('upvotes');
    expect(out.fields).not.toHaveProperty('reviewer');
  });

  it('never mutates the card it was handed', () => {
    const before = card();
    redactItemForCommunity(before, [TASK]);
    expect(before.fields.assignee).toEqual(ADA);
    expect(before.openComments).toBe(3);
  });

  it('redacts a list against the stored catalogue, or none', () => {
    expect(redactItemsForCommunity([card()], CATALOGUE)[0]!.fields).not.toHaveProperty('reviewer');
    expect(redactItemsForCommunity([card()], null)[0]!.fields).not.toHaveProperty('assignee');
  });
});

// docs/specs/030-forms/forms.md "What a response makes": a response card is what someone answered.
describe("a form's response card", () => {
  const response = (over: Partial<Item> = {}) =>
    card({
      fields: {
        title: 'Response from Jo',
        status: 'new',
        fromForm: { formId: 'f1', responseId: 'r1' },
        email: 'jo@example.com',
        answer: 'Yes please',
      } as unknown as Item['fields'],
      ...over,
    });

  it('keeps its title and column, and nothing it answered', () => {
    const out = redactItemForCommunity(response(), [TASK]);
    expect(out.fields).toEqual({ title: 'Response from Jo', status: 'new' });
  });

  it('is known by the form it came from, or by the form as its maker', () => {
    expect(isResponseCard(response())).toBe(true);
    const made = card({
      fields: { title: 'T', answer: 'x' } as unknown as Item['fields'],
      createdBy: { id: 'form:f1', name: 'Form', color: '#000' },
    });
    expect(isResponseCard(made)).toBe(true);
    expect(redactItemForCommunity(made, [TASK]).fields).toEqual({ title: 'T' });
    expect(isResponseCard(card())).toBe(false);
    expect(isResponseCard({ fields: {}, createdBy: undefined as never })).toBe(false);
  });
});

describe('a stored card row, for a copy', () => {
  const row = (over: Record<string, unknown> = {}) => ({
    id: 'i1',
    type: 'task',
    fields: JSON.stringify(card().fields),
    created_by: JSON.stringify(ADA),
    updated_by: JSON.stringify(BOB),
    rev: 4,
    ...over,
  });

  it('carries the same redaction as a read, its rows otherwise as they were', () => {
    const out = redactItemRowForCommunity(row(), [TASK]);
    expect(JSON.parse(String(out['fields']))).toEqual(redactItemForCommunity(card(), [TASK]).fields);
    expect(JSON.parse(String(out['created_by']))).toEqual(COMMUNITY_PERSON);
    expect(JSON.parse(String(out['updated_by']))).toEqual(COMMUNITY_PERSON);
    expect(out['rev']).toBe(4);
  });

  it('knows a response row by its maker, and carries a row whose fields do not parse with none', () => {
    const made = redactItemRowForCommunity(
      row({
        fields: JSON.stringify({ title: 'R', answer: 'x' }),
        created_by: JSON.stringify({ id: 'form:f1', name: 'Form', color: '#000' }),
      }),
      [TASK],
    );
    expect(JSON.parse(String(made['fields']))).toEqual({ title: 'R' });
    const broken = redactItemRowForCommunity(row({ fields: '{' }), [TASK]);
    expect(JSON.parse(String(broken['fields']))).toEqual({});
    // Fields that are not an object, and a row with none at all, carry nothing either.
    expect(JSON.parse(String(redactItemRowForCommunity(row({ fields: '[1]' }), [])['fields']))).toEqual(
      {},
    );
    const bare = redactItemRowForCommunity({ id: 'i2' }, []);
    expect(JSON.parse(String(bare['fields']))).toEqual({});
    expect(JSON.parse(String(bare['created_by']))).toEqual(COMMUNITY_PERSON);
  });
});

describe('a tab', () => {
  const tab = {
    id: 't1',
    name: 'Board',
    elements: [
      { id: 'e1', type: 'shape', shape: 'plan-board', addedBy: 'adder-key' },
      { id: 'e2', type: 'sticky', text: 'Idea' },
    ],
  };

  it("drops a Participant's adder key with every app's own redaction", () => {
    const out = redactPlanTabForCommunity(tab);
    expect(JSON.stringify(out)).not.toContain('adder-key');
    expect(out.elements).toHaveLength(2);
    expect(tab.elements[0]).toHaveProperty('addedBy');
  });

  it('passes a tab with no elements through', () => {
    expect(redactPlanTabForCommunity({ id: 't2' } as never)).toEqual({ id: 't2' });
  });

  it("redacts a stored body for a copy, and copies one that does not parse, or has no elements, as empty", () => {
    expect(redactPlanTabDataForCommunity(JSON.stringify(tab))).not.toContain('adder-key');
    expect(JSON.parse(redactPlanTabDataForCommunity('{'))).toEqual({ elements: [] });
    expect(JSON.parse(redactPlanTabDataForCommunity(JSON.stringify({ kind: 'form' })))).toEqual({
      kind: 'form',
      elements: [],
    });
  });
});

describe("a form's response sheet", () => {
  const sheet = (id: string): SheetJson =>
    ({
      id,
      tabId: 't1',
      title: 'Responses',
      layout: { rows: ['r0', 'r1', 'r2'], cols: ['c0'] },
      cells: [
        { r: 'r0', c: 'c0', i: 'Email' },
        { r: 'r1', c: 'c0', i: 'jo@example.com' },
        { r: 'r2', c: 'c0', i: 'al@example.com' },
      ],
      rev: 1,
      createdAt: 1,
      updatedAt: 1,
      updatedBy: ADA,
    }) as unknown as SheetJson;

  it("is found from a Form tab's form, its stored body, and nowhere else", () => {
    const ids = responseSheetIds([
      { form: { sheet: { sheetId: 's1' } } },
      { data: JSON.stringify({ form: { sheet: { sheetId: 's2' } } }) },
      { data: JSON.stringify({ elements: [] }) },
      { data: '{"form": ' },
      { data: JSON.stringify({ form: 'none' }) },
      { form: { board: { tabId: 't9' } } },
    ]);
    expect([...ids]).toEqual(['s1', 's2']);
  });

  it('keeps its heading row alone, and every other sheet whole, nobody named as its writer', () => {
    const responses = new Set(['s1']);
    const kept = redactSheetForCommunity(sheet('s1'), responses);
    expect(kept.cells).toEqual([{ r: 'r0', c: 'c0', i: 'Email' }]);
    expect(kept.updatedBy).toEqual(COMMUNITY_PERSON);
    const other = redactSheetForCommunity(sheet('s2'), responses);
    expect(other.cells).toHaveLength(3);
    expect(other.updatedBy).toEqual(COMMUNITY_PERSON);
  });

  it('carries only its heading row in a copy', () => {
    const sheets = [
      { id: 's1', layout: JSON.stringify({ rows: ['r0', 'r1'] }) },
      { id: 's2', layout: JSON.stringify({ rows: ['x0'] }) },
      { id: 's3', layout: '{' },
    ];
    const cells = [
      { sheet_id: 's1', row_id: 'r0', col_id: 'c0' },
      { sheet_id: 's1', row_id: 'r1', col_id: 'c0' },
      { sheet_id: 's2', row_id: 'x1', col_id: 'c0' },
      { sheet_id: 's3', row_id: 'r0', col_id: 'c0' },
    ];
    const out = redactSheetCellRowsForCommunity(cells, sheets, new Set(['s1', 's3']));
    expect(out).toEqual([
      { sheet_id: 's1', row_id: 'r0', col_id: 'c0' },
      { sheet_id: 's2', row_id: 'x1', col_id: 'c0' },
    ]);
    expect(redactSheetCellRowsForCommunity(cells, sheets, new Set())).toEqual(cells);
  });
});
