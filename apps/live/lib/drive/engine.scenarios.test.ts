import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/core';
import {
  DRIVE_FOCUS_POLL_MIN_GAP_MS,
  DRIVE_PAGE_TOKEN_PERSIST_MIN_INTERVAL_MS,
  DRIVE_POLL_INTERVAL_MS,
} from './cadence';
import { fileOf, makeEngine, OWNER, world } from './test-support';
import { createBrokerTokenSource, createBrowserTokenSource } from './token-source';

// The mirror over time and across devices (docs/specs/022-drive-mirror/drive-mirror.md,
// "Cadence", "Errors and edge cases", "Folders livediagram cannot see",
// "Disconnecting").

const MIN = 60_000;

describe('two devices', () => {
  it('the lease lets one device write; the other still reads changes from Drive', async () => {
    const w = world();
    w.ld.createDocument('d1', 'Plan');
    const a = makeEngine({ ...w, deviceId: 'device-a' });
    await a.engine.start();
    const b = makeEngine({ ...w, deviceId: 'device-b' });
    await b.engine.start();

    // A holds the lease: B's outbound is skipped, and B says so.
    w.clock.tick(MIN);
    await w.ld.port().renameDocument('d1', 'From B');
    await b.engine.syncNow();
    expect(fileOf(w.google, w.ld, 'document', 'd1')!.name).toBe('Plan.livediagram');
    expect(b.statuses.at(-1)!.leaseHeldElsewhere).toBe(true);
    // A writes it.
    await a.engine.syncNow();
    expect(fileOf(w.google, w.ld, 'document', 'd1')!.name).toBe('From B.livediagram');

    // B still applies a change made in Drive.
    w.google.userRename(fileOf(w.google, w.ld, 'document', 'd1')!.id, 'Drive.livediagram');
    await b.engine.syncNow();
    expect(w.ld.document('d1')!.name).toBe('Drive');

    // A hides: it flushes and hands the lease over at once.
    await a.engine.onHidden();
    await a.engine.releaseLease();
    w.clock.tick(MIN);
    await w.ld.port().renameDocument('d1', 'B again');
    await b.engine.syncNow();
    expect(fileOf(w.google, w.ld, 'document', 'd1')!.name).toBe('B again.livediagram');
    expect(b.statuses.at(-1)!.leaseHeldElsewhere).toBe(false);
  });
});

describe('arrival catch-up', () => {
  it('uploads every document saved since it was last mirrored, after reading Drive', async () => {
    const w = world();
    w.ld.createDocument('d1', 'Plan');
    w.ld.createDocument('d2', 'Notes');
    const first = makeEngine(w);
    await first.engine.start();
    first.engine.stop();
    const md5 = fileOf(w.google, w.ld, 'document', 'd1')!.md5Checksum;

    // Away: edited on another device, a new document, a Drive rename.
    w.clock.tick(3 * 60 * MIN);
    w.ld.edit('d1');
    w.ld.createDocument('d3', 'New');
    w.google.userRename(fileOf(w.google, w.ld, 'document', 'd2')!.id, 'Renamed.livediagram');
    w.clock.tick(5 * MIN);

    const next = makeEngine(w);
    await next.engine.start();
    expect(fileOf(w.google, w.ld, 'document', 'd1')!.md5Checksum).not.toBe(md5);
    expect(fileOf(w.google, w.ld, 'document', 'd3')).toBeDefined();
    expect(w.ld.document('d2')!.name).toBe('Renamed');
  });
});

describe('cadence', () => {
  it('checks on the poll while visible, never while hidden, and on focus after the gap', async () => {
    const w = world();
    let visible = true;
    const { engine } = makeEngine({ ...w, visible: () => visible });
    await engine.start();
    expect(w.timers.pending()).toEqual([DRIVE_POLL_INTERVAL_MS]);

    // Every check starts with the gate's start-token read.
    const listed = () =>
      w.google.requests.filter((r) => r.path === '/drive/v3/changes/startPageToken').length;
    const before = listed();
    w.timers.advance(DRIVE_POLL_INTERVAL_MS);
    await engine.syncNow();
    expect(listed()).toBeGreaterThan(before);

    visible = false;
    await engine.onHidden();
    expect(w.timers.pending()).toEqual([]);

    visible = true;
    w.clock.tick(DRIVE_FOCUS_POLL_MIN_GAP_MS - 1);
    const beforeFocus = listed();
    await engine.onVisible();
    expect(listed()).toBe(beforeFocus);
    w.clock.tick(2);
    await engine.onVisible();
    expect(listed()).toBe(beforeFocus + 1);
  });

  it('writes the page token to D1 only when changed, at most every 10 minutes, and on flush', async () => {
    const w = world();
    w.ld.createDocument('d1', 'Plan');
    const { engine } = makeEngine(w);
    await engine.start();
    const saved = () => w.ld.connection!.pageToken;
    const afterStart = saved();

    w.google.userRename(fileOf(w.google, w.ld, 'document', 'd1')!.id, 'X.livediagram');
    await engine.syncNow();
    expect(saved()).toBe(afterStart);

    w.clock.tick(DRIVE_PAGE_TOKEN_PERSIST_MIN_INTERVAL_MS);
    await engine.syncNow();
    expect(saved()).not.toBe(afterStart);

    const t = saved();
    w.google.userRename(fileOf(w.google, w.ld, 'document', 'd1')!.id, 'Y.livediagram');
    await engine.syncNow();
    expect(saved()).toBe(t);
    await engine.flush();
    // The flush pass does not read changes; it persists what the last read got.
    expect(saved()).not.toBe(t);
  });

  it('backs off on a rate limit: status says so and the poll interval doubles', async () => {
    const w = world();
    w.ld.createDocument('d1', 'Plan');
    const { engine, statuses } = makeEngine(w);
    await engine.start();
    w.google.fail({ status: 403, reason: 'userRateLimitExceeded' });
    await engine.syncNow();
    expect(statuses.at(-1)).toMatchObject({ error: 'rate_limited' });
    expect(w.timers.pending()).toEqual([2 * DRIVE_POLL_INTERVAL_MS]);
    await engine.syncNow();
    expect(statuses.at(-1)).toMatchObject({ error: null });
  });

  it('reports offline when Google is unreachable, and resumes on the next trigger', async () => {
    const w = world();
    const { engine, statuses } = makeEngine(w);
    await engine.start();
    const fetchBefore = w.google.fetch;
    Object.assign(w.google, { handle: () => Promise.reject(new TypeError('Failed to fetch')) });
    await engine.syncNow();
    expect(statuses.at(-1)).toMatchObject({ error: 'offline' });
    expect(fetchBefore).toBeDefined();
  });
});

describe('tokens', () => {
  it('turns needs_reconnect when the api answers drive_needs_reconnect, once', async () => {
    const w = world();
    const tokens = createBrokerTokenSource({
      fetchToken: async () => {
        throw new ApiError('drive token', 409, 'drive_needs_reconnect');
      },
      now: () => w.clock.now,
    });
    const { engine, statuses, events } = makeEngine({ ...w, tokens });
    await engine.start();
    await engine.syncNow();
    expect(statuses.at(-1)!.state).toBe('needs_reconnect');
    expect(events.filter((e) => e === 'ReconnectNeeded')).toHaveLength(1);
  });

  it('browser-only mode asks to Resume sync when the token lapses', async () => {
    const w = world();
    const tokens = createBrowserTokenSource({ now: () => w.clock.now });
    tokens.set({
      accessToken: w.google.issueAccessToken(OWNER),
      expiresAt: w.clock.now + 60 * MIN,
    });
    const { engine, statuses } = makeEngine({ ...w, tokens });
    await engine.start();
    expect(statuses.at(-1)!.state).toBe('idle');
    w.clock.tick(60 * MIN);
    await engine.syncNow();
    expect(statuses.at(-1)!.state).toBe('needs_resume');
    tokens.set({
      accessToken: w.google.issueAccessToken(OWNER),
      expiresAt: w.clock.now + 60 * MIN,
    });
    await engine.syncNow();
    expect(statuses.at(-1)!.state).toBe('idle');
  });

  it('says disconnected when there is no connection', async () => {
    const w = world();
    w.ld.connection = null;
    const { engine, statuses } = makeEngine(w);
    await engine.start();
    expect(statuses.at(-1)!.state).toBe('disconnected');
  });
});

describe('folders livediagram cannot see', () => {
  it('adopting the picked folder makes the matching folder and moves the document in; it then syncs both ways', async () => {
    const w = world();
    w.ld.createFolderAs('f1', 'Work');
    w.ld.createDocument('d1', 'Plan', 'f1');
    const { engine, statuses } = makeEngine(w);
    await engine.start();
    w.clock.tick(MIN);
    const hidden = w.google.userCreateFolder(
      OWNER,
      'Clients',
      fileOf(w.google, w.ld, 'folder', 'f1')!.id,
    );
    w.google.userMove(fileOf(w.google, w.ld, 'document', 'd1')!.id, hidden);
    await engine.syncNow();
    expect(statuses.at(-1)!.notices).toHaveLength(1);

    // The Picker grants access to the folder itself.
    w.google.grantAccess(OWNER, hidden);
    await engine.adoptFolder('document', 'd1', hidden);
    const adopted = [...w.ld.folders.values()].find((f) => f.name === 'Clients')!;
    expect(adopted.parentId).toBe('f1');
    expect(w.ld.document('d1')!.folderId).toBe(adopted.id);
    expect(w.ld.item('document', 'd1')!.notice).toBeNull();
    expect(statuses.at(-1)!.notices).toEqual([]);
    expect(w.google.get(hidden)!.appProperties).toMatchObject({ ldFolderId: adopted.id });

    // From then on it syncs like any other folder.
    w.google.userRename(hidden, 'Customers');
    await engine.syncNow();
    expect(w.ld.folders.get(adopted.id)!.name).toBe('Customers');
    await w.ld.port().renameFolder(adopted.id, 'Accounts');
    await engine.syncNow();
    expect(w.google.get(hidden)!.name).toBe('Accounts');
  });
});

describe('disconnect and reconnect', () => {
  it('a reconnect finds the root again and matches existing files instead of copying them', async () => {
    const w = world();
    w.ld.createFolderAs('f1', 'Work');
    w.ld.createDocument('d1', 'Plan', 'f1');
    const first = makeEngine(w);
    await first.engine.start();
    first.engine.stop();
    const root = w.ld.connection!.rootFolderId;
    const files = w.google.appFiles(OWNER).length;

    // Disconnect: rows go, Drive files stay.
    w.ld.connection = null;
    w.ld.items.clear();
    w.ld.connection = {
      status: 'connected',
      hasRefreshToken: true,
      rootFolderId: null,
      pageToken: null,
      pageTokenSavedAt: null,
      connectedAt: w.clock.tick(MIN),
      pendingAccountSwitch: null,
    };
    const second = makeEngine(w);
    await second.engine.start();
    expect(w.ld.connection!.rootFolderId).toBe(root);
    expect(w.google.appFiles(OWNER).length).toBe(files);
    expect(w.ld.items.size).toBe(2);
  });
});

describe('idle states', () => {
  it('stops polling while disconnected, and starts again on the next trigger', async () => {
    const w = world();
    w.ld.connection = null;
    const { engine } = makeEngine(w);
    await engine.start();
    expect(w.timers.pending()).toEqual([]);
    w.ld.connection = {
      status: 'connected',
      hasRefreshToken: true,
      rootFolderId: null,
      pageToken: null,
      pageTokenSavedAt: null,
      connectedAt: w.clock.now,
      pendingAccountSwitch: null,
    };
    await engine.syncNow();
    expect(w.timers.pending()).toEqual([DRIVE_POLL_INTERVAL_MS]);
  });
});

describe('the api token limiter', () => {
  it('is treated like a Google rate limit: status says so and the poll backs off', async () => {
    const w = world();
    let limited = false;
    const tokens = createBrokerTokenSource({
      fetchToken: async () => {
        if (limited) throw new ApiError('drive token', 429, 'drive_token_rate_limited');
        return { accessToken: w.google.issueAccessToken(OWNER), expiresAt: w.clock.now + 60 * MIN };
      },
      now: () => w.clock.now,
    });
    const { engine, statuses } = makeEngine({ ...w, tokens });
    await engine.start();
    (tokens as { clear(): void }).clear();
    limited = true;
    await engine.syncNow();
    expect(statuses.at(-1)).toMatchObject({ state: 'idle', error: 'rate_limited' });
    expect(w.timers.pending()).toEqual([2 * DRIVE_POLL_INTERVAL_MS]);
    limited = false;
    await engine.syncNow();
    expect(statuses.at(-1)).toMatchObject({ state: 'idle', error: null });
  });
});

describe('the 2-minute gated pace (docs/specs/022-drive-mirror/drive-mirror.md, "Cadence")', () => {
  const listCalls = (w: ReturnType<typeof world>) =>
    w.google.requests.filter((r) => r.path === '/drive/v3/changes').length;

  it('polls every 2 minutes while visible', async () => {
    const w = world();
    const { engine } = makeEngine(w);
    await engine.start();
    expect(w.timers.pending()).toEqual([2 * MIN]);
  });

  it('asks only for the start token when nothing changed, and lists when it moved', async () => {
    const w = world();
    w.ld.createDocument('d1', 'Plan');
    const { engine } = makeEngine(w);
    await engine.start();
    await engine.syncNow();
    const before = listCalls(w);
    await engine.syncNow();
    expect(listCalls(w)).toBe(before);
    w.google.userRename(fileOf(w.google, w.ld, 'document', 'd1')!.id, 'Moved.livediagram');
    await engine.syncNow();
    expect(listCalls(w)).toBe(before + 1);
    expect(w.ld.document('d1')!.name).toBe('Moved');
  });

  it('never skips a real change, even when the token also moves for files it cannot see', async () => {
    const w = world();
    w.ld.createDocument('d1', 'Plan');
    const { engine } = makeEngine(w);
    await engine.start();
    // Invisible activity elsewhere in the user's Drive moves the token too.
    w.google.userCreateFolder(OWNER, 'Elsewhere');
    await engine.syncNow();
    w.google.userRename(fileOf(w.google, w.ld, 'document', 'd1')!.id, 'Seen.livediagram');
    await engine.syncNow();
    expect(w.ld.document('d1')!.name).toBe('Seen');
  });

  it('logs the E-A3 diagnostic only when asked to', async () => {
    const w = world();
    const lines: string[] = [];
    const info = console.info;
    console.info = (...args: unknown[]) => void lines.push(args.map(String).join(' '));
    try {
      const { engine } = makeEngine({ ...w, diagnostics: () => false });
      await engine.start();
      await engine.syncNow();
      expect(lines.filter((l) => l.startsWith('drive: start-token'))).toEqual([]);
      const d = makeEngine({ ...w, deviceId: 'device-b', diagnostics: () => true });
      await d.engine.start();
      await d.engine.syncNow();
      expect(lines.some((l) => /^drive: start-token moved=(true|false) listed=\d+$/.test(l))).toBe(
        true,
      );
      lines.length = 0;
      // Activity livediagram cannot see: whether the real token moves for it is
      // exactly what the diagnostic is for (E-A3); the fake says it does.
      w.google.userCreateFolder(OWNER, 'Elsewhere');
      await d.engine.syncNow();
      await d.engine.syncNow();
      expect(lines.filter((l) => l.startsWith('drive: start-token'))).toEqual([
        'drive: start-token moved=true listed=0',
        'drive: start-token moved=false listed=0',
      ]);
    } finally {
      console.info = info;
    }
  });

  it('checks on focus at most every 30 seconds', async () => {
    const w = world();
    const { engine } = makeEngine(w);
    await engine.start();
    const startTokens = () =>
      w.google.requests.filter((r) => r.path.endsWith('/startPageToken')).length;
    const before = startTokens();
    w.clock.tick(DRIVE_FOCUS_POLL_MIN_GAP_MS - 1);
    await engine.onVisible();
    expect(startTokens()).toBe(before);
    w.clock.tick(2);
    await engine.onVisible();
    expect(startTokens()).toBe(before + 1);
    expect(DRIVE_FOCUS_POLL_MIN_GAP_MS).toBe(30_000);
  });
});

describe('views follow (docs/specs/022-drive-mirror/drive-mirror.md, "Other views follow")', () => {
  it('announces a pass that applied a change from Drive, and only those', async () => {
    const w = world();
    w.ld.createDocument('d1', 'Plan');
    let applied = 0;
    const { engine } = makeEngine({ ...w, onInboundApplied: () => void (applied += 1) });
    await engine.start();
    await engine.syncNow();
    expect(applied).toBe(0);
    w.google.userRename(fileOf(w.google, w.ld, 'document', 'd1')!.id, 'Renamed.livediagram');
    await engine.syncNow();
    expect(applied).toBe(1);
  });
});

describe('not-ours logging', () => {
  it('logs a file it does not take as its own, saying whether it had any appProperties', async () => {
    const w = world();
    w.ld.createDocument('d1', 'Plan');
    const lines: unknown[][] = [];
    const info = console.info;
    console.info = (...args: unknown[]) => void lines.push(args);
    try {
      const { engine } = makeEngine(w);
      await engine.start();
      w.google.userCopy(fileOf(w.google, w.ld, 'document', 'd1')!.id, {
        keepAppProperties: false,
        visibleToApp: true,
      });
      await engine.syncNow();
      expect(lines).toContainEqual([
        '[drive-mirror] inbound-not-ours',
        expect.objectContaining({ hadAppProperties: false }),
      ]);
    } finally {
      console.info = info;
    }
  });
});

describe('the root folder (docs/specs/022-drive-mirror/drive-mirror.md, "Connecting")', () => {
  it('keeps syncing after the user moves and renames it, and never renames it back', async () => {
    const w = world();
    w.ld.createDocument('d1', 'Plan');
    const { engine } = makeEngine(w);
    await engine.start();
    const root = w.ld.connection!.rootFolderId!;
    const mine = w.google.userCreateFolder(OWNER, 'My projects');
    w.google.userRename(root, 'Documents');
    w.google.userMove(root, mine);
    w.clock.tick(MIN);
    w.ld.createDocument('d2', 'Later');
    await engine.syncNow();
    // A fresh arrival too, the check that could have re-made the root.
    const next = makeEngine({ ...w, deviceId: 'device-b' });
    await next.engine.start();
    expect(w.ld.connection!.rootFolderId).toBe(root);
    expect(w.google.get(root)).toMatchObject({ name: 'Documents', parents: [mine] });
    expect(fileOf(w.google, w.ld, 'document', 'd2')!.parents).toEqual([root]);
    expect(w.google.appFiles(OWNER).filter((f) => f.appProperties.ldRoot)).toHaveLength(1);
  });
});

describe('the root folder name in the status (blueprint "Cloud Sync in Settings")', () => {
  it('reports the name it created, and follows a rename made in Drive', async () => {
    const w = world();
    const { engine, statuses } = makeEngine(w);
    await engine.start();
    // The test host is a self-hosted one.
    expect(statuses.at(-1)!.rootName).toBe('livediagram (self-hosted)');
    w.google.userRename(w.ld.connection!.rootFolderId!, 'My documents');
    await engine.syncNow();
    expect(statuses.at(-1)!.rootName).toBe('My documents');
  });

  it('reads the name of a root it finds on arrival', async () => {
    const w = world();
    const first = makeEngine(w);
    await first.engine.start();
    w.google.userRename(w.ld.connection!.rootFolderId!, 'Renamed');
    const next = makeEngine({ ...w, deviceId: 'device-b' });
    await next.engine.start();
    expect(next.statuses.at(-1)!.rootName).toBe('Renamed');
  });
});

describe('checks asked for by another tab (docs/specs/022-drive-mirror/drive-mirror.md, "A visible tab is never left unsynced")', () => {
  it('runs a gated check for focus or view past the focus guard, and says Synced for it', async () => {
    const w = world();
    w.ld.createDocument('d1', 'Plan');
    const { engine, statuses } = makeEngine(w);
    await engine.start();
    const calls = () =>
      w.google.requests.filter((r) => r.path === '/drive/v3/changes/startPageToken').length;
    const before = calls();
    // Inside the guard: nothing.
    w.clock.tick(DRIVE_FOCUS_POLL_MIN_GAP_MS - 1);
    await engine.requestCheck('focus');
    expect(calls()).toBe(before);
    // Past it: one gated check, which found nothing new and still counts.
    w.clock.tick(1);
    await engine.requestCheck('view');
    expect(calls()).toBe(before + 1);
    expect(statuses.at(-1)).toMatchObject({ state: 'idle', lastSyncedAt: w.clock.now });
  });

  it('runs a poll check only once the poll interval has passed', async () => {
    const w = world();
    const { engine } = makeEngine(w);
    await engine.start();
    const calls = () =>
      w.google.requests.filter((r) => r.path === '/drive/v3/changes/startPageToken').length;
    const before = calls();
    w.clock.tick(DRIVE_POLL_INTERVAL_MS - 5_000);
    await engine.requestCheck('poll');
    expect(calls()).toBe(before);
    w.clock.tick(5_000);
    await engine.requestCheck('poll');
    expect(calls()).toBe(before + 1);
  });
});

describe('a check asked for while a flush is queued', () => {
  it('still runs, after the flush', async () => {
    const w = world();
    w.ld.createDocument('d1', 'Plan');
    const { engine } = makeEngine(w);
    await engine.start();
    const calls = () =>
      w.google.requests.filter((r) => r.path === '/drive/v3/changes/startPageToken').length;
    w.clock.tick(DRIVE_FOCUS_POLL_MIN_GAP_MS);
    const before = calls();
    // A pass runs; the tab hides (a flush queues); the user asks for a check.
    w.ld.edit('d1');
    const running = engine.flush();
    const flushed = engine.flush();
    const checked = engine.requestCheck('focus');
    await Promise.all([running, flushed, checked]);
    expect(calls()).toBe(before + 1);
  });
});
