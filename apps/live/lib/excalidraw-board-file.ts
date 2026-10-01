// Excalidraw files as boards of their own (docs/specs/020-import-export/excalidraw-import-export.md
// "Import as new documents"): each picked file is read into a board scene named and dated after
// the file, ready for the shared new-document target (importBoardsAsDocuments).

import type { BoardScene } from './board-scene/scene';
import { readExcalidrawFile, type ExcalidrawFileRead } from './excalidraw-read';

/** An untitled board's name; its date follows when Excalidraw's default name gives one. */
export const EXCALIDRAW_BOARD_NAME = 'Excalidraw board';
export const EXCALIDRAW_NOT_A_SCENE = "This file isn't an Excalidraw scene.";
const UNREADABLE_FILE = "This file couldn't be read.";

/** Excalidraw's default file name: `Untitled-${getDateTime()}`, its local save moment. */
export const EXCALIDRAW_UNTITLED_NAME = /^Untitled-(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})$/;

// Longest first, so `.excalidraw.png` is not read as `.png`.
const EXTENSIONS = ['.excalidraw.png', '.excalidraw.svg', '.excalidraw', '.png', '.svg', '.json'];

const DATE_FORMAT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

export type ExcalidrawFileIdentity = { title: string; createdAt?: string; modifiedAt?: string };

function stripExtension(name: string): string {
  const lower = name.toLowerCase();
  const ext = EXTENSIONS.find((e) => lower.endsWith(e));
  return (ext ? name.slice(0, -ext.length) : name).trim();
}

/** The local moment in Excalidraw's default name, when it names a real one. */
function untitledMoment(stem: string): Date | null {
  const m = EXCALIDRAW_UNTITLED_NAME.exec(stem);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number) as [number, number, number, number, number];
  const at = new Date(y, mo - 1, d, h, mi);
  const real =
    at.getFullYear() === y &&
    at.getMonth() === mo - 1 &&
    at.getDate() === d &&
    at.getHours() === h &&
    at.getMinutes() === mi;
  return real ? at : null;
}

/** A file's board name and dates (ISO 8601): from Excalidraw's default name, else the file. */
export function excalidrawFileIdentity(name: string, lastModified: number): ExcalidrawFileIdentity {
  const stem = stripExtension(name);
  const fileDate =
    Number.isFinite(lastModified) && lastModified > 0
      ? new Date(lastModified).toISOString()
      : undefined;
  const moment = untitledMoment(stem);
  if (moment) {
    return {
      title: `${EXCALIDRAW_BOARD_NAME}, ${DATE_FORMAT.format(moment)}`,
      createdAt: moment.toISOString(),
      ...(fileDate ? { modifiedAt: fileDate } : {}),
    };
  }
  return {
    title: stem || EXCALIDRAW_BOARD_NAME,
    ...(fileDate ? { createdAt: fileDate, modifiedAt: fileDate } : {}),
  };
}

export type ExcalidrawBoardFiles = {
  scenes: BoardScene[];
  failures: { title: string; message: string }[];
};

/** Every picked file as a named, dated board scene, in pick order; unreadable files listed. */
export async function readExcalidrawBoardFiles(
  files: readonly File[],
): Promise<ExcalidrawBoardFiles> {
  const out: ExcalidrawBoardFiles = { scenes: [], failures: [] };
  for (const file of files) {
    const identity = excalidrawFileIdentity(file.name, file.lastModified);
    let read: ExcalidrawFileRead;
    try {
      read = await readExcalidrawFile(file);
    } catch (error) {
      console.warn('[excalidraw-import] file unreadable', { error: String(error) });
      out.failures.push({ title: identity.title, message: UNREADABLE_FILE });
      continue;
    }
    if (read.kind === 'scene') {
      out.scenes.push({ ...read.scene, ...identity, sourceId: `excalidraw:${file.name}` });
    } else {
      out.failures.push({
        title: identity.title,
        message: read.kind === 'error' ? read.error : EXCALIDRAW_NOT_A_SCENE,
      });
    }
  }
  console.info('[excalidraw-import] files', {
    files: files.length,
    boards: out.scenes.length,
    failures: out.failures.length,
  });
  return out;
}
