// The keys of a path's edit mode (docs/specs/023-whiteboard/path-tool.md "Editing"; blueprint
// path-tool "Edit mode"), as a pure rule: what one key press does to the anchors and the node
// selection. The gesture (usePathEditGesture) applies the outcome.
import type { PathAnchor } from '@livediagram/document';
import { canJoin, deleteNodes, moveNodes } from './path-edit';
import type { PathEditKind } from '@/hooks/canvas/usePathCommits';

export type PathKeyOutcome = {
  // The key is edit mode's: nothing else acts on it.
  claim: boolean;
  select?: ReadonlySet<number>;
  land?: { anchors: PathAnchor[]; closed: boolean; kind: PathEditKind };
  leave?: string;
  // Tab past the last node: on into the edit toolbar.
  focusToolbar?: boolean;
  // Undo or redo: the editor's, and edit mode reopens after it.
  reopen?: boolean;
};

const PASS: PathKeyOutcome = { claim: false };
const NONE: ReadonlySet<number> = new Set();

export function pathEditKey(
  key: { key: string; shiftKey: boolean; mod: boolean },
  anchors: readonly PathAnchor[],
  closed: boolean,
  selected: ReadonlySet<number>,
): PathKeyOutcome {
  const lower = key.key.toLowerCase();
  const n = anchors.length;
  if (key.key === 'Escape') {
    return selected.size > 0 ? { claim: true, select: NONE } : { claim: true, leave: 'escape' };
  }
  if (key.key === 'Enter') return { claim: true, leave: 'enter' };
  if (key.key === 'Backspace' || key.key === 'Delete') {
    if (selected.size === 0) return { claim: true };
    return {
      claim: true,
      select: NONE,
      land: { anchors: deleteNodes(anchors, selected), closed, kind: 'edit' },
    };
  }
  if (key.key.startsWith('Arrow')) {
    if (selected.size === 0) return { claim: true };
    const step = key.shiftKey ? 10 : 1;
    const dx = key.key === 'ArrowLeft' ? -step : key.key === 'ArrowRight' ? step : 0;
    const dy = key.key === 'ArrowUp' ? -step : key.key === 'ArrowDown' ? step : 0;
    return {
      claim: true,
      land: { anchors: moveNodes(anchors, selected, dx, dy), closed, kind: 'edit' },
    };
  }
  if (key.key === 'Tab') {
    const current = selected.size > 0 ? Math.max(...selected) : key.shiftKey ? 0 : -1;
    if (!key.shiftKey && current === n - 1) return { claim: true, focusToolbar: true };
    return { claim: true, select: new Set([(current + (key.shiftKey ? -1 : 1) + n) % n]) };
  }
  if (key.mod && (lower === 'z' || lower === 'y')) return { claim: false, reopen: true };
  if (key.mod && lower === 'a') return { claim: true, select: new Set(anchors.map((_, i) => i)) };
  if (!key.mod && lower === 'j') {
    return canJoin(anchors, closed, selected)
      ? { claim: true, land: { anchors: [...anchors], closed: true, kind: 'join' } }
      : { claim: true };
  }
  return PASS;
}
