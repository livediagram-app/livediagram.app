// Where a Knowledgebase Style change sits in the editor's undo history (docs/specs/030-knowledgebase/page-surface.md
// "Knowledgebase Style": "one undoable edit"). The history is snapshots of the tabs (hooks/canvas/
// useDocumentHistory), and the style is in no tab, so a change is a step that leaves the tabs as they are (a
// checkpoint) with the style before and after remembered against that step's place: its depth, and the branch of
// edits it was made on. Undo at that depth puts the style back, redo sets it again, and a new edit made below it
// forgets it, as it forgets the redo side. Pure: the editor's slice binds it to the real history.
import type { KnowledgeStyle } from '@liveknowledge/document';

type StyleStep = { depth: number; branch: number; before: KnowledgeStyle; after: KnowledgeStyle };

// Steps remembered at most; the history itself keeps 500 snapshots.
export const STYLE_STEPS_MAX = 200;

export function createStyleHistory() {
  let steps: StyleStep[] = [];
  let at = { depth: 0, branch: 0 };
  return {
    /** The history as it stands after a render: steps a new edit overwrote are forgotten. */
    sync(depth: number, branch: number): void {
      if (branch !== at.branch) steps = steps.filter((s) => s.depth < depth || s.branch === branch);
      at = { depth, branch };
    },
    /** A style change, just after its checkpoint was pushed: the step from here to one deeper. */
    record(before: KnowledgeStyle, after: KnowledgeStyle): void {
      at = { depth: at.depth + 1, branch: at.branch + 1 };
      steps = [
        ...steps.filter((s) => s.depth < at.depth).slice(-(STYLE_STEPS_MAX - 1)),
        { ...at, before, after },
      ];
    },
    /** The style an undo from here puts back, or null when the step being undone is not a style change. */
    undoing(): KnowledgeStyle | null {
      return steps.find((s) => s.depth === at.depth)?.before ?? null;
    },
    /** The style a redo from here sets again, or null. */
    redoing(): KnowledgeStyle | null {
      return steps.find((s) => s.depth === at.depth + 1)?.after ?? null;
    },
    clear(): void {
      steps = [];
    },
    size: (): number => steps.length,
  };
}

export type StyleHistory = ReturnType<typeof createStyleHistory>;
