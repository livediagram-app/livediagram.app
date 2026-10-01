// Excalidraw content on a paste or a drop (docs/specs/020-import-export/excalidraw-import-export.md
// "Paste"). Excalidraw's copy puts its envelope on the clipboard as its own MIME type and as plain
// text; a file arrives as `.excalidraw` JSON or as a PNG / SVG export that may embed the scene.
// Recognising it lives here, small and synchronous; reading it is excalidraw-read.ts.

import { looksLikeExcalidraw } from './excalidraw-envelope';

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

/** A file worth opening for a scene: `.excalidraw`, its MIME type, or a PNG / SVG export. */
export function isExcalidrawFileCandidate(file: Pick<File, 'name' | 'type'>): boolean {
  return (
    file.name.toLowerCase().endsWith('.excalidraw') ||
    file.type === EXCALIDRAW_FILE_MIME ||
    IMAGE_TYPES.has(file.type)
  );
}
