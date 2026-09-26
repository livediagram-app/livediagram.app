// Tab import (docs/specs/020-import-export/markdown-import.md + docs/specs/020-import-export/mermaid.md), lifted out of useTabActions: the
// id re-mint imported elements go through, the single-undo-step content
// replace, and the format-dispatched importer (JSON / DSL / Markdown)
// with its lazy-loaded parser cluster (JSON / Markdown / Mermaid /
// Excalidraw, docs/specs/020-import-export/excalidraw-import-export.md).

import { remapElementRefs, type Element, type Tab } from '@livediagram/diagram';
import { mergeImportedTab } from '@/lib/import-merge';
import type { ImportOutcome } from '@/lib/import-tab';
import { track } from '@/lib/telemetry';

// Re-mint element ids (and remap pinned-arrow endpoints) so imported
// elements can't collide with anything already on the diagram. Shared
// with useTabActions' cross-diagram tab link, which copies elements the
// same way.
export const remintElementIds = (elements: Element[]): Element[] => {
  const idMap = new Map<string, string>();
  const next = elements.map((el) => {
    const id = crypto.randomUUID();
    idMap.set(el.id, id);
    return { ...el, id };
  });
  // Arrow endpoints, mind-map parents (docs/specs/009-elements/mind-node.md) and portal partners
  // (docs/specs/009-elements/portal-element.md) follow the new ids. Missed, a duplicated tab's mind-map
  // nodes named parents on the SOURCE tab and paired portals lost their
  // partner. Element links are left alone: a link names its tab too, and
  // that is still the source tab, where the original element still is.
  return remapElementRefs(next, idMap);
};

type TabImportDeps = {
  tabs: Tab[];
  activeId: string;
  commitTabs: (mapTabs: (ts: Tab[]) => Tab[]) => void;
  setSelectedId: (id: string | null) => void;
  setEditingId: (id: string | null) => void;
  setFormatSourceId: (id: string | null) => void;
  // Surfaces an import parse error in the header (null clears it).
  setImportError: (message: string | null) => void;
};

export function useTabImport({
  tabs,
  activeId,
  commitTabs,
  setSelectedId,
  setEditingId,
  setFormatSourceId,
  setImportError,
}: TabImportDeps) {
  // Replace the ACTIVE tab's content with an imported tab — its
  // elements + theme/background, keeping the tab's own id and name.
  // Goes through `commitTabs` so the whole replace is a single undo
  // step (the warning in the Import dialog promises this). Selection /
  // edit state is cleared so nothing dangles over the new content.
  const replaceActiveTabContent = (imported: Tab) => {
    setImportError(null);
    commitTabs((ts) => ts.map((t) => (t.id === activeId ? mergeImportedTab(t, imported) : t)));
    setSelectedId(null);
    setEditingId(null);
    setFormatSourceId(null);
  };

  // Import TEXT of a given format into the active tab (docs/specs/020-import-export/markdown-import.md + docs/specs/020-import-export/mermaid.md).
  // Shared by the Import dialog's paste-editor path and the file path
  // (which reads the file then hands the text here), so both routes run
  // the exact same parse + replace. The parsers are lazy-loaded so their
  // code stays out of the editor's initial bundle. Never throws — returns
  // the outcome the dialog renders (close / stay / show error).
  const importTextIntoActiveTab = async (
    format: 'json' | 'markdown' | 'mermaid' | 'excalidraw',
    text: string,
  ): Promise<ImportOutcome> => {
    const active = tabs.find((t) => t.id === activeId);
    if (active?.locked) {
      return { status: 'error', error: 'This tab is locked. Unlock it before importing.' };
    }

    if (format === 'excalidraw') {
      const { buildElementsFromExcalidraw } = await import('@/lib/excalidraw-import');
      const result = buildElementsFromExcalidraw(text);
      if (!result.ok) return { status: 'error', error: result.error };
      // Ids are already re-minted inside the converter (docs/specs/020-import-export/excalidraw-import-export.md), so this
      // skips the JSON path's remintElementIds step.
      replaceActiveTabContent({
        id: activeId,
        name: active?.name ?? '',
        elements: result.elements,
        theme: active?.theme,
        backgroundColor: result.backgroundColor,
      });
      track('Tab', 'Imported', 'Excalidraw');
      return { status: 'done' };
    }

    if (format === 'mermaid') {
      const { parseMermaid, layoutClusteredGraph } = await import('@livediagram/diagram');
      const parsed = parseMermaid(text);
      if (!parsed.ok) return { status: 'error', error: parsed.error };
      // Uncoloured elements inherit the tab's theme at render, so no
      // explicit recolour is needed. The cluster-aware layout honours the
      // flowchart direction (TB / LR) and draws subgraphs as frames.
      const elements = layoutClusteredGraph(parsed.graph, { direction: parsed.direction });
      replaceActiveTabContent({
        id: activeId,
        name: active?.name ?? '',
        elements,
        theme: active?.theme,
      });
      track('Tab', 'Imported', 'Mermaid');
      return { status: 'done' };
    }

    if (format === 'markdown') {
      const { buildTabFromMarkdown } = await import('@/lib/markdown-import');
      const result = buildTabFromMarkdown(text, { tabName: active?.name, themeId: active?.theme });
      if (!result.ok) return { status: 'error', error: result.error };
      replaceActiveTabContent(result.tab);
      track('Tab', 'Imported', 'Markdown');
      return { status: 'done' };
    }

    const { parseImportedTab } = await import('@/lib/import-tab');
    const result = parseImportedTab(text);
    if (!result.ok) return { status: 'error', error: result.error };
    replaceActiveTabContent({ ...result.tab, elements: remintElementIds(result.tab.elements) });
    track('Tab', 'Imported', 'JSON');
    return { status: 'done' };
  };

  // Import a FILE into the active tab (docs/specs/020-import-export/markdown-import.md). Picks a file for the
  // chosen format, then hands its text to importTextIntoActiveTab so the
  // file and paste paths converge on one parser. Returns the dialog
  // outcome; 'cancelled' when the file picker is dismissed.
  const importIntoActiveTab = async (
    format: 'json' | 'markdown' | 'mermaid' | 'excalidraw',
  ): Promise<ImportOutcome> => {
    const active = tabs.find((t) => t.id === activeId);
    if (active?.locked) {
      return { status: 'error', error: 'This tab is locked. Unlock it before importing.' };
    }
    const accept =
      format === 'markdown'
        ? 'text/markdown,.md,.markdown,.mdown,.mkd,text/plain'
        : format === 'mermaid'
          ? '.mmd,.mermaid,.txt,text/plain'
          : format === 'excalidraw'
            ? '.excalidraw,.json,application/json'
            : '.json,application/json';
    const { pickTabFile } = await import('@/lib/import-tab');
    const picked = await pickTabFile(accept);
    if (!picked) return { status: 'cancelled' };
    return importTextIntoActiveTab(format, picked.text);
  };

  return { replaceActiveTabContent, importIntoActiveTab, importTextIntoActiveTab };
}
