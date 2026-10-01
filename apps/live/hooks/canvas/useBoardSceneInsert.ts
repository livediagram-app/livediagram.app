'use client';

// Paste and drop of a board scene (docs/specs/020-import-export/board-scene.md "In the editor"):
// the scene lands at the pointer (else the middle of the view) on the active tab, its images go
// through the import image pipeline first (insert mode: nothing is replaced), its text boxes hug
// in our fonts, and then everything lands in ONE commit, selected. A paste that changed or dropped
// anything leaves a notice; a lossless one leaves none.

import { useEffect, useState, type RefObject } from 'react';
import {
  MAX_ELEMENTS_PER_TAB,
  isWhiteboardTab,
  type Element,
  type Tab,
} from '@livediagram/document';
import { landBoardScene } from '@/lib/board-scene/land';
import type { BoardScene } from '@/lib/board-scene/scene';
import { reportHasLosses, type BoardSceneReport } from '@/lib/board-scene/report';
import {
  attachImportImages,
  importImagePlaceholderCount,
  type ImportImageReport,
} from '@/lib/import-images';
import {
  browserHugText,
  browserImageSession,
  type CreateImageSession,
  type HugText,
} from './board-scene-browser';
import { useLatest } from '@/hooks/ui/useLatest';

export type BoardSceneSource = BoardScene['source'];

export type BoardSceneNoticeState =
  | { kind: 'progress'; source: BoardSceneSource; done: number; total: number }
  | {
      kind: 'report';
      source: BoardSceneSource;
      report: BoardSceneReport;
      images?: ImportImageReport;
    }
  | { kind: 'refused'; source: BoardSceneSource; message: string };

type Point = { x: number; y: number };

export type BoardSceneInsertDeps = {
  activeTab: Tab;
  editsBlocked: boolean;
  commit: (mapElements: (els: Element[]) => Element[]) => void;
  setSelectedId: (id: string | null) => void;
  setMultiSelectedIds: (ids: Set<string>) => void;
  // The pointer in canvas coords while it is over the canvas, else null.
  canvasPointerRef?: RefObject<Point | null>;
  getViewportCenter: () => Point;
  ownerId: string;
  documentId: string | null;
  // Seams for tests; the defaults are the browser's.
  createImageSession?: CreateImageSession;
  hugText?: HugText;
};

export type BoardSceneInsertApi = {
  /** Lands a scene on the active tab; resolves true when anything landed. */
  insertScene: (scene: BoardScene) => Promise<boolean>;
  notice: BoardSceneNoticeState | null;
  dismissNotice: () => void;
};

export function useBoardSceneInsert(deps: BoardSceneInsertDeps): BoardSceneInsertApi {
  const latest = useLatest(deps);
  const [notice, setNotice] = useState<BoardSceneNoticeState | null>(null);

  // The notice belongs to the tab it was pasted on.
  const tabId = deps.activeTab.id;
  useEffect(() => {
    setNotice(null);
  }, [tabId]);

  const insertScene = async (scene: BoardScene): Promise<boolean> => {
    const d = latest.current;
    const tab = d.activeTab;
    if (d.editsBlocked || tab.locked) {
      console.info('[board-scene] insert refused', { reason: 'edits blocked' });
      return false;
    }
    const whiteboard = isWhiteboardTab(tab);
    const at = d.canvasPointerRef?.current ?? d.getViewportCenter();
    const result = landBoardScene(scene, {
      profile: whiteboard ? 'whiteboard' : 'diagram',
      placement: { kind: 'at', x: at.x, y: at.y },
      mintId: () => crypto.randomUUID(),
      room: MAX_ELEMENTS_PER_TAB - tab.elements.length,
    });
    if (!result.ok) {
      setNotice({ kind: 'refused', source: scene.source, message: result.message });
      return false;
    }
    let elements = result.elements;
    let images: ImportImageReport | undefined;
    if (result.imageRequests.length > 0) {
      const session = await (d.createImageSession ?? browserImageSession)({
        ownerId: d.ownerId,
        documentId: d.documentId,
      });
      ({ elements, report: images } = await attachImportImages(
        elements,
        result.imageRequests,
        session,
        ({ done, total }) => setNotice({ kind: 'progress', source: scene.source, done, total }),
      ));
    }
    if (whiteboard) elements = await (d.hugText ?? browserHugText)(elements, tab.font);

    // A tab switched while the images uploaded: the paste belonged to the tab it was made on.
    const now = latest.current;
    if (now.activeTab.id !== tab.id) {
      console.info('[board-scene] insert dropped', { reason: 'tab changed' });
      return false;
    }
    if (elements.length > 0) {
      now.commit((els) => [...els, ...elements]);
      if (elements.length === 1) {
        now.setSelectedId(elements[0]!.id);
        now.setMultiSelectedIds(new Set());
      } else {
        now.setSelectedId(null);
        now.setMultiSelectedIds(new Set(elements.map((el) => el.id)));
      }
    }
    console.info('[board-scene] insert', {
      elements: elements.length,
      images: result.imageRequests.length,
    });
    const lossy =
      reportHasLosses(result.report) || (images ? importImagePlaceholderCount(images) > 0 : false);
    setNotice(
      lossy ? { kind: 'report', source: scene.source, report: result.report, images } : null,
    );
    return elements.length > 0;
  };

  return { insertScene, notice, dismissNotice: () => setNotice(null) };
}
