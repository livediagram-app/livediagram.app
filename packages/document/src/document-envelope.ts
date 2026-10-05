// The whole-document envelope (docs/specs/022-drive-mirror/drive-mirror.md, "The file"):
// the contents of a `.livediagram` file in Google Drive, and what "Import a
// copy" reads back. The sibling of the per-tab `livediagram.tab` envelope in
// export-tab-text.ts: same shape (kind, schemaVersion, exportedAt), one
// document with every tab, each tab's per-document folder, and the slide deck.
// Images stay references to livediagram's image store; no bytes are embedded.

import type { Tab } from './index';
import type { Tab } from '@livediagram/document';
import type { Item } from '@livediagram/items';

export const DOCUMENT_ENVELOPE_KIND = 'livediagram.document';
export const DOCUMENT_SCHEMA_VERSION = 1;

export type EnvelopeTab = Tab & { folder?: string };

export type DocumentEnvelope = {
  kind: typeof DOCUMENT_ENVELOPE_KIND;
  schemaVersion: number;
  exportedAt: number;
  document: {
    id: string;
    name: string;
    presentation: string | null;
    tabs: EnvelopeTab[];
    // The item store (docs/specs/025-plan/items.md "Copies and exports"). Optional and additive,
    // so a file written before items, or read by a build before them, stays version 1.
    items?: Item[];
  };
};

export type DocumentEnvelopeFailure =
  'not_json' | 'wrong_kind' | 'unsupported_version' | 'malformed';

export function documentToEnvelopeText(
  liveDoc: { id: string; name: string; presentation: string | null },
  tabs: EnvelopeTab[],
  exportedAt: number,
  items: Item[] = [],
): string {
  const envelope: DocumentEnvelope = {
    kind: DOCUMENT_ENVELOPE_KIND,
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    exportedAt,
    document: {
      id: liveDoc.id,
      name: liveDoc.name,
      presentation: liveDoc.presentation,
      tabs,
      ...(items.length ? { items } : {}),
    },
  };
  return JSON.stringify(envelope, null, 2);
}

function isTab(value: unknown): value is EnvelopeTab {
  if (!value || typeof value !== 'object') return false;
  const t = value as Record<string, unknown>;
  return typeof t.id === 'string' && typeof t.name === 'string' && Array.isArray(t.elements);
}

function isItemLike(value: unknown): value is Item {
  if (!value || typeof value !== 'object') return false;
  const i = value as Record<string, unknown>;
  return (
    typeof i.id === 'string' &&
    typeof i.type === 'string' &&
    typeof i.key === 'number' &&
    typeof i.rank === 'string' &&
    !!i.fields &&
    typeof i.fields === 'object'
  );
}

export function parseDocumentEnvelope(
  text: string,
): { ok: true; envelope: DocumentEnvelope } | { ok: false; failure: DocumentEnvelopeFailure } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, failure: 'not_json' };
  }
  if (!raw || typeof raw !== 'object') return { ok: false, failure: 'malformed' };
  const r = raw as Record<string, unknown>;
  if (r.kind !== DOCUMENT_ENVELOPE_KIND) return { ok: false, failure: 'wrong_kind' };
  if (
    typeof r.schemaVersion !== 'number' ||
    r.schemaVersion > DOCUMENT_SCHEMA_VERSION ||
    r.schemaVersion < 1
  ) {
    return { ok: false, failure: 'unsupported_version' };
  }
  const d = r.document as Record<string, unknown> | undefined;
  if (
    !d ||
    typeof d.id !== 'string' ||
    typeof d.name !== 'string' ||
    !(
      d.presentation === null ||
      d.presentation === undefined ||
      typeof d.presentation === 'string'
    ) ||
    !Array.isArray(d.tabs) ||
    !d.tabs.every(isTab)
  ) {
    return { ok: false, failure: 'malformed' };
  }
  return {
    ok: true,
    envelope: {
      kind: DOCUMENT_ENVELOPE_KIND,
      schemaVersion: r.schemaVersion,
      exportedAt: typeof r.exportedAt === 'number' ? r.exportedAt : 0,
      document: {
        id: d.id,
        name: d.name,
        presentation: (d.presentation as string | null | undefined) ?? null,
        tabs: d.tabs,
        // Items that do not look like items are left behind; the api validates the rest.
        ...(Array.isArray(d.items) ? { items: d.items.filter(isItemLike) } : {}),
      },
    },
  };
}
