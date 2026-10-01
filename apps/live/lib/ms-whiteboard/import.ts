// The card's two steps (docs/specs/020-import-export/whiteboard-import.md "Importing in the
// dialog"): list the boards a pick holds, then turn the chosen ones into board scenes.
import type { BoardScene } from '@/lib/board-scene/scene';
import {
  findBoards,
  readBoardFiles,
  sniffImageType,
  type BoardFiles,
  type ExportFileSet,
} from './board-export';
import { readBoard, type WbBoard } from './elements';
import { replayBoard, type ReplayedBoard } from './replay';
import { boardToScene, type BoardImage } from './to-scene';

export const UNTITLED_BOARD = 'Untitled board';

export type BoardSummary = {
  dir: string;
  title: string;
  /** ISO date of the last edit, when the board record has one. */
  modified?: string;
  elementCount: number;
  /** Decoded once while listing, reused by the import. */
  prepared: { files: BoardFiles; replayed: ReplayedBoard; board: WbBoard };
};

export type BoardFailure = { title: string; message: string };

export const MESSAGES = {
  noBoards: 'No Microsoft Whiteboard boards found. Pick a board folder or its .zip.',
  unreadable: "This board's files couldn't be read.",
} as const;

const label = (dir: string) => dir.split('/').pop() || dir;

/** Newest first, then by title (blueprint default M4). */
function byRecency(a: BoardSummary, b: BoardSummary): number {
  const ma = a.modified ?? '';
  const mb = b.modified ?? '';
  if (ma !== mb) return ma < mb ? 1 : -1;
  return a.title.localeCompare(b.title);
}

/** Every board in the pick, decoded; boards that can't be read are listed as failures. */
export async function listBoards(
  files: ExportFileSet,
): Promise<
  { ok: true; boards: BoardSummary[]; failures: BoardFailure[] } | { ok: false; error: string }
> {
  const refs = findBoards(files);
  console.info('[ms-whiteboard] boards found', { count: refs.length });
  if (refs.length === 0) return { ok: false, error: MESSAGES.noBoards };
  const boards: BoardSummary[] = [];
  const failures: BoardFailure[] = [];
  for (const ref of refs) {
    const read = await readBoardFiles(files, ref).catch(() => null);
    const replayed = read?.ok ? replayBoard(read.board.treeInit, read.board.changes) : null;
    if (!read?.ok || !replayed) {
      console.warn('[ms-whiteboard] board failed', {
        board: label(ref.dir),
        rejection: 'board-unreadable',
      });
      failures.push({ title: label(ref.dir), message: MESSAGES.unreadable });
      continue;
    }
    console.info('[ms-whiteboard] replayed', replayed.stats);
    const board = readBoard(replayed);
    boards.push({
      dir: ref.dir,
      title: read.board.title ?? UNTITLED_BOARD,
      ...(read.board.modified ? { modified: read.board.modified } : {}),
      elementCount: board.elements.length,
      prepared: { files: read.board, replayed, board },
    });
  }
  if (boards.length === 0 && failures.length === 0) return { ok: false, error: MESSAGES.noBoards };
  return { ok: true, boards: boards.sort(byRecency), failures };
}

/** A listed board as a scene, its images read from the pick. */
export async function boardSceneOf(
  files: ExportFileSet,
  summary: BoardSummary,
): Promise<BoardScene> {
  const { files: board, replayed, board: decoded } = summary.prepared;
  const images = new Map<string, BoardImage>();
  const wanted = new Set(replayed.imageObjects.values());
  for (const [objectId, path] of board.objects) {
    if (!wanted.has(objectId)) continue;
    const read = files.get(path);
    const bytes = read ? await read().catch(() => null) : null;
    const mimeType = bytes ? sniffImageType(bytes) : null;
    if (bytes && mimeType) images.set(objectId, { bytes, mimeType });
  }
  const scene = boardToScene({
    board: decoded,
    ...(summary.title !== UNTITLED_BOARD ? { title: summary.title } : {}),
    ...(board.id ? { sourceId: `microsoft-whiteboard:${board.id}` } : {}),
    imageObjects: replayed.imageObjects,
    images,
  });
  const kinds: Record<string, number> = {};
  for (const item of scene.items) kinds[item.kind] = (kinds[item.kind] ?? 0) + 1;
  console.info('[ms-whiteboard] scene', { items: kinds, notes: scene.notes });
  return scene;
}
