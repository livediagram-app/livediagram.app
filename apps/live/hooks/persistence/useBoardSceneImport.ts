// The Import dialog's commit paths for board scenes (docs/specs/020-import-export/board-import.md
// "Stages", docs/specs/020-import-export/board-scene.md "In the editor"): replace the active tab
// with a scene (the Excalidraw card), or open each scene as a new whiteboard tab after the active
// one (the Microsoft Whiteboard card). Either way the images are stored first and the tabs change
// in ONE undoable step.

import { isWhiteboardTab, type Element, type Tab } from '@livediagram/document';
import { landBoardScene, type LandedBoardScene } from '@/lib/board-scene/land';
import type { BoardScene } from '@/lib/board-scene/scene';
import type { BoardSceneReport } from '@/lib/board-scene/report';
import { mergeNotes } from '@/lib/board-scene/report';
import {
  attachImportImages,
  emptyImportImageReport,
  type ImportImageProgress,
  type ImportImageReport,
} from '@/lib/import-images';
import type { ImportOutcome } from '@/lib/import-tab';
import { track } from '@/lib/telemetry';
import {
  browserHugText,
  browserImageSession,
  type CreateImageSession,
  type HugText,
} from '@/hooks/canvas/board-scene-browser';

/** Image progress, and which board of how many it belongs to when several import at once. */
export type BoardImportProgress = ImportImageProgress & { board?: number; boards?: number };

export type BoardSceneImportDeps = {
  tabs: Tab[];
  activeId: string;
  ownerId: string;
  documentId: string | null;
  createTab: (name: string) => Tab;
  commitTabs: (mapTabs: (ts: Tab[]) => Tab[]) => void;
  markTabLoaded: (id: string) => void;
  setActiveId: (id: string) => void;
  setSelectedId: (id: string | null) => void;
  setEditingId: (id: string | null) => void;
  setFormatSourceId: (id: string | null) => void;
  // The existing replace (useTabImport): merge onto the active tab, one undo step, then frame it.
  replaceActiveTabContent: (imported: Tab) => void;
  requestFit: () => void;
  // Seams for tests; the defaults are the browser's.
  createImageSession?: CreateImageSession;
  hugText?: HugText;
};

// Adds b's counts into a.
function addImageReports(a: ImportImageReport, b: ImportImageReport): ImportImageReport {
  const placeholders = { ...a.placeholders };
  for (const [k, n] of Object.entries(b.placeholders) as [keyof typeof placeholders, number][]) {
    placeholders[k] = (placeholders[k] ?? 0) + n;
  }
  return { imported: a.imported + b.imported, deduped: a.deduped + b.deduped, placeholders };
}

function addReports(a: BoardSceneReport, b: BoardSceneReport): BoardSceneReport {
  const landed = { ...a.landed };
  for (const [k, n] of Object.entries(b.landed) as [keyof typeof landed, number][]) {
    landed[k] = (landed[k] ?? 0) + n;
  }
  return {
    landed,
    ...mergeNotes([
      ...a.degraded,
      ...b.degraded,
      ...a.skipped.map((r) => ({ ...r, kind: 'skipped' as const })),
      ...b.skipped.map((r) => ({ ...r, kind: 'skipped' as const })),
    ]),
  };
}

export function useBoardSceneImport(deps: BoardSceneImportDeps) {
  const createSession = deps.createImageSession ?? browserImageSession;
  const hugText = deps.hugText ?? browserHugText;

  // Images and the text hug for one landed scene; the elements ready to commit.
  const finish = async (
    landed: LandedBoardScene,
    whiteboard: boolean,
    tabFont: string | undefined,
    onProgress?: (p: ImportImageProgress) => void,
  ): Promise<{ elements: Element[]; images?: ImportImageReport }> => {
    let elements = landed.elements;
    let images: ImportImageReport | undefined;
    if (landed.imageRequests.length > 0) {
      const session = await createSession({ ownerId: deps.ownerId, documentId: deps.documentId });
      ({ elements, report: images } = await attachImportImages(
        elements,
        landed.imageRequests,
        session,
        onProgress,
      ));
    }
    if (whiteboard) elements = await hugText(elements, tabFont);
    return { elements, images };
  };

  /** Replace the active tab with a scene, in its own profile. */
  const importSceneIntoActiveTab = async (
    scene: BoardScene,
    onProgress?: (p: ImportImageProgress) => void,
  ): Promise<ImportOutcome> => {
    const active = deps.tabs.find((t) => t.id === deps.activeId);
    if (!active) return { status: 'error', error: 'There is no tab to import into.' };
    if (active.locked) {
      return { status: 'error', error: 'This tab is locked. Unlock it before importing.' };
    }
    const whiteboard = isWhiteboardTab(active);
    const landed = landBoardScene(scene, {
      profile: whiteboard ? 'whiteboard' : 'diagram',
      placement: { kind: 'origin' },
      mintId: () => crypto.randomUUID(),
    });
    if (!landed.ok) return { status: 'error', error: landed.message };
    const { elements, images } = await finish(landed, whiteboard, active.font, onProgress);
    const { tabPatch } = landed;
    deps.replaceActiveTabContent({
      id: active.id,
      name: active.name,
      elements,
      theme: active.theme,
      ...(tabPatch.backgroundColor ? { backgroundColor: tabPatch.backgroundColor } : {}),
      // A whiteboard keeps its own background unless the scene names one.
      ...(whiteboard && scene.background?.pattern
        ? { backgroundPattern: tabPatch.backgroundPattern }
        : {}),
    });
    console.info('[board-scene] import', { boards: 1, target: 'replace-tab', failures: 0 });
    return { status: 'done', ...(images ? { images } : {}), scene: landed.report };
  };

  /** Open every scene as a new whiteboard tab after the active one, in one undo step. */
  const importScenesAsNewWhiteboards = async (
    scenes: BoardScene[],
    onProgress?: (p: BoardImportProgress) => void,
  ): Promise<ImportOutcome> => {
    const tabs: Tab[] = [];
    const failures: { title: string; message: string }[] = [];
    let report: BoardSceneReport | undefined;
    let images: ImportImageReport | undefined;
    for (const [i, scene] of scenes.entries()) {
      const landed = landBoardScene(scene, {
        profile: 'whiteboard',
        placement: { kind: 'origin' },
        mintId: () => crypto.randomUUID(),
      });
      const title = scene.title?.trim() || 'Untitled board';
      if (!landed.ok) {
        failures.push({ title, message: landed.message });
        continue;
      }
      const done = await finish(landed, true, undefined, (p) =>
        onProgress?.({ ...p, board: i + 1, boards: scenes.length }),
      );
      const { kind, name, backgroundPattern } = landed.tabPatch;
      tabs.push({
        ...deps.createTab(name),
        kind,
        backgroundPattern,
        elements: done.elements,
        templateChosen: true,
      });
      report = report ? addReports(report, landed.report) : landed.report;
      if (done.images) images = addImageReports(images ?? emptyImportImageReport(), done.images);
    }
    console.info('[board-scene] import', {
      boards: scenes.length,
      target: 'new-whiteboard-tab',
      failures: failures.length,
    });
    if (tabs.length === 0) {
      return {
        status: 'error',
        error: failures[0]?.message ?? 'There was no board to import.',
      };
    }
    deps.commitTabs((ts) => {
      const at = ts.findIndex((t) => t.id === deps.activeId);
      const next = [...ts];
      next.splice(at < 0 ? next.length : at + 1, 0, ...tabs);
      return next;
    });
    for (const tab of tabs) {
      deps.markTabLoaded(tab.id);
      track('Whiteboard', 'Created', 'Import');
    }
    deps.setActiveId(tabs[0]!.id);
    deps.setSelectedId(null);
    deps.setEditingId(null);
    deps.setFormatSourceId(null);
    deps.requestFit();
    return {
      status: 'done',
      ...(images ? { images } : {}),
      ...(report ? { scene: report } : {}),
      ...(failures.length > 0 ? { failures } : {}),
    };
  };

  return { importSceneIntoActiveTab, importScenesAsNewWhiteboards };
}
