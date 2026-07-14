// Tab import (spec/27 + spec/73), lifted out of useTabActions: the
// id re-mint imported elements go through, the single-undo-step content
// replace, and the format-dispatched importer (JSON / DSL / Markdown)
// with its lazy-loaded parser cluster (JSON / Markdown / Mermaid /
// Excalidraw, spec/87).

import type { Element, Tab } from '@livediagram/diagram';
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
  for (const el of next) {
    if (el.type === 'arrow') {
      for (const end of ['from', 'to'] as const) {
        const ep = el[end];
        if (ep.kind === 'pinned') {
          const mapped = idMap.get(ep.elementId);
          if (mapped) el[end] = { ...ep, elementId: mapped };
        } else if (ep.kind === 'on-arrow') {
          // Arrow-to-arrow endpoints (spec/50) reference another arrow's id,
          // so they need remapping too — otherwise a DSL / JSON import with a
          // message hung off a lifeline points at the pre-remint id.
          const mapped = idMap.get(ep.arrowId);
          if (mapped) el[end] = { ...ep, arrowId: mapped };
        }
      }
    }
  }
  return next;
};

type TabImportDeps = {
  tabs: Tab[];
  activeId: string;
  commitTabs: (mapTabs: (ts: Tab[]) => Tab[]) => void;
  setSelectedId: (id: string | null) => void;
  setEditingId: (id: string | null) => void;
  setFormatSourceId: (id: string | null) => void;
  setGroupSourceId: (id: string | null) => void;
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
  setGroupSourceId,
  setImportError,
}: TabImportDeps) {
  // Replace the ACTIVE tab's content with an imported tab — its
  // elements + theme/background, keeping the tab's own id and name.
  // Goes through `commitTabs` so the whole replace is a single undo
  // step (the warning in the Import dialog promises this). Selection /
  // edit state is cleared so nothing dangles over the new content.
  const replaceActiveTabContent = (imported: Tab) => {
    setImportError(null);
    commitTabs((ts) =>
      ts.map((t) =>
        t.id === activeId
          ? {
              ...t,
              elements: imported.elements,
              theme: imported.theme ?? t.theme,
              backgroundColor: imported.backgroundColor ?? t.backgroundColor,
              backgroundPattern: imported.backgroundPattern ?? t.backgroundPattern,
              backgroundOpacity: imported.backgroundOpacity ?? t.backgroundOpacity,
              patternColor: imported.patternColor ?? t.patternColor,
              backgroundPatternScale: imported.backgroundPatternScale ?? t.backgroundPatternScale,
              // Tab-level typography rides the export too (spec/13):
              // without these an exported tab using a tab font came
              // back rendering in the default face.
              font: imported.font ?? t.font,
              defaultTextSize: imported.defaultTextSize ?? t.defaultTextSize,
              templateChosen: true,
            }
          : t,
      ),
    );
    setSelectedId(null);
    setEditingId(null);
    setFormatSourceId(null);
    setGroupSourceId(null);
  };

  // Import TEXT of a given format into the active tab (spec/27 + spec/73).
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
      // Ids are already re-minted inside the converter (spec/87), so this
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

  // Import a FILE into the active tab (spec/27). Picks a file for the
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
