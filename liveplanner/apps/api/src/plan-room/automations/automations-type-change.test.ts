import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  defaultCatalogue,
  type AutomationRun,
  type Item,
  type ItemTypeDef,
} from '@liveplanner/items';
import { endRepeatWorld } from '../test-repeat-world';
import { automationWorld, type AutomationWorld } from './test-automation-world';

// A Change Card Type rule end to end (docs/specs/026-plan/item-types.md "Changing a card's type"; automations.md
// "Actions"): the Work Tracker's Progress Idea, an accepted Idea turned into a Work Item that shows its App, the
// Solution kept on the card, hidden; and a Viewer, who changes no card, can't set it off.
vi.mock('../../auth/accounts', async () => (await import('../test-accounts-mock')).accountsMock);

const IDEA: ItemTypeDef = {
  id: 'idea',
  label: 'Idea',
  newTitle: 'New idea',
  glyph: 'task',
  color: '#2563eb',
  fields: ['title', 'status', 'description', 'priority', 'f-apps', 'f-solution'],
  custom: [
    { id: 'f-apps', label: 'App', kind: 'multichoice', options: ['Editor', 'API', 'Help'] },
    { id: 'f-solution', label: 'Solution', kind: 'longtext' },
  ],
};
const WORK: ItemTypeDef = {
  id: 'work',
  label: 'Work Item',
  newTitle: 'New work item',
  glyph: 'task',
  color: '#16a34a',
  fields: ['title', 'status', 'description', 'priority', 'f-app'],
  custom: [{ id: 'f-app', label: 'App', kind: 'multichoice', options: ['Editor', 'API'] }],
};

let w: AutomationWorld;
beforeEach(async () => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'debug').mockImplementation(() => {});
  w = await automationWorld();
  const put = await w.send('PUT', '/api/projects/A/item-types', {
    itemTypes: { version: defaultCatalogue().version, types: [IDEA, WORK] },
  });
  expect(put.status).toBeLessThan(300);
  await w.rule({
    name: 'Progress Idea',
    trigger: { kind: 'card_moved', to: ['done'] },
    steps: [{ kind: 'set_type', type: 'work' }],
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  endRepeatWorld();
});

const room = () => w.plans.get('A')!.room;
const card = async (id: string): Promise<Item> => (await w.items('A')).find((i) => i.id === id)!;
const runs = async () =>
  (await (await w.call('GET', '/runs')).json<{ runs: AutomationRun[] }>()).runs;
const idea = async () => {
  const res = await w.send('POST', '/api/projects/A/items', {
    type: 'idea',
    fields: {
      title: 'Map fields on a type change',
      priority: 'high',
      'f-apps': ['Help', 'API'],
      'f-solution': 'Map by name',
    },
    place: { status: 'todo' },
  });
  expect(res.status).toBe(201);
  return (await res.json<{ item: Item }>()).item;
};

describe('Change Card Type maps custom fields', () => {
  it('turns an Idea into a Work Item that shows its App, the Solution kept hidden', async () => {
    const c = await idea();
    expect(
      (await w.send('POST', `/api/projects/A/items/${c.id}/move`, { status: 'done' })).status,
    ).toBe(200);
    await room().alarm();
    const after = await card(c.id);
    expect(after.type).toBe('work');
    // Help is no Work Item option, so only API is written; built-ins carry over as they are.
    expect(after.fields).toMatchObject({
      'f-app': ['API'],
      title: 'Map fields on a type change',
      priority: 'high',
      'f-apps': ['Help', 'API'],
      'f-solution': 'Map by name',
    });
    const [run] = await runs();
    expect(run).toMatchObject({ result: 'done', ruleName: 'Progress Idea' });
  });

  // Share roles (docs/instructions/gate-a-feature-by-share-role.md): a Viewer's move is refused, so no rule runs.
  it('never runs for a Viewer, whose move is refused', async () => {
    const c = await idea();
    const res = await w.as('viewer', 'POST', `/items/${c.id}/move`, { status: 'done' });
    expect(res.status).toBe(403);
    await room().alarm();
    const after = await card(c.id);
    expect(after.type).toBe('idea');
    expect(after.fields['f-app']).toBeUndefined();
    expect(await runs()).toEqual([]);
  });
});
