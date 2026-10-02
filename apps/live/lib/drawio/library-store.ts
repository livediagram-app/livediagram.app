// Imported draw.io libraries made into shape libraries (docs/specs/013-workspace/shape-libraries.md
// "Making libraries"; blueprint "Behaviour and state" 1). Each library on its own: its pictures
// through the import image pipeline (into the owner's gallery, no document), its items given ids and
// titles within the limits, then one create. A refused library is listed and the next goes on.

import {
  MAX_SHAPE_LIBRARY_TITLE_CHARS,
  MAX_TAB_BYTES,
  shapeLibraryItemsBytes,
  type ShapeLibraryItem,
  type ShapeLibrarySource,
} from '@livediagram/api-schema';
import type { BoardImportProgress } from '@/hooks/persistence/useBoardSceneImport';
import type { BoardSceneReport } from '@/lib/board-scene/report';
import { browserImageSession, type CreateImageSession } from '@/lib/board-scene-browser';
import { addImageReports, addReports } from '@/lib/board-scene-import';
import { SHAPE_LIBRARY_TOO_LARGE } from '@/lib/api/shape-libraries';
import { attachImportImages, type ImportImageReport } from '@/lib/import-images';
import { track } from '@/lib/telemetry';
import type { DrawioLibraryFile } from './files';
import { attachDrawioImages } from './images';
import { drawioSceneReport } from './report';

/** The host's create (the provider's `createLibrary`). */
export type CreateShapeLibrary = (input: {
  name: string;
  source: ShapeLibrarySource;
  items: ShapeLibraryItem[];
}) => Promise<{ ok: true; library: { id: string; name: string } } | { ok: false; error: string }>;

export type ShapeLibrariesImported = {
  libraries: { id: string; name: string }[];
  failures: { title: string; message: string }[];
  scene?: BoardSceneReport;
  images?: ImportImageReport;
};

export async function importShapeLibraries(
  files: readonly DrawioLibraryFile[],
  o: {
    ownerId: string;
    createLibrary: CreateShapeLibrary;
    createImageSession?: CreateImageSession;
    onProgress?: (p: BoardImportProgress) => void;
    /** Where this run starts in a longer count (diagrams before it), and that count. */
    progressOffset?: number;
    progressTotal?: number;
  },
): Promise<ShapeLibrariesImported> {
  const out: ShapeLibrariesImported = { libraries: [], failures: [] };
  const offset = o.progressOffset ?? 0;
  const total = o.progressTotal ?? files.length;
  for (const [index, file] of files.entries()) {
    const board = offset + index + 1;
    o.onProgress?.({ board, boards: total, done: 0, total: 0 });
    const { pages: items, images } = await attachDrawioImages(
      file.items,
      file.images,
      async (elements, requests) => {
        const session = await (o.createImageSession ?? browserImageSession)({
          ownerId: o.ownerId,
          documentId: null,
        });
        return attachImportImages(elements, requests, session, (p) =>
          o.onProgress?.({ ...p, board, boards: total }),
        );
      },
    );
    const stored: ShapeLibraryItem[] = items.map((item) => ({
      id: crypto.randomUUID(),
      title: item.title.slice(0, MAX_SHAPE_LIBRARY_TITLE_CHARS),
      width: item.width,
      height: item.height,
      elements: item.elements,
    }));
    if (shapeLibraryItemsBytes(stored) > MAX_TAB_BYTES) {
      out.failures.push({ title: file.name, message: SHAPE_LIBRARY_TOO_LARGE });
      continue;
    }
    const made = await o.createLibrary({ name: file.name, source: 'drawio', items: stored });
    if (!made.ok) {
      out.failures.push({ title: file.name, message: made.error });
      continue;
    }
    out.libraries.push({ id: made.library.id, name: made.library.name });
    const scene = drawioSceneReport(file.report, items);
    out.scene = out.scene ? addReports(out.scene, scene) : scene;
    if (images) out.images = out.images ? addImageReports(out.images, images) : images;
    track('Element', 'Imported', 'ShapeLibrary');
    console.info('[drawio-import] library imported', {
      items: stored.length,
      images: file.images.length,
    });
  }
  return out;
}

/** An import's outcome with its libraries folded in: their links, landed totals, images, failures. */
export function withLibraries<
  O extends {
    scene?: BoardSceneReport;
    images?: ImportImageReport;
    failures?: { title: string; message: string }[];
  },
>(outcome: O, made: ShapeLibrariesImported): O & { libraries?: { id: string; name: string }[] } {
  const scene =
    outcome.scene && made.scene
      ? addReports(outcome.scene, made.scene)
      : (outcome.scene ?? made.scene);
  const images =
    outcome.images && made.images
      ? addImageReports(outcome.images, made.images)
      : (outcome.images ?? made.images);
  const failures = [...(outcome.failures ?? []), ...made.failures];
  return {
    ...outcome,
    ...(scene ? { scene } : {}),
    ...(images ? { images } : {}),
    ...(failures.length > 0 ? { failures } : {}),
    ...(made.libraries.length > 0 ? { libraries: made.libraries } : {}),
  };
}
