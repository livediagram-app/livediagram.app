// Counterpart to export-tab.ts — parses an imported `.livediagram-
// tab.json` envelope back into a Tab. Markdown is also importable
// (spec/27) via its own module (`markdown-import.ts`). The Import
// dialog (spec/27) lets the user pick which format; the chosen format
// drives the picker's file filter + which parser runs. PNG / PDF
// remain export-only.

// The result of an import attempt, surfaced back to the Import dialog:
// 'done' (replaced the tab — close), 'cancelled' (file dialog dismissed
// — stay open, no error), or 'error' (parse / build failed — show it).
export type ImportOutcome =
  | { status: 'done' }
  | { status: 'cancelled' }
  | { status: 'error'; error: string };

// JSON forward-compat: the envelope carries a numeric `schemaVersion`.
// Files at or below `TAB_SCHEMA_VERSION` are accepted; newer files are
// refused with a clear error so the user can update the editor rather
// than silently importing a half-understood shape. Backward compat:
// when we bump the schema we add a `migrate(version, tab)` branch in
// parseImportedTab that walks old shapes forward.

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
    return { ok: false, error: 'Missing schemaVersion; refusing to guess.' };
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

// Open the browser's file picker and resolve with the chosen file's name
// + text content. `accept` narrows the picker to the format the user
// chose in the Import dialog (JSON vs Markdown).
//
// Crucially, this ALWAYS settles — resolving `null` on cancel. Browsers
// don't fire `change` when the file dialog is dismissed, so we detect a
// cancel via the window regaining focus: when the dialog closes, `focus`
// fires; if no `change` lands shortly after, it was a cancel. Without
// this the promise hangs forever and the caller (e.g. the Import dialog)
// is stuck "busy" with its buttons disabled.
export function pickTabFile(
  accept = 'application/json,.json,text/markdown,.md,.markdown,.mdown,.mkd,text/plain',
): Promise<{ name: string; text: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;

    let settled = false;
    // `picked` flips synchronously the instant `change` fires (before we
    // await the file's text), so the focus-based cancel check below never
    // misfires for a slow-reading large file.
    let picked = false;
    const finish = (value: { name: string; text: string } | null) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('focus', onFocus);
      resolve(value);
    };

    function onFocus() {
      window.removeEventListener('focus', onFocus);
      // `change` (when a file WAS chosen) fires just after focus returns,
      // so wait a beat before declaring a cancel.
      window.setTimeout(() => {
        if (!picked) finish(null);
      }, 500);
    }

    input.onchange = async () => {
      picked = (input.files?.length ?? 0) > 0;
      const file = input.files?.[0] ?? null;
      if (!file) {
        finish(null);
        return;
      }
      try {
        const text = await file.text();
        finish({ name: file.name, text });
      } catch {
        finish(null);
      }
    };

    window.addEventListener('focus', onFocus);
    input.click();
  });
}
