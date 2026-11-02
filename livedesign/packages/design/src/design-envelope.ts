// The whole-design envelope: the contents of a `.livedesign` file, as the
// CLI's pull files write it and read it back. The sibling of the per-tab `livedesign.tab` envelope in
// export-tab-text.ts: same shape (kind, schemaVersion, exportedAt), one
// design with every tab and each tab's per-design folder. An older file's `presentation` (the slide deck
// livedesign no longer has, docs/specs/012-collaboration/presentation-mode.md) is read past.
// Images stay references to livedesign's image store; no bytes are embedded. The design's component library
// (docs/specs/009-elements/components.md) rides beside its tabs as `components` when it has one, so the instances on
// the tabs draw after an import; a file without it reads as a design without one.

import type { DesignComponent } from './components';
import { isValidDesignComponent } from './component-validate';
import { remapTabLinks } from './duplicate';
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
    tabs: EnvelopeTab[];
    components?: DesignComponent[];
  };
};

type DesignEnvelopeFailure = 'not_json' | 'wrong_kind' | 'unsupported_version' | 'malformed';

export function designToEnvelopeText(
  liveDoc: { id: string; name: string },
  tabs: EnvelopeTab[],
  exportedAt: number,
  components: readonly DesignComponent[] = [],
): string {
  const envelope: DesignEnvelope = {
    kind: DESIGN_ENVELOPE_KIND,
    schemaVersion: DESIGN_SCHEMA_VERSION,
    exportedAt,
    design: {
      id: liveDoc.id,
      name: liveDoc.name,
      tabs,
      ...(components.length > 0 ? { components: [...components] } : {}),
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
    !Array.isArray(d.tabs) ||
    !d.tabs.every(isTab)
  ) {
    return { ok: false, failure: 'malformed' };
  }
  // A malformed main is left behind: its instances draw as missing, the rest of the file still reads.
  const components = Array.isArray(d.components) ? d.components.filter(isValidDesignComponent) : [];
  return {
    ok: true,
    envelope: {
      kind: DESIGN_ENVELOPE_KIND,
      schemaVersion: r.schemaVersion,
      exportedAt: typeof r.exportedAt === 'number' ? r.exportedAt : 0,
      design: {
        id: d.id,
        name: d.name,
        tabs: d.tabs,
        ...(components.length > 0 ? { components } : {}),
      },
    },
  };
}

// A copy of an envelope's design (the Drive mirror's import door, liveworkspace/docs/specs/005-drive/drive.md): fresh tab ids, with
// the tab links following them, so the copy navigates like the original. Mains keep their ids: the instances name them.
export function copyDesignEnvelope(envelope: DesignEnvelope): {
  tabs: EnvelopeTab[];
  components: DesignComponent[];
} {
  const idMap = new Map(envelope.design.tabs.map((t) => [t.id, crypto.randomUUID()] as const));
  const tabs = envelope.design.tabs.map((t) => ({
    ...t,
    id: idMap.get(t.id)!,
    elements: remapTabLinks(t.elements, idMap),
  }));
  return { tabs, components: envelope.design.components ?? [] };
}
