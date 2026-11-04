// The data export's side of the index (liveworkspace/docs/specs/003-accounts/data-export.md "Contracts > The index"): its
// key acting for a person, listing their personal items, or one team's, in every app, and nothing else.
import type { Item } from '@liveworkspace/index-client';
import { describe, expect, it } from 'vitest';
import { isExportCaller } from './auth';
import type { Env } from './env';
import { body, call, makeItem, person, useHarness } from './test-support';

useHarness({ INDEX_KEY_EXPORT: 'export-key' });

const asExport = (
  path: string,
  options: {
    method?: string;
    personId?: string;
    key?: string;
    teams?: string;
    body?: unknown;
  } = {},
) =>
  call(path, {
    method: options.method ?? 'GET',
    auth: options.key ?? 'export-key',
    headers: {
      'X-Index-App': 'export',
      'X-Index-Person': options.personId ?? 'user_a',
      ...(options.teams !== undefined ? { 'X-Index-Teams': options.teams } : {}),
    },
    ...(options.body !== undefined ? { body: options.body } : {}),
  });

const ids = async (res: Response) =>
  (await body<{ items: Item[] }>(res)).items.map((i) => i.title).sort();

describe('the data export acting for a person', () => {
  it('lists their personal items in every app, never a team’s or one shared with them', async () => {
    const ada = await person('user_a', { teams: [{ id: 'team_1' }] });
    const bo = await person('user_b');
    await makeItem(ada.auth, { title: 'Plan' });
    await makeItem(ada.auth, { app: 'livediagram', title: 'Sketch' });
    await makeItem(ada.auth, { teamId: 'team_1', title: 'Team plan' });
    await makeItem(bo.auth, { title: 'Bo’s' });

    expect(await ids(await asExport('/items'))).toEqual(['Plan', 'Sketch']);
    // The view and a team filter play no part.
    expect(await ids(await asExport('/items?view=shared&team=team_1'))).toEqual(['Plan', 'Sketch']);
    // An app filter still applies.
    expect(await ids(await asExport('/items?app=livediagram'))).toEqual(['Sketch']);
  });

  it('lists one team’s items when it names the team', async () => {
    const ada = await person('user_a', { teams: [{ id: 'team_1' }, { id: 'team_2' }] });
    await makeItem(ada.auth, { title: 'Plan' });
    await makeItem(ada.auth, { teamId: 'team_1', title: 'Team plan' });
    await makeItem(ada.auth, { teamId: 'team_2', title: 'Other team' });
    expect(await ids(await asExport('/items', { teams: 'team_1' }))).toEqual(['Team plan']);
  });

  it('reaches nothing but the list', async () => {
    const ada = await person('user_a');
    const plan = await makeItem(ada.auth, { title: 'Plan' });
    expect((await asExport(`/items/${plan.id}`)).status).toBe(404);
    expect((await asExport('/trash')).status).toBe(404);
    expect((await asExport('/folders')).status).toBe(404);
    expect(
      (await asExport('/items', { method: 'POST', body: { app: 'liveplanner' } })).status,
    ).toBe(404);
    expect((await asExport('/items?any=1')).status).toBe(400);
  });

  it('refuses a wrong key, two teams, a bad id, and a guest', async () => {
    expect((await asExport('/items', { key: 'nope' })).status).toBe(401);
    expect((await asExport('/items', { teams: 'team_1,team_2' })).status).toBe(401);
    expect((await asExport('/items', { teams: 'bad id' })).status).toBe(401);
    expect((await asExport('/items', { personId: 'a:b' })).status).toBe(401);
    expect((await asExport('/items', { personId: 'guest_1' })).status).toBe(403);
  });
});

describe('without its key set', () => {
  it('is refused', async () => {
    const request = new Request('https://index/api/index/items', {
      headers: { Authorization: 'Bearer export-key' },
    });
    expect(await isExportCaller(request, {} as Env)).toBe(false);
    expect(
      await isExportCaller(new Request('https://index/'), { INDEX_KEY_EXPORT: 'k' } as Env),
    ).toBe(false);
  });
});
