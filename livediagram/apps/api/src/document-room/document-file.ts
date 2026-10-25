// The canvas as its Google Drive file (liveworkspace/docs/drive.md "The file", "Contracts > The apps";
// docs/specs/015-api/api.md "Internal"): the `livediagram.document` envelope the CLI exports, every tab with its
// per-document folder, and the slide deck. The export runs inside the canvas's Durable Object, from the same tab read
// a copy makes (document-content.ts readContentTabRows), stamped with the canvas's last save so unchanged content is
// byte-identical. The import's file is read in the worker (readDocumentFile: parsed, fresh ids, limits) and written
// inside the new canvas's object (importDocumentFile) as a copy lands, then started as its owner's.

import {
  capElementActions,
  copyDocumentEnvelope,
  documentToEnvelopeText,
  drawnCount,
  isValidTab,
  migrateIncomingTab,
  migrateStoredTab,
  parseDocumentEnvelope,
  type EnvelopeTab,
  type Tab,
} from '@livediagram/document';
import { APP_FILE_FORMATS } from '@liveworkspace/drive/formats';
import type { ExportResult } from '@liveworkspace/index-app';
import { MAX_DECK_LEN, MAX_TAB_BYTES, byteLength, logTabRefused } from '../limits';
import { capStoredName } from '../names';
import type { DocumentEnv } from '../types';
import {
  importDocumentCopy,
  initDocument,
  readContentTabRows,
  readDocumentHead,
  type ContentTabRow,
  type DocumentCopy,
} from './document-content';

export const DOCUMENT_FILE_FORMAT = APP_FILE_FORMATS.livediagram;

// ---------- Export ------------------------------------------------------------------------------------------------

// One stored tab as the envelope carries it: its body as every tab read migrates it, its id and name, and its folder
// when it is in one. The row's own bookkeeping (revision, order, save time) stays behind: the order is the array's.
function envelopeTabOf(row: ContentTabRow): EnvelopeTab {
  const body = migrateStoredTab(JSON.parse(row.data) as Omit<Tab, 'id' | 'name'>) as Omit<
    Tab,
    'id' | 'name'
  > & { folder?: unknown };
  const { folder: _stale, ...rest } = body;
  return { ...rest, id: row.id, name: row.name, ...(row.folder ? { folder: row.folder } : {}) };
}

// The file, or `unchanged` when the caller already holds this last save, or `not_found` for a canvas not started.
export async function exportDocumentFile(
  env: DocumentEnv,
  documentId: string,
  ifVersion: number | null,
): Promise<ExportResult> {
  const { meta, savedAt, presentation } = await readDocumentHead(env, documentId);
  if (!meta) return { status: 'not_found' };
  if (ifVersion === savedAt) return { status: 'unchanged', version: savedAt };
  const tabs = (await readContentTabRows(env, documentId, null)).map(envelopeTabOf);
  return {
    status: 'ok',
    body: documentToEnvelopeText({ id: documentId, name: meta.name, presentation }, tabs, savedAt),
    contentType: DOCUMENT_FILE_FORMAT.mimeType,
    version: savedAt,
  };
}

// ---------- Import ------------------------------------------------------------------------------------------------

// What a new canvas is made of: its deck and its tabs as a copy carries them (fresh ids, links re-pointed). No
// placement grants travel: the file names images, it holds no right to serve them.
export type DocumentFileContent = { presentation: string | null; copy: DocumentCopy };

export type DocumentFileRead =
  { ok: true; content: DocumentFileContent } | { ok: false; failure: 'invalid_file' | 'too_large' };

// The fields a tab read adds beside the body (tab-row.ts rowToTab), which a file the CLI wrote carries; the body
// is stored without them.
const ROW_FIELDS = ['documentId', 'orderIndex', 'updatedAt', 'rev', 'folder'] as const;

// Read a file's text as a new canvas's content: another kind, an unreadable envelope or a malformed tab is
// `invalid_file`; a tab past the tab cap, or a deck past its cap, `too_large` (docs/specs/015-api/api.md "Tab size").
export function readDocumentFile(text: string): DocumentFileRead {
  const parsed = parseDocumentEnvelope(text);
  if (!parsed.ok) return { ok: false, failure: 'invalid_file' };
  const { tabs, presentation } = copyDocumentEnvelope(parsed.envelope);
  if (presentation !== null && presentation.length > MAX_DECK_LEN) {
    return { ok: false, failure: 'too_large' };
  }
  const copied: DocumentCopy['tabs'] = [];
  for (const [index, incoming] of tabs.entries()) {
    const tab = migrateIncomingTab(incoming);
    if (!isValidTab(tab)) return { ok: false, failure: 'invalid_file' };
    const folder = typeof incoming.folder === 'string' ? incoming.folder.trim() || null : null;
    const body: Record<string, unknown> = { ...tab, elements: capElementActions(tab.elements) };
    const { id, name } = tab;
    delete body.id;
    delete body.name;
    for (const field of ROW_FIELDS) delete body[field];
    const data = JSON.stringify(body);
    const bytes = byteLength(data);
    if (bytes > MAX_TAB_BYTES) {
      logTabRefused('drive-import', id, bytes);
      return { ok: false, failure: 'too_large' };
    }
    copied.push({
      id,
      name: capStoredName(name, null, 'tab') || 'Untitled',
      orderIndex: index,
      folder,
      data,
      elementCount: drawnCount(tab),
    });
  }
  return { ok: true, content: { presentation, copy: { tabs: copied, images: [] } } };
}

export type DocumentFileImport = DocumentFileContent & { name: string; ownerId: string };

// Inside the new canvas's object: its tabs land as a copy's do (one transaction, refused when the canvas already
// holds content), then its row is started as its owner's, with its name and deck.
export async function importDocumentFile(
  env: DocumentEnv,
  documentId: string,
  file: DocumentFileImport,
  now = Date.now(),
): Promise<void> {
  await importDocumentCopy(env, documentId, file.copy, now);
  await initDocument(env, documentId, {
    name: file.name,
    ownerId: file.ownerId,
    teamId: null,
    source: null,
    savedAt: now,
    createdAt: now,
    presentation: file.presentation,
  });
}
