// Drive's "Open with" (docs/specs/022-drive-mirror/drive-mirror.md, "Open with";
// blueprint "Open with"). Google opens `/drive/open?state=...`; the browser
// reads the file's appProperties and decides: open the diagram, offer
// **Import a copy**, or say the file cannot be opened.

import {
  DRIVE_FILE_EXTENSION,
  DRIVE_FILE_MIME,
  DRIVE_PROP_DIAGRAM_ID,
  DRIVE_PROP_ORIGIN,
  isDriveFileId,
  stripDriveName,
} from '@livediagram/api-schema';
import { parseDiagramEnvelope } from '../export-diagram-text';
import { DriveApiError, type DriveClient } from './drive-client';
import type { LivediagramPort } from './livediagram-port';
import { driveLog, driveWarn } from './log';

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

export type OpenWithOutcome =
  | { kind: 'open'; diagramId: string }
  | { kind: 'import'; reason: 'no-access' | 'foreign' | 'no-id'; name: string }
  | { kind: 'error'; reason: 'unreadable' | 'not-livediagram' };

// The telemetry type of an outcome (docs/specs/022-drive-mirror/drive-mirror.md, "Telemetry").
export function openWithTelemetryType(
  outcome: OpenWithOutcome,
): 'Opened' | 'ImportOffered' | 'Error' {
  return outcome.kind === 'open' ? 'Opened' : outcome.kind === 'import' ? 'ImportOffered' : 'Error';
}

export async function resolveOpenWith(
  deps: { drive: DriveClient; port: Pick<LivediagramPort, 'canOpenDiagram'>; host: string },
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
  const diagramId = file.appProperties[DRIVE_PROP_DIAGRAM_ID];
  const ours =
    file.mimeType === DRIVE_FILE_MIME ||
    file.name.toLowerCase().endsWith(DRIVE_FILE_EXTENSION) ||
    !!diagramId;
  if (!ours) return { kind: 'error', reason: 'not-livediagram' };
  const name = stripDriveName(file.name) ?? 'Diagram';
  if (!diagramId) return { kind: 'import', reason: 'no-id', name };
  if (file.appProperties[DRIVE_PROP_ORIGIN] !== deps.host)
    return { kind: 'import', reason: 'foreign', name };
  if (await deps.port.canOpenDiagram(diagramId)) {
    driveLog('open-with', { outcome: 'open' });
    return { kind: 'open', diagramId };
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

// **Import a copy**: a new Personal Space diagram from the file's contents.
export async function importOpenWithCopy(
  deps: { drive: DriveClient; port: Pick<LivediagramPort, 'importDiagramCopy'> },
  state: OpenWithState,
): Promise<string> {
  const text = await deps.drive.download(state.fileId, state.resourceKey);
  const parsed = parseDiagramEnvelope(text);
  if (!parsed.ok) throw new OpenWithImportError(parsed.failure);
  const id = await deps.port.importDiagramCopy(parsed.envelope);
  driveLog('open-with-imported', { tabs: parsed.envelope.diagram.tabs.length });
  return id;
}
