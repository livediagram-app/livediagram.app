import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ITEM_TYPES, type Item, type ItemTypeDef } from '@liveplanner/items';
import { changeItemsShape, changeCardTypesShape } from '../mcp/plan-schema';
import { contextOf, DOC_A, fakeApi, library, tabsOfA } from '../testing/fake-api';
import { itemAdd } from '../verbs/item';
import { typeLs } from '../verbs/card-type';
import { changeCardTypes } from './card-types';
import { applyItemChanges } from './item-changes';
import { listedType } from './plan-listing';
import { readPlanState } from './plan-state';

// docs/specs/026-plan/plan-agents.md "Card templates": agents add, edit and remove a type's templates, start a card
// from one, and read them in list_items.
const by = { id: 'p', name: 'Priya', color: '#7c3aed' };
const SAM = { id: 'u-sam', name: 'Sam Reed', color: '#2563eb' };
const item = (key: number, id: string, fields: Item['fields'], type = 'task'): Item => ({
  id,
  type,
  key,
  rank: 'i',
  fields,
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: by,
  updatedBy: by,
});
const BUG: ItemTypeDef = {
  ...ITEM_TYPES[1],
  id: 'bug',
  label: 'Bug',
  newTitle: 'New bug',
  fields: ['title', 'status', 'description', 'checklist', 'labels', 'f-sev', 'f-owner'],
  custom: [
    { id: 'f-sev', label: 'Severity', kind: 'choice', options: ['S1', 'S2'], required: true },
    { id: 'f-owner', label: 'Owner', kind: 'person' },
  ],
  templates: [
    {
      id: 'tp-bug-report',
      name: 'Bug Report',
      fields: {
        title: 'Bug: ',
        description: 'Steps',
        descriptionRich: [{ text: 'Steps', bold: true }],
        labels: ['triage'],
        'f-sev': 'S2',
      },
    },
    { id: 'tp-blank', name: 'Blank', fields: { labels: ['x'] } },
  ],
};
const TASK: ItemTypeDef = {
  ...ITEM_TYPES[1],
  templates: [{ id: 'tp-chore', name: 'Chore', fields: { title: 'Chore' } }],
};
const TYPES = [TASK, BUG];
const PLAN = {
  boards: [
    {
      tabId: 't1',
      tabName: 'Board',
      elementId: 'b1',
      title: 'Sprint',
      kind: 'board',
      types: null,
      columns: [{ status: 'todo', name: 'To Do' }],
    },
  ],
  statuses: [{ status: 'todo', name: 'To Do' }],
  types: TYPES,
};
const ITEMS = [item(1, 'aaa111', { title: 'Old', assignee: SAM }, 'bug')];

function api() {
  const seen: { method: string; path: string; body: unknown }[] = [];
  const echo = async (request: Request) => {
    const text = await request.text();
    seen.push({
      method: request.method,
      path: new URL(request.url).pathname.replace(/^\/api/, ''),
      body: text ? JSON.parse(text) : undefined,
    });
    return Response.json({ item: item(2, 'bbb222', { title: 'New' }, 'bug'), rev: 2 });
  };
  const fake = fakeApi({
    ...library,
    ...tabsOfA,
    [`/projects/${DOC_A}/items`]: (r: Request) =>
      r.method === 'GET' ? Response.json({ items: ITEMS, rev: 1 }) : echo(r),
    [`/projects/${DOC_A}/plan`]: PLAN,
    [`/projects/${DOC_A}/item-types`]: echo,
  });
  return { ctx: contextOf(fake), seen };
}

type AddChange = Parameters<typeof applyItemChanges>[2][number];

async function add(change: Omit<Extract<AddChange, { op: 'add' }>, 'op'>) {
  const { ctx, seen } = api();
  const state = await readPlanState(ctx.api, DOC_A);
  const result = await applyItemChanges(ctx.api, DOC_A, [{ op: 'add', ...change }], state);
  const post = seen.find((s) => s.method === 'POST') as
    { body: { fields: Record<string, unknown> } } | undefined;
  return { result, fields: post?.body.fields };
}

describe('change_items: starting a card from a template', () => {
  it('takes the template’s values and title', async () => {
    const { result, fields } = await add({ type: 'Bug', template: 'bug report' });
    expect(result.refusal).toBeUndefined();
    expect(fields).toEqual({
      title: 'Bug: ',
      description: 'Steps',
      descriptionRich: [{ text: 'Steps', bold: true }],
      labels: ['triage'],
      'f-sev': 'S2',
    });
  });

  it('lets the change’s own title and fields win, a description dropping the template’s formatting', async () => {
    const { fields } = await add({
      title: 'Login crash',
      type: 'bug',
      template: 'tp-bug-report',
      fields: { description: 'Plain text', Severity: 's1' },
    });
    expect(fields).toEqual({
      title: 'Login crash',
      description: 'Plain text',
      labels: ['triage'],
      'f-sev': 'S1',
    });
  });

  it('gives the type’s new-card title when the template has none', async () => {
    const { fields } = await add({ type: 'bug', template: 'Blank', fields: { Severity: 'S1' } });
    expect(fields).toMatchObject({ title: 'New bug', labels: ['x'] });
  });

  it('counts the template’s values toward required fields', async () => {
    const { result } = await add({ type: 'bug', template: 'Blank' });
    expect(result.refusal?.code).toBe('field_required');
  });

  it('refuses an add with neither a title nor a template', async () => {
    const { result, fields } = await add({ type: 'bug' });
    expect(result.refusal).toEqual({
      code: 'value_invalid',
      message: 'A new card needs a title, or a template to take one from.',
    });
    expect(fields).toBeUndefined();
  });

  it('refuses an unknown template, listing the type’s', async () => {
    const { result } = await add({ title: 'x', type: 'bug', template: 'Release' });
    expect(result.refusal).toEqual({
      code: 'template_unknown',
      message: 'Bug has no template "Release". Templates: Bug Report, Blank.',
    });
  });

  it('names the type a template belongs to when the card is another type', async () => {
    const { result } = await add({ type: 'bug', template: 'Chore' });
    expect(result.refusal?.message).toBe(
      'Chore is a Task template, not a Bug one: give type "Task". Templates: Bug Report, Blank.',
    );
  });
});

describe('change_card_types: templates', () => {
  it('adds a template, a person named as the cards name them, and saves it with the type', async () => {
    const { ctx, seen } = api();
    const result = await changeCardTypes(ctx.api, DOC_A, [
      {
        op: 'set',
        type: 'Bug',
        addTemplates: [{ name: 'Mine', fields: { Owner: 'sam reed', description: '# Why' } }],
        removeTemplates: ['Blank'],
      },
    ]);
    expect(result.refusal).toBeUndefined();
    const put = seen.find((s) => s.method === 'PUT') as {
      body: { itemTypes: { types: ItemTypeDef[] } };
    };
    const bug = put.body.itemTypes.types.find((t) => t.id === 'bug')!;
    expect(bug.templates!.map((t) => t.name)).toEqual(['Bug Report', 'Mine']);
    expect(bug.templates![1]!.fields).toMatchObject({ 'f-owner': SAM, description: 'Why' });
    expect(result.types.find((t) => t.id === 'bug')!.templates).toEqual([
      {
        id: 'tp-bug-report',
        name: 'Bug Report',
        fields: ['title', 'description', 'labels', 'Severity'],
      },
      { id: 'tp-mine', name: 'Mine', fields: ['Owner', 'description'] },
    ]);
  });

  it('refuses an unknown template and saves nothing', async () => {
    const { ctx, seen } = api();
    const result = await changeCardTypes(ctx.api, DOC_A, [
      { op: 'set', type: 'Bug', editTemplates: [{ template: 'Nope', name: 'X' }] },
    ]);
    expect(result.refusal?.code).toBe('template_unknown');
    expect(seen.some((s) => s.method === 'PUT')).toBe(false);
  });
});

describe('the MCP and CLI doors', () => {
  const changes = z.object(changeItemsShape);
  it('takes template on an add, title then optional, and refuses it on a set', () => {
    expect(
      changes.safeParse({
        projectId: 'p',
        changes: [{ op: 'add', type: 'Bug', template: 'Bug Report' }],
      }).success,
    ).toBe(true);
    expect(
      changes.safeParse({
        projectId: 'p',
        changes: [{ op: 'set', item: '#1', template: 'Bug Report' }],
      }).success,
    ).toBe(false);
  });

  it('takes template changes on change_card_types', () => {
    const parsed = z.object(changeCardTypesShape).parse({
      projectId: 'p',
      changes: [
        { op: 'add', name: 'Incident', templates: [{ name: 'Outage', fields: { title: 'Down' } }] },
        {
          op: 'set',
          type: 'Bug',
          addTemplates: [{ name: 'A' }],
          editTemplates: [{ template: 'A', fields: { labels: 'x' }, clear: ['description'] }],
          removeTemplates: ['B'],
        },
      ],
    });
    expect(parsed.changes).toHaveLength(2);
  });

  it('lists a type without templates without the key', () => {
    expect(listedType(ITEM_TYPES[0]).templates).toBeUndefined();
  });

  it('item add --template starts a card from one, its title optional', async () => {
    const { ctx, seen } = api();
    await itemAdd.run!(
      ctx,
      itemAdd.input.parse({ project: DOC_A, type: 'bug', template: 'Bug Report' }),
    );
    expect(seen[0]).toMatchObject({
      method: 'POST',
      body: { type: 'bug', fields: { title: 'Bug: ', 'f-sev': 'S2' } },
    });
  });

  it('type ls ends a type’s line with its templates', async () => {
    const { ctx } = api();
    const out = await typeLs.run!(ctx, { project: DOC_A });
    const lines = typeLs.text!(out);
    expect(lines.find((l) => l.startsWith('bug'))).toMatch(/\| templates: Bug Report, Blank$/);
    expect(lines.find((l) => l.startsWith('task'))).toMatch(/\| templates: Chore$/);
  });
});
