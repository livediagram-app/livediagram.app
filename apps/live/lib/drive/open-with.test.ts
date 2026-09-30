import { describe, expect, it } from 'vitest';
import { FakeGoogle } from '@livediagram/fake-google';
import { DRIVE_FILE_MIME } from '@livediagram/api-schema';
import { documentToEnvelopeText } from '../export-document-text';
import { createDriveRestClient } from './drive-rest-client';
import {
  importOpenWithCopy,
  OpenWithImportError,
  openWithTelemetryType,
  parseOpenState,
  resolveOpenWith,
} from './open-with';
import { Clock, FakeLivediagram, HOST, OWNER } from './test-support';

// "Open with" outcomes (docs/specs/022-drive-mirror/drive-mirror.md, "Open with").

function setup() {
  const clock = new Clock();
  const google = new FakeGoogle({ now: () => clock.now });
  const ld = new FakeLivediagram(clock);
  const drive = createDriveRestClient({
    fetch: google.fetch,
    getAccessToken: async () => google.issueAccessToken(OWNER),
  });
  const deps = { drive, port: ld.port(), host: HOST };
  const envelope = documentToEnvelopeText(
    {
      id: 'd1',
      name: 'Shared plan',
      presentation: JSON.stringify({ decks: [{ slides: [{ tabId: 't1', elementIds: [] }] }] }),
    },
    [{ id: 't1', name: 'Tab 1', elements: [], folder: 'Ideas' }],
    1,
  );
  const file = (
    props: Record<string, string>,
    over: { name?: string; mimeType?: string; content?: string; owner?: string } = {},
  ) => {
    const id = google.otherUserFile({
      owner: over.owner ?? 'someone',
      name: over.name ?? 'Shared plan.livediagram',
      mimeType: over.mimeType ?? DRIVE_FILE_MIME,
      content: over.content ?? envelope,
      appProperties: props,
      shareWith: OWNER,
    });
    return parseOpenState(`?state=${encodeURIComponent(google.openWithState(OWNER, id))}`)!;
  };
  return { google, ld, deps, file };
}

describe('parseOpenState', () => {
  it("reads Google's open state, resource key included", () => {
    const state = JSON.stringify({
      ids: ['abc_1'],
      resourceKeys: { abc_1: 'rk' },
      action: 'open',
      userId: 'u',
    });
    expect(parseOpenState(`?state=${encodeURIComponent(state)}`)).toEqual({
      fileId: 'abc_1',
      resourceKey: 'rk',
    });
  });

  it('refuses anything else', () => {
    expect(parseOpenState('')).toBeNull();
    expect(parseOpenState('?state=nope')).toBeNull();
    expect(
      parseOpenState(`?state=${encodeURIComponent('{"action":"create","folderId":"x"}')}`),
    ).toBeNull();
    expect(
      parseOpenState(`?state=${encodeURIComponent('{"action":"open","ids":["../x"]}')}`),
    ).toBeNull();
  });
});

describe('resolveOpenWith', () => {
  it('opens a document the user can open', async () => {
    const s = setup();
    s.ld.createDocument('d1', 'Shared plan');
    const outcome = await resolveOpenWith(s.deps, s.file({ ldDocumentId: 'd1', ldOrigin: HOST }));
    expect(outcome).toEqual({ kind: 'open', documentId: 'd1' });
    expect(openWithTelemetryType(outcome)).toBe('Opened');
  });

  it('offers Import a copy when the user cannot open it (shared in Drive only)', async () => {
    const s = setup();
    const outcome = await resolveOpenWith(s.deps, s.file({ ldDocumentId: 'd1', ldOrigin: HOST }));
    expect(outcome).toEqual({ kind: 'import', reason: 'no-access', name: 'Shared plan' });
    expect(openWithTelemetryType(outcome)).toBe('ImportOffered');
  });

  it('offers Import a copy only, for another deployment or no document id', async () => {
    const s = setup();
    s.ld.createDocument('d1', 'Mine');
    expect(
      await resolveOpenWith(s.deps, s.file({ ldDocumentId: 'd1', ldOrigin: 'other.host' })),
    ).toMatchObject({ kind: 'import', reason: 'foreign' });
    expect(await resolveOpenWith(s.deps, s.file({}))).toMatchObject({
      kind: 'import',
      reason: 'no-id',
    });
  });

  it('refuses a file that is not a livediagram file, or cannot be read', async () => {
    const s = setup();
    const notOurs = await resolveOpenWith(
      s.deps,
      s.file({}, { name: 'photo.png', mimeType: 'image/png' }),
    );
    expect(notOurs).toEqual({ kind: 'error', reason: 'not-livediagram' });
    expect(openWithTelemetryType(notOurs)).toBe('Error');
    expect(await resolveOpenWith(s.deps, { fileId: 'missing' })).toEqual({
      kind: 'error',
      reason: 'unreadable',
    });
  });
});

describe('importOpenWithCopy', () => {
  it('creates a new document with fresh tab ids, folders and the deck following', async () => {
    const s = setup();
    const id = await importOpenWithCopy(
      s.deps,
      s.file({ ldDocumentId: 'd1', ldOrigin: HOST }),
      'foreign',
    );
    const copy = s.ld.document(id)!;
    expect(copy.name).toBe('Shared plan');
    expect(copy.tabs).toHaveLength(1);
    expect(copy.tabs[0]!.id).not.toBe('t1');
    expect(copy.tabs[0]!.folder).toBe('Ideas');
    expect(JSON.parse(copy.presentation!).decks[0].slides[0].tabId).toBe(copy.tabs[0]!.id);
  });

  it('names an unreadable envelope', async () => {
    const s = setup();
    await expect(
      importOpenWithCopy(s.deps, s.file({}, { content: 'not json' }), 'foreign'),
    ).rejects.toBeInstanceOf(OpenWithImportError);
  });
});
