// Tab import (docs/specs/020-import-export/markdown-import.md + docs/specs/020-import-export/mermaid.md), lifted out of useTabActions: the
// id re-mint imported elements go through, the single-undo-step content
// replace, and the format-dispatched importer (JSON / DSL / Markdown)
// with its lazy-loaded parser cluster (JSON / Markdown / Mermaid /
// Excalidraw, docs/specs/020-import-export/excalidraw-import-export.md, and
// draw.io, docs/specs/020-import-export/drawio-import.md, and Visio,
// docs/specs/020-import-export/visio-import.md, whose extra pages become new tabs).

import {
  remapElementRefs,
  remapSourceIds,
  savableElements,
  tabSourcesOf,
  type Element,
  type Tab,
} from '@livediagram/document';
import type { BoardScene } from '@/lib/board-scene/scene';
import type { DrawioInput } from '@/lib/drawio/import';
import type { VisioImportResult } from '@/lib/visio/import';
import { VISIO_MAX_FILE_BYTES, VISIO_TAB_FILE_ACCEPT } from '@/lib/visio/limits';
import { IMPORT_FILE_ACCEPT, type ImportFileFormat } from '@/lib/import-file-types';
import { BPMN_MAX_FILE_BYTES } from '@/lib/bpmn/limits';
import { INFRA_FILE_MAX_BYTES, INFRA_TOO_LARGE } from '@/lib/infra-import';
import { useInfraImport } from './useInfraImport';
import { mergeImportedTab } from '@/lib/import-merge';
import { mermaidImportOutcome } from '@/lib/text-import-report';
import { getTheme } from '@/lib/themes';
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
  // Arrow endpoints, mind-map parents (docs/specs/009-elements/mind-node.md) and portal partners
  // (a retired Portal's, docs/specs/009-elements/retired-elements.md) follow the new ids. Missed, a duplicated tab's mind-map
  // nodes named parents on the SOURCE tab and paired portals lost their
  // partner. Element links are left alone: a link names its tab too, and
  // that is still the source tab, where the original element still is.
  return { elements: remapElementRefs(minted, ids), ids };
}

// A tab's elements re-minted as above, its remembered files' record following the new ids
// (infrastructure-import.md "Updating a tab from its files"). Shared with useTabActions' Duplicate.
export function remintTabElements<T extends Pick<Tab, 'elements'> & { sources?: unknown }>(
  tab: T,
): T {
  const { elements, ids } = remintElements(tab.elements);
  const sources = tabSourcesOf(tab);
  if (!sources) {
    const { sources: _dropped, ...rest } = tab;
    return { ...(rest as T), elements };
  }
  return { ...tab, elements, sources: remapSourceIds(sources, ids) };
}

export type ImportFormat = ImportFileFormat;
type ImportProgressListener = (progress: ImportImageProgress) => void;

const EXCALIDRAW_TELEMETRY_TYPE = {
  json: 'Excalidraw',
  png: 'ExcalidrawPng',
  svg: 'ExcalidrawSvg',
} as const;

type TabImportDeps = {
  tabs: Tab[];
  // A fresh tab for each further page of a multi-page draw.io import, marked loaded once
  // committed so the per-tab loader does not fetch it (useTabActions).
  createTab: (name: string) => Tab;
  markTabLoaded: (id: string) => void;
  // Who stores a draw.io file's embedded images, and whether this document is an Offline Mode
  // one that embeds them instead (docs/specs/020-import-export/import-image-pipeline.md).
  ownerId: string;
  documentId: string | null;
  activeId: string;
  commitTabs: (mapTabs: (ts: Tab[]) => Tab[]) => void;
  setSelectedId: (id: string | null) => void;
  setEditingId: (id: string | null) => void;
  setFormatSourceId: (id: string | null) => void;
  // Surfaces an import parse error in the header (null clears it).
  setImportError: (message: string | null) => void;
  // Frames the tab once the imported content has rendered (useTabEntryEffects).
  requestFit: () => void;
  // Notes the view the import starts from and the elements it lands, just before its commit, so undoing it brings
  // the view back (hooks/canvas/useImportUndoView).
  noteImport?: (tabId: string, elements: readonly Element[]) => void;
  // Replaces the active tab with a board scene (useBoardSceneImport): the Excalidraw format's commit.
  importScene: (scene: BoardScene, onProgress?: ImportProgressListener) => Promise<ImportOutcome>;
};

export function useTabImport({
  tabs,
  createTab,
  markTabLoaded,
  ownerId,
  documentId,
  activeId,
  commitTabs,
  setSelectedId,
  setEditingId,
  setFormatSourceId,
  setImportError,
  requestFit,
  noteImport,
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
    noteImport?.(activeId, elements);
    commitTabs((ts) => ts.map((t) => (t.id === activeId ? mergeImportedTab(t, imported) : t)));
    setSelectedId(null);
    setEditingId(null);
    setFormatSourceId(null);
    // The import replaced the tab's content, so frame it.
    if (imported.elements.length > 0) requestFit();
  };

  // Import TEXT of a given format into the active tab (docs/specs/020-import-export/markdown-import.md + docs/specs/020-import-export/mermaid.md).
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

  // draw.io (docs/specs/020-import-export/drawio-import.md) and Visio (visio-import.md, built on draw.io's converter):
  // the first page replaces the active tab, every further page becomes a new tab after it, all in ONE commit so a
  // single undo takes the whole import back. Embedded images go through the import image pipeline BEFORE the tabs
  // change, for the same reason, in one pass across every page.
  const importPages = async (
    read: (tabIdForPage: (index: number) => string) => Promise<VisioImportResult>,
    telemetryType: 'Drawio' | 'Visio',
    onProgress?: ImportProgressListener,
  ): Promise<ImportOutcome> => {
    const [{ applyDrawioPages }, { attachDrawioImages }, { drawioOutcome }] = await Promise.all([
      import('./drawio-apply'),
      import('@/lib/drawio/images'),
      import('@/lib/drawio/report'),
    ]);
    const result = await read((index) => (index === 0 ? activeId : crypto.randomUUID()));
    if (!result.ok) return { status: 'error', error: result.error };
    const { pages, images } = await attachDrawioImages(
      result.pages,
      result.images,
      async (elements, requests) => {
        const [{ attachImportImages }, { createBrowserImportImageSession }] = await Promise.all([
          import('@/lib/import-images'),
          import('@/lib/import-images/browser'),
        ]);
        const session = createBrowserImportImageSession({ ownerId, documentId });
        return attachImportImages(elements, requests, session, onProgress);
      },
    );
    setImportError(null);
    noteImport?.(activeId, pages[0]?.elements ?? []);
    commitTabs((ts) => applyDrawioPages(ts, activeId, pages, createTab));
    for (const page of pages.slice(1)) markTabLoaded(page.tabId);
    setSelectedId(null);
    setEditingId(null);
    setFormatSourceId(null);
    if ((pages[0]?.elements.length ?? 0) > 0) requestFit();
    track('Tab', 'Imported', telemetryType);
    debugLog(telemetryType === 'Visio' ? '[visio-import] applied' : '[drawio-import] applied', {
      pages: result.report.pages,
      elements: result.report.elements,
      notes: Object.fromEntries(result.report.notes.map((n) => [n.kind, n.count])),
      ...(images ? { images } : {}),
    });
    return drawioOutcome(result.report, pages, images);
  };

  const importDrawioInput = (input: DrawioInput, onProgress?: ImportProgressListener) =>
    importPages(
      async (tabIdForPage) =>
        (await import('@/lib/drawio/import')).importDrawio(input, { tabIdForPage }),
      'Drawio',
      onProgress,
    );

  // A .vsdx, picked or dropped (docs/specs/020-import-export/visio-import.md). Past the limit it is never read:
  // reading it would hang the tab before it is refused.
  const importVisioFile = async (
    file: Blob,
    onProgress?: ImportProgressListener,
  ): Promise<ImportOutcome> => {
    if (file.size > VISIO_MAX_FILE_BYTES) {
      const { visioRefusalMessage } = await import('@/lib/visio/refusals');
      return { status: 'error', error: visioRefusalMessage('too-large') };
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    return importPages(
      async (tabIdForPage) =>
        (await import('@/lib/visio/import')).importVisio(bytes, { tabIdForPage }),
      'Visio',
      onProgress,
    );
  };

  // Infrastructure files drawn as an architecture tab that remembers them, and the update from them
  // (docs/specs/020-import-export/infrastructure-import.md): the parsers load on first use.
  const { importInfraFiles, updateFromSources } = useInfraImport({
    tabs,
    activeId,
    commitTabs,
    replaceActiveTabContent,
    setSelectedId,
    setEditingId,
    setFormatSourceId,
    setImportError,
    noteImport,
  });

  // A .bpmn file drawn where its modeler drew it (docs/specs/020-import-export/bpmn-import.md): read through the inert
  // parse, one replace.
  const importBpmnText = async (text: string): Promise<ImportOutcome> => {
    const active = tabs.find((t) => t.id === activeId);
    const { importBpmn, bpmnImportOutcome } = await import('@/lib/bpmn/import');
    const result = importBpmn(text);
    if (!result.ok) return { status: 'error', error: result.error };
    replaceActiveTabContent({
      id: activeId,
      name: active?.name ?? '',
      elements: result.elements,
      theme: active?.theme,
    });
    track('Tab', 'Imported', 'Bpmn');
    debugLog('[bpmn-import]', {
      shapes: result.tally.shapes,
      lines: result.tally.lines,
      approximated: result.tally.approximated,
      leftOut: result.tally.leftOut,
    });
    return bpmnImportOutcome(result.elements, result.tally);
  };

  const importTextIntoActiveTab = async (
    format: ImportFormat,
    text: string,
    onProgress?: ImportProgressListener,
    // The picked file's name, for a format that reads it (infra: which format, and the drawing's subtitle).
    fileName?: string,
  ): Promise<ImportOutcome> => {
    const active = tabs.find((t) => t.id === activeId);
    if (active?.locked) {
      return { status: 'error', error: 'This tab is locked. Unlock it before importing.' };
    }

    if (format === 'drawio') return importDrawioInput({ kind: 'text', text }, onProgress);
    // A .vsdx is a zip: there is nothing to paste (visio-import.md "UI").
    if (format === 'visio') return { status: 'error', error: 'Choose a .vsdx file to import.' };
    if (format === 'excalidraw') return importExcalidraw(text, onProgress);
    if (format === 'infra')
      return importInfraFiles([{ ...(fileName ? { name: fileName } : {}), text }]);
    if (format === 'bpmn') return importBpmnText(text);

    if (format === 'mermaid') {
      const {
        graphFromMermaid,
        layoutGraph,
        MERMAID_UNSUPPORTED_ERROR,
        rederiveColorPresetForTheme,
        unreadMermaidLines,
      } = await import('@livediagram/document');
      const parsed = graphFromMermaid(text);
      if (!parsed.ok) return { status: 'error', error: parsed.error };
      // Sequence diagrams are the agents' only, for now (docs/specs/020-import-export/mermaid.md).
      if (parsed.graph.style === 'sequence')
        return { status: 'error', error: MERMAID_UNSUPPORTED_ERROR };
      // The layout an agent's Mermaid gets (graph-input.ts layoutGraph): the flowchart direction, subgraphs as
      // frames, and lines that bend round the boxes, a line back to an earlier step round the outside. Labels stay
      // as written. Uncoloured elements inherit the tab's theme at render, so no explicit recolour is needed; only
      // a preset-bound node (a state diagram's solid start / end dot) takes its colours from the theme now.
      const theme = getTheme(active?.theme);
      const elements = layoutGraph(parsed.graph, { wholeLabels: true }).map((el) =>
        el.type === 'shape' && el.colorPreset ? rederiveColorPresetForTheme(el, theme) : el,
      );
      replaceActiveTabContent({
        id: activeId,
        name: active?.name ?? '',
        elements,
        theme: active?.theme,
      });
      track('Tab', 'Imported', 'Mermaid');
      // Lines it could not read, and subgraphs folded, are said in the report rather than lost (mermaid.md).
      if (parsed.unread) debugLog('[mermaid-import] unread', { lines: parsed.unread.length });
      return mermaidImportOutcome(elements, parsed, unreadMermaidLines);
    }

    if (format === 'markdown') {
      const { buildTabFromMarkdown, markdownImportOutcome } = await import('@/lib/markdown-import');
      const result = buildTabFromMarkdown(text, { tabName: active?.name, themeId: active?.theme });
      if (!result.ok) return { status: 'error', error: result.error };
      replaceActiveTabContent(result.tab);
      track('Tab', 'Imported', 'Markdown');
      if (result.leftOut > 0) debugLog('[markdown-import] left out', { leftOut: result.leftOut });
      // Past the node cap, the dialog's report says how much was left out.
      return markdownImportOutcome(result.tab, result.leftOut);
    }

    const { parseImportedTab } = await import('@/lib/import-tab');
    // A picked file comes with its name; pasted text has none.
    const result = parseImportedTab(text, fileName === undefined ? 'paste' : 'file');
    if (!result.ok) return { status: 'error', error: result.error };
    replaceActiveTabContent(remintTabElements(result.tab));
    track('Tab', 'Imported', 'JSON');
    return { status: 'done' };
  };

  // Import a FILE into the active tab (docs/specs/020-import-export/markdown-import.md). Picks a file for the
  // chosen format, then hands its text to importTextIntoActiveTab so the
  // file and paste paths converge on one parser. Returns the dialog
  // outcome; 'cancelled' when the file picker is dismissed. A file already in hand (dropped on a binary format's
  // panel, visio-import.md "UI") skips the picker.
  const importIntoActiveTab = async (
    format: ImportFormat,
    onProgress?: ImportProgressListener,
    dropped?: File,
  ): Promise<ImportOutcome> => {
    const active = tabs.find((t) => t.id === activeId);
    if (active?.locked) {
      return { status: 'error', error: 'This tab is locked. Unlock it before importing.' };
    }
    if (format === 'visio') {
      if (dropped) return importVisioFile(dropped, onProgress);
      const { pickTabFile } = await import('@/lib/import-tab');
      const picked = await pickTabFile(VISIO_TAB_FILE_ACCEPT, { binary: true });
      return picked ? importVisioFile(picked.file, onProgress) : { status: 'cancelled' };
    }
    const accept = IMPORT_FILE_ACCEPT[format];
    const { pickTabFile } = await import('@/lib/import-tab');
    // An infrastructure file past its cap is refused unread (infrastructure-import.md "Limits").
    const picked = await pickTabFile(
      accept,
      format === 'infra'
        ? { maxBytes: INFRA_FILE_MAX_BYTES }
        : format === 'bpmn'
          ? { maxBytes: BPMN_MAX_FILE_BYTES }
          : {},
    );
    if (!picked) return { status: 'cancelled' };
    // A .bpmn past its cap is refused unread (bpmn-import.md "Reading the file").
    if (picked.tooBig && format === 'bpmn')
      return { status: 'error', error: 'This file is too large to import (the limit is 5 MB).' };
    if (picked.tooBig) return { status: 'error', error: INFRA_TOO_LARGE };
    // A .drawio.png is binary, so draw.io reads the bytes.
    if (format === 'drawio') {
      return importDrawioInput(
        { kind: 'bytes', bytes: new Uint8Array(await picked.file.arrayBuffer()) },
        onProgress,
      );
    }
    // An Excalidraw PNG export is binary, so that format reads the bytes.
    if (format === 'excalidraw') {
      return importExcalidraw(new Uint8Array(await picked.file.arrayBuffer()), onProgress);
    }
    return importTextIntoActiveTab(format, picked.text, onProgress, picked.name);
  };

  return {
    replaceActiveTabContent,
    importIntoActiveTab,
    importTextIntoActiveTab,
    importInfraFiles,
    updateFromSources,
  };
}
