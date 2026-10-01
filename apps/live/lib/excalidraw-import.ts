// The Import dialog's Excalidraw converter (docs/specs/020-import-export/excalidraw-import-export.md):
// a `.excalidraw` scene (or a clipboard copy pasted into the panel) read, turned into a board
// scene by the one Excalidraw parser, and landed for the tab's profile at the tab's own
// coordinates. Lazy-loaded by useTabImport. Never throws: bad input is a message.
//
// Ids are minted fresh by the landing (with a map so arrow bindings follow), so the caller needs
// no remint step and imported elements cannot collide with anything already on the document.

import type { BackgroundPattern, Element } from '@livediagram/document';
import { landBoardScene, type BoardSceneProfile } from './board-scene/land';
import type { BoardSceneReport } from './board-scene/report';
import { readExcalidrawEnvelope } from './excalidraw-envelope';
import { excalidrawToBoardScene } from './excalidraw-scene';
import type { ImportImageRequest } from './import-images';

export type ExcalidrawImportResult =
  | {
      ok: true;
      elements: Element[];
      // One per image element, for the import image pipeline
      // (docs/specs/020-import-export/import-image-pipeline.md); the elements arrive as placeholders.
      images: ImportImageRequest[];
      report: BoardSceneReport;
      // The tab's background: a colour on the diagram profile, a pattern on a whiteboard.
      backgroundColor?: string;
      backgroundPattern?: BackgroundPattern;
    }
  | { ok: false; error: string };

export function buildElementsFromExcalidraw(
  text: string,
  profile: BoardSceneProfile,
  mintId: () => string = () => crypto.randomUUID(),
): ExcalidrawImportResult {
  const read = readExcalidrawEnvelope(text);
  if (!read.ok) return { ok: false, error: read.error };
  const scene = excalidrawToBoardScene(read.envelope);
  const landed = landBoardScene(scene, { profile, placement: { kind: 'origin' }, mintId });
  if (!landed.ok) return { ok: false, error: landed.message };
  const { backgroundColor } = landed.tabPatch;
  // A replace keeps the receiving board's pattern unless the scene names one.
  const backgroundPattern = scene.background?.pattern
    ? landed.tabPatch.backgroundPattern
    : undefined;
  return {
    ok: true,
    elements: landed.elements,
    images: landed.imageRequests,
    report: landed.report,
    ...(backgroundColor ? { backgroundColor } : {}),
    ...(backgroundPattern ? { backgroundPattern } : {}),
  };
}
