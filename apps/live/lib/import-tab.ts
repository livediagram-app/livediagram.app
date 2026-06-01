// Counterpart to export-tab.ts — parses an imported `.livediagram-
// tab.json` envelope back into a Tab the editor can splice into the
// current diagram. Single-format support today (the JSON envelope
// from `exportTabAsJson`); Markdown / PNG / PDF are export-only.
//
// Forward-compat: the envelope carries a numeric `schemaVersion`.
// Files at or below `TAB_SCHEMA_VERSION` are accepted; newer files
// are refused with a clear error so the user can update the editor
// rather than silently importing a half-understood shape. Backward
// compat: when we bump the schema we add a `migrate(version, tab)`
// branch here that walks old shapes forward.

import type { Tab } from '@livediagram/diagram';
import { TAB_SCHEMA_VERSION, type ExportedTabEnvelope } from './export-tab';

type ImportResult = { ok: true; tab: Tab } | { ok: false; error: string };

// Parse text from a chosen `.json` file. Returns a discriminated
// union — callers branch on `.ok` and surface the error string to
// the user when present. Never throws on bad input; user-supplied
// JSON is expected to be wrong sometimes.
export function parseImportedTab(text: string): ImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "File isn't valid JSON." };
  }
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Expected a JSON object at the top level.' };
  }
  const env = raw as Partial<ExportedTabEnvelope>;
  if (env.kind !== 'livediagram.tab') {
    return {
      ok: false,
      error: "This file isn't a livediagram tab export (missing kind field).",
    };
  }
  if (typeof env.schemaVersion !== 'number') {
    return { ok: false, error: 'Missing schemaVersion — refusing to guess.' };
  }
  if (env.schemaVersion > TAB_SCHEMA_VERSION) {
    return {
      ok: false,
      error: `File was exported with schema v${env.schemaVersion}; this editor understands up to v${TAB_SCHEMA_VERSION}. Update the editor and try again.`,
    };
  }
  if (!env.tab || typeof env.tab !== 'object') {
    return { ok: false, error: 'Envelope is missing the tab payload.' };
  }
  const tab = env.tab as Tab;
  if (typeof tab.id !== 'string' || typeof tab.name !== 'string' || !Array.isArray(tab.elements)) {
    return { ok: false, error: 'Tab payload is missing required fields (id, name, elements).' };
  }
  // Schema v1 doesn't need migration — passes straight through.
  // Future bumps: insert `if (env.schemaVersion < 2) tab = migrateV1ToV2(tab);` etc here.
  return { ok: true, tab };
}

// Open the browser's file picker and resolve with the chosen text
// content. Resolves to `null` when the user cancelled the dialog so
// the caller can no-op silently. Reads as text — the only format we
// currently import is JSON.
export function pickTabFile(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const file = input.files?.[0] ?? null;
      if (!file) {
        resolve(null);
        return;
      }
      try {
        const text = await file.text();
        resolve(text);
      } catch {
        resolve(null);
      }
    };
    // Some browsers don't fire `change` when the user cancels the
    // dialog, so there's no clean cancel callback to wire — the
    // caller's UI just stays in its pre-click state.
    input.click();
  });
}
