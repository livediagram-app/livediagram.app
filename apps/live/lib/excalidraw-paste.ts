// Excalidraw content out of a paste or a drop (docs/specs/020-import-export/excalidraw-import-export.md
// "Paste"). Excalidraw's copy puts its envelope on the clipboard as its own MIME type and as plain
// text; a file arrives as `.excalidraw` JSON or as a PNG / SVG export that may embed the scene.
// Detection lives here so useClipboard keeps one small branch.

import type { BoardScene } from './board-scene/scene';
import { extractExcalidrawScene, NO_SCENE, type ExcalidrawContainer } from './excalidraw-embedded';
import { looksLikeExcalidraw, readExcalidrawEnvelope } from './excalidraw-envelope';
import { excalidrawToBoardScene } from './excalidraw-scene';

/** Excalidraw `MIME_TYPES.excalidrawClipboard`: its copy's own clipboard type. */
export const EXCALIDRAW_CLIPBOARD_MIME = 'application/vnd.excalidraw.clipboard+json';
/** Excalidraw `MIME_TYPES.excalidraw`: a saved scene's type. */
export const EXCALIDRAW_FILE_MIME = 'application/vnd.excalidraw+json';

const IMAGE_TYPES = new Set(['image/png', 'image/svg+xml']);

/** The Excalidraw text on a paste: its own type first, then plain text; null when there is none. */
export function excalidrawTextFromPaste(data: Pick<DataTransfer, 'getData'> | null): string | null {
  if (!data) return null;
  for (const type of [EXCALIDRAW_CLIPBOARD_MIME, 'text/plain']) {
    let text: string;
    try {
      text = data.getData(type);
    } catch {
      continue;
    }
    if (text && looksLikeExcalidraw(text)) return text;
  }
  return null;
}

export type ExcalidrawSceneRead = { ok: true; scene: BoardScene } | { ok: false; error: string };

/** An Excalidraw text read into a board scene, or the rejection's message. */
export function sceneFromExcalidrawText(text: string): ExcalidrawSceneRead {
  const read = readExcalidrawEnvelope(text);
  if (!read.ok) {
    console.warn('[excalidraw-paste] rejected', read.rejection);
    return { ok: false, error: read.error };
  }
  return { ok: true, scene: excalidrawToBoardScene(read.envelope) };
}

/** A file worth opening for a scene: `.excalidraw`, its MIME type, or a PNG / SVG export. */
export function isExcalidrawFileCandidate(file: Pick<File, 'name' | 'type'>): boolean {
  return (
    file.name.toLowerCase().endsWith('.excalidraw') ||
    file.type === EXCALIDRAW_FILE_MIME ||
    IMAGE_TYPES.has(file.type)
  );
}

export type ExcalidrawFileRead =
  | { kind: 'scene'; scene: BoardScene; container: ExcalidrawContainer }
  | { kind: 'not-excalidraw' }
  | { kind: 'error'; error: string };

/**
 * A pasted or dropped file's scene. A PNG or SVG without one is `not-excalidraw`: the caller goes
 * on with its ordinary image paste or drop.
 */
export async function readExcalidrawFile(file: File): Promise<ExcalidrawFileRead> {
  const extracted = await extractExcalidrawScene(new Uint8Array(await file.arrayBuffer()));
  if (!extracted.ok) {
    return extracted.error === NO_SCENE
      ? { kind: 'not-excalidraw' }
      : { kind: 'error', error: extracted.error };
  }
  const read = sceneFromExcalidrawText(extracted.text);
  return read.ok
    ? { kind: 'scene', scene: read.scene, container: extracted.container }
    : { kind: 'error', error: read.error };
}
