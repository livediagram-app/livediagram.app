// Drive's "Open with" (docs/specs/022-drive-mirror/drive-mirror.md, "Open with";
// blueprint "Open with"). Google opens `/drive/open?state=...`; the browser
// reads the file's appProperties and decides: open the document, offer
// **Import a copy** or, for a copy of a mirrored file, **Import as new
// document**, or say the file cannot be opened.

import {
  DRIVE_FILE_EXTENSION,
  DRIVE_FILE_MIME,
  DRIVE_PROP_DOCUMENT_ID,
  DRIVE_PROP_ORIGIN,
  isDriveFileId,
} from '@livediagram/api-schema';
import { parseDocumentEnvelope } from '../export-document-text';
import { DriveApiError, type DriveClient } from './drive-client';
import type { LivediagramPort } from './livediagram-port';
import { driveLog, driveWarn } from './log';
import { importAsNewDocument, type CopyPort } from './open-with-copy';

export type OpenWithState = { fileId: string; resourceKey?: string };

// Google's `state` query value: `{"ids":["ID"],"resourceKeys":{...},"action":"open",...}`.
// Untrusted: only a well-formed open of one Drive id is accepted.
export function parseOpenState(search: string): OpenWithState | null {
  const raw = new URLSearchParams(search).get('state');
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const s = parsed as { ids?: unknown; action?: unknown; resourceKeys?: unknown };
  if (s.action !== 'open' || !Array.isArray(s.ids) || !isDriveFileId(s.ids[0])) return null;
  const fileId = s.ids[0];
  const keys =
    s.resourceKeys && typeof s.resourceKeys === 'object'
      ? (s.resourceKeys as Record<string, unknown>)
      : {};
  const key = keys[fileId];
  return typeof key === 'string' && key ? { fileId, resourceKey: key } : { fileId };
}

export type OpenWithImportReason = 'no-access' | 'foreign' | 'no-id' | 'copy';

export type OpenWithOutcome =
  | { kind: 'open'; documentId: string }
  | { kind: 'import'; reason: OpenWithImportReason; name: string }
  | { kind: 'error'; reason: 'unreadable' | 'not-livediagram' };

// The telemetry type of an outcome (docs/specs/022-drive-mirror/drive-mirror.md, "Telemetry").
export function openWithTelemetryType(
  outcome: OpenWithOutcome,
): 'Opened' | 'ImportOffered' | 'Error' {
  return outcome.kind === 'open' ? 'Opened' : outcome.kind === 'import' ? 'ImportOffered' : 'Error';
}

export async function resolveOpenWith(
  deps: {
    drive: DriveClient;
    port: Pick<LivediagramPort, 'canOpenDocument' | 'listItems'>;
    host: string;
  },
  state: OpenWithState,
): Promise<OpenWithOutcome> {
  let file;
  try {
    file = await deps.drive.getFile(state.fileId, state.resourceKey);
  } catch (err) {
    driveWarn('open-with-unreadable', { status: err instanceof DriveApiError ? err.status : null });
    if (err instanceof DriveApiError && (err.isRateLimit || err.isAuth)) throw err;
    return { kind: 'error', reason: 'unreadable' };
  }
  const documentId = file.appProperties[DRIVE_PROP_DOCUMENT_ID];
  const ours =
    file.mimeType === DRIVE_FILE_MIME ||
    file.name.toLowerCase().endsWith(DRIVE_FILE_EXTENSION) ||
    !!documentId;
  if (!ours) return { kind: 'error', reason: 'not-livediagram' };
  const name = file.name.replace(/\.livediagram$/i, '') || 'Document';
  if (!documentId) return { kind: 'import', reason: 'no-id', name };
  if (file.appProperties[DRIVE_PROP_ORIGIN] !== deps.host)
    return { kind: 'import', reason: 'foreign', name };
  // A copy of a mirrored file: it carries the document's id, but the mirror
  // records another file for it (docs/specs/022-drive-mirror/drive-mirror.md, "Copies made in Drive").
  const recorded = (await deps.port.listItems()).find(
    (i) => i.kind === 'document' && i.ldId === documentId,
  );
  if (recorded && recorded.driveFileId !== state.fileId) {
    driveLog('open-with', { outcome: 'copy' });
    return { kind: 'import', reason: 'copy', name };
  }
  if (await deps.port.canOpenDocument(documentId)) {
    driveLog('open-with', { outcome: 'open' });
    return { kind: 'open', documentId };
  }
  return { kind: 'import', reason: 'no-access', name };
}

export class OpenWithImportError extends Error {
  readonly failure: string;
  constructor(failure: string) {
    super(`open with import: ${failure}`);
    this.name = 'OpenWithImportError';
    this.failure = failure;
  }
}

// **Import a copy** (or, for a copy of a mirrored file, **Import as new
// document**): a new document in My documents from the file's contents.
export async function importOpenWithCopy(
  deps: { drive: DriveClient; port: CopyPort; host: string },
  state: OpenWithState,
  reason: OpenWithImportReason,
): Promise<string> {
  const text = await deps.drive.download(state.fileId, state.resourceKey);
  const parsed = parseDocumentEnvelope(text);
  if (!parsed.ok) throw new OpenWithImportError(parsed.failure);
  if (reason === 'copy') {
    const file = await deps.drive.getFile(state.fileId, state.resourceKey);
    return importAsNewDocument(deps, file, parsed.envelope);
  }
  const id = await deps.port.importDocumentCopy(parsed.envelope);
  driveLog('open-with-imported', { tabs: parsed.envelope.document.tabs.length });
  return id;
}
