// What one queued row adds to an export (steps.ts): an item's files (its envelope, each tab's pictures, its
// comments) or one image, each read tried twice before it counts as a problem.

import { EXPORT_TAB_PICTURES_MAX } from '@liveworkspace/data-export';
import type { ExportThread } from '@liveworkspace/index-app';
import {
  APP_EXTENSION,
  commentRows,
  itemFolder,
  pictureNames,
  safeName,
  tabsOfEnvelope,
  uniqueNames,
  type CommentRow,
} from '../files';
import { zipFile, type ZipFile } from '../zip/zip';
import { type Job, type Problem, type QueueRow } from './store';
import type { RunContext } from './steps';

const encoder = new TextEncoder();

// What the README says of an item whose app the service can't reach (its origin or key unset).
export const UNREACHABLE_REASON = 'its app is not part of downloads yet';

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
// the list adds nothing; one whose file the app can't answer is named in the README, and so is one whose app the
// service has no origin or key for (data-export.md "The apps"), without a request.
export async function itemFiles(ctx: RunContext, job: Job, row: QueueRow): Promise<Made> {
  const app = row.app!;
  const doors = ctx.sources.doors;
  const made: Made = { files: [], comments: [], problems: [] };
  if (!ctx.sources.reachable(app)) {
    made.problems.push({ app, name: row.name || row.ref, reason: UNREACHABLE_REASON });
    return made;
  }
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

export async function imageFiles(ctx: RunContext, row: QueueRow): Promise<Made> {
  const bytes = await ctx.sources.imageBytes(row.ref);
  if (!bytes) return { files: [], comments: [], problems: [] };
  // Stored as uploaded: an image is already compressed.
  return {
    files: [await zipFile(imageName(row), bytes, { store: true, at: row.updatedAt })],
    comments: [],
    problems: [],
  };
}
