// A person's Google Drive mirror (liveworkspace/docs/drive.md "The service"): everything its Durable Object answers,
// as a plain class over injected deps (context.ts), so the object (durable-object.ts) only wires the runtime in and
// the tests drive this directly. Each call names the person; the connection row remembers whose it is, and the alarm
// reads it from there.
//
// The object runs one alarm at a time, but a call can land while a pass waits on Google or the index. A disconnect
// or a confirmed account switch bumps `epoch`, and a pass begun before it stops at its next row write
// (Runtime.guard), so it never writes the old connection's rows back.

import {
  DRIVE_CHECK_MIN_GAP_MS,
  DRIVE_PASS_DEBOUNCE_MS,
  DRIVE_PICKER_TOKENS_PER_MINUTE,
  DRIVE_PROP_FOLDER_ID,
  DRIVE_PROP_ORIGIN,
  DRIVE_FOLDER_MIME,
  fileState,
  LOCAL_NAME_MAX,
  localFolderForParent,
  rowKey,
  stripDriveName,
  type DriveConnectionAnswer,
  type DriveErrorCode,
  type DriveMarksAnswer,
  type DriveOpenAnswer,
  type DrivePickerTokenAnswer,
} from '@liveworkspace/drive';
import { createDriveClient, DriveApiError } from '@liveworkspace/drive/server';
import { driveLog, driveWarn, errorKind } from '../log';
import { importCopy, resolveOpen, type ImportOutcome, type OpenTarget } from '../open';
import { connectionAnswer, marksAnswer } from './answers';
import { cancelSwitch, confirmSwitch, connect, disconnect, type ConnectOutcome } from './connect';
import { PassAborted, type MirrorDeps, type Runtime } from './context';
import { nextPassAt, runPass } from './pass';
import { PassState } from './pass-state';
import { NeedsReconnect, NotConnected, TokenSource } from './tokens';

export type Refusal = { refused: DriveErrorCode };

const MINUTE = 60_000;

export class Mirror {
  private readonly deps: MirrorDeps;
  private readonly tokens: TokenSource;
  private epoch = 0;

  constructor(deps: MirrorDeps) {
    this.deps = deps;
    this.tokens = new TokenSource(deps);
  }

  private runtime(personId: string): Runtime {
    const epoch = this.epoch;
    const tokens = this.tokens;
    return {
      deps: this.deps,
      personId,
      tokens,
      drive: createDriveClient(this.deps.google, (opts) => tokens.get(opts)),
      guard: () => {
        if (this.epoch !== epoch) throw new PassAborted();
      },
    };
  }

  // The connection, if it is this person's. A row naming someone else (never expected: objects are by account id)
  // is refused rather than acted on.
  private connection(personId: string) {
    const connection = this.deps.store.connection();
    if (connection && connection.personId !== personId) {
      driveWarn('person-mismatch', { person: personId });
      return null;
    }
    return connection;
  }

  isConnected(personId: string): boolean {
    return this.connection(personId) !== null;
  }

  async connect(personId: string, code: string, redirectUri: string): Promise<ConnectOutcome> {
    const existing = this.deps.store.connection();
    if (existing && existing.personId !== personId) return { outcome: 'google_failed' };
    return connect(this.runtime(personId), code, redirectUri);
  }

  connectionSummary(personId: string): DriveConnectionAnswer {
    if (!this.connection(personId)) return { connected: false };
    return connectionAnswer(this.deps.store, this.deps.environment, this.deps.now());
  }

  async confirmSwitch(personId: string): Promise<boolean> {
    if (!this.connection(personId)) return false;
    this.epoch += 1;
    return confirmSwitch(this.runtime(personId));
  }

  async cancelSwitch(personId: string): Promise<boolean> {
    if (!this.connection(personId)) return false;
    return cancelSwitch(this.runtime(personId));
  }

  async disconnect(personId: string): Promise<boolean> {
    if (!this.connection(personId)) return false;
    this.epoch += 1;
    return disconnect(this.runtime(personId));
  }

  /** Something changed (the index's signal, Google's push): a pass DRIVE_PASS_DEBOUNCE_MS from now, unless one is
   *  already due sooner. */
  async signal(personId: string): Promise<void> {
    const connection = this.connection(personId);
    if (!connection || connection.status === 'needs_reconnect') return;
    const at = this.deps.now() + DRIVE_PASS_DEBOUNCE_MS;
    const existing = await this.deps.scheduler.getAlarm();
    if (existing === null || existing > at) await this.deps.scheduler.setAlarm(at);
  }

  /** Cloud Sync opened: a pass now, writing every changed item, unless one is running or finished in the last 30 s. */
  async check(personId: string): Promise<DriveConnectionAnswer | Refusal> {
    const connection = this.connection(personId);
    if (!connection) return { refused: 'not_connected' };
    const now = this.deps.now();
    const recent =
      connection.lastPassAt !== null && now - connection.lastPassAt < DRIVE_CHECK_MIN_GAP_MS;
    if (connection.status !== 'needs_reconnect' && !connection.syncing && !recent) {
      this.deps.store.updateConnection({ flushNext: true });
      await this.deps.scheduler.setAlarm(now);
      driveLog('check', { person: personId });
    }
    return connectionAnswer(this.deps.store, this.deps.environment, now);
  }

  marks(personId: string): DriveMarksAnswer {
    return this.connection(personId) ? marksAnswer(this.deps.store) : { marks: [] };
  }

  /** An hour-long access token for the Picker, DRIVE_PICKER_TOKENS_PER_MINUTE a minute. */
  async pickerToken(personId: string): Promise<DrivePickerTokenAnswer | Refusal> {
    const connection = this.connection(personId);
    if (!connection) return { refused: 'not_connected' };
    if (connection.status === 'needs_reconnect') return { refused: 'needs_reconnect' };
    const now = this.deps.now();
    const fresh =
      connection.pickerWindowStart === null || now - connection.pickerWindowStart >= MINUTE;
    const count = fresh ? 0 : connection.pickerCount;
    if (count >= DRIVE_PICKER_TOKENS_PER_MINUTE) return { refused: 'rate_limited' };
    this.deps.store.updateConnection({
      pickerWindowStart: fresh ? now : connection.pickerWindowStart,
      pickerCount: count + 1,
    });
    try {
      return await this.tokens.mint();
    } catch (err) {
      return { refused: err instanceof NeedsReconnect ? 'needs_reconnect' : 'google_failed' };
    }
  }

  /** The person showed liveworkspace a folder it couldn't see (the Picker): a matching folder is made in the index
   *  under its nearest mirrored ancestor, the Drive folder tagged as its mirror, and the noticed item moved in. */
  async adopt(
    personId: string,
    folderId: string,
    itemId: string | null,
  ): Promise<{ ok: true } | Refusal> {
    const connection = this.connection(personId);
    if (!connection?.rootId) return { refused: 'not_connected' };
    const rt = this.runtime(personId);
    const { origin, newId } = this.deps;
    try {
      const index = this.deps.index.forPerson(personId);
      const state = PassState.build(rt, index, connection.rootId, await index.picture());
      const picked = await rt.drive.getFile(folderId);
      if (picked.mimeType !== DRIVE_FOLDER_MIME) return { refused: 'invalid_request' };
      const existing = state.snapshot.rowsByFile.get(picked.id);
      let localId = existing?.kind === 'folder' ? existing.id : null;
      if (!localId) {
        localId = newId();
        const name = stripDriveName(picked.name, LOCAL_NAME_MAX) ?? 'Folder';
        const parentId = localFolderForParent(state.snapshot, picked.parents[0] ?? null) ?? null;
        await index.createFolder(localId, name, parentId);
        state.snapshot.folders.set(localId, {
          id: localId,
          name,
          parentId,
          updatedAt: this.deps.now(),
        });
        const tagged = await rt.drive.updateFile(picked.id, {
          appProperties: { [DRIVE_PROP_FOLDER_ID]: localId, [DRIVE_PROP_ORIGIN]: origin },
        });
        state.record({
          kind: 'folder',
          id: localId,
          app: null,
          driveFileId: picked.id,
          ...fileState(tagged),
          localName: name,
          mirroredUpdatedAt: null,
          contentWrittenAt: null,
          notice: null,
          noticeParentId: null,
        });
      }
      const row = itemId
        ? (state.snapshot.rows.get(rowKey('item', itemId)) ??
          state.snapshot.rows.get(rowKey('folder', itemId)))
        : undefined;
      if (row && row.id !== localId) {
        if (row.kind === 'item') await index.moveItem(row.id, localId);
        else await index.moveFolder(row.id, localId);
        state.record({ ...row, notice: null, noticeParentId: null });
      }
      driveLog('adopt-folder', { person: personId, folder: localId, fileId: picked.id });
      await this.deps.scheduler.setAlarm(this.deps.now());
      return { ok: true };
    } catch (err) {
      if (err instanceof DriveApiError && err.isNotFound) return { refused: 'not_found' };
      if (err instanceof NeedsReconnect) return { refused: 'needs_reconnect' };
      driveWarn('adopt-failed', { person: personId, error: errorKind(err) });
      return { refused: 'google_failed' };
    }
  }

  async open(personId: string, target: OpenTarget): Promise<DriveOpenAnswer> {
    if (!this.connection(personId)) return { action: 'allow_access' };
    return resolveOpen(this.runtime(personId), target);
  }

  async importFile(personId: string, target: OpenTarget): Promise<ImportOutcome> {
    if (!this.connection(personId)) return { refused: 'not_connected' };
    try {
      return await importCopy(this.runtime(personId), target);
    } catch (err) {
      if (err instanceof NeedsReconnect || err instanceof NotConnected)
        return { refused: 'not_connected' };
      throw err;
    }
  }

  /** The alarm: a pass, then the next alarm. Never throws, so the runtime never retries a pass on its own. */
  async alarm(): Promise<void> {
    const connection = this.deps.store.connection();
    if (!connection) return;
    const rt = this.runtime(connection.personId);
    // A switch not answered in time: its grant is revoked and never used.
    if (connection.pendingSealed && (connection.pendingUntil ?? 0) < this.deps.now())
      await cancelSwitch(rt);
    let outcome;
    try {
      outcome = await runPass(rt);
    } catch (err) {
      driveWarn('alarm-failed', { person: connection.personId, error: errorKind(err) });
      outcome = { kind: 'failed' as const, retryAt: this.deps.now() + DRIVE_CHECK_MIN_GAP_MS };
    }
    const after = this.deps.store.connection();
    if (!after) return;
    const next = nextPassAt(after, outcome, this.deps.now());
    const existing = await this.deps.scheduler.getAlarm();
    if (next === null) {
      // Needs reconnecting: nothing runs until a new consent. (A pass stopped by an account switch leaves the
      // switch's own alarm alone.)
      if (after.status === 'needs_reconnect' && existing !== null)
        await this.deps.scheduler.deleteAlarm();
      return;
    }
    if (existing === null || existing > next) await this.deps.scheduler.setAlarm(next);
  }
}
