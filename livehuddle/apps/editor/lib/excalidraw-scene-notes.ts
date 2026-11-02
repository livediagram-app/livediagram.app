// The Excalidraw parser's notes (docs/specs/020-import-export/excalidraw-import-export.md "What degrades"):
// each rule is its final user-facing sentence; the report shows "count · rule".

import type { SceneNote } from './board-scene/scene';

export const EXCALIDRAW_NOTE = {
  groups: 'Groups were dropped',
  taperedStrokes: 'Tapered strokes drawn at an even width',
  unmatchedHeads: 'Arrowheads with no match here drawn as plain arrowheads',
  labelPosition: 'Arrow labels moved to the middle of their arrow',
  unreadableColour: "Colours that couldn't be read use the ink",
} as const;

/** "Embeddable elements were skipped", from Excalidraw's type name. */
export const skippedTypeRule = (type: string) =>
  `${type.charAt(0).toUpperCase()}${type.slice(1)} elements were skipped`;

/** Counts notes by rule, in first-seen order. */
export class SceneNotes {
  private readonly counts = new Map<string, SceneNote>();

  add(rule: string, kind: 'degraded' | 'skipped' = 'degraded', count = 1): void {
    if (count <= 0) return;
    const at = this.counts.get(rule);
    if (at) at.count += count;
    else this.counts.set(rule, kind === 'skipped' ? { rule, count, kind } : { rule, count });
  }

  list(): SceneNote[] {
    return [...this.counts.values()];
  }
}
