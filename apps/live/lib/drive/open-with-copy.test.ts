import { documentToEnvelopeText } from '@livediagram/document';
import { describe, expect, it, vi } from 'vitest';
import { DRIVE_FILE_MIME } from '@livediagram/api-schema';
import { DRIVE_WRITE_IDLE_MS, DRIVE_WRITE_MIN_INTERVAL_MS } from './cadence';
import { createDriveRestClient } from './drive-rest-client';
import {
  importOpenWithCopy,
  openWithTelemetryType,
  parseOpenState,
  resolveOpenWith,
  type OpenWithState,
} from './open-with';
import { fileOf, HOST, makeEngine, OWNER, world } from './test-support';

// "Open with" on a copy of a mirrored file (docs/specs/022-drive-mirror/drive-mirror.md,
// "Copies made in Drive"; blueprint "Open with"). The copy is made in Drive's own UI, so
// the app only sees it once the user opens it with livediagram.

const COPY_CONTENT = documentToEnvelopeText(
  { id: 'd1', name: 'Plan', presentation: null },
  [{ id: 'x1', name: 'Edited in the copy', elements: [] }],
  1,
);

async function mirrored(opts: { folder?: boolean } = {}) {
  const w = world();
  if (opts.folder) w.ld.createFolderAs('f1', 'Work');
  w.ld.createDocument('d1', 'Plan', opts.folder ? 'f1' : null);
  const { engine, statuses } = makeEngine(w);
  await engine.start();
  const drive = createDriveRestClient({
    fetch: w.google.fetch,
    getAccessToken: async () => w.google.issueAccessToken(OWNER),
  });
  const deps = { drive, port: w.ld.port(), host: HOST };
  const original = () => fileOf(w.google, w.ld, 'document', 'd1')!;
  const openWith = (fileId: string): OpenWithState =>
    parseOpenState(`?state=${encodeURIComponent(w.google.openWithState(OWNER, fileId))}`)!;
  const copy = () => w.google.userCopy(original().id, { content: COPY_CONTENT });
  return { ...w, engine, statuses, deps, original, openWith, copy };
}

const documentFiles = (w: Awaited<ReturnType<typeof mirrored>>) =>
  w.google.appFiles(OWNER).filter((f) => f.appProperties.ldDocumentId);

describe('Open with on a copy of a mirrored file', () => {
  it('offers Import as new document, never the original', async () => {
    const w = await mirrored();
    const outcome = await resolveOpenWith(w.deps, w.openWith(w.copy()));
    expect(outcome).toEqual({ kind: 'import', reason: 'copy', name: 'Copy of Plan' });
    expect(openWithTelemetryType(outcome)).toBe('ImportOffered');
  });

  it("imports the copy's contents as a new document, leaving the original untouched", async () => {
    const w = await mirrored();
    const copyId = w.copy();
    const originalBefore = { ...w.original(), appProperties: { ...w.original().appProperties } };
    const newId = await importOpenWithCopy(w.deps, w.openWith(copyId), 'copy');
    expect(newId).not.toBe('d1');
    const doc = w.ld.document(newId)!;
    expect(doc).toMatchObject({ name: 'Copy of Plan', folderId: null });
    expect(doc.tabs.map((t) => t.name)).toEqual(['Edited in the copy']);
    // The original: same document, same file, same tags.
    expect(w.ld.document('d1')!.tabs.map((t) => t.name)).toEqual(['Tab 1']);
    expect(w.ld.item('document', 'd1')!.driveFileId).toBe(originalBefore.id);
    expect(w.google.get(originalBefore.id)!.appProperties).toEqual(originalBefore.appProperties);
  });

  it('re-tags the copy to the new document and records it, so it mirrors that document', async () => {
    const w = await mirrored();
    const copyId = w.copy();
    const newId = await importOpenWithCopy(w.deps, w.openWith(copyId), 'copy');
    expect(w.google.get(copyId)!.appProperties).toEqual({ ldDocumentId: newId, ldOrigin: HOST });
    expect(w.ld.item('document', newId)).toMatchObject({
      driveFileId: copyId,
      ldName: 'Copy of Plan',
      mirroredSavedAt: null,
      notice: null,
    });
  });

  it('leaves both consistent through later passes: no second file, nothing re-tagged', async () => {
    const w = await mirrored();
    const copyId = w.copy();
    const originalId = w.original().id;
    const newId = await importOpenWithCopy(w.deps, w.openWith(copyId), 'copy');
    await w.engine.syncNow();
    // Past the quiet wait before a content write.
    w.clock.tick(DRIVE_WRITE_IDLE_MS + DRIVE_WRITE_MIN_INTERVAL_MS);
    await w.engine.syncNow();
    expect(
      documentFiles(w)
        .map((f) => [f.id, f.appProperties.ldDocumentId])
        .sort(),
    ).toEqual(
      [
        [originalId, 'd1'],
        [copyId, newId],
      ].sort(),
    );
    expect(w.ld.item('document', 'd1')!.driveFileId).toBe(originalId);
    expect(w.ld.item('document', newId)!.driveFileId).toBe(copyId);
    // Outbound wrote the new document into the copy.
    expect(JSON.parse(w.google.get(copyId)!.content).document.id).toBe(newId);
    expect(w.statuses.at(-1)).toMatchObject({ error: null, notices: [] });
    // The copy now opens its own document.
    expect(await resolveOpenWith(w.deps, w.openWith(copyId))).toEqual({
      kind: 'open',
      documentId: newId,
    });
  });

  it('still opens the original when the original is opened with livediagram', async () => {
    const w = await mirrored();
    w.copy();
    expect(await resolveOpenWith(w.deps, w.openWith(w.original().id))).toEqual({
      kind: 'open',
      documentId: 'd1',
    });
  });

  it('ignores an opened copy the change feed brings before any import', async () => {
    const w = await mirrored();
    const copyId = w.copy();
    w.openWith(copyId);
    w.google.userRename(copyId, 'Copy of Plan 2.livediagram');
    await w.engine.syncNow();
    expect(w.google.get(copyId)!.appProperties.ldDocumentId).toBe('d1');
    expect(w.ld.item('document', 'd1')!.driveFileId).toBe(w.original().id);
    expect(w.ld.document('d1')!.name).toBe('Plan');
    expect(documentFiles(w)).toHaveLength(2);
  });

  it('places the new document in the folder the copy sits in', async () => {
    const w = await mirrored({ folder: true });
    const newId = await importOpenWithCopy(w.deps, w.openWith(w.copy()), 'copy');
    expect(w.ld.document(newId)!.folderId).toBe('f1');
  });

  it('puts it at the root with the unseen-folder notice when its folder is one livediagram cannot see', async () => {
    const w = await mirrored();
    const copyId = w.copy();
    const hidden = w.google.userCreateFolder(OWNER, 'Private');
    w.google.userMove(copyId, hidden);
    const newId = await importOpenWithCopy(w.deps, w.openWith(copyId), 'copy');
    expect(w.ld.document(newId)!.folderId).toBeNull();
    expect(w.ld.item('document', newId)).toMatchObject({
      notice: 'unseen_folder',
      noticeParentId: hidden,
    });
    await w.engine.syncNow();
    expect(w.google.get(copyId)!.parents).toEqual([hidden]);
    expect(w.statuses.at(-1)!.notices).toEqual([
      expect.objectContaining({ kind: 'document', ldId: newId }),
    ]);
  });

  it('imports but never claims a copy someone else owns', async () => {
    const w = await mirrored();
    const theirs = w.google.otherUserFile({
      owner: 'someone-else',
      name: 'Their copy.livediagram',
      mimeType: DRIVE_FILE_MIME,
      content: COPY_CONTENT,
      appProperties: { ldDocumentId: 'd1', ldOrigin: HOST },
      shareWith: OWNER,
    });
    const state = w.openWith(theirs);
    expect(await resolveOpenWith(w.deps, state)).toMatchObject({ reason: 'copy' });
    const newId = await importOpenWithCopy(w.deps, state, 'copy');
    expect(w.ld.document(newId)).toBeDefined();
    expect(w.google.get(theirs)!.appProperties.ldDocumentId).toBe('d1');
    expect(w.ld.item('document', newId)).toBeUndefined();
  });

  it('still opens the new document when the claim fails, and says so in the log', async () => {
    const w = await mirrored();
    const copyId = w.copy();
    const state = w.openWith(copyId);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    w.google.fail({ status: 500, match: (r) => r.method === 'PATCH' && r.path.includes(copyId) });
    const newId = await importOpenWithCopy(w.deps, state, 'copy');
    expect(w.ld.document(newId)).toBeDefined();
    expect(w.ld.item('document', newId)).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      '[drive-mirror] open-with-claim-failed',
      expect.objectContaining({ status: 500 }),
    );
    warn.mockRestore();
  });
});
