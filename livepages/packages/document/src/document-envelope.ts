// The whole-document envelope: the contents of a `.livepages` file, as the
// CLI's pull files write it and read it back. The sibling of the per-tab `livepages.tab` envelope in
// export-tab-text.ts: same shape (kind, schemaVersion, exportedAt), one
// document with every tab, each tab's per-document folder, and the slide deck.
// Images stay references to livepages's image store; no bytes are embedded.

import type { Tab } from './index';

export const DOCUMENT_ENVELOPE_KIND = 'livepages.document';
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
  };
};

type DocumentEnvelopeFailure = 'not_json' | 'wrong_kind' | 'unsupported_version' | 'malformed';

export function documentToEnvelopeText(
  liveDoc: { id: string; name: string; presentation: string | null },
  tabs: EnvelopeTab[],
  exportedAt: number,
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
    },
  };
  return JSON.stringify(envelope, null, 2);
}

function isTab(value: unknown): value is EnvelopeTab {
  if (!value || typeof value !== 'object') return false;
  const t = value as Record<string, unknown>;
  return typeof t.id === 'string' && typeof t.name === 'string' && Array.isArray(t.elements);
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
        presentation: d.presentation ?? null,
        tabs: d.tabs,
      },
    },
  };
}
