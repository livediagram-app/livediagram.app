'use client';

// Where a path lands in the document (docs/specs/023-whiteboard/path-tool.md; blueprint path-tool
// "Drawing" and "Edit mode"): a drawn path, a continued one, and every edit-mode gesture, each one
// `commit`, so each is one undo step.
import {
  continuedPath,
  createPath,
  isCommittablePath,
  reshapePath,
  type Element,
  type PathAnchor,
} from '@livediagram/document';
import { track } from '@/lib/telemetry';
import type { PathCommit } from '@/components/canvas/path/usePathDrawGesture';
import { debugLog } from '@/lib/debug-log';
import { boardShape } from '@/lib/whiteboard-tool';

export type PathEditKind = 'edit' | 'join';

export function usePathCommits({
  editsBlocked,
  commit,
  styleNewElement,
  setSelectedId,
}: {
  editsBlocked: boolean;
  commit: (mapElements: (els: Element[]) => Element[]) => void;
  // The board's style memory: a new path wears the style chosen for the next path.
  styleNewElement: <T extends Element>(el: T) => T;
  // A landed path is selected, so it can be edited at once (Edit points, Enter).
  setSelectedId: (id: string | null) => void;
}) {
  const commitPath = ({ anchors, closed, continuing }: PathCommit) => {
    if (editsBlocked) {
      debugLog('[path] refused: blocked');
      return;
    }
    if (!isCommittablePath(anchors, closed)) {
      debugLog('[path] refused: too few nodes');
      return;
    }
    // The Path tool is a Draw mode tool: its path is written in Ink, unfilled (boardShape).
    const fresh = styleNewElement(boardShape(createPath(anchors, closed)));
    let continued = false;
    commit((els) => {
      const original = continuing
        ? els.find((el) => el.id === continuing.id && el.type === 'path')
        : undefined;
      // A path deleted by a peer while it was being continued lands as a new one.
      if (!original || original.type !== 'path') return [...els, fresh];
      continued = true;
      return els.map((el) => (el === original ? continuedPath(original, anchors, closed) : el));
    });
    setSelectedId(continued && continuing ? continuing.id : fresh.id);
    track('Element', 'Added', 'Path');
    debugLog(
      `[path] committed nodes=${anchors.length} closed=${closed ? 'yes' : 'no'} continued=${continued ? 'yes' : 'no'}`,
    );
  };

  // One edit-mode gesture. A path left with fewer nodes than it needs is deleted.
  const commitPathEdit = (
    id: string,
    next: { anchors: PathAnchor[]; closed: boolean },
    kind: PathEditKind,
  ) => {
    if (editsBlocked) {
      debugLog('[path] refused: blocked');
      return;
    }
    const keep = isCommittablePath(next.anchors, next.closed);
    commit((els) =>
      els.flatMap((el) => {
        if (el.id !== id || el.type !== 'path') return [el];
        return keep ? [reshapePath(el, next.anchors, next.closed)] : [];
      }),
    );
    track('Element', 'Changed', kind === 'join' ? 'PathJoin' : 'PathEdit');
    debugLog(`[path] edit ${keep ? kind : 'deleted'} nodes=${next.anchors.length}`);
  };

  return { commitPath, commitPathEdit };
}
