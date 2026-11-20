// The whole-document envelope: the contents of a `.liveknowledge` file, as the
// CLI's pull files write it and read it back. The sibling of the per-tab `liveknowledge.tab` envelope in
// export-tab-text.ts: same shape (kind, schemaVersion, exportedAt), one
// document with every tab, each tab's per-document folder, and the slide deck.
// Images stay references to liveknowledge's image store; no bytes are embedded.

import { remapTabLinks } from './duplicate';
import type { Tab } from './index';
import { DEFAULT_REVIEW_EVERY, isReviewEvery, type KnowledgeSettings } from './knowledge-settings';
import type { StoredPresentation } from './slide-deck';

export const DOCUMENT_ENVELOPE_KIND = 'liveknowledge.document';
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
    /** The knowledgebase's settings (the Review Period); absent is the default, every 90 days. */
    knowledgeSettings?: KnowledgeSettings;
    tabs: EnvelopeTab[];
  };
};

// The settings a file carries: a period that is known and not the default, or nothing.
function fileSettings(v: unknown): { knowledgeSettings?: KnowledgeSettings } {
  const every = v && typeof v === 'object' ? (v as { reviewEvery?: unknown }).reviewEvery : 0;
  return isReviewEvery(every) && every !== DEFAULT_REVIEW_EVERY
    ? { knowledgeSettings: { reviewEvery: every } }
    : {};
}

type DocumentEnvelopeFailure = 'not_json' | 'wrong_kind' | 'unsupported_version' | 'malformed';

export function documentToEnvelopeText(
  liveDoc: {
    id: string;
    name: string;
    presentation: string | null;
    knowledgeSettings?: KnowledgeSettings;
  },
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
      ...fileSettings(liveDoc.knowledgeSettings),
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
        ...fileSettings(d.knowledgeSettings),
        tabs: d.tabs,
      },
    },
  };
}

// A copy of an envelope's document (the Drive mirror's import door): fresh tab ids, with the tab links and the
// deck's slides following them, so the copy navigates and presents like the original. An unreadable deck is
// dropped rather than carried broken.
export function copyDocumentEnvelope(envelope: DocumentEnvelope): {
  tabs: EnvelopeTab[];
  presentation: string | null;
  knowledgeSettings?: KnowledgeSettings;
} {
  const idMap = new Map(envelope.document.tabs.map((t) => [t.id, crypto.randomUUID()] as const));
  const tabs = envelope.document.tabs.map((t) => ({
    ...t,
    id: idMap.get(t.id)!,
    elements: remapTabLinks(t.elements, idMap),
  }));
  let presentation = envelope.document.presentation;
  if (presentation) {
    try {
      const deck = JSON.parse(presentation) as StoredPresentation;
      for (const d of deck.decks ?? []) {
        for (const slide of d.slides ?? []) slide.tabId = idMap.get(slide.tabId) ?? slide.tabId;
      }
      presentation = JSON.stringify(deck);
    } catch {
      presentation = null;
    }
  }
  return { tabs, presentation, ...fileSettings(envelope.document.knowledgeSettings) };
}
