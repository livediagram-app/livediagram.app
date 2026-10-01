// Reading Excalidraw text or a file into a board scene (docs/specs/020-import-export/excalidraw-import-export.md):
// the paste, the drop and the Import dialog all come through here. Lazy-loaded by its callers so
// the parser stays out of the editor's first bundle.

import type { BoardScene } from './board-scene/scene';
import { extractExcalidrawScene, NO_SCENE, type ExcalidrawContainer } from './excalidraw-embedded';
import { readExcalidrawEnvelope } from './excalidraw-envelope';
import { excalidrawToBoardScene } from './excalidraw-scene';

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
