// A person's mirror outside its passes (liveworkspace/docs/drive.md "Connecting", "Tokens", "Folders liveworkspace
// can't see", "Open with", "Disconnecting"): consent, the account switch, disconnect, the Picker's token, adopting a
// folder, the marks, Check now, and what Open with does with a file.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DRIVE_ACCOUNT_SWITCH_TTL_MS, DRIVE_PICKER_TOKENS_PER_MINUTE } from '@liveworkspace/drive';
import {
  envelopeOf,
  GOOGLE_USER,
  harness,
  ORIGIN,
  PERSON,
  REDIRECT_URI,
  type Harness,
} from '../test-support';

let h: Harness;

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  h = harness();
});

afterEach(() => vi.restoreAllMocks());

async function connected() {
  expect(await h.connect()).toEqual({ outcome: 'connected' });
  await h.runDue();
}

describe('connecting', () => {
  it('stores the grant sealed, sets the index flag, opens a channel and schedules the first pass now', async () => {
    expect(await h.connect()).toEqual({ outcome: 'connected' });
    expect(h.index.mirrored.has(PERSON)).toBe(true);
    expect(h.google.channels.size).toBe(1);
    expect(h.alarm.at).toBe(h.clock.now());
    const sealed = h.store.connection()!.sealedRefresh;
    expect(sealed.startsWith('v1.')).toBe(true);
    expect(sealed).not.toContain('refresh');
  });

  it('refuses a consent without a refresh token when nothing is stored', async () => {
    h.google.omitRefreshToken = true;
    expect(await h.connect()).toEqual({ outcome: 'no_refresh_token' });
    expect(h.store.connection()).toBeNull();
  });

  it('answers google_failed for a code Google refuses', async () => {
    expect(await h.mirror.connect(PERSON, 'bogus', REDIRECT_URI)).toEqual({
      outcome: 'google_failed',
    });
  });
});

describe('another Google account', () => {
  beforeEach(connected);

  it('waits for a confirmation, then starts afresh for the new account and revokes the old grant', async () => {
    const answer = await h.connect('bob-google');
    expect(answer).toEqual({
      outcome: 'switch_pending',
      until: h.clock.now() + DRIVE_ACCOUNT_SWITCH_TTL_MS,
    });
    expect(h.mirror.connectionSummary(PERSON)).toMatchObject({
      pendingSwitchUntil: answer.outcome === 'switch_pending' ? answer.until : 0,
    });
    expect(h.store.connection()!.googleAccount).toBe(GOOGLE_USER);
    expect(await h.mirror.confirmSwitch(PERSON)).toBe(true);
    const connection = h.store.connection()!;
    expect(connection).toMatchObject({
      googleAccount: 'bob-google',
      rootId: null,
      pendingSealed: null,
    });
    expect(h.store.rows()).toEqual([]);
    expect(h.google.requests.some((r) => r.path === '/revoke')).toBe(true);
    await h.runDue();
    expect(h.google.appFiles('bob-google').some((f) => f.appProperties.lwRoot === ORIGIN)).toBe(
      true,
    );
  });

  it('drops the switch on cancel, keeping the connected account', async () => {
    await h.connect('bob-google');
    expect(await h.mirror.cancelSwitch(PERSON)).toBe(true);
    expect(h.store.connection()).toMatchObject({ googleAccount: GOOGLE_USER, pendingSealed: null });
    expect(await h.mirror.cancelSwitch(PERSON)).toBe(false);
  });

  it('refuses a switch confirmed too late', async () => {
    await h.connect('bob-google');
    h.clock.advance(DRIVE_ACCOUNT_SWITCH_TTL_MS + 1);
    expect(await h.mirror.confirmSwitch(PERSON)).toBe(false);
    expect(h.store.connection()).toMatchObject({ googleAccount: GOOGLE_USER, pendingSealed: null });
  });
});

describe('disconnecting', () => {
  it('revokes, closes the channel, forgets everything and clears the flag, leaving the files', async () => {
    h.index.addItem({ name: 'Flow' });
    await connected();
    const files = h.files().length;
    expect(await h.mirror.disconnect(PERSON)).toBe(true);
    expect(h.store.connection()).toBeNull();
    expect(h.store.rows()).toEqual([]);
    expect(h.alarm.at).toBeNull();
    expect(h.index.mirrored.has(PERSON)).toBe(false);
    expect(h.google.channels.size).toBe(0);
    expect(h.google.store.files.size).toBeGreaterThanOrEqual(files);
    expect(h.mirror.connectionSummary(PERSON)).toEqual({ connected: false });
    expect(await h.mirror.disconnect(PERSON)).toBe(false);
  });
});

describe('Check now', () => {
  it('runs a pass now, writing every changed item, unless one finished in the last 30 s', async () => {
    await connected();
    h.alarm.at = null;
    await h.mirror.check(PERSON);
    expect(h.alarm.at).toBeNull();
    h.clock.advance(31_000);
    await h.mirror.check(PERSON);
    expect(h.alarm.at).toBe(h.clock.now());
    expect(h.store.connection()!.flushNext).toBe(true);
  });

  it('refuses someone not connected', async () => {
    expect(await h.mirror.check(PERSON)).toEqual({ refused: 'not_connected' });
  });
});

describe('the Picker’s token', () => {
  it('mints an hour’s token, ten a minute', async () => {
    await connected();
    for (let i = 0; i < DRIVE_PICKER_TOKENS_PER_MINUTE; i++) {
      const answer = await h.mirror.pickerToken(PERSON);
      expect(answer).toMatchObject({
        accessToken: expect.any(String),
        expiresAt: h.clock.now() + 3600_000,
      });
    }
    expect(await h.mirror.pickerToken(PERSON)).toEqual({ refused: 'rate_limited' });
    h.clock.advance(60_000);
    expect(await h.mirror.pickerToken(PERSON)).toMatchObject({ accessToken: expect.any(String) });
  });
});

describe('marks', () => {
  it('says synced, waiting and failed from the rows alone, and nothing for someone not connected', async () => {
    expect(h.mirror.marks(PERSON)).toEqual({ marks: [] });
    const a = h.index.addItem({ name: 'A' });
    const folder = h.index.addFolder('F');
    await connected();
    expect(h.mirror.marks(PERSON).marks).toEqual(
      expect.arrayContaining([
        { id: a.id, kind: 'item', state: 'synced', notice: null },
        { id: folder.id, kind: 'folder', state: 'synced', notice: null },
      ]),
    );
    h.clock.advance(1000);
    h.index.edit(a.id, {});
    await h.pass();
    expect(h.mirror.marks(PERSON).marks.find((m) => m.id === a.id)!.state).toBe('waiting');
  });
});

describe('adopting a folder liveworkspace can’t see', () => {
  it('makes the matching folder under its nearest mirrored ancestor and moves the noticed item in', async () => {
    const work = h.index.addFolder('Work');
    const a = h.index.addItem({ name: 'Flow' });
    await connected();
    const unseen = h.google.userCreateFolder(GOOGLE_USER, 'Private', h.folderFileOf(work.id)!.id);
    h.google.userMove(h.fileOf(a.id)!.id, unseen);
    h.clock.advance(60_000);
    await h.pass();
    expect(h.mirror.marks(PERSON).marks.find((m) => m.id === a.id)!.notice).toBe('unseen_folder');
    h.google.grantAccess(GOOGLE_USER, unseen);
    expect(await h.mirror.adopt(PERSON, unseen, a.id)).toEqual({ ok: true });
    const made = [...h.index.folders.values()].find((f) => f.name === 'Private')!;
    expect(made.parentId).toBe(work.id);
    expect(h.index.items.get(a.id)!.folderId).toBe(made.id);
    expect(h.google.get(unseen)!.appProperties).toEqual({ lwFolderId: made.id, lwOrigin: ORIGIN });
    expect(h.mirror.marks(PERSON).marks.find((m) => m.id === a.id)!.notice).toBeNull();
    // Nothing moves on the next pass: Drive and liveworkspace agree.
    await h.pass();
    expect(h.fileOf(a.id)!.parents).toEqual([unseen]);
  });

  it('refuses a folder the grant doesn’t reach', async () => {
    await connected();
    const unseen = h.google.userCreateFolder(GOOGLE_USER, 'Private');
    expect(await h.mirror.adopt(PERSON, unseen, null)).toEqual({ refused: 'not_found' });
  });
});

describe('Open with', () => {
  let a: { id: string };

  beforeEach(async () => {
    a = h.index.addItem({ name: 'Flow' });
    await connected();
  });

  it('opens the item its file mirrors', async () => {
    expect(await h.mirror.open(PERSON, { fileId: h.fileOf(a.id)!.id })).toEqual({
      action: 'open',
      app: 'livediagram',
      itemId: a.id,
      url: `https://livediagram.test/item/${a.id}`,
    });
  });

  it('offers a copy of a mirrored file as an import, and imports it into its app', async () => {
    const copy = h.google.userCopy(h.fileOf(a.id)!.id, { visibleToApp: true });
    expect(await h.mirror.open(PERSON, { fileId: copy })).toEqual({
      action: 'import',
      app: 'livediagram',
      name: 'Copy of Flow',
      reason: 'copy',
    });
    const imported = await h.mirror.importFile(PERSON, { fileId: copy });
    expect(imported).toMatchObject({
      app: 'livediagram',
      url: expect.stringContaining('https://livediagram.test/'),
    });
    expect(h.doors.imports).toEqual([
      expect.objectContaining({ app: 'livediagram', owner: PERSON, name: 'Copy of Flow' }),
    ]);
  });

  it('offers a file from another environment, or shared by someone, as an import', async () => {
    const other = h.google.otherUserFile({
      owner: 'carol-google',
      name: 'Plan.liveplanner',
      mimeType: 'application/vnd.liveplanner+json',
      content: envelopeOf({ app: 'liveplanner', name: 'Plan' }, 1),
      appProperties: {
        lwItemId: 'theirs',
        lwApp: 'liveplanner',
        lwOrigin: 'https://elsewhere.test',
      },
      shareWith: GOOGLE_USER,
    });
    h.google.grantAccess(GOOGLE_USER, other);
    expect(await h.mirror.open(PERSON, { fileId: other })).toMatchObject({
      action: 'import',
      app: 'liveplanner',
      reason: 'other_environment',
    });
  });

  it('says not ours for another kind of file, and allow access for one it can’t reach', async () => {
    const pdf = h.google.otherUserFile({
      owner: GOOGLE_USER,
      name: 'notes.pdf',
      mimeType: 'application/pdf',
      content: '%PDF',
      appProperties: {},
    });
    expect(await h.mirror.open(PERSON, { fileId: pdf })).toEqual({ action: 'not_ours' });
    const hidden = h.google.userCreateFolder(GOOGLE_USER, 'Hidden');
    expect(await h.mirror.open(PERSON, { fileId: hidden })).toEqual({ action: 'allow_access' });
    expect(await h.mirror.open('user_other', { fileId: pdf })).toEqual({ action: 'allow_access' });
  });

  it('refuses to import a file that isn’t an app’s envelope', async () => {
    const junk = h.google.otherUserFile({
      owner: GOOGLE_USER,
      name: 'Junk.livediagram',
      mimeType: 'application/vnd.livediagram+json',
      content: '{"kind":"something.else"}',
      appProperties: {},
    });
    expect(await h.mirror.importFile(PERSON, { fileId: junk })).toEqual({
      refused: 'invalid_request',
    });
  });
});
