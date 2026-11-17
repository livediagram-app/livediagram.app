import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultCatalogue, type ItemTypeDef } from '@liveplanner/items';
import { endRepeatWorld } from './test-repeat-world';
import { automationWorld, type AutomationWorld } from './automations/test-automation-world';

// Every door a card write comes through notes the pictures it took off (docs/specs/026-plan/items.md "Removed
// pictures"): the editor's and an agent's REST write (the MCP's and the CLI's door, through an API token), and a rule's
// Clear Field, end to end through the real worker and room. The triggers sit on the plan's own cards, so no door can
// skip them.
vi.mock('../auth/accounts', async () => (await import('./test-accounts-mock')).accountsMock);

const SHOT: ItemTypeDef = {
  id: 'task',
  label: 'Task',
  newTitle: 'New task',
  glyph: 'task',
  color: '#2563eb',
  fields: ['title', 'status', 'f-shot', 'f-shots'],
  custom: [
    { id: 'f-shot', label: 'Shot', kind: 'image' },
    { id: 'f-shots', label: 'Shots', kind: 'image', multiple: true } as never,
  ],
};

let w: AutomationWorld;
beforeEach(async () => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'debug').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  w = await automationWorld();
  const put = await w.send('PUT', '/api/projects/A/item-types', {
    itemTypes: { version: defaultCatalogue().version, types: [SHOT] },
  });
  expect(put.status).toBeLessThan(300);
  for (const id of ['img-1', 'img-2', 'img-3']) await w.plans.get('A')!.room.grantImage('A', id);
});
afterEach(() => {
  vi.restoreAllMocks();
  endRepeatWorld();
});

const noted = () =>
  w.plans
    .get('A')!
    .db.prepare('SELECT image_id FROM image_releases ORDER BY image_id')
    .all()
    .map((r) => r['image_id']);

describe('a picture taken off a card', () => {
  it('is noted for an editor’s clear and an agent’s, through the REST door', async () => {
    const a = await w.make('A', { title: 'Mine', 'f-shot': 'img-1' });
    const b = await w.make('A', { title: 'Agent', 'f-shot': 'img-2' });
    expect(noted()).toEqual([]);
    const mine = await w.as('owner', 'POST', `/items/${a.id}`, { clear: ['f-shot'] });
    expect(mine.status).toBe(200);
    const agent = await w.as('token', 'POST', `/items/${b.id}`, { clear: ['f-shot'] });
    expect(agent.status).toBe(200);
    expect(noted()).toEqual(['img-1', 'img-2']);
  });

  it('is noted for one picture taken out of a Several Images list', async () => {
    const c = await w.make('A', { title: 'Gallery', 'f-shots': ['img-1', 'img-3'] });
    const res = await w.as('owner', 'POST', `/items/${c.id}`, { set: { 'f-shots': ['img-3'] } });
    expect(res.status).toBe(200);
    expect(noted()).toEqual(['img-1']);
  });

  it('is noted for a rule’s Clear Field', async () => {
    await w.rule({ steps: [{ kind: 'clear_field', field: 'f-shot' }] });
    const c = await w.make('A', { title: 'Ruled', 'f-shot': 'img-3' });
    await w.send('POST', `/api/projects/A/items/${c.id}/move`, { status: 'done' });
    await w.plans.get('A')!.room.alarm();
    expect(noted()).toEqual(['img-3']);
  });
});
