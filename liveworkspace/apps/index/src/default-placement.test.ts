// Filing on create: a create with no place and an intent lands in the person's default folder for it.
import { describe, expect, it } from 'vitest';
import { body, call, makeItem, person, useHarness } from './test-support';

useHarness();

async function folder(auth: string, input: Record<string, unknown> = {}): Promise<string> {
  const res = await call('/folders', {
    method: 'POST',
    auth,
    body: { name: 'Folder', ...input },
  });
  return (await body<{ folder: { id: string } }>(res)).folder.id;
}

async function setDefault(auth: string, key: string, folderId: string) {
  const res = await call(`/placement-defaults/${encodeURIComponent(key)}`, {
    method: 'PUT',
    auth,
    body: { folderId },
  });
  expect(res.status).toBe(204);
}

describe('filing on create', () => {
  it('files a new item in the app’s default folder, and a template’s ahead of it', async () => {
    const ada = await person('user_a');
    const plans = await folder(ada.auth, { name: 'Plans' });
    const kanban = await folder(ada.auth, { name: 'Boards' });
    await setDefault(ada.auth, 'liveplanner', plans);
    await setDefault(ada.auth, 'liveplanner:template:kanban', kanban);

    expect((await makeItem(ada.auth, { intent: 'plan:board' })).folderId).toBe(plans);
    expect((await makeItem(ada.auth, { intent: 'plan:board:kanban' })).folderId).toBe(kanban);
    // Another app's defaults are its own.
    expect(
      (await makeItem(ada.auth, { app: 'livediagram', intent: 'diagram:empty' })).folderId,
    ).toBeNull();
  });

  it('files by the kind, then the template, then the mode, then the app', async () => {
    const ada = await person('user_a');
    const canvases = await folder(ada.auth, { name: 'Canvases' });
    const boards = await folder(ada.auth, { name: 'Whiteboards' });
    const storms = await folder(ada.auth, { name: 'Storms' });
    const retros = await folder(ada.auth, { name: 'Retros' });
    await setDefault(ada.auth, 'livediagram', canvases);
    await setDefault(ada.auth, 'livediagram:mode:draw', boards);
    await setDefault(ada.auth, 'livediagram:kind:event-storming', storms);
    await setDefault(ada.auth, 'livediagram:template:retrospective', retros);
    const filed = async (intent: string) =>
      (await makeItem(ada.auth, { app: 'livediagram', intent })).folderId;
    expect(await filed('draw:diagram')).toBe(boards);
    expect(await filed('diagram:diagram')).toBe(canvases);
    expect(await filed('draw:diagram:retrospective')).toBe(retros);
    expect(await filed('draw:event-storming:retrospective')).toBe(storms);
  });

  it('never overrides a place the create names, the root chosen on purpose included', async () => {
    const ada = await person('user_a', { teams: [{ id: 'team1' }] });
    const plans = await folder(ada.auth);
    const other = await folder(ada.auth);
    await setDefault(ada.auth, 'liveplanner', plans);

    expect((await makeItem(ada.auth, { intent: 'plan', folderId: null })).folderId).toBeNull();
    expect((await makeItem(ada.auth, { intent: 'plan', folderId: other })).folderId).toBe(other);
    const inTeam = await makeItem(ada.auth, { intent: 'plan', teamId: 'team1' });
    expect(inTeam.teamId).toBe('team1');
    expect(inTeam.folderId).toBeNull();
    // Without an intent (a sync, an API script) the defaults are not consulted.
    expect((await makeItem(ada.auth)).folderId).toBeNull();
  });

  it('files into a joined team’s folder, and skips it once the team is left', async () => {
    const member = await person('user_a', { teams: [{ id: 'team1' }] });
    const teamFolder = await folder(member.auth, { teamId: 'team1' });
    await setDefault(member.auth, 'liveplanner', teamFolder);

    const made = await makeItem(member.auth, { intent: 'plan' });
    expect(made.folderId).toBe(teamFolder);
    expect(made.teamId).toBe('team1');

    const left = await person('user_a');
    const after = await makeItem(left.auth, { intent: 'plan' });
    expect(after.folderId).toBeNull();
    expect(after.teamId).toBeNull();
  });

  it('falls back to the app’s default when the template’s folder is gone', async () => {
    const ada = await person('user_a');
    const plans = await folder(ada.auth);
    const boards = await folder(ada.auth);
    await setDefault(ada.auth, 'liveplanner', plans);
    await setDefault(ada.auth, 'liveplanner:template:kanban', boards);
    expect((await call(`/folders/${boards}`, { method: 'DELETE', auth: ada.auth })).status).toBe(
      204,
    );
    expect((await makeItem(ada.auth, { intent: 'plan:board:kanban' })).folderId).toBe(plans);
  });
});
