// The whole-diagram envelope (docs/specs/022-drive-mirror/drive-mirror.md, "The file"):
// the contents of a `.livedoc` file in Google Drive, and what "Import a
// copy" reads back. The sibling of the per-tab `livediagram.tab` envelope in
// export-tab-text.ts: same shape (kind, schemaVersion, exportedAt), one
// diagram with every tab, each tab's per-diagram folder, and the slide deck.
// Images stay references to livediagram's image store; no bytes are embedded.

import type { Tab } from '@livediagram/diagram';

export const DIAGRAM_ENVELOPE_KIND = 'livediagram.diagram';
export const DIAGRAM_SCHEMA_VERSION = 1;

export type EnvelopeTab = Tab & { folder?: string };

export type DiagramEnvelope = {
  kind: typeof DIAGRAM_ENVELOPE_KIND;
  schemaVersion: number;
  exportedAt: number;
  diagram: {
    id: string;
    name: string;
    presentation: string | null;
    tabs: EnvelopeTab[];
  };
};

export type DiagramEnvelopeFailure =
  'not_json' | 'wrong_kind' | 'unsupported_version' | 'malformed';

export function diagramToEnvelopeText(
  diagram: { id: string; name: string; presentation: string | null },
  tabs: EnvelopeTab[],
  exportedAt: number,
): string {
  const envelope: DiagramEnvelope = {
    kind: DIAGRAM_ENVELOPE_KIND,
    schemaVersion: DIAGRAM_SCHEMA_VERSION,
    exportedAt,
    diagram: { id: diagram.id, name: diagram.name, presentation: diagram.presentation, tabs },
  };
  return JSON.stringify(envelope, null, 2);
}

function isTab(value: unknown): value is EnvelopeTab {
  if (!value || typeof value !== 'object') return false;
  const t = value as Record<string, unknown>;
  return typeof t.id === 'string' && typeof t.name === 'string' && Array.isArray(t.elements);
}

export function parseDiagramEnvelope(
  text: string,
): { ok: true; envelope: DiagramEnvelope } | { ok: false; failure: DiagramEnvelopeFailure } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, failure: 'not_json' };
  }
  if (!raw || typeof raw !== 'object') return { ok: false, failure: 'malformed' };
  const r = raw as Record<string, unknown>;
  if (r.kind !== DIAGRAM_ENVELOPE_KIND) return { ok: false, failure: 'wrong_kind' };
  if (
    typeof r.schemaVersion !== 'number' ||
    r.schemaVersion > DIAGRAM_SCHEMA_VERSION ||
    r.schemaVersion < 1
  ) {
    return { ok: false, failure: 'unsupported_version' };
  }
  const d = r.diagram as Record<string, unknown> | undefined;
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
      kind: DIAGRAM_ENVELOPE_KIND,
      schemaVersion: r.schemaVersion,
      exportedAt: typeof r.exportedAt === 'number' ? r.exportedAt : 0,
      diagram: {
        id: d.id,
        name: d.name,
        presentation: (d.presentation as string | null | undefined) ?? null,
        tabs: d.tabs,
      },
    },
  };
}
