import { migrateStoredTab, type Tab } from '@livepages/document';

// How an imported tab lands on top of the tab receiving it (docs/specs/020-import-export/markdown-import.md).
//
// Pulled out of useTabImport so the merge RULE is testable on its own: what
// the import brings, what the receiving tab keeps, and — the part that was
// silently wrong — what must travel or the round trip loses meaning.
//
// `kind` and `layers` are in that last group. An exported Plan tab re-imported without its kind came back
// as an ordinary diagram (docs/specs/026-plan/plan-tabs.md). Without `layers`, every imported
// element's `layerId` dangles and the bands it was organised into are lost.
// A file is a stored tab like any other, so it takes the same migrations on
// the way in (retired schemes, retired groups and docks).
export function mergeImportedTab(receiving: Tab, imported: Tab): Tab {
  return mergeFields(receiving, migrateStoredTab(imported));
}

function mergeFields(receiving: Tab, imported: Tab): Tab {
  return {
    ...receiving,
    elements: imported.elements,
    kind: imported.kind ?? receiving.kind,
    // A Dashboard's rows and slots travel with its elements (docs/specs/026-plan/plan-tabs.md "Import and Export of a
    // Dashboard"); any other import leaves the receiving tab's layout alone.
    ...(imported.kind === 'dashboard' && imported.dashboard
      ? { dashboard: imported.dashboard }
      : {}),
    // A Form tab's form travels too (docs/specs/030-forms/forms.md "restored from a file"): without it the tab came in as
    // a Form tab with no form. Its link stays the original's; the copy is unpublished, its destination chosen again
    // when the document does not hold it.
    ...(imported.kind === 'form' && imported.form ? { form: imported.form } : {}),
    // The mode the tab opens in travels with it (docs/specs/007-editor/editor-modes.md).
    opensIn: imported.opensIn ?? receiving.opensIn,
    layers: imported.layers ?? receiving.layers,
    theme: imported.theme ?? receiving.theme,
    backgroundColor: imported.backgroundColor ?? receiving.backgroundColor,
    backgroundPattern: imported.backgroundPattern ?? receiving.backgroundPattern,
    backgroundOpacity: imported.backgroundOpacity ?? receiving.backgroundOpacity,
    patternColor: imported.patternColor ?? receiving.patternColor,
    backgroundPatternScale: imported.backgroundPatternScale ?? receiving.backgroundPatternScale,
    // Tab-level typography rides the export too (docs/specs/006-document/per-tab-storage.md): without these an
    // exported tab using a tab font came back rendering in the default face.
    font: imported.font ?? receiving.font,
    defaultTextSize: imported.defaultTextSize ?? receiving.defaultTextSize,
    templateChosen: true,
  };
}
