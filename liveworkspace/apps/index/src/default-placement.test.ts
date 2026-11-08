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
    const plans = await folder(ada.auth, { name: 'Plans' });
    const planning = await folder(ada.auth, { name: 'Planning' });
    const boards = await folder(ada.auth, { name: 'Boards' });
    const kanban = await folder(ada.auth, { name: 'Kanban' });
    await setDefault(ada.auth, 'liveplanner', plans);
    await setDefault(ada.auth, 'liveplanner:mode:plan', planning);
    await setDefault(ada.auth, 'liveplanner:kind:board', boards);
    await setDefault(ada.auth, 'liveplanner:template:kanban', kanban);
    const filed = async (intent: string) => (await makeItem(ada.auth, { intent })).folderId;
    expect(await filed('kanban')).toBe(kanban);
    expect(await filed('plan:sheet')).toBe(planning);
    expect(await filed('plan:sheet:kanban')).toBe(kanban);
    expect(await filed('plan:board:kanban')).toBe(boards);
  });

  // MODE_ONLY_PLACEMENT_APPS (one-explorer-contracts.md "Mode-only apps"): livediagram files by its mode alone, and
  // an older app, kind or template key (one an older client wrote) never wins.
  it('files a mode-only app by its mode alone', async () => {
    const ada = await person('user_a');
    const canvases = await folder(ada.auth, { name: 'Canvases' });
    const drawings = await folder(ada.auth, { name: 'Drawings' });
    const workshops = await folder(ada.auth, { name: 'Workshops' });
    const storms = await folder(ada.auth, { name: 'Storms' });
    await setDefault(ada.auth, 'livediagram', canvases);
    await setDefault(ada.auth, 'livediagram:mode:draw', drawings);
    await setDefault(ada.auth, 'livediagram:mode:workshop', workshops);
    await setDefault(ada.auth, 'livediagram:kind:event-storming', storms);
    await setDefault(ada.auth, 'livediagram:template:retrospective', storms);
    const filed = async (intent: string) =>
      (await makeItem(ada.auth, { app: 'livediagram', intent })).folderId;
    expect(await filed('draw:diagram')).toBe(drawings);
    expect(await filed('workshop:event-storming:retrospective')).toBe(workshops);
    expect(await filed('diagram:event-storming')).toBeNull();
    expect(await filed('retrospective')).toBeNull();
  });

  // RETIRED_PLACEMENT_KEYS (one-explorer-contracts.md "Retired default keys"): livehuddle's Workshop mode entry
  // and Retrospective family are read as its own key, after it, and never dropped.
  it('files by an app’s retired keys after its own key', async () => {
    const ada = await person('user_a');
    const retros = await folder(ada.auth, { name: 'Retros' });
    const sessions = await folder(ada.auth, { name: 'Sessions' });
    const spaces = await folder(ada.auth, { name: 'Spaces' });
    const filed = async () =>
      (await makeItem(ada.auth, { app: 'livehuddle', intent: 'workshop:diagram' })).folderId;
    await setDefault(ada.auth, 'livehuddle:template:retrospective', retros);
    expect(await filed()).toBe(retros);
    await setDefault(ada.auth, 'livehuddle:mode:workshop', sessions);
    expect(await filed()).toBe(sessions);
    await setDefault(ada.auth, 'livehuddle', spaces);
    expect(await filed()).toBe(spaces);
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
