import { migrateStoredTab, type Tab } from '@livepages/document';

// How an imported tab lands on top of the tab receiving it (docs/specs/020-import-export/markdown-import.md).
//
// Pulled out of useTabImport so the merge RULE is testable on its own: what
// the import brings, what the receiving tab keeps, and — the part that was
// silently wrong — what must travel or the round trip loses meaning.
//
// `kind` and `layers` are in that last group. An exported tab re-imported without its kind came back as
// another kind of tab. Without `layers`, every imported
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
    // The mode the tab opens in travels with it (docs/specs/007-editor/pages-mode.md "One mode").
    opensIn: imported.opensIn ?? receiving.opensIn,
    layers: imported.layers ?? receiving.layers,
    // A Pages tab's pages and its articles' writing (docs/specs/007-editor/article-pages.md): an imported article
    // arrives as both, and without them its elements would sit on the receiving tab's pages.
    pages: imported.pages ?? receiving.pages,
    articles: imported.articles ?? receiving.articles,
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
