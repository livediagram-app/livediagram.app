'use client';

// The Fill tool's press landing in the document (docs/specs/023-draw-mode/fill-tool.md "What a press
// fills"): one `commit`, so one undo step that reaches every collaborator, gated on the session's
// right to recolour what it would change. A press that fills nothing says why in a small hint.
import { layerBands, type Element, type Layer } from '@livediagram/document';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { isFillIntent, type PendingDraw } from '@/lib/draw-mode';
import { paintBucketTarget, pourBucket } from '@/lib/paint-bucket';
import { track } from '@/lib/telemetry';

export const FILL_MISSED_HINT = 'Click inside a closed shape, or a loop whose ends meet, to fill it.';
export const FILL_LOCKED_HINT = "That's locked, so its fill stays.";

export function usePaintBucket({
  pendingDraw,
  elements,
  layers,
  inertIds,
  editsBlocked,
  canRecolour,
  commit,
  hint,
}: {
  pendingDraw: PendingDraw | null;
  // The active tab as it is now: read at the press, never from inside the commit's updater.
  elements: () => Element[];
  layers: Layer[] | undefined;
  inertIds: ReadonlySet<string>;
  editsBlocked: boolean;
  // The session may recolour this element (`can.recolour`, docs/specs/013-workspace/share-roles.md).
  canRecolour: (el: Element) => boolean;
  commit: (mapElements: (els: Element[]) => Element[]) => void;
  hint: (message: string) => void;
}) {
  const paintBucket = (point: { x: number; y: number }) => {
    if (!isFillIntent(pendingDraw)) return;
    if (editsBlocked) {
      debugLog('[fill] refused: blocked');
      return;
    }
    const painted = layerBands(elements(), layers).flatMap((band) => band.elements);
    const target = paintBucketTarget(painted, point, inertIds);
    if (target.kind === 'none' || target.kind === 'locked') {
      hint(target.kind === 'locked' ? FILL_LOCKED_HINT : FILL_MISSED_HINT);
      track('Draw', 'Changed', 'FillMissed');
      debugLog(`[fill] missed: ${target.kind}`);
      return;
    }
    if (!canRecolour(target.el)) {
      debugLog('[fill] refused: may not recolour');
      return;
    }
    const next = pourBucket(target, pendingDraw.fill);
    if (!next) {
      debugLog('[fill] unchanged');
      return;
    }
    commit((els) => els.map((el) => (el.id === next.id ? next : el)));
    track('Element', 'Changed', target.kind === 'loop' ? 'FillLoop' : 'FillBucket');
    debugLog(`[fill] ${target.kind} ${next.type}`);
  };
  return { paintBucket };
}
