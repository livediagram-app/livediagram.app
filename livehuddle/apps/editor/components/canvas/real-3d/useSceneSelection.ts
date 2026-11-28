// Real 3D's selection marks (docs/specs/008-canvas/3d-view.md "Editing in 3D"): the selection, marked in the scene while
// editing, and re-marked whenever the pieces (and so their boxes) are rebuilt.

import { useEffect, type RefObject } from 'react';
import type { useOptionalSelectionStore } from '@liveworkspace/workbench/hooks/canvas/useSelectionStore';
import { selectionIds } from '@liveworkspace/workbench/lib/selection-store';
import type { PieceBounds } from '@/lib/real-3d/piece-pick';
import { SelectionMarks } from './selection-marks';
import type { SceneState } from './real3d-scene-kit';
import type { Real3DEngine } from './useReal3DEngine';

export function useSceneSelection(
  engineRef: RefObject<Real3DEngine | null>,
  staticRef: RefObject<SceneState>,
  markSelectionRef: RefObject<() => void>,
  selectionStore: ReturnType<typeof useOptionalSelectionStore>,
): void {
  // The selection, marked in the scene while editing (3d-view.md "Editing in 3D").
  useEffect(() => {
    const e = engineRef.current;
    if (!e || !selectionStore) return undefined;
    const marks = new SelectionMarks();
    e.scene.add(marks.group);
    const mark = () => {
      const s = staticRef.current;
      const { selectedId, multiSelectedIds } = selectionStore.get();
      const picked: PieceBounds[] = [];
      if (s)
        for (const id of selectionIds(selectedId, multiSelectedIds)) {
          const b = s.boundsById.get(id);
          if (b) picked.push(b);
        }
      marks.set(picked);
    };
    markSelectionRef.current = mark;
    mark();
    const unsubscribe = selectionStore.subscribe(mark);
    return () => {
      unsubscribe();
      markSelectionRef.current = () => {};
      e.scene.remove(marks.group);
      marks.dispose();
    };
  }, [engineRef, staticRef, markSelectionRef, selectionStore]);
}
