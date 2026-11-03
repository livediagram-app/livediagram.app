import { describe, expect, it, vi } from 'vitest';
import { cpuBudgetMs, cpuMsOfAsync } from '@liveworkspace/vitest-config/cpu-time';
import {
  EXPORT_CHUNK_MS,
  EXPORT_FAILURES_MAX,
  EXPORT_LINK_TTL_MS,
  EXPORT_MAX_ITEMS,
  EXPORT_PART_BYTES,
  type StartExportCall,
} from '@liveworkspace/data-export';
import { envelope, testContext, text, unzip, type FakeItem } from '../test-support';
import {
  FINISH_RESERVE_BYTES,
  imageName,
  newJob,
  NOTIFY_RETRY_MS,
  NOTIFY_TRIES_MAX,
  removeJob,
  runChunk,
  startJob,
} from './steps';
import { objectKey } from './store';

const PERSONAL: StartExportCall = {
  key: 'personal:user_ada',
  requestedBy: 'user_ada',
  scope: { kind: 'personal', personId: 'user_ada' },
  profile: { id: 'user_ada', name: 'Ada' },
};
const TEAM: StartExportCall = {
  key: 'team:t1',
  requestedBy: 'user_ada',
  scope: { kind: 'team', teamId: 't1', teamName: 'Design' },
};

const thread = (authorId: string | null, text: string, id = 'T1') => ({
  id,
  tabId: 'tab1',
  tabName: 'Main',
  on: 'e1',
  resolved: false,
  comments: [{ id: `${id}-c`, authorId, authorName: authorId ? 'Name' : null, text, createdAt: 5 }],
});

function item(id: string, extra: Partial<FakeItem> = {}): FakeItem {
  return { id, app: 'livediagram', name: `Item ${id}`, updatedAt: Date.UTC(2026, 9, 1), ...extra };
}

/** Runs chunks until the export stops running, advancing the clock to each alarm. */
async function runToEnd(t: ReturnType<typeof testContext>, max = 200) {
  for (let i = 0; i < max; i++) {
    const job = t.store.job();
    if (!job || job.status !== 'running') return;
    const { alarmAt } = await runChunk(t.ctx);
    if (alarmAt !== null) t.clock.now = Math.max(t.clock.now, alarmAt);
    t.sources.calls = 0;
  }
  throw new Error('export never finished');
}

/** One chunk that only lists: its requests are spent as soon as the listing is. */
async function listOnly(t: ReturnType<typeof testContext>) {
  const requests = t.ctx.requests;
  t.ctx.requests = () => 400;
  await runChunk(t.ctx);
  t.ctx.requests = requests;
}

async function begin(t: ReturnType<typeof testContext>, call = PERSONAL, id = 'ex_1') {
  const started = await startJob(t.ctx, call, id, t.clock.now);
  expect(started.ok).toBe(true);
}

function zipOf(t: ReturnType<typeof testContext>, call = PERSONAL, id = 'ex_1') {
  const bytes = t.bucket.objects.get(objectKey(call.key, id));
  if (!bytes) throw new Error('no zip');
  return unzip(bytes);
}

describe('a personal export', () => {
  it('holds every item’s file, pictures, CSV, my comments, my profile and my images', async () => {
    const t = testContext();
    t.sources.items = [
      item('A', {
        name: 'Roadmap: Q4',
        file: envelope('livediagram', 'Roadmap', [
          { id: 'tab1', name: 'Main' },
          { id: 'tab2', name: 'Main' },
          { id: 'tab3', name: 'Blank' },
        ]),
        svg: { tab1: '<svg one/>', tab2: '<svg two/>', tab3: 'blank' },
        threads: [thread('user_ada', 'mine'), thread('user_bo', 'theirs', 'T2')],
      }),
      item('P', {
        app: 'liveplanner',
        name: 'Sprint',
        tables: [
          { name: 'Board', kind: 'board', csv: 'Title\r\nShip\r\n' },
          { name: 'Board', kind: 'board', csv: 'Title\r\n' },
          { name: '', kind: 'sheet', csv: 'a\r\n' },
        ],
      }),
      item('G', { file: null }),
    ];
    t.sources.images = [
      {
        id: 'img1',
        contentType: 'image/png',
        byteSize: 3,
        width: 1,
        height: 1,
        originalName: 'logo.png',
        createdAt: 1,
        app: 'livediagram.app',
        bytes: new Uint8Array([1, 2, 3]),
      },
      {
        id: 'img2',
        contentType: 'image/png',
        byteSize: 3,
        width: 1,
        height: 1,
        createdAt: 1,
        app: 'livediagram.app',
        bytes: null,
      },
    ];
    await begin(t);
    await runToEnd(t);

    const job = t.store.job()!;
    expect(job).toMatchObject({
      status: 'ready',
      itemsTotal: 3,
      itemsDone: 3,
      imagesTotal: 2,
      imagesDone: 2,
    });
    expect(job.expiresAt).toBe(job.finishedAt! + EXPORT_LINK_TTL_MS);
    const files = zipOf(t);
    expect([...files.keys()].sort()).toEqual(
      [
        'README.txt',
        'comments.csv',
        'comments.json',
        'images/img1 logo.png',
        'livediagram/Roadmap Q4 (A)/01 Main.png',
        'livediagram/Roadmap Q4 (A)/02 Main.png',
        'livediagram/Roadmap Q4 (A)/Roadmap Q4.livediagram',
        'liveplanner/Sprint (P)/Board 2.csv',
        'liveplanner/Sprint (P)/Board.csv',
        'liveplanner/Sprint (P)/Sheet.csv',
        'liveplanner/Sprint (P)/Sprint.liveplanner',
        'profile.json',
      ].sort(),
    );
    expect(text(files.get('livediagram/Roadmap Q4 (A)/01 Main.png')!.data)).toBe('PNG:<svg one/>');
    expect(JSON.parse(text(files.get('profile.json')!.data))).toEqual({
      id: 'user_ada',
      name: 'Ada',
    });
    const comments = JSON.parse(text(files.get('comments.json')!.data));
    expect(comments.map((c: { text: string }) => c.text)).toEqual(['mine']);
    expect(files.get('images/img1 logo.png')!.data).toEqual(new Uint8Array([1, 2, 3]));
    // Lists are the person's own.
    expect(t.sources.scopes[0]).toEqual({ scope: PERSONAL.scope, requestedBy: 'user_ada' });
    expect(t.sources.readyCalls).toEqual([
      {
        key: 'personal:user_ada',
        exportId: 'ex_1',
        requestedBy: 'user_ada',
        status: 'ready',
        bytes: job.bytes,
        expiresAt: job.expiresAt,
        teamName: null,
      },
    ]);
    expect(job.notifyPending).toBe(false);
    expect(t.logs.map((l) => l.event)).toContain('ready');
    // Nothing of the content is logged.
    expect(JSON.stringify(t.logs)).not.toContain('Roadmap');
  });

  it('crosses parts in even sizes and keeps the tail between chunks', async () => {
    const t = testContext();
    const big = new Uint8Array(EXPORT_PART_BYTES + 1000);
    for (let i = 0; i < big.length; i++) big[i] = (i * 2654435761) >>> 24;
    t.sources.items = [item('A')];
    t.sources.images = Array.from({ length: 3 }, (_, i) => ({
      id: `img${i}`,
      contentType: 'image/jpeg',
      byteSize: big.length,
      width: 1,
      height: 1,
      originalName: `photo ${i}.JPG`,
      createdAt: 1,
      app: 'livediagram.app' as const,
      bytes: big,
    }));
    await begin(t);
    // Every read of the clock is a new chunk's worth of time: one file per chunk, each saving its tail for the next.
    const realNow = t.ctx.now;
    let reads = 0;
    t.ctx.now = () => realNow() + reads++ * EXPORT_CHUNK_MS;
    await runToEnd(t);
    const files = zipOf(t);
    expect(files.get('images/img2 photo 2.jpg')!.data.length).toBe(big.length);
    const upload = [...t.bucket.uploads.values()][0]!;
    expect(upload.done).toBe(true);
    expect(upload.parts.size).toBe(4);
  });

  it('works within each chunk’s wall time, carrying on next chunk', async () => {
    const t = testContext();
    t.sources.items = Array.from({ length: 5 }, (_, i) => item(`I${i}`));
    t.sources.pageSize = 200;
    await begin(t);
    const realNow = t.ctx.now;
    let calls = 0;
    // Each read of the clock moves it on 6 s: a chunk does a few items, then stops.
    t.ctx.now = () => realNow() + calls++ * 6000;
    let chunks = 0;
    while (t.store.job()!.status === 'running' && chunks < 50) {
      await runChunk(t.ctx);
      chunks += 1;
    }
    expect(chunks).toBeGreaterThan(1);
    expect(t.store.job()!.status).toBe('ready');
    expect([...zipOf(t).keys()].filter((n) => n.endsWith('.livediagram'))).toHaveLength(5);
    expect(EXPORT_CHUNK_MS).toBe(20_000);
  });

  it('stops listing for the chunk once its requests run low', async () => {
    const t = testContext();
    t.sources.items = Array.from({ length: 6 }, (_, i) => item(`I${i}`));
    t.sources.pageSize = 1;
    t.ctx.requests = () => 400;
    await begin(t);
    const { alarmAt } = await runChunk(t.ctx);
    expect(alarmAt).toBe(t.clock.now);
    expect(t.store.job()!.phase).toBe('listing');
    expect(t.store.job()!.cursor).toBe('1');
  });

  it('names an item it could not read, and leaves a gone one out', async () => {
    const t = testContext();
    t.sources.items = [
      item('A', { fileFails: 2, name: '' }),
      item('B', { fileFails: 1 }),
      item('P', { app: 'liveplanner', tables: 'fail', threads: 'fail' }),
      item('S', {
        file: envelope('livediagram', 'S', [{ id: 'x', name: 'X' }]),
        svg: { x: 'throw' },
      }),
    ];
    await begin(t);
    await runToEnd(t);
    const job = t.store.job()!;
    expect(job.status).toBe('ready');
    expect(job.problems).toBe(3);
    const readme = text(zipOf(t).get('README.txt')!.data);
    expect(readme).toContain('- livediagram: A (its file could not be read)');
    expect(readme).toContain('- liveplanner: Item P (its boards and sheets could not be read)');
    expect(readme).toContain('- liveplanner: Item P (its comments could not be read)');
    // B was read on its second try; S has no picture.
    expect([...zipOf(t).keys()]).toContain('livediagram/Item B (B)/Item B.livediagram');
    expect([...zipOf(t).keys()].some((n) => n.startsWith('livediagram/Item S (S)/01'))).toBe(false);
  });
});

describe('a team export', () => {
  it('holds the team’s items and every comment, with no profile or images', async () => {
    const t = testContext();
    t.sources.items = [
      item('A', { threads: [thread('user_bo', 'theirs'), thread(null, 'gone', 'T2')] }),
    ];
    await begin(t, TEAM);
    await runToEnd(t);
    const files = zipOf(t, TEAM);
    expect(files.has('profile.json')).toBe(false);
    expect(JSON.parse(text(files.get('team.json')!.data))).toEqual({ id: 't1', name: 'Design' });
    expect(JSON.parse(text(files.get('comments.json')!.data))).toHaveLength(2);
    expect(t.sources.scopes[0]!.scope).toEqual(TEAM.scope);
    expect(t.sources.readyCalls[0]!.teamName).toBe('Design');
    expect(t.store.job()!.profile).toBeNull();
  });
});

describe('caps', () => {
  it('leaves out what passes the size cap, and says so', async () => {
    const t = testContext();
    t.sources.items = [item('A'), item('B'), item('C')];
    t.sources.pageSize = 10;
    await begin(t);
    await listOnly(t);
    // As if the zip were already nearly full.
    const job = t.store.job()!;
    job.bytes = 2 * 1024 * 1024 * 1024 - FINISH_RESERVE_BYTES - 10;
    t.store.save(job);
    t.bucket.objects.clear();
    await runToEnd(t);
    const done = t.store.job()!;
    expect(done.status).toBe('ready');
    expect(done.leftOut).toBe(3);
    expect(done.itemsDone).toBe(0);
  });

  it('leaves out items past the item cap while listing', async () => {
    const t = testContext();
    await begin(t);
    const job = t.store.job()!;
    job.itemsTotal = EXPORT_MAX_ITEMS - 1;
    t.store.save(job);
    t.sources.items = [item('A'), item('B'), item('C')];
    t.sources.pageSize = 10;
    await listOnly(t);
    expect(t.store.job()).toMatchObject({
      itemsTotal: EXPORT_MAX_ITEMS,
      leftOut: 2,
      phase: 'items',
    });
  });

  it('leaves out what passes the file count cap', async () => {
    const t = testContext();
    t.sources.items = [item('A')];
    await begin(t);
    await listOnly(t);
    vi.spyOn(t.store, 'entryStats').mockReturnValue({ count: 64_995, nameBytes: 0 });
    await runToEnd(t);
    expect(t.store.job()).toMatchObject({ status: 'ready', leftOut: 1 });
  });
});

describe('failures', () => {
  it('backs off and tries again from the last commit', async () => {
    const t = testContext();
    t.sources.items = [item('A')];
    t.sources.listFails = 1;
    await begin(t);
    const { alarmAt } = await runChunk(t.ctx);
    expect(alarmAt).toBe(t.clock.now + 5000);
    expect(t.store.job()).toMatchObject({ failures: 1, phase: 'listing' });
    await runToEnd(t);
    expect(t.store.job()).toMatchObject({ status: 'ready', failures: 0 });
  });

  it('uploads a part again after R2 fails mid-chunk, with the same bytes in the end', async () => {
    const t = testContext();
    const big = new Uint8Array(EXPORT_PART_BYTES + 5).fill(9);
    t.sources.items = [item('A')];
    t.sources.images = [
      {
        id: 'i',
        contentType: 'image/png',
        byteSize: 1,
        width: 1,
        height: 1,
        createdAt: 1,
        app: 'livediagram.app',
        bytes: big,
      },
    ];
    t.bucket.failUploads = 1;
    await begin(t);
    await runToEnd(t);
    expect(t.store.job()!.status).toBe('ready');
    expect(zipOf(t).get('images/i image.png')!.data.length).toBe(big.length);
  });

  it('fails after too many tries in a row, aborts the upload and says so', async () => {
    const t = testContext();
    t.sources.items = [item('A')];
    await begin(t);
    await listOnly(t);
    const job = t.store.job()!;
    job.failures = EXPORT_FAILURES_MAX - 1;
    t.store.save(job);
    expect(job.uploadId).toBeTruthy();
    t.bucket.failUploads = 0;
    t.ctx.sources.imageBytes = async () => {
      throw new Error('x');
    };
    t.store.next = () => {
      throw new Error('storage');
    };
    const { alarmAt } = await runChunk(t.ctx);
    expect(alarmAt).toBeNull();
    expect(t.store.job()).toMatchObject({ status: 'failed', notifyPending: false });
    expect(t.bucket.uploads.get(job.uploadId!)!.aborted).toBe(true);
    expect(t.sources.readyCalls[0]).toMatchObject({ status: 'failed', expiresAt: null });
  });

  it('fails without an upload to abort', async () => {
    const t = testContext();
    await begin(t);
    const job = t.store.job()!;
    job.failures = EXPORT_FAILURES_MAX - 1;
    t.store.save(job);
    t.sources.listFails = 1;
    await runChunk(t.ctx);
    expect(t.store.job()!.status).toBe('failed');
  });
});

describe('telling accounts', () => {
  it('tries again a minute later, and gives up after a few tries', async () => {
    const t = testContext();
    t.sources.readyFails = 100;
    await begin(t);
    await listOnly(t);
    const { alarmAt } = await runChunk(t.ctx); // items, finish
    expect(alarmAt).toBe(t.clock.now + NOTIFY_RETRY_MS);
    expect(t.store.job()).toMatchObject({ status: 'ready', notifyPending: true, failures: 1 });
    for (let i = 1; i < NOTIFY_TRIES_MAX; i++) {
      t.clock.now += NOTIFY_RETRY_MS;
      await runChunk(t.ctx);
    }
    const job = t.store.job()!;
    expect(job.notifyPending).toBe(false);
    // Then only the expiry is waited for.
    expect((await runChunk(t.ctx)).alarmAt).toBe(job.expiresAt);
  });

  it('sends on a later alarm once accounts answers', async () => {
    const t = testContext();
    t.sources.readyFails = 1;
    await begin(t);
    await runToEnd(t);
    expect(t.store.job()!.notifyPending).toBe(true);
    const { alarmAt } = await runChunk(t.ctx);
    expect(alarmAt).toBe(t.store.job()!.expiresAt);
    expect(t.sources.readyCalls).toHaveLength(1);
  });

  it('retries a failed export’s email too', async () => {
    const t = testContext();
    await begin(t);
    const job = t.store.job()!;
    job.status = 'failed';
    job.notifyPending = true;
    t.store.save(job);
    expect((await runChunk(t.ctx)).alarmAt).toBeNull();
    expect(t.sources.readyCalls[0]!.status).toBe('failed');
    expect((await runChunk(t.ctx)).alarmAt).toBeNull();
  });
});

describe('expiry, starting again and removing', () => {
  it('deletes the file when the link lapses', async () => {
    const t = testContext();
    await begin(t);
    await runToEnd(t);
    const job = t.store.job()!;
    t.clock.now = job.expiresAt!;
    expect((await runChunk(t.ctx)).alarmAt).toBeNull();
    expect(t.store.job()!.status).toBe('expired');
    expect(t.bucket.deleted).toContain(objectKey(job.key, job.id));
  });

  it('refuses a second export while one runs, and replaces a finished one', async () => {
    const t = testContext();
    await begin(t);
    expect(await startJob(t.ctx, PERSONAL, 'ex_2', t.clock.now)).toEqual({
      ok: false,
      error: 'export_running',
    });
    await runToEnd(t);
    const again = await startJob(t.ctx, PERSONAL, 'ex_2', t.clock.now);
    expect(again.ok).toBe(true);
    expect(t.bucket.deleted).toContain(objectKey(PERSONAL.key, 'ex_1'));
    expect(t.store.job()!.id).toBe('ex_2');
  });

  it('removes a running export, its upload and its rows', async () => {
    const t = testContext();
    t.sources.items = [item('A')];
    await begin(t);
    await runChunk(t.ctx);
    await runChunk(t.ctx);
    await removeJob(t.ctx);
    expect(t.store.job()).toBeNull();
    await removeJob(t.ctx);
    expect(t.bucket.deleted).toEqual([objectKey(PERSONAL.key, 'ex_1')]);
  });

  it('removes a running export before its upload exists', async () => {
    const t = testContext();
    await begin(t);
    await removeJob(t.ctx);
    expect(t.store.job()).toBeNull();
  });

  it('does nothing with no job', async () => {
    const t = testContext();
    expect(await runChunk(t.ctx)).toEqual({ alarmAt: null });
  });

  it('starts a personal export with an empty profile when none came', () => {
    expect(newJob({ ...PERSONAL, profile: undefined as never }, 'x', 1).profile).toEqual({});
  });
});

describe('edges', () => {
  it('removes a running export even when R2 will not abort its upload', async () => {
    const t = testContext();
    t.sources.items = [item('A'), item('B'), item('C')];
    await begin(t);
    await listOnly(t);
    const job = t.store.job()!;
    job.uploadId = (await t.bucket.createMultipartUpload(objectKey(PERSONAL.key, 'ex_1'))).uploadId;
    t.store.save(job);
    const resume = t.bucket.resumeMultipartUpload;
    t.bucket.resumeMultipartUpload = (key, id) => ({
      ...resume(key, id),
      abort: async () => {
        throw new Error('r2 down');
      },
    });
    await removeJob(t.ctx);
    expect(t.store.job()).toBeNull();
  });

  it('fails even when R2 will not abort its upload', async () => {
    const t = testContext();
    t.sources.items = [item('A')];
    await begin(t);
    await listOnly(t);
    const job = t.store.job()!;
    job.failures = EXPORT_FAILURES_MAX - 1;
    t.store.save(job);
    const resume = t.bucket.resumeMultipartUpload;
    t.bucket.resumeMultipartUpload = (key, id) => ({
      ...resume(key, id),
      abort: async () => {
        throw new Error('r2 down');
      },
    });
    t.store.next = () => {
      throw new Error('storage');
    };
    await runChunk(t.ctx);
    expect(t.store.job()!.status).toBe('failed');
  });

  it('names an unnamed item by its id, skips a tab with no picture, and writes an empty profile', async () => {
    const t = testContext();
    t.sources.items = [
      item('P', { app: 'liveplanner', name: '', tables: 'fail', threads: 'fail' }),
      item('S', { file: envelope('livediagram', 'S', [{ id: 'x', name: 'X' }]) }),
    ];
    await begin(t);
    t.store.begin({ ...t.store.job()!, profile: null });
    await runToEnd(t);
    const zip = zipOf(t);
    const readme = text(zip.get('README.txt')!.data);
    expect(readme).toContain('- liveplanner: P (its boards and sheets could not be read)');
    expect(readme).toContain('- liveplanner: P (its comments could not be read)');
    expect([...zip.keys()].some((n) => n.startsWith('livediagram/Item S (S)/01'))).toBe(false);
    expect(text(zip.get('profile.json')!.data)).toBe('{}');
  });
});

it('names an image by its id, name and type', () => {
  expect(imageName({ ref: 'i1', name: 'Holiday.JPEG', contentType: 'image/jpeg' })).toBe(
    'images/i1 Holiday.jpg',
  );
  expect(imageName({ ref: 'i2', name: '', contentType: null })).toBe('images/i2 image.bin');
});

describe('a realistic account (measured)', () => {
  it('exports 200 items of 3 tabs, 40 with comments, and 30 images within budget', async () => {
    const t = testContext();
    const tabs = [
      { id: 't1', name: 'One' },
      { id: 't2', name: 'Two' },
      { id: 't3', name: 'Three' },
    ];
    const body = (i: number) =>
      JSON.stringify({
        kind: 'livediagram.document',
        document: {
          name: `D${i}`,
          tabs: tabs.map((tab) => ({
            ...tab,
            elements: Array.from({ length: 60 }, (_, e) => ({
              id: `e${e}`,
              type: 'shape',
              x: e * 10,
              y: i,
              text: `Box ${e}`,
            })),
          })),
        },
      });
    t.sources.items = Array.from({ length: 200 }, (_, i) =>
      item(`I${i}`, {
        app: (['livediagram', 'liveplanner', 'livedocuments', 'livedesign'] as const)[i % 4],
        file: body(i),
        svg: { t1: '<svg/>', t2: '<svg/>', t3: '<svg/>' },
        ...(i % 5 === 0 ? { threads: [thread('user_ada', `Comment ${i}`)] } : {}),
      }),
    );
    t.sources.pageSize = 200;
    t.sources.images = Array.from({ length: 30 }, (_, i) => ({
      id: `img${i}`,
      contentType: 'image/png',
      byteSize: 200_000,
      width: 1,
      height: 1,
      createdAt: 1,
      app: 'livediagram.app' as const,
      bytes: new Uint8Array(200_000).fill(i),
    }));
    await begin(t);
    let chunks = 0;
    let maxRequests = 0;
    const ms = await cpuMsOfAsync(async () => {
      while (t.store.job()!.status === 'running') {
        await runChunk(t.ctx);
        maxRequests = Math.max(maxRequests, t.sources.calls);
        t.sources.calls = 0;
        chunks += 1;
      }
    });
    const job = t.store.job()!;
    const files = zipOf(t);
    console.log(
      `[measure] 200 items x 3 tabs + 30 images: ${chunks} chunks, ${files.size} files, ${(job.bytes / 1e6).toFixed(1)} MB, ${Math.round(ms)} ms CPU, most requests in a chunk ${maxRequests}`,
    );
    expect(job).toMatchObject({ status: 'ready', itemsDone: 200, imagesDone: 30 });
    expect(files.size).toBe(200 * 4 + 30 + 4);
    expect(maxRequests).toBeLessThanOrEqual(400);
    expect(ms).toBeLessThan(cpuBudgetMs(15_000));
  });
});
