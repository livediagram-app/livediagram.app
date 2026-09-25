import { migrateStoredElements, type Tab } from '@livediagram/diagram';

// How an imported tab lands on top of the tab receiving it (spec/27).
//
// Pulled out of useTabImport so the merge RULE is testable on its own: what
// the import brings, what the receiving tab keeps, and — the part that was
// silently wrong — what must travel or the round trip loses meaning.
//
// `kind` and `layers` are in that last group. An exported workshop board
// re-imported without its kind came back as an ordinary diagram: the notes
// were all there, but the palette, the stationery and the note menu were
// gone, with nothing to say why (spec/139). Without `layers`, every imported
// element's `layerId` dangles and the bands it was organised into are lost.
// A file is a stored tab like any other, so its elements take the same
// migrations on the way in (retired groups and docks).
export function mergeImportedTab(receiving: Tab, imported: Tab): Tab {
  return {
    ...receiving,
    elements: migrateStoredElements(imported.elements),
    kind: imported.kind ?? receiving.kind,
    layers: imported.layers ?? receiving.layers,
    theme: imported.theme ?? receiving.theme,
    backgroundColor: imported.backgroundColor ?? receiving.backgroundColor,
    backgroundPattern: imported.backgroundPattern ?? receiving.backgroundPattern,
    backgroundOpacity: imported.backgroundOpacity ?? receiving.backgroundOpacity,
    patternColor: imported.patternColor ?? receiving.patternColor,
    backgroundPatternScale: imported.backgroundPatternScale ?? receiving.backgroundPatternScale,
    // Tab-level typography rides the export too (spec/13): without these an
    // exported tab using a tab font came back rendering in the default face.
    font: imported.font ?? receiving.font,
    defaultTextSize: imported.defaultTextSize ?? receiving.defaultTextSize,
    templateChosen: true,
  };
}
