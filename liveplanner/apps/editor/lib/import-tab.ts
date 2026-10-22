// Counterpart to export-tab.ts — parses an imported `.liveplanner-
// tab.json` envelope back into a Tab. PNG / PDF remain export-only.

// The result of an import attempt, surfaced back to the Import dialog:
// 'done' (replaced the tab — close, or show the report when part of it could
// not land), 'cancelled' (file dialog dismissed — stay open, no error), or
// 'error' (parse / build failed — show it).
export type ImportOutcome =
  | {
      status: 'done';
      // What could not land (the rest did): a file's Plan cards the store refused.
      failures?: { title: string; message: string }[];
    }
  | { status: 'cancelled' }
  | { status: 'error'; error: string };

// JSON forward-compat: the envelope carries a numeric `schemaVersion`.
// Files at or below `TAB_SCHEMA_VERSION` are accepted; newer files are
// refused with a clear error so the user can update the editor rather
// than silently importing a half-understood shape. Backward compat:
// when we bump the schema we add a `migrate(version, tab)` branch in
// parseImportedTab that walks old shapes forward.

import {
  legacyCatalogue,
  readItemTypeCatalogue,
  type Item,
  type ItemTypeCatalogue,
} from '@liveplanner/items';
import {
  isItemLike,
  isValidElement,
  migrateIncomingElements,
  type Tab,
  TAB_SCHEMA_VERSION,
  type ExportedTabEnvelope,
} from '@liveplanner/project';

// The Plan items a tab export carries (docs/specs/026-plan/items.md "Copies and exports"), and its stored type
// catalogue (null: the default types).
export type ImportedPlanItems = { items: Item[]; itemTypes: ItemTypeCatalogue | null };

type ImportResult = { ok: true; tab: Tab; plan?: ImportedPlanItems } | { ok: false; error: string };

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
  if (env.kind !== 'liveplanner.tab') {
    return {
      ok: false,
      error: "This file isn't a liveplanner tab export (missing kind field).",
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
  const tab = env.tab;
  if (typeof tab.id !== 'string' || typeof tab.name !== 'string' || !Array.isArray(tab.elements)) {
    return { ok: false, error: 'Tab payload is missing required fields (id, name, elements).' };
  }
  // Every older version (v1: freehand points as `{ nx, ny }`, docs/specs/006-project/stroke-points.md)
  // migrates through the stored-element migrations, which leave current elements alone.
  //
  // Each element through the same guard clipboard paste uses. An array check
  // alone let `null`, `{}` or an arrow with no endpoints through: the last
  // threw in the id re-mint (leaving the Import dialog stuck on busy), the
  // others landed on the canvas as junk.
  const elements = migrateIncomingElements(tab.elements).filter(isValidElement);
  // Items that do not look like items are left behind, as the project envelope does; the store validates the rest.
  const items = Array.isArray(env.items) ? env.items.filter(isItemLike) : [];
  if (items.length === 0) return { ok: true, tab: { ...tab, elements } };
  return {
    ok: true,
    tab: { ...tab, elements },
    // A tab exported before card types started empty carries cards and no catalogue: the default types.
    plan: { items, itemTypes: legacyCatalogue(readItemTypeCatalogue(env.itemTypes), true) },
  };
}

// Open the browser's file picker and resolve with the chosen file's name
// + text content. `accept` narrows the picker to the format the user
// chose.
//
// Crucially, this ALWAYS settles — resolving `null` on cancel. Browsers
// don't fire `change` when the file dialog is dismissed, so we detect a
// cancel via the window regaining focus: when the dialog closes, `focus`
// fires; if no `change` lands shortly after, it was a cancel. Without
// this the promise hangs forever and the caller (e.g. the Import dialog)
// is stuck "busy" with its buttons disabled.
// The picked file's text, plus the File itself.
// `tooBig` (its text then empty, never read) when the file is past the `maxBytes` the caller allows.
type PickedTabFile = { name: string; text: string; file: File; tooBig?: true };

export function pickTabFile(
  accept = 'application/json,.json',
  opts: { maxBytes?: number } = {},
): Promise<PickedTabFile | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;

    let settled = false;
    // `picked` flips synchronously the instant `change` fires (before we
    // await the file's text), so the focus-based cancel check below never
    // misfires for a slow-reading large file.
    let picked = false;
    const finish = (value: PickedTabFile | null) => {
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
      // Past the caller's limit the file is never read: reading a huge file would hang the tab before it is refused.
      if (opts.maxBytes !== undefined && file.size > opts.maxBytes) {
        finish({ name: file.name, text: '', file, tooBig: true });
        return;
      }
      try {
        const text = await file.text();
        finish({ name: file.name, text, file });
      } catch {
        finish(null);
      }
    };

    window.addEventListener('focus', onFocus);
    input.click();
  });
}
