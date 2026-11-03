// One export, a chunk at a time (liveworkspace/docs/specs/003-accounts/data-export.md "How it is built"): list the
// scope's items (and a person's images), add each item's files, then each image, then finish the zip. A chunk works
// until its wall time or its requests run out and is committed in one go at its end; a chunk that fails commits
// nothing but its failure, and the next tries again from the last commit, so a part uploaded again is the same part.

import {
  EXPORT_CHUNK_MS,
  EXPORT_CHUNK_SUBREQUESTS,
  EXPORT_FAILURES_MAX,
  EXPORT_LINK_TTL_MS,
  EXPORT_MAX_BYTES,
  EXPORT_MAX_ENTRIES,
  EXPORT_MAX_ITEMS,
  EXPORT_PART_BYTES,
  EXPORT_TAB_PICTURES_MAX,
  exportRetryDelay,
  type StartExportCall,
} from '@liveworkspace/data-export';
import type { ExportThread } from '@liveworkspace/index-app';
import {
  APP_EXTENSION,
  commentRows,
  commentsCsv,
  commentsJson,
  itemFolder,
  pictureNames,
  readme,
  safeName,
  tabsOfEnvelope,
  uniqueNames,
  type CommentRow,
} from '../files';
import type { Sources } from '../sources';
import { PartWriter, type PartSink, type UploadedPart } from '../upload';
import {
  centralHeader,
  directoryBytes,
  endRecord,
  zipFile,
  type ZipEntry,
  type ZipFile,
} from '../zip/zip';
import { objectKey, type Job, type JobStore, type Problem, type QueueRow } from './store';

const encoder = new TextEncoder();

/** The slice of an R2 bucket an export uses. */
export interface ExportBucket {
  createMultipartUpload(key: string, options?: R2MultipartOptions): Promise<{ uploadId: string }>;
  resumeMultipartUpload(
    key: string,
    uploadId: string,
  ): PartSink & { complete(parts: UploadedPart[]): Promise<unknown>; abort(): Promise<void> };
  delete(key: string): Promise<void>;
}

/** An SVG drawn as a PNG, or null when it can't be. */
export type Rasterise = (svg: string) => Promise<Uint8Array | null>;

export type RunContext = {
  store: JobStore;
  sources: Sources;
  bucket: ExportBucket;
  rasterise: Rasterise;
  now: () => number;
  // Requests made so far in this invocation (the sources count them).
  requests: () => number;
  // Runs `fn` as one storage transaction.
  transaction: (fn: () => void) => void;
  log: (event: string, fields: Record<string, unknown>) => void;
};

// Room kept for the finish (the comments, the README, the directory) under the size cap, and the requests one item
// may need (its file, comments, CSV and a picture per tab), kept under the chunk's budget.
export const FINISH_RESERVE_BYTES = 64 * 1024 * 1024;
export const ITEM_REQUESTS_MAX = 4 + EXPORT_TAB_PICTURES_MAX;
// After this many failed tries to tell accounts an export finished, the email is given up on (the file stays).
export const NOTIFY_TRIES_MAX = 5;
export const NOTIFY_RETRY_MS = 60_000;

// ---------- Starting and stopping -------------------------------------------------------------------------------

export function newJob(call: StartExportCall, id: string, now: number): Job {
  return {
    id,
    key: call.key,
    scope: call.scope,
    requestedBy: call.requestedBy,
    status: 'running',
    phase: 'listing',
    cursor: null,
    itemsTotal: 0,
    itemsDone: 0,
    imagesTotal: 0,
    imagesDone: 0,
    bytes: 0,
    uploadId: null,
    nextPart: 1,
    startedAt: now,
    finishedAt: null,
    expiresAt: null,
    failures: 0,
    leftOut: 0,
    problems: 0,
    notifyPending: false,
    profile: call.scope.kind === 'personal' ? (call.profile ?? {}) : null,
  };
}

/** Starts a new export unless one is running; the last one's file goes. */
export async function startJob(
  ctx: Pick<RunContext, 'store' | 'bucket' | 'log'>,
  call: StartExportCall,
  id: string,
  now: number,
): Promise<{ ok: true; job: Job } | { ok: false; error: 'export_running' }> {
  const previous = ctx.store.job();
  if (previous?.status === 'running') return { ok: false, error: 'export_running' };
  if (previous) await ctx.bucket.delete(objectKey(previous.key, previous.id));
  const job = newJob(call, id, now);
  ctx.store.begin(job);
  ctx.log('started', { kind: call.scope.kind, id });
  return { ok: true, job };
}

/** Stops the scope's export and deletes its file and every row (an account closing). */
export async function removeJob(ctx: Pick<RunContext, 'store' | 'bucket'>): Promise<void> {
  const job = ctx.store.job();
  if (!job) return;
  if (job.status === 'running' && job.uploadId) {
    await ctx.bucket
      .resumeMultipartUpload(objectKey(job.key, job.id), job.uploadId)
      .abort()
      .catch(() => {});
  }
  await ctx.bucket.delete(objectKey(job.key, job.id));
  ctx.store.forget();
}

// ---------- A chunk ---------------------------------------------------------------------------------------------

type Pending = {
  entries: ZipEntry[];
  done: number[];
  comments: CommentRow[];
  problems: Problem[];
};

/** Runs one chunk; answers when the object's alarm should next fire (null: never). */
export async function runChunk(ctx: RunContext): Promise<{ alarmAt: number | null }> {
  const job = ctx.store.job();
  if (!job) return { alarmAt: null };
  if (job.status === 'ready') return settleReady(ctx, job);
  if (job.status !== 'running')
    return { alarmAt: job.notifyPending ? await notify(ctx, job) : null };
  const started = ctx.now();
  try {
    return await work(ctx, job, started);
  } catch (err) {
    // Nothing of the chunk is kept but the failure: the next tries again from the last commit.
    const committed = ctx.store.job()!;
    const failed: Job = { ...committed, failures: committed.failures + 1 };
    ctx.log('chunk failed', { id: job.id, failures: failed.failures, error: String(err) });
    if (failed.failures >= EXPORT_FAILURES_MAX) return fail(ctx, failed);
    ctx.store.save(failed);
    return { alarmAt: ctx.now() + exportRetryDelay(failed.failures) };
  }
}

async function work(
  ctx: RunContext,
  job: Job,
  started: number,
): Promise<{ alarmAt: number | null }> {
  const inBudget = () =>
    ctx.now() - started < EXPORT_CHUNK_MS &&
    ctx.requests() + ITEM_REQUESTS_MAX <= EXPORT_CHUNK_SUBREQUESTS;

  // Listing touches only the queue: each page is committed as it is read.
  const listed = job.phase === 'listing';
  while (job.phase === 'listing') {
    await listStep(ctx, job);
    if (job.phase === 'listing' && !inBudget()) return { alarmAt: ctx.now() };
  }

  if (!job.uploadId) {
    const upload = await ctx.bucket.createMultipartUpload(objectKey(job.key, job.id), {
      httpMetadata: { contentType: 'application/zip' },
    });
    job.uploadId = upload.uploadId;
    ctx.store.save(job);
  }
  const upload = ctx.bucket.resumeMultipartUpload(objectKey(job.key, job.id), job.uploadId);
  const writer = new PartWriter(
    upload,
    { offset: job.bytes, nextPart: job.nextPart, tail: ctx.store.tail() },
    EXPORT_PART_BYTES,
  );
  const pending: Pending = { entries: [], done: [], comments: [], problems: [] };
  const stats = ctx.store.entryStats();
  let lastSeq = 0;

  const append = async (files: readonly ZipFile[]) => {
    for (const file of files) {
      pending.entries.push({ ...file.entry, offset: writer.offset });
      await writer.append(file.bytes);
    }
  };
  // Whether these files still fit under the caps, with room for the finish.
  const fits = (files: readonly ZipFile[]) => {
    const length = files.reduce((n, f) => n + f.length, 0);
    const names = files.map((f) => f.entry.name);
    const entries = stats.count + pending.entries.length + files.length;
    return (
      writer.offset + length + directoryBytes(names) + stats.nameBytes + FINISH_RESERVE_BYTES <=
        EXPORT_MAX_BYTES && entries + 6 <= EXPORT_MAX_ENTRIES
    );
  };
  // The caps reached: whatever is still queued is left out, and the zip is finished.
  const cap = () => {
    const doneHere = pending.done.length;
    job.leftOut += ctx.store.remaining('item') + ctx.store.remaining('image') - doneHere;
    job.phase = 'finishing';
  };

  // At least one row a chunk that did no listing, however slow, so an export always moves on.
  let first = !listed;
  while ((first || inBudget()) && (job.phase === 'items' || job.phase === 'images')) {
    first = false;
    const row = ctx.store.next(job.phase === 'items' ? 'item' : 'image', lastSeq);
    if (!row) {
      job.phase = job.phase === 'items' && job.imagesTotal > 0 ? 'images' : 'finishing';
      lastSeq = 0;
      continue;
    }
    lastSeq = row.seq;
    const made = row.kind === 'item' ? await itemFiles(ctx, job, row) : await imageFiles(ctx, row);
    if (!fits(made.files)) {
      cap();
      break;
    }
    await append(made.files);
    pending.done.push(row.seq);
    pending.comments.push(...made.comments);
    pending.problems.push(...made.problems);
    if (row.kind === 'item') job.itemsDone += 1;
    else job.imagesDone += 1;
  }

  if (job.phase === 'finishing') return finish(ctx, job, writer, upload, pending);

  job.bytes = writer.offset;
  job.nextPart = writer.nextPart;
  job.failures = 0;
  job.problems += pending.problems.length;
  const tail = writer.tail();
  ctx.transaction(() => {
    ctx.store.addEntries(pending.entries);
    ctx.store.markDone(pending.done);
    ctx.store.addComments(pending.comments);
    ctx.store.addProblems(pending.problems);
    ctx.store.addParts(writer.uploaded);
    ctx.store.saveTail(tail);
    ctx.store.save(job);
  });
  ctx.log('chunk', {
    id: job.id,
    phase: job.phase,
    itemsDone: job.itemsDone,
    imagesDone: job.imagesDone,
    bytes: job.bytes,
  });
  return { alarmAt: ctx.now() };
}

// One index page into the queue, up to the item cap; past it, items are only counted as left out. The last page
// moves on to the images (a person's) and then the items.
async function listStep(ctx: RunContext, job: Job): Promise<void> {
  const page = await ctx.sources.listItems(job.scope, job.requestedBy, job.cursor);
  const room = Math.max(0, EXPORT_MAX_ITEMS - job.itemsTotal);
  const taken = page.items.slice(0, room);
  job.leftOut += page.items.length - taken.length;
  job.itemsTotal += taken.length;
  job.cursor = page.nextCursor;
  const rows: Omit<QueueRow, 'seq'>[] = taken.map((item) => ({
    kind: 'item',
    app: item.app,
    ref: item.id,
    name: item.name,
    updatedAt: item.updatedAt,
    contentType: null,
  }));
  if (page.nextCursor === null) {
    if (job.scope.kind === 'personal') {
      const images = await ctx.sources.listImages(job.scope.personId);
      job.imagesTotal = images.length;
      for (const image of images) {
        rows.push({
          kind: 'image',
          app: null,
          ref: image.id,
          name: image.originalName ?? '',
          updatedAt: image.createdAt,
          contentType: image.contentType,
        });
      }
    }
    job.phase = 'items';
  }
  ctx.transaction(() => {
    ctx.store.enqueue(rows);
    ctx.store.save(job);
  });
}

type Made = { files: ZipFile[]; comments: CommentRow[]; problems: Problem[] };

// A door call tried twice: a blip at the app is not an item left out.
async function twice<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch {
    return call();
  }
}

// An item's files: its whole file, a picture of each tab, its CSV (liveplanner) and its comments. An item gone since
// the list adds nothing; one whose file the app can't answer is named in the README.
async function itemFiles(ctx: RunContext, job: Job, row: QueueRow): Promise<Made> {
  const app = row.app!;
  const doors = ctx.sources.doors;
  const made: Made = { files: [], comments: [], problems: [] };
  let file: { body: string } | null;
  try {
    file = await twice(() => doors.exportFile(app, row.ref));
  } catch {
    made.problems.push({ app, name: row.name || row.ref, reason: 'its file could not be read' });
    return made;
  }
  if (!file) return made;
  const folder = itemFolder(app, row.name, row.ref);
  const at = row.updatedAt;
  made.files.push(
    await zipFile(
      `${folder}/${safeName(row.name)}.${APP_EXTENSION[app]}`,
      encoder.encode(file.body),
      { at },
    ),
  );

  const tabs = tabsOfEnvelope(file.body).slice(0, EXPORT_TAB_PICTURES_MAX);
  const names = pictureNames(tabs);
  for (const [i, tab] of tabs.entries()) {
    const png = await doors
      .exportSvg(app, row.ref, tab.id)
      .then((svg) => (svg ? ctx.rasterise(svg) : null))
      .catch(() => null);
    if (png) made.files.push(await zipFile(`${folder}/${names[i]}`, png, { store: true, at }));
  }

  if (app === 'liveplanner') {
    const tables = await twice(() => doors.exportTables(app, row.ref)).catch(() => {
      made.problems.push({
        app,
        name: row.name || row.ref,
        reason: 'its boards and sheets could not be read',
      });
      return null;
    });
    const csvNames = uniqueNames(
      (tables ?? []).map((t) => safeName(t.name, t.kind === 'board' ? 'Board' : 'Sheet')),
    );
    for (const [i, table] of (tables ?? []).entries()) {
      made.files.push(
        await zipFile(`${folder}/${csvNames[i]}.csv`, encoder.encode(table.csv), { at }),
      );
    }
  }

  const threads: ExportThread[] | null = await twice(() =>
    doors.exportComments(app, row.ref),
  ).catch(() => {
    made.problems.push({
      app,
      name: row.name || row.ref,
      reason: 'its comments could not be read',
    });
    return null;
  });
  const onlyBy = job.scope.kind === 'personal' ? job.scope.personId : null;
  made.comments = commentRows({ app, id: row.ref, name: row.name }, threads ?? [], onlyBy);
  return made;
}

const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
};

/** An image's file name: its id, then the name it was uploaded with, with its type's extension. */
export function imageName(row: Pick<QueueRow, 'ref' | 'name' | 'contentType'>): string {
  const ext = IMAGE_EXTENSIONS[row.contentType ?? ''] ?? 'bin';
  const base = safeName(row.name.replace(/\.[A-Za-z0-9]{1,5}$/, ''), 'image');
  return `images/${safeName(row.ref, 'image')} ${base}.${ext}`;
}

async function imageFiles(ctx: RunContext, row: QueueRow): Promise<Made> {
  const bytes = await ctx.sources.imageBytes(row.ref);
  if (!bytes) return { files: [], comments: [], problems: [] };
  // Stored as uploaded: an image is already compressed.
  return {
    files: [await zipFile(imageName(row), bytes, { store: true, at: row.updatedAt })],
    comments: [],
    problems: [],
  };
}

// ---------- Finishing -------------------------------------------------------------------------------------------

async function finish(
  ctx: RunContext,
  job: Job,
  writer: PartWriter,
  upload: ReturnType<ExportBucket['resumeMultipartUpload']>,
  pending: Pending,
): Promise<{ alarmAt: number | null }> {
  const now = ctx.now();
  const comments = [...ctx.store.comments(), ...pending.comments];
  const problems = [...ctx.store.problems(), ...pending.problems];
  const scope = job.scope;
  const own: ZipFile[] = [
    await zipFile(
      'README.txt',
      encoder.encode(
        readme({
          kind: scope.kind,
          teamName: scope.kind === 'team' ? scope.teamName : null,
          madeAt: now,
          items: job.itemsDone,
          images: job.imagesDone,
          comments: comments.length,
          leftOut: job.leftOut,
          problems,
        }),
      ),
      { at: now },
    ),
    scope.kind === 'personal'
      ? await zipFile('profile.json', encoder.encode(JSON.stringify(job.profile ?? {}, null, 2)), {
          at: now,
        })
      : await zipFile(
          'team.json',
          encoder.encode(JSON.stringify({ id: scope.teamId, name: scope.teamName }, null, 2)),
          {
            at: now,
          },
        ),
    await zipFile('comments.json', encoder.encode(commentsJson(comments)), { at: now }),
    await zipFile('comments.csv', encoder.encode(commentsCsv(comments)), { at: now }),
  ];
  for (const file of own) {
    pending.entries.push({ ...file.entry, offset: writer.offset });
    await writer.append(file.bytes);
  }
  const entries = [...ctx.store.entries(), ...pending.entries];
  const directoryOffset = writer.offset;
  const directory = entries.map(centralHeader);
  const directorySize = directory.reduce((n, d) => n + d.length, 0);
  await writer.append([...directory, endRecord(entries.length, directorySize, directoryOffset)]);
  await writer.finish();
  await upload.complete([...ctx.store.parts(), ...writer.uploaded]);

  job.status = 'ready';
  job.phase = null;
  job.bytes = writer.offset;
  job.nextPart = writer.nextPart;
  job.finishedAt = now;
  job.expiresAt = now + EXPORT_LINK_TTL_MS;
  job.failures = 0;
  job.problems = problems.length;
  job.notifyPending = true;
  ctx.transaction(() => {
    ctx.store.clearWork();
    ctx.store.save(job);
  });
  ctx.log('ready', {
    id: job.id,
    kind: scope.kind,
    items: job.itemsDone,
    images: job.imagesDone,
    comments: comments.length,
    bytes: job.bytes,
    leftOut: job.leftOut,
    problems: job.problems,
  });
  const retryAt = await notify(ctx, job);
  return { alarmAt: retryAt ?? job.expiresAt };
}

async function fail(ctx: RunContext, job: Job): Promise<{ alarmAt: number | null }> {
  if (job.uploadId) {
    await ctx.bucket
      .resumeMultipartUpload(objectKey(job.key, job.id), job.uploadId)
      .abort()
      .catch(() => {});
  }
  job.status = 'failed';
  job.phase = null;
  job.finishedAt = ctx.now();
  job.notifyPending = true;
  ctx.transaction(() => {
    ctx.store.clearWork();
    ctx.store.save(job);
  });
  ctx.log('failed', { id: job.id, kind: job.scope.kind });
  return { alarmAt: await notify(ctx, job) };
}

// Tells accounts the export finished, for the email. Answers when to try again, or null when it is done (or given
// up on after NOTIFY_TRIES_MAX tries, counted in `failures` once the export has stopped).
async function notify(ctx: RunContext, job: Job): Promise<number | null> {
  try {
    await ctx.sources.ready({
      key: job.key,
      exportId: job.id,
      requestedBy: job.requestedBy,
      status: job.status === 'ready' ? 'ready' : 'failed',
      bytes: job.bytes,
      expiresAt: job.expiresAt,
      teamName: job.scope.kind === 'team' ? job.scope.teamName : null,
    });
    job.notifyPending = false;
    ctx.store.save(job);
    return null;
  } catch (err) {
    job.failures += 1;
    if (job.failures >= NOTIFY_TRIES_MAX) job.notifyPending = false;
    ctx.store.save(job);
    ctx.log('notify failed', { id: job.id, tries: job.failures, error: String(err) });
    return job.notifyPending ? ctx.now() + NOTIFY_RETRY_MS : null;
  }
}

// A ready export: the email if it hasn't gone, and once the link lapses, the file deleted.
async function settleReady(ctx: RunContext, job: Job): Promise<{ alarmAt: number | null }> {
  const expiresAt = job.expiresAt!;
  if (ctx.now() >= expiresAt) {
    await ctx.bucket.delete(objectKey(job.key, job.id));
    job.status = 'expired';
    job.notifyPending = false;
    ctx.store.save(job);
    ctx.log('expired', { id: job.id });
    return { alarmAt: null };
  }
  const retryAt = job.notifyPending ? await notify(ctx, job) : null;
  return { alarmAt: retryAt === null ? expiresAt : Math.min(retryAt, expiresAt) };
}
