// Tab import (docs/specs/020-import-export/README.md), lifted out of useTabActions: the id re-mint
// imported elements go through, the single-undo-step content replace, and the format-dispatched importer with
// its lazy-loaded parsers: a livehuddle tab's JSON, and Excalidraw
// (docs/specs/020-import-export/excalidraw-import-export.md). The draw.io, Mermaid and Markdown imports are gone
// from livehuddle (Work Tracker #423, part 4).

import { remapElementRefs, savableElements, type Element, type Tab } from '@livehuddle/document';
import type { BoardScene } from '@/lib/board-scene/scene';
import { mergeImportedTab } from '@/lib/import-merge';
import type { ImportOutcome } from '@/lib/import-tab';
import type { ImportImageProgress } from '@/lib/import-images';
import { track } from '@/lib/telemetry';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';

// Re-mint element ids (and remap pinned-arrow endpoints) so imported elements can't collide with anything already on
// the document, with the old-to-new map of the element ids. Shared with remintTabElements, which a Duplicate goes
// through too.
export function remintElements(elements: Element[]): {
  elements: Element[];
  ids: Map<string, string>;
} {
  const ids = new Map<string, string>();
  const minted = elements.map((el) => {
    const id = crypto.randomUUID();
    ids.set(el.id, id);
    return { ...el, id };
  });
  // Arrow endpoints and portal partners (docs/specs/009-elements/portal-element.md) follow the new ids. Missed,
  // a duplicated tab's paired portals lost their partner. Element links are left alone: a link names its tab too, and
  // that is still the source tab, where the original element still is.
  return { elements: remapElementRefs(minted, ids), ids };
}

// A tab's elements re-minted as above. Shared with useTabActions' Duplicate.
export function remintTabElements<T extends Pick<Tab, 'elements'>>(tab: T): T {
  return { ...tab, elements: remintElements(tab.elements).elements };
}

export type ImportFormat = 'json' | 'excalidraw';
type ImportProgressListener = (progress: ImportImageProgress) => void;

const EXCALIDRAW_TELEMETRY_TYPE = {
  json: 'Excalidraw',
  png: 'ExcalidrawPng',
  svg: 'ExcalidrawSvg',
} as const;

type TabImportDeps = {
  tabs: Tab[];
  activeId: string;
  commitTabs: (mapTabs: (ts: Tab[]) => Tab[]) => void;
  setSelectedId: (id: string | null) => void;
  setEditingId: (id: string | null) => void;
  setFormatSourceId: (id: string | null) => void;
  // Surfaces an import parse error in the header (null clears it).
  setImportError: (message: string | null) => void;
  // Frames the tab once the imported content has rendered (useTabEntryEffects).
  requestFit: () => void;
  // Replaces the active tab with a board scene (useBoardSceneImport): the Excalidraw format's commit.
  importScene: (scene: BoardScene, onProgress?: ImportProgressListener) => Promise<ImportOutcome>;
};

export function useTabImport({
  tabs,
  activeId,
  commitTabs,
  setSelectedId,
  setEditingId,
  setFormatSourceId,
  setImportError,
  requestFit,
  importScene,
}: TabImportDeps) {
  // Replace the ACTIVE tab's content with an imported tab — its
  // elements + theme/background, keeping the tab's own id and name.
  // Goes through `commitTabs` so the whole replace is a single undo
  // step (the warning in the Import dialog promises this). Selection /
  // edit state is cleared so nothing dangles over the new content.
  const replaceActiveTabContent = (raw: Tab) => {
    setImportError(null);
    // Only what the api will save lands (docs/specs/020-import-export/board-import.md "What lands"): an
    // element the validator refuses would make every later save of this tab fail.
    const { elements, dropped } = savableElements(raw.elements);
    if (dropped > 0) debugLog('[import] dropped unsavable elements', { dropped });
    const imported = { ...raw, elements };
    commitTabs((ts) => ts.map((t) => (t.id === activeId ? mergeImportedTab(t, imported) : t)));
    setSelectedId(null);
    setEditingId(null);
    setFormatSourceId(null);
    // The import replaced the tab's content, so frame it.
    if (imported.elements.length > 0) requestFit();
  };

  // Import TEXT of a given format into the active tab.
  // Shared by the Import dialog's paste-editor path and the file path
  // (which reads the file then hands the text here), so both routes run
  // the exact same parse + replace. The parsers are lazy-loaded so their
  // code stays out of the editor's initial bundle. Never throws — returns
  // the outcome the dialog renders (close / stay / show error).
  // Excalidraw: a scene as JSON text, or inside a PNG / SVG export, read into a board scene and
  // landed by the shared commit path; its images are stored BEFORE the tab changes, so the whole
  // import stays one undo step (docs/specs/020-import-export/excalidraw-import-export.md).
  const importExcalidraw = async (
    input: Uint8Array | string,
    onProgress?: ImportProgressListener,
  ): Promise<ImportOutcome> => {
    const [{ extractExcalidrawScene }, { sceneFromExcalidrawText }] = await Promise.all([
      import('@/lib/excalidraw-embedded'),
      import('@/lib/excalidraw-read'),
    ]);
    const extracted = await extractExcalidrawScene(input);
    if (!extracted.ok) return { status: 'error', error: extracted.error };
    const read = sceneFromExcalidrawText(extracted.text);
    if (!read.ok) return { status: 'error', error: read.error };
    // The shared board-scene commit: landed for the tab's profile, images stored, one replace.
    const outcome = await importScene(read.scene, onProgress);
    debugLog('[excalidraw-import]', {
      container: extracted.container,
      items: read.scene.items.length,
      status: outcome.status,
    });
    if (outcome.status === 'done') {
      track('Tab', 'Imported', EXCALIDRAW_TELEMETRY_TYPE[extracted.container]);
    }
    return outcome;
  };

  const importTextIntoActiveTab = async (
    format: ImportFormat,
    text: string,
    onProgress?: ImportProgressListener,
  ): Promise<ImportOutcome> => {
    const active = tabs.find((t) => t.id === activeId);
    if (active?.locked) {
      return { status: 'error', error: 'This tab is locked. Unlock it before importing.' };
    }

    if (format === 'excalidraw') return importExcalidraw(text, onProgress);

    const { parseImportedTab } = await import('@/lib/import-tab');
    const result = parseImportedTab(text);
    if (!result.ok) return { status: 'error', error: result.error };
    replaceActiveTabContent(remintTabElements(result.tab));
    track('Tab', 'Imported', 'JSON');
    return { status: 'done' };
  };

  // Import a FILE into the active tab. Picks a file for the
  // chosen format, then hands its text to importTextIntoActiveTab so the
  // file and paste paths converge on one parser. Returns the dialog
  // outcome; 'cancelled' when the file picker is dismissed.
  const importIntoActiveTab = async (
    format: ImportFormat,
    onProgress?: ImportProgressListener,
  ): Promise<ImportOutcome> => {
    const active = tabs.find((t) => t.id === activeId);
    if (active?.locked) {
      return { status: 'error', error: 'This tab is locked. Unlock it before importing.' };
    }
    const accept =
      format === 'excalidraw'
        ? '.excalidraw,.json,application/json,.png,image/png,.svg,image/svg+xml'
        : '.json,application/json';
    const { pickTabFile } = await import('@/lib/import-tab');
    const picked = await pickTabFile(accept);
    if (!picked) return { status: 'cancelled' };
    // An Excalidraw PNG export is binary, so that format reads the bytes.
    if (format === 'excalidraw') {
      return importExcalidraw(new Uint8Array(await picked.file.arrayBuffer()), onProgress);
    }
    return importTextIntoActiveTab(format, picked.text);
  };

  return { replaceActiveTabContent, importIntoActiveTab, importTextIntoActiveTab };
}
