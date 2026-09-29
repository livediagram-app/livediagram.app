// The Drive mirror's sync engine (docs/specs/022-drive-mirror/drive-mirror.md;
// blueprint "Passes"). It runs in one tab per browser, only while that tab is
// open: arrival catch-up, a poll while visible, idle writes after edits, a
// flush on hide. Inbound before outbound, one pass at a time.

import {
  DRIVE_LEASE_RENEW_BEFORE_MS,
  DRIVE_PROP_ORIGIN,
  DRIVE_PROP_ROOT,
  driveRootName,
  type DriveConnection,
  type DriveItemKind,
} from '@livediagram/api-schema';
import { stripDriveName } from '@livediagram/api-schema';
import { Backoff } from './backoff';
import {
  DRIVE_FOCUS_POLL_MIN_GAP_MS,
  DRIVE_PAGE_TOKEN_PERSIST_MIN_INTERVAL_MS,
  DRIVE_WRITE_IDLE_MS,
} from './cadence';
import { DriveApiError, type DriveChange, type DriveClient } from './drive-client';
import { applyInbound, folderAppProperties } from './engine-inbound';
import { runOutbound } from './engine-outbound';
import type { LivediagramPort } from './livediagram-port';
import { driveLog, driveWarn } from './log';
import { PassContext } from './pass-context';
import { planOutbound } from './plan-outbound';
import { LD_NAME_MAX, planAdoption } from './plan-inbound';
import { buildSnapshot, itemKey, ldFolderForParent, type MirrorSnapshot } from './snapshot';
import type { Rasteriser } from './thumbnail';
import { seenRowsOf, type SeenStore } from './tombstones';
import { DriveTokenError, type TokenSource } from './token-source';

export type PassKind = 'arrival' | 'poll' | 'focus' | 'write' | 'flush' | 'manual';

export type DriveMirrorState =
  'starting' | 'idle' | 'syncing' | 'disconnected' | 'needs_reconnect' | 'needs_resume';

export type DriveMirrorNotice = {
  kind: DriveItemKind;
  ldId: string;
  name: string;
  parentId: string | null;
};

export type DriveMirrorStatus = {
  state: DriveMirrorState;
  lastSyncedAt: number | null;
  progress: { done: number; total: number } | null;
  error: 'offline' | 'rate_limited' | 'failed' | null;
  leaseHeldElsewhere: boolean;
  notices: DriveMirrorNotice[];
  // The root folder's Drive name, as the user sees it; null until known.
  rootName: string | null;
};

export type DriveEngineTelemetry = (
  action: 'Applied' | 'FirstMirrorFinished' | 'ReconnectNeeded',
  type?: string,
) => void;

export type Timers = {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
};

export type DriveEngineDeps = {
  ownerId: string;
  host: string;
  deviceId: string;
  port: LivediagramPort;
  drive: DriveClient;
  tokens: TokenSource;
  rasterise: Rasteriser;
  seen: SeenStore;
  now: () => number;
  timers: Timers;
  track: DriveEngineTelemetry;
  // Whether the first mirror was already reported for this connection.
  firstMirror: { done(connectedAt: number): boolean; mark(connectedAt: number): void };
  isVisible: () => boolean;
  onStatus: (status: DriveMirrorStatus) => void;
  // After a pass applied a change from Drive: open views re-read
  // (docs/specs/022-drive-mirror/drive-mirror.md, "Other views follow").
  onInboundApplied?: () => void;
  // The E-A3 diagnostic: log each gated check (`drive: start-token ...`).
  diagnostics?: () => boolean;
};

const INITIAL: DriveMirrorStatus = {
  state: 'starting',
  lastSyncedAt: null,
  progress: null,
  error: null,
  leaseHeldElsewhere: false,
  notices: [],
  rootName: null,
};

export class DriveMirrorEngine {
  private readonly deps: DriveEngineDeps;
  private status: DriveMirrorStatus = INITIAL;
  private running: Promise<void> | null = null;
  private rerun: PassKind | null = null;
  private stopped = false;
  private readonly backoff = new Backoff();
  private readonly lastContentWrite = new Map<string, number>();
  private pageToken: string | null = null;
  private pageTokenPersisted: string | null = null;
  private pageTokenSavedAt = 0;
  private lastInboundAt = 0;
  private leaseExpiresAt = 0;
  private pollTimer: unknown = null;
  private writeTimer: unknown = null;
  private writeTimerAt = 0;
  // Set while the engine makes its own api writes, so their write signals
  // do not schedule another pass.
  applying = false;

  constructor(deps: DriveEngineDeps) {
    this.deps = deps;
  }

  get current(): DriveMirrorStatus {
    return this.status;
  }

  private publish(patch: Partial<DriveMirrorStatus>): void {
    this.status = { ...this.status, ...patch };
    this.deps.onStatus(this.status);
  }

  // ---- triggers --------------------------------------------------------------

  start(): Promise<void> {
    driveLog('elected', { device: this.deps.deviceId });
    return this.pass('arrival');
  }

  stop(): void {
    this.stopped = true;
    this.clearTimer('poll');
    this.clearTimer('write');
  }

  // An api write happened (here or in another tab of this browser).
  noteWrite(): void {
    if (this.applying || this.stopped) return;
    this.scheduleWrite(this.deps.now() + DRIVE_WRITE_IDLE_MS);
  }

  // A check another tab asked for (docs/specs/022-drive-mirror/drive-mirror.md, "A visible
  // tab is never left unsynced"): the user returned to it (`focus`), opened
  // Cloud Sync (`view`), or it keeps the 2-minute rhythm while visible (`poll`).
  // Gated like this tab's own checks, so asking often costs nothing.
  requestCheck(kind: 'focus' | 'view' | 'poll'): Promise<void> {
    const gap =
      kind === 'poll' ? this.backoff.pollIntervalMs(this.deps.now()) : DRIVE_FOCUS_POLL_MIN_GAP_MS;
    if (this.deps.now() - this.lastInboundAt < gap) return Promise.resolve();
    return this.pass(kind === 'poll' ? 'poll' : 'focus');
  }

  onVisible(): Promise<void> {
    if (this.deps.now() - this.lastInboundAt >= DRIVE_FOCUS_POLL_MIN_GAP_MS)
      return this.pass('focus');
    this.schedulePoll();
    return Promise.resolve();
  }

  async onHidden(): Promise<void> {
    this.clearTimer('poll');
    await this.pass('flush');
  }

  flush(): Promise<void> {
    return this.pass('flush');
  }

  syncNow(): Promise<void> {
    return this.pass('manual');
  }

  // One pass at a time. A trigger during a pass queues one more pass after
  // it (flush outranks the rest), and resolves when that later pass is done,
  // so a caller always waits for a pass that saw its change.
  pass(kind: PassKind): Promise<void> {
    if (this.stopped) return Promise.resolve();
    if (!this.running) {
      this.running = this.runPass(kind).finally(() => this.afterPass());
      return this.running;
    }
    if (this.rerun !== 'flush') this.rerun = kind === 'write' && this.rerun ? this.rerun : kind;
    this.queued ??= new Promise<void>((resolve) => this.queuedWaiters.push(resolve));
    return this.queued;
  }

  private queued: Promise<void> | null = null;
  private queuedWaiters: (() => void)[] = [];

  private afterPass(): void {
    this.running = null;
    const again = this.rerun;
    const waiters = this.queuedWaiters;
    this.rerun = null;
    this.queued = null;
    this.queuedWaiters = [];
    if (!again || this.stopped) {
      for (const w of waiters) w();
      return;
    }
    void this.pass(again).then(() => {
      for (const w of waiters) w();
    });
  }

  private clearTimer(which: 'poll' | 'write'): void {
    const handle = which === 'poll' ? this.pollTimer : this.writeTimer;
    if (handle !== null) this.deps.timers.clearTimeout(handle);
    if (which === 'poll') this.pollTimer = null;
    else this.writeTimer = null;
  }

  private schedulePoll(): void {
    this.clearTimer('poll');
    if (this.stopped || !this.deps.isVisible()) return;
    const delay = this.backoff.pollIntervalMs(this.deps.now());
    this.pollTimer = this.deps.timers.setTimeout(() => {
      this.pollTimer = null;
      void this.pass('poll');
    }, delay);
  }

  private scheduleWrite(at: number): void {
    if (this.writeTimer !== null && this.writeTimerAt >= at) return;
    this.clearTimer('write');
    this.writeTimerAt = at;
    this.writeTimer = this.deps.timers.setTimeout(
      () => {
        this.writeTimer = null;
        void this.pass('write');
      },
      Math.max(0, at - this.deps.now()),
    );
  }

  // ---- one pass --------------------------------------------------------------

  private async runPass(kind: PassKind): Promise<void> {
    const { deps } = this;
    driveLog('pass-start', { kind });
    try {
      await deps.tokens.get();
    } catch (err) {
      this.onTokenError(err);
      return;
    }
    this.publish({ state: 'syncing' });
    this.applying = true;
    try {
      let connection = await deps.port.getConnection();
      if (!connection) {
        this.publish({ state: 'disconnected' });
        return;
      }
      if (connection.status === 'needs_reconnect') {
        this.publish({ state: 'needs_reconnect' });
        return;
      }
      if (this.pageToken === null) {
        this.pageToken = connection.pageToken;
        this.pageTokenPersisted = connection.pageToken;
        this.pageTokenSavedAt = connection.pageTokenSavedAt ?? 0;
      }
      const root = await this.ensureRoot(connection, kind);
      connection = root.connection;
      let snapshot = await this.loadSnapshot(connection.rootFolderId!);
      if (root.fresh) {
        await this.adoptExisting(snapshot);
        snapshot = await this.loadSnapshot(connection.rootFolderId!);
      }

      let applied = false;
      if (kind !== 'write' && kind !== 'flush') {
        applied = await this.inbound(snapshot);
        if (applied) snapshot = await this.loadSnapshot(connection.rootFolderId!);
      }
      await this.outbound(snapshot, kind);
      if (applied) deps.onInboundApplied?.();
      await this.persistPageToken(kind);
      deps.seen.write(deps.ownerId, seenRowsOf(snapshot.items.values()));
      this.maybeReportFirstMirror(snapshot, connection);
      this.publish({
        state: 'idle',
        lastSyncedAt: deps.now(),
        error: null,
        progress: null,
        notices: this.noticesOf(snapshot),
      });
      driveLog('pass-end', { kind });
    } catch (err) {
      this.onPassError(err, kind);
    } finally {
      this.applying = false;
      // Disconnected or awaiting a reconnect: nothing to poll until a trigger.
      if (kind !== 'flush' && this.status.state === 'idle') this.schedulePoll();
    }
  }

  private onTokenError(err: unknown): void {
    if (err instanceof DriveTokenError) {
      driveWarn('token', { kind: err.kind });
      if (err.kind === 'needs_reconnect') {
        if (this.status.state !== 'needs_reconnect') this.deps.track('ReconnectNeeded');
        this.publish({ state: 'needs_reconnect' });
      } else if (err.kind === 'needs_resume') this.publish({ state: 'needs_resume' });
      else if (err.kind === 'not_connected') this.publish({ state: 'disconnected' });
      else if (err.kind === 'rate_limited') {
        this.backoff.hit(this.deps.now());
        this.publish({ state: 'idle', error: 'rate_limited', progress: null });
        this.schedulePoll();
      } else this.publish({ state: 'idle', error: 'failed' });
      return;
    }
    this.onPassError(err, 'token');
  }

  private onPassError(err: unknown, kind: string): void {
    if (err instanceof DriveTokenError) {
      this.onTokenError(err);
      return;
    }
    if (err instanceof DriveApiError && err.isRateLimit) {
      this.backoff.hit(this.deps.now());
      driveWarn('backoff', { kind, status: err.status, reason: err.reason });
      this.publish({ state: 'idle', error: 'rate_limited', progress: null });
      return;
    }
    const offline = err instanceof TypeError;
    driveWarn('error', { kind, error: err instanceof Error ? err.message : String(err) });
    this.publish({ state: 'idle', error: offline ? 'offline' : 'failed', progress: null });
  }

  // The `livediagram` folder, by id. Found again by its `ldRoot` after a
  // reconnect; made in My Drive otherwise. The first page token is taken
  // before anything is written, so every later write reads back as an echo.
  private async ensureRoot(
    connection: DriveConnection,
    kind: PassKind,
  ): Promise<{ connection: DriveConnection; fresh: boolean }> {
    const { deps } = this;
    if (connection.rootFolderId && kind === 'arrival') {
      // Once per arrival: a root deleted for good is made again. A binned
      // root stays the root; binning it binned everything, as the user did.
      try {
        const root = await deps.drive.getFile(connection.rootFolderId);
        this.publish({ rootName: root.name });
        return { connection, fresh: false };
      } catch (err) {
        if (!(err instanceof DriveApiError && err.isNotFound)) throw err;
        driveWarn('root-missing', { root: connection.rootFolderId });
      }
    } else if (connection.rootFolderId) {
      return { connection, fresh: false };
    }
    if (!this.pageToken) {
      this.pageToken = await deps.drive.getStartPageToken();
      await deps.port.putConnection({ pageToken: this.pageToken });
      this.pageTokenPersisted = this.pageToken;
      this.pageTokenSavedAt = deps.now();
    }
    const existing = await deps.drive.listFiles(
      `appProperties has { key='${DRIVE_PROP_ROOT}' and value='${deps.host}' } and trashed = false`,
    );
    let rootId = existing[0]?.id;
    if (rootId) {
      driveLog('root-found', { root: rootId });
      this.publish({ rootName: existing[0]!.name });
    } else {
      const name = driveRootName(deps.host);
      rootId = (
        await deps.drive.createFolder({
          name,
          parentId: 'root',
          appProperties: { [DRIVE_PROP_ROOT]: deps.host },
        })
      ).id;
      driveLog('root-created', { root: rootId });
      this.publish({ rootName: name });
    }
    return { connection: await deps.port.putConnection({ rootFolderId: rootId }), fresh: true };
  }

  // After a (re)connect: record a row for every file livediagram made earlier
  // whose diagram or folder still exists, instead of making a second copy.
  private async adoptExisting(snapshot: MirrorSnapshot): Promise<void> {
    const files = await this.deps.drive.listFiles(
      `appProperties has { key='${DRIVE_PROP_ORIGIN}' and value='${this.deps.host}' }`,
    );
    const ctx = this.context(snapshot);
    const { adopt, ambiguous } = planAdoption(files, snapshot);
    for (const item of adopt) await ctx.record(item);
    await ctx.flushItems();
    if (ambiguous.length > 0) driveWarn('adopt-ambiguous', { diagrams: ambiguous.length });
    driveLog('adopted', { files: files.length, adopted: adopt.length });
  }

  private async loadSnapshot(rootFolderId: string): Promise<MirrorSnapshot> {
    const { port } = this.deps;
    const [diagrams, folders, trash, items] = await Promise.all([
      port.listPersonalDiagrams(),
      port.listPersonalFolders(),
      port.listPersonalTrash(),
      port.listItems(),
    ]);
    return buildSnapshot({ host: this.deps.host, rootFolderId, diagrams, folders, trash, items });
  }

  private context(snapshot: MirrorSnapshot): PassContext {
    return new PassContext({
      snapshot,
      port: this.deps.port,
      drive: this.deps.drive,
      rasterise: this.deps.rasterise,
      track: (action, type) => this.deps.track(action, type),
      now: this.deps.now,
    });
  }

  private async inbound(snapshot: MirrorSnapshot): Promise<boolean> {
    const { drive } = this.deps;
    // The gate (docs/specs/022-drive-mirror/drive-mirror.md, "Cadence"): the start
    // token names the position after the latest change, so one equal to the
    // stored token means nothing new since; only then is changes.list skipped.
    const start = await drive.getStartPageToken();
    const moved = this.pageToken === null || start !== this.pageToken;
    if (!moved) {
      this.lastInboundAt = this.deps.now();
      this.diagnose(false, 0);
      return false;
    }
    let token = this.pageToken ?? start;
    const changes: DriveChange[] = [];
    for (;;) {
      let page;
      try {
        page = await drive.listChanges(token);
      } catch (err) {
        // A token Drive no longer takes: start again from now, and adopt what
        // the lost stretch may have made (D8).
        if (err instanceof DriveApiError && (err.status === 400 || err.status === 404)) {
          driveWarn('page-token-rejected', { status: err.status });
          this.pageToken = await drive.getStartPageToken();
          await this.adoptExisting(snapshot);
          return true;
        }
        throw err;
      }
      changes.push(...page.changes);
      if (page.nextPageToken) token = page.nextPageToken;
      else {
        token = page.newStartPageToken ?? token;
        break;
      }
    }
    this.lastInboundAt = this.deps.now();
    this.diagnose(true, changes.length);
    // The root is no item; a rename of it only changes the name shown.
    const root = changes.findLast((c) => c.fileId === snapshot.rootFolderId && c.file);
    if (root?.file && root.file.name !== this.status.rootName)
      this.publish({ rootName: root.file.name });
    const changed =
      changes.length > 0 ? await applyInbound(this.context(snapshot), changes) : false;
    this.pageToken = token;
    return changed;
  }

  // Settles research E-A3 against real Drive: does the start token move for
  // changes livediagram cannot see? Opt-in, one quiet line per check.
  private diagnose(moved: boolean, listed: number): void {
    if (this.deps.diagnostics?.())
      console.info(`drive: start-token moved=${moved} listed=${listed}`);
  }

  private async outbound(snapshot: MirrorSnapshot, kind: PassKind): Promise<void> {
    const { deps } = this;
    const now = deps.now();
    const plan = planOutbound(snapshot, {
      now,
      flush: kind === 'flush',
      writeIntervalMs: this.backoff.writeIntervalMs(now),
      lastContentWrite: (id) => this.lastContentWrite.get(id),
      seen: deps.seen.read(deps.ownerId),
    });
    if (plan.nextDueAt !== null) {
      driveLog('deferred', { dueInMs: plan.nextDueAt - now });
      this.scheduleWrite(plan.nextDueAt);
    }
    if (plan.ops.length === 0) return;
    if (!(await this.holdLease())) return;
    const creates = plan.ops.filter((o) => o.op === 'create-file').length;
    let done = 0;
    if (creates > 1) this.publish({ progress: { done, total: creates } });
    await runOutbound(this.context(snapshot), plan.ops, {
      onContentWritten: (id) => this.lastContentWrite.set(id, deps.now()),
      onCreated: () => {
        done += 1;
        if (creates > 1) this.publish({ progress: { done, total: creates } });
      },
    });
  }

  private async holdLease(): Promise<boolean> {
    const { deps } = this;
    if (this.leaseExpiresAt - deps.now() > DRIVE_LEASE_RENEW_BEFORE_MS) return true;
    const lease = await deps.port.acquireLease(deps.deviceId);
    if (!lease.acquired) {
      driveLog('lease-held-elsewhere', { expiresAt: lease.expiresAt });
      this.leaseExpiresAt = 0;
      this.publish({ leaseHeldElsewhere: true });
      return false;
    }
    this.leaseExpiresAt = lease.expiresAt ?? 0;
    if (this.status.leaseHeldElsewhere) this.publish({ leaseHeldElsewhere: false });
    return true;
  }

  // Hand the lease over when this tab stops writing (hidden, closed).
  async releaseLease(): Promise<void> {
    if (this.leaseExpiresAt <= this.deps.now()) return;
    this.leaseExpiresAt = 0;
    await this.deps.port.releaseLease(this.deps.deviceId);
  }

  private async persistPageToken(kind: PassKind): Promise<void> {
    const { deps } = this;
    if (!this.pageToken || this.pageToken === this.pageTokenPersisted) return;
    const due = deps.now() - this.pageTokenSavedAt >= DRIVE_PAGE_TOKEN_PERSIST_MIN_INTERVAL_MS;
    if (!due && kind !== 'flush') return;
    await deps.port.putConnection({ pageToken: this.pageToken });
    this.pageTokenPersisted = this.pageToken;
    this.pageTokenSavedAt = deps.now();
  }

  private maybeReportFirstMirror(snapshot: MirrorSnapshot, connection: DriveConnection): void {
    const { deps } = this;
    if (deps.firstMirror.done(connection.connectedAt)) return;
    for (const d of snapshot.diagrams.values()) {
      if (snapshot.items.get(itemKey('diagram', d.id))?.mirroredSavedAt == null) return;
    }
    deps.firstMirror.mark(connection.connectedAt);
    deps.track('FirstMirrorFinished');
  }

  private noticesOf(snapshot: MirrorSnapshot): DriveMirrorNotice[] {
    const out: DriveMirrorNotice[] = [];
    for (const item of snapshot.items.values()) {
      if (item.notice !== 'unseen_folder') continue;
      const name =
        item.kind === 'diagram'
          ? snapshot.diagrams.get(item.ldId)?.name
          : snapshot.folders.get(item.ldId)?.name;
      if (name !== undefined)
        out.push({ kind: item.kind, ldId: item.ldId, name, parentId: item.noticeParentId });
    }
    return out;
  }

  // ---- adoption --------------------------------------------------------------

  // The user picked the folder livediagram could not see: make the matching
  // Personal Space folder under its nearest mirrored ancestor, and move the
  // noticed item into it (docs/specs/022-drive-mirror/drive-mirror.md, "Adopting a folder").
  async adoptFolder(kind: DriveItemKind, ldId: string, pickedFolderId: string): Promise<void> {
    const { deps } = this;
    await deps.tokens.get();
    this.applying = true;
    try {
      const connection = await deps.port.getConnection();
      if (!connection?.rootFolderId) return;
      const snapshot = await this.loadSnapshot(connection.rootFolderId);
      const ctx = this.context(snapshot);
      const picked = await deps.drive.getFile(pickedFolderId);
      const existing = snapshot.itemsByFile.get(picked.id);
      let folderId = existing?.kind === 'folder' ? existing.ldId : null;
      if (!folderId) {
        folderId = crypto.randomUUID();
        const name = stripDriveName(picked.name, LD_NAME_MAX) ?? 'Folder';
        const parent = ldFolderForParent(snapshot, picked.parents[0] ?? null) ?? null;
        await deps.port.createFolder(folderId, name, parent);
        const tagged = await deps.drive.updateFile(picked.id, {
          appProperties: folderAppProperties(deps.host, folderId),
        });
        snapshot.folders.set(folderId, {
          id: folderId,
          name,
          parentId: parent,
          updatedAt: deps.now(),
        });
        await ctx.record({
          kind: 'folder',
          ldId: folderId,
          driveFileId: picked.id,
          name: tagged.name,
          ldName: name,
          parentId: tagged.parents[0] ?? null,
          trashed: false,
          md5: null,
          headRevisionId: null,
          mirroredSavedAt: null,
          notice: null,
          noticeParentId: null,
        });
      }
      const item = snapshot.items.get(itemKey(kind, ldId));
      if (kind === 'diagram') await deps.port.moveDiagram(ldId, folderId);
      else await deps.port.moveFolder(ldId, folderId);
      if (item) await ctx.record({ ...item, notice: null, noticeParentId: null });
      await ctx.flushItems();
      driveLog('adopt-folder', { kind, ldId, folderId });
    } finally {
      this.applying = false;
    }
    await this.pass('manual');
  }
}
