import { describe, expect, it } from 'vitest';
import { ApiError } from '@liveworkspace/api-client';
import { ITEM_TYPES, type Item, type ItemTypeDef } from '@liveplanner/items';
import { fakeApi } from '../testing/fake-api';
import { FIELD_HINT, FIELD_LIMITS, apiRefusalOf } from './api-refusal';
import { applyItemChanges } from './item-changes';
import { readPlanState } from './plan-state';

// docs/specs/026-plan/plan-agents.md "Errors that teach": a value refused for its length or count names the field as
// the card shows it and the limit (Work Tracker 944).

const D = 'doc1';
const by = { id: 'p', name: 'Priya', color: '#7c3aed' };
const IDEA: ItemTypeDef = {
  ...ITEM_TYPES[1],
  id: 'pitch',
  label: 'Pitch',
  fields: ['title', 'status', 'description', 'f-solution'],
  fieldLabels: { description: 'Problem' },
  custom: [{ id: 'f-solution', label: 'Solution', kind: 'longtext' }],
};
const OTHER: ItemTypeDef = {
  ...ITEM_TYPES[1],
  id: 'risk',
  label: 'Risk',
  custom: [{ id: 'f-impact', label: 'Impact', kind: 'text' }],
};
const card: Item = {
  id: 'aaa111',
  type: 'pitch',
  key: 1,
  rank: 'k',
  fields: { title: 'Idea', status: 'todo~x' },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: by,
  updatedBy: by,
};
const refused = (body: object) => new ApiError(400, JSON.stringify(body));
const tooLong = {
  error: 'field_value_invalid',
  field: 'f-solution',
  limit: { unit: 'characters', max: 10_000, given: 12_412 },
};

describe('a refused field value', () => {
  it('names the field and the limit from the api’s body', () => {
    expect(apiRefusalOf(refused(tooLong), () => 'Solution')).toEqual({
      code: 'field_value_invalid',
      message: 'The api refused it: Solution is 12,412 characters; the most is 10,000.',
    });
    // Without names, the field's id.
    expect(apiRefusalOf(refused(tooLong))!.message).toBe(
      'The api refused it: f-solution is 12,412 characters; the most is 10,000.',
    );
    const row = {
      error: 'field_value_invalid',
      field: 'f-ac',
      limit: { unit: 'characters', max: 200, given: 230, row: 3, entry: 'row' },
    };
    expect(apiRefusalOf(refused(row), () => 'Acceptance Criteria')!.message).toBe(
      'The api refused it: Acceptance Criteria row 3 is 230 characters; the most is 200 a row.',
    );
  });

  it('names the field when no limit was broken, then lists the fields and their limits', () => {
    const r = apiRefusalOf(refused({ error: 'field_value_invalid', field: 'due' }), () => 'Due');
    expect(r!.message).toBe(
      `The api refused the value of Due (field_value_invalid). ${FIELD_HINT}`,
    );
    expect(FIELD_HINT).toContain(FIELD_LIMITS);
    expect(apiRefusalOf(refused({ error: 'title_too_long' }))!.message).toContain(
      'The api refused a field value (title_too_long)',
    );
    expect(apiRefusalOf(refused({ error: 'fields_too_large' }))!.message).toContain('64 KB');
    // A plan past its fields budget says so in plain words, and what to do (items.md "Limits").
    const full = apiRefusalOf(new ApiError(413, JSON.stringify({ error: 'plan_full' })))!;
    expect(full.code).toBe('plan_full');
    expect(full.message).toContain(
      "the plan's cards together hold the most a plan can (16 MB of fields)",
    );
    expect(full.message).toContain('create_project');
    // A code it words itself still wins over the field it names.
    expect(apiRefusalOf(refused({ error: 'field_required', field: 'f-x' }))!.message).toContain(
      'required custom field',
    );
    // A body that is not JSON, or names neither, says no more than the code.
    expect(apiRefusalOf(new ApiError(400, 'nope'))!.message).toBe('The api refused it (http_400).');
    expect(apiRefusalOf(new ApiError(400, 'null'))!.message).toBe('The api refused it (http_400).');
    expect(
      apiRefusalOf(refused({ error: 'field_value_invalid', field: '', limit: { unit: 'x' } }))!
        .message,
    ).toContain('The api refused a field value');
  });

  it('states the limits change_items takes', () => {
    expect(FIELD_LIMITS).toBe(
      'A title holds up to 500 characters, the description and a Long Text field 10,000 (as plain text, once ' +
        'Markdown is read), a Text field 2,000, and a checklist 50 rows of up to 200 characters.',
    );
  });
});

describe('applyItemChanges', () => {
  it('words the api’s refusal of a Long Text with the field’s name', async () => {
    const api = fakeApi({
      [`/projects/${D}/items`]: { items: [card], rev: 1 },
      [`/projects/${D}/plan`]: {
        boards: [],
        statuses: [{ status: 'todo~x', name: 'To Do' }],
        types: [...ITEM_TYPES, IDEA, OTHER],
      },
      [`/projects/${D}/items/aaa111`]: () => Response.json(tooLong, { status: 400 }),
    });
    const r = await applyItemChanges(
      api,
      D,
      [{ op: 'set', item: '#1', fields: { Solution: 's'.repeat(12_412) } }],
      await readPlanState(api, D),
    );
    expect(r.refusal).toEqual({
      code: 'field_value_invalid',
      message: 'The api refused it: Solution is 12,412 characters; the most is 10,000.',
    });
  });
});
