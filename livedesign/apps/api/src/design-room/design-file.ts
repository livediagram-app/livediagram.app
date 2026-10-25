// The design as its Google Drive file (liveworkspace/docs/drive.md "The file", "Contracts > The apps";
// docs/specs/015-api/api.md "Internal"): the `livedesign.design` envelope the CLI's pull files write, every tab with
// its per-design folder, and the slide deck. The export runs inside the design's Durable Object, from the same tab
// read a copy makes (design-content.ts readContentTabRows), stamped with the design's last save so unchanged content
// is byte-identical. The import's file is read in the worker (readDesignFile: parsed, fresh ids, limits) and written
// inside the new design's object (importDesignFile) as a copy lands, then started as its owner's.

import {
  capElementActions,
  copyDesignEnvelope,
  designToEnvelopeText,
  drawnCount,
  isValidTab,
  migrateIncomingTab,
  migrateStoredTab,
  parseDesignEnvelope,
  type EnvelopeTab,
  type Tab,
} from '@livedesign/design';
import { APP_FILE_FORMATS } from '@liveworkspace/drive/formats';
import type { ExportResult } from '@liveworkspace/index-app';
import { MAX_DECK_LEN, MAX_TAB_BYTES, byteLength, logTabRefused } from '../limits';
import { capStoredName } from '../names';
import type { DesignEnv } from '../types';
import {
  importDesignCopy,
  initDesign,
  readContentTabRows,
  readDesignHead,
  type ContentTabRow,
  type DesignCopy,
} from './design-content';

export const DESIGN_FILE_FORMAT = APP_FILE_FORMATS.livedesign;

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

// The file, or `unchanged` when the caller already holds this last save, or `not_found` for a design not started.
export async function exportDesignFile(
  env: DesignEnv,
  designId: string,
  ifVersion: number | null,
): Promise<ExportResult> {
  const { meta, savedAt, presentation } = await readDesignHead(env, designId);
  if (!meta) return { status: 'not_found' };
  if (ifVersion === savedAt) return { status: 'unchanged', version: savedAt };
  const tabs = (await readContentTabRows(env, designId, null)).map(envelopeTabOf);
  return {
    status: 'ok',
    body: designToEnvelopeText({ id: designId, name: meta.name, presentation }, tabs, savedAt),
    contentType: DESIGN_FILE_FORMAT.mimeType,
    version: savedAt,
  };
}

// ---------- Import ------------------------------------------------------------------------------------------------

// What a new design is made of: its tabs and deck as a copy carries them (fresh ids, links re-pointed). No placement
// grants, image owners or photo blobs travel: the file names images, it holds no right to serve them.
export type DesignFileContent = { copy: DesignCopy };

export type DesignFileRead =
  { ok: true; content: DesignFileContent } | { ok: false; failure: 'invalid_file' | 'too_large' };

// The fields a tab read adds beside the body (tab-row.ts rowToTab), which a file the CLI wrote carries; the body is
// stored without them.
const ROW_FIELDS = ['designId', 'orderIndex', 'updatedAt', 'rev', 'folder'] as const;

// Read a file's text as a new design's content: another kind, an unreadable envelope or a malformed tab is
// `invalid_file`; a tab past the tab cap, or a deck past its cap, `too_large` (docs/specs/015-api/api.md "Tab size").
export function readDesignFile(text: string): DesignFileRead {
  const parsed = parseDesignEnvelope(text);
  if (!parsed.ok) return { ok: false, failure: 'invalid_file' };
  const { tabs, presentation } = copyDesignEnvelope(parsed.envelope);
  if (presentation !== null && presentation.length > MAX_DECK_LEN) {
    return { ok: false, failure: 'too_large' };
  }
  const copied: DesignCopy['tabs'] = [];
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
  return {
    ok: true,
    content: {
      copy: {
        presentation,
        opensIn: null,
        tabKind: null,
        tabs: copied,
        grants: [],
        owners: [],
        blobs: [],
      },
    },
  };
}

export type DesignFileImport = DesignFileContent & { name: string; ownerId: string };

// Inside the new design's object: its tabs and deck land as a copy's do (one transaction, refused when the design
// already holds content), then its row is started as its owner's, with its name.
export async function importDesignFile(
  env: DesignEnv,
  designId: string,
  file: DesignFileImport,
  now = Date.now(),
): Promise<void> {
  await importDesignCopy(env, designId, file.copy, now);
  await initDesign(env, designId, {
    name: file.name,
    ownerId: file.ownerId,
    teamId: null,
    source: null,
    opensIn: null,
    tabKind: null,
    savedAt: now,
    createdAt: now,
  });
}
