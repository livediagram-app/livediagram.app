// The whole-design envelope: the contents of a `.livedesign` file, as the
// CLI's pull files write it and read it back. The sibling of the per-tab `livedesign.tab` envelope in
// export-tab-text.ts: same shape (kind, schemaVersion, exportedAt), one
// design with every tab, each tab's per-design folder, and the slide deck.
// Images stay references to livedesign's image store; no bytes are embedded.

import type { Tab } from './index';

export const DESIGN_ENVELOPE_KIND = 'livedesign.design';
export const DESIGN_SCHEMA_VERSION = 1;

export type EnvelopeTab = Tab & { folder?: string };

export type DesignEnvelope = {
  kind: typeof DESIGN_ENVELOPE_KIND;
  schemaVersion: number;
  exportedAt: number;
  design: {
    id: string;
    name: string;
    presentation: string | null;
    tabs: EnvelopeTab[];
  };
};

type DesignEnvelopeFailure = 'not_json' | 'wrong_kind' | 'unsupported_version' | 'malformed';

export function designToEnvelopeText(
  liveDoc: { id: string; name: string; presentation: string | null },
  tabs: EnvelopeTab[],
  exportedAt: number,
): string {
  const envelope: DesignEnvelope = {
    kind: DESIGN_ENVELOPE_KIND,
    schemaVersion: DESIGN_SCHEMA_VERSION,
    exportedAt,
    design: {
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

export function parseDesignEnvelope(
  text: string,
): { ok: true; envelope: DesignEnvelope } | { ok: false; failure: DesignEnvelopeFailure } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, failure: 'not_json' };
  }
  if (!raw || typeof raw !== 'object') return { ok: false, failure: 'malformed' };
  const r = raw as Record<string, unknown>;
  if (r.kind !== DESIGN_ENVELOPE_KIND) return { ok: false, failure: 'wrong_kind' };
  if (
    typeof r.schemaVersion !== 'number' ||
    r.schemaVersion > DESIGN_SCHEMA_VERSION ||
    r.schemaVersion < 1
  ) {
    return { ok: false, failure: 'unsupported_version' };
  }
  const d = r.design as Record<string, unknown> | undefined;
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
      kind: DESIGN_ENVELOPE_KIND,
      schemaVersion: r.schemaVersion,
      exportedAt: typeof r.exportedAt === 'number' ? r.exportedAt : 0,
      design: {
        id: d.id,
        name: d.name,
        presentation: d.presentation ?? null,
        tabs: d.tabs,
      },
    },
  };
}
