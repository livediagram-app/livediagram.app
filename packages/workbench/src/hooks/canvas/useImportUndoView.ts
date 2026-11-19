// The view across an import's undo and redo, every editor's one copy (each editor's
// docs/specs/008-canvas/canvas-and-palette.md "Undoing an import brings its view back", Work Tracker 1247). An import
// notes the view it started from and what it landed (`noteImport`); the person's own undo and redo say they are about
// to step (`beforeStep`); once the step has rendered, the view goes back to where it was before the import, or lands
// on the import again (lib/import-undo-view's `importViewMove`). Nothing else moves it.

import { useCallback, useEffect, useEffectEvent, useRef } from 'react';
import type { ViewportStore } from '../../lib/viewport-store';
import { useLatest } from '../ui/useLatest';
import {
  importViewMove,
  type ImportViewMark,
  type ImportViewTab,
} from '../../lib/import-undo-view';

export type ImportUndoView = {
  // Called by an import just before it commits: the tab it lands on and the elements it lands there.
  noteImport: (tabId: string, elements: readonly { id: string }[]) => void;
  // Called by undo and redo just before they step the history.
  beforeStep: () => void;
};

export function useImportUndoView<T extends ImportViewTab>({
  tabs,
  activeId,
  viewport,
  land,
}: {
  tabs: T[];
  activeId: string;
  viewport: Pick<ViewportStore, 'get' | 'setZoom' | 'setOffset'>;
  // Frames the active tab as an import does (livediagram's landing view, the other editors' Fit to Screen).
  land: () => void;
}): ImportUndoView {
  // Only the latest import is kept: one mark, its ids bounded by what that import landed.
  const markRef = useRef<ImportViewMark | null>(null);
  // The tabs an undo or redo stepped from, until the step has rendered.
  const steppingFromRef = useRef<T[] | null>(null);
  // Read when undo or redo is pressed, never during render.
  const tabsNow = useLatest(tabs);

  const noteImport = useCallback(
    (tabId: string, elements: readonly { id: string }[]) => {
      const { zoom, offset } = viewport.get();
      markRef.current = {
        tabId,
        ids: new Set(elements.map((el) => el.id)),
        before: { zoom, offset: { ...offset } },
      };
    },
    [viewport],
  );

  const beforeStep = useCallback(() => {
    // Nothing to compare against without an import, so an ordinary undo costs nothing here.
    if (markRef.current) steppingFromRef.current = tabsNow.current;
  }, [tabsNow]);

  // The view's response to a step that has rendered: an effect event, so it reads the active tab and the landing at
  // their newest without re-running on them.
  const settle = useEffectEvent((from: T[], to: T[]) => {
    const move = importViewMove(markRef.current, from, to, activeId);
    if (move === 'restore') {
      // A restore always has a mark: importViewMove answers null without one.
      const { before } = markRef.current as ImportViewMark;
      viewport.setZoom(before.zoom);
      viewport.setOffset(before.offset);
    } else if (move === 'land') {
      land();
    }
  });

  useEffect(() => {
    const from = steppingFromRef.current;
    // Waits for the render that carries the step: the tabs it stepped from are still on screen until then.
    if (!from || from === tabs) return;
    steppingFromRef.current = null;
    settle(from, tabs);
  }, [tabs]);

  return { noteImport, beforeStep };
}
