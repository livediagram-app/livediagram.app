import { describe, expect, it } from 'vitest';
import { DRIVE_WRITE_MIN_INTERVAL_MS } from './cadence';
import { driveCopyDiagramId } from './plan-inbound';
import { fileOf, makeEngine, OWNER, world } from './test-support';

// A copy made in Drive's own UI is a new diagram, as if Duplicate was pressed
// (docs/specs/022-drive-mirror/drive-mirror.md, "Copies made in Drive").

async function mirrored() {
  const w = world();
  const { engine, events, statuses } = makeEngine(w);
  w.ld.createFolderAs('f1', 'Work');
  w.ld.createDiagram('d1', 'Plan', 'f1');
  await engine.start();
  w.clock.tick(60_000);
  const original = () => fileOf(w.google, w.ld, 'diagram', 'd1')!;
  return { ...w, engine, events, statuses, original };
}

const madeFrom = (w: Awaited<ReturnType<typeof mirrored>>) =>
  [...w.ld.diagrams.values()].filter((d) => d.id !== 'd1');

describe('a copy of a live diagram', () => {
  it('becomes a new diagram duplicated from livediagram, in the same folder, named after the copy', async () => {
    const w = await mirrored();
    // An edit to the copy's contents in Drive is never imported.
    const copyId = w.google.userCopy(w.original().id, { content: '{"edited":"in drive"}' });
    await w.engine.syncNow();
    const made = madeFrom(w);
    expect(made).toHaveLength(1);
    expect(made[0]).toMatchObject({
      id: driveCopyDiagramId(copyId),
      name: 'Copy of Plan',
      folderId: 'f1',
      trashedAt: null,
    });
    expect(made[0]!.tabs).toHaveLength(w.ld.diagram('d1')!.tabs.length);
    expect(w.events).toContain('Applied:Copy');
  });

  it('re-tags the copy so it mirrors the new diagram, and rewrites its contents', async () => {
    const w = await mirrored();
    const copyId = w.google.userCopy(w.original().id);
    await w.engine.syncNow();
    const newId = driveCopyDiagramId(copyId);
    expect(w.google.get(copyId)!.appProperties.ldDiagramId).toBe(newId);
    expect(w.ld.item('diagram', newId)).toMatchObject({
      driveFileId: copyId,
      mirroredSavedAt: null,
    });
    // The original keeps its own file.
    expect(w.ld.item('diagram', 'd1')!.driveFileId).toBe(w.original().id);
    w.clock.tick(DRIVE_WRITE_MIN_INTERVAL_MS);
    await w.engine.syncNow();
    expect(w.google.get(copyId)!.content).toContain(newId);
    // Settled: another pass makes nothing more.
    await w.engine.syncNow();
    expect(madeFrom(w)).toHaveLength(1);
  });

  it('makes one diagram even when a pass stops between making it and re-tagging the copy', async () => {
    const w = await mirrored();
    const copyId = w.google.userCopy(w.original().id);
    w.google.fail({
      status: 503,
      reason: 'backendError',
      match: (r) => r.method === 'PATCH' && r.path.endsWith(copyId),
    });
    await w.engine.syncNow();
    expect(madeFrom(w)).toHaveLength(1);
    expect(w.google.get(copyId)!.appProperties.ldDiagramId).toBe('d1');
    await w.engine.syncNow();
    expect(madeFrom(w)).toHaveLength(1);
    expect(w.google.get(copyId)!.appProperties.ldDiagramId).toBe(driveCopyDiagramId(copyId));
  });

  it('lands in Unsorted with the notice when the copy sits in a folder livediagram cannot see', async () => {
    const w = await mirrored();
    const hidden = w.google.userCreateFolder(OWNER, 'Secret');
    const copyId = w.google.userCopy(w.original().id);
    w.google.userMove(copyId, hidden);
    await w.engine.syncNow();
    const newId = driveCopyDiagramId(copyId);
    expect(w.ld.diagram(newId)!.folderId).toBeNull();
    expect(w.ld.item('diagram', newId)).toMatchObject({
      notice: 'unseen_folder',
      noticeParentId: hidden,
    });
  });
});

describe('a copy whose original is not live', () => {
  it('imports the copy’s contents when the original is in the Trash', async () => {
    const w = await mirrored();
    const copyId = w.google.userCopy(w.original().id);
    await w.ld.port().trashDiagram('d1');
    await w.engine.syncNow();
    const made = w.ld.diagram(driveCopyDiagramId(copyId))!;
    expect(made).toMatchObject({ name: 'Copy of Plan', folderId: 'f1', trashedAt: null });
    expect(made.tabs.map((t) => t.name)).toEqual(['Tab 1']);
  });

  it('imports the copy’s contents when the original is gone', async () => {
    const w = await mirrored();
    const copyId = w.google.userCopy(w.original().id);
    await w.ld.port().trashDiagram('d1');
    w.ld.purge('d1');
    await w.engine.syncNow();
    expect(w.ld.diagram(driveCopyDiagramId(copyId))).toMatchObject({ name: 'Copy of Plan' });
  });

  it('lists an unreadable copy in the panel instead of making nothing silently', async () => {
    const w = await mirrored();
    const copyId = w.google.userCopy(w.original().id, { content: 'not a diagram' });
    await w.ld.port().trashDiagram('d1');
    w.ld.purge('d1');
    await w.engine.syncNow();
    expect(w.ld.diagram(driveCopyDiagramId(copyId))).toBeUndefined();
    expect(w.statuses.at(-1)!.skipped).toEqual([{ name: 'Copy of Plan', reason: 'unreadable' }]);
    expect(w.google.get(copyId)!.appProperties.ldDiagramId).toBe('d1');
  });
});

describe('copies livediagram cannot recognise', () => {
  it('does nothing for a copy without appProperties, one it is never shown, or one in the bin', async () => {
    const w = await mirrored();
    w.google.userCopy(w.original().id, { keepAppProperties: false });
    w.google.userCopy(w.original().id, { visibleToApp: false });
    const binned = w.google.userCopy(w.original().id);
    w.google.userTrash(binned);
    await w.engine.syncNow();
    expect(madeFrom(w)).toEqual([]);
    expect(w.statuses.at(-1)!.skipped).toEqual([]);
  });
});

describe('files someone else owns', () => {
  it('never takes a file shared with the user (opened with livediagram) as a copy', async () => {
    const w = await mirrored();
    const theirs = w.google.otherUserFile({
      owner: 'someone-else',
      name: 'Theirs.livediagram',
      mimeType: 'application/vnd.livediagram+json',
      content: w.original().content,
      appProperties: { ldDiagramId: 'not-yours', ldOrigin: 'livediagram.test' },
      shareWith: OWNER,
    });
    w.google.grantAccess(OWNER, theirs);
    await w.engine.syncNow();
    expect(madeFrom(w)).toEqual([]);
    expect(w.statuses.at(-1)).toMatchObject({ error: null, skipped: [] });
  });
});
