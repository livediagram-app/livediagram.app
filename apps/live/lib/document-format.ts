// What this page has heard of the server's document format number
// (docs/specs/016-platform/new-version-prompt.md). Fed by every api response's header (apiFetch) and
// the realtime room's `format` message; read by the new version prompt. Module state: one page, one
// server.
import { DOCUMENT_FORMAT, parseDocumentFormat } from '@livediagram/api-schema';

let highest: number | null = null;
const listeners = new Set<() => void>();

/** Records a number from the server; anything unparsable is ignored, and only a rise notifies. */
export function noteServerDocumentFormat(value: unknown): void {
  const format = parseDocumentFormat(value);
  if (format === null || (highest !== null && format <= highest)) return;
  highest = format;
  for (const listener of listeners) listener();
}

export function serverDocumentFormat(): number | null {
  return highest;
}

/** The server serves a document format newer than this editor was built for. */
export function newVersionAvailable(): boolean {
  return highest !== null && highest > DOCUMENT_FORMAT;
}

export function subscribeDocumentFormat(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function resetDocumentFormatForTests(): void {
  highest = null;
  listeners.clear();
}
