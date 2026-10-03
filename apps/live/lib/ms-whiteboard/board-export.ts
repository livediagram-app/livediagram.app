// Finding and reading board exports (docs/specs/020-import-export/whiteboard-import.md "The board
// export"): a board is a folder holding manifest.json, session.json and changes.json.

/** A Zip's or a folder's files by path ('/' separators), each read on demand. */
export type ExportFileSet = Map<string, () => Promise<Uint8Array>>;

export type BoardRef = { dir: string };

export type BoardRejection = 'board-unreadable';

export type BoardFiles = {
  dir: string;
  id?: string;
  title?: string;
  /** The board record's dates, as written (validated by board-identity.ts). */
  created?: string;
  modified?: string;
  treeInit: unknown;
  changes: unknown[];
  /** Image files by object id: the path in the file set. */
  objects: Map<string, string>;
};

// A single board file larger than this is refused unread (the largest real changes.json is
// about 2 MB; its sync frames, never read, are larger).
export const MAX_BOARD_JSON_BYTES = 64 * 1024 * 1024;

const REQUIRED = ['manifest.json', 'session.json', 'changes.json'] as const;

const dirOf = (path: string) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '');
const join = (dir: string, name: string) => (dir ? `${dir}/${name}` : name);

/** Every board folder in the set, sorted by path. */
export function findBoards(files: ExportFileSet): BoardRef[] {
  const names = new Map<string, Set<string>>();
  for (const path of files.keys()) {
    const dir = dirOf(path);
    const name = path.slice(dir ? dir.length + 1 : 0);
    if (!names.has(dir)) names.set(dir, new Set());
    names.get(dir)!.add(name);
  }
  return [...names]
    .filter(([, set]) => REQUIRED.every((n) => set.has(n)))
    .map(([dir]) => ({ dir }))
    .sort((a, b) => (a.dir < b.dir ? -1 : a.dir > b.dir ? 1 : 0));
}

type Rec = Record<string, unknown>;
const isRecord = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined);

async function readJson(files: ExportFileSet, path: string): Promise<unknown> {
  const read = files.get(path);
  if (!read) return undefined;
  const bytes = await read();
  if (bytes.length > MAX_BOARD_JSON_BYTES) throw new Error('board file too large');
  return JSON.parse(new TextDecoder().decode(bytes));
}

/** One board's files, parsed; a named rejection when they can't be read. */
export async function readBoardFiles(
  files: ExportFileSet,
  ref: BoardRef,
): Promise<{ ok: true; board: BoardFiles } | { ok: false; rejection: BoardRejection }> {
  const unreadable = { ok: false, rejection: 'board-unreadable' } as const;
  let manifest: unknown, session: unknown, changes: unknown, metadata: unknown;
  try {
    [manifest, session, changes] = await Promise.all(
      REQUIRED.map((n) => readJson(files, join(ref.dir, n))),
    );
    // The board record is optional: a damaged one costs only the title and date.
    metadata = await readJson(files, join(ref.dir, 'metadata.json')).catch(() => undefined);
  } catch {
    return unreadable;
  }
  if (!isRecord(manifest) || !isRecord(session) || !Array.isArray(changes)) return unreadable;
  if (!isRecord(session.treeInit)) return unreadable;
  const meta = isRecord(metadata) ? metadata : {};
  const objects = new Map<string, string>();
  if (Array.isArray(manifest.objects))
    for (const o of manifest.objects)
      if (
        isRecord(o) &&
        typeof o.id === 'string' &&
        typeof o.file === 'string' &&
        !o.file.includes('/')
      )
        objects.set(o.id, join(ref.dir, `objects/${o.file}`));
  const id = text(manifest.id) ?? text(session.id);
  const title = text(meta.title) ?? text(manifest.title);
  const created = text(meta.createdTime);
  const modified = text(meta.lastModifiedTime);
  return {
    ok: true,
    board: {
      dir: ref.dir,
      ...(id ? { id } : {}),
      ...(title ? { title } : {}),
      ...(created ? { created } : {}),
      ...(modified ? { modified } : {}),
      treeInit: session.treeInit,
      changes,
      objects,
    },
  };
}

/** An image's MIME type from its magic bytes, or null when it is not an image the board uses. */
export function sniffImageType(bytes: Uint8Array): string | null {
  const starts = (...sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (starts(0x89, 0x50, 0x4e, 0x47)) return 'image/png';
  if (starts(0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (starts(0x47, 0x49, 0x46, 0x38)) return 'image/gif';
  if (starts(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45) return 'image/webp';
  return null;
}
