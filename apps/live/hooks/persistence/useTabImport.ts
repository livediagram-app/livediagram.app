// Tab import (spec/27 + spec/73), lifted out of useTabActions: the
// id re-mint imported elements go through, the single-undo-step content
// replace, and the format-dispatched importer (JSON / DSL / Markdown)
// with its lazy-loaded parser cluster (JSON / Markdown / Mermaid).

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

  // Import a file INTO the active tab, replacing its contents (spec/27).
  // The Import dialog passes the user's chosen format, which drives both
  // the file-picker filter and the parser. Returns an outcome the dialog
  // renders (close / stay / show error) rather than throwing.
  const importIntoActiveTab = async (format: 'json' | 'markdown'): Promise<ImportOutcome> => {
    const active = tabs.find((t) => t.id === activeId);
    if (active?.locked) {
      return { status: 'error', error: 'This tab is locked. Unlock it before importing.' };
    }
    const accept =
      format === 'markdown'
        ? 'text/markdown,.md,.markdown,.mdown,.mkd,text/plain'
        : '.json,application/json';
    // Lazy-load the whole import cluster on first use: its static chain
    // (import-tab -> export-tab -> svg-render + the DSL parser) put
    // ~28 kB min of parse/serialise code in the editor's FIRST LOAD for
    // a user-action feature (same rationale as the markdown branch
    // below and the template builders).
    const { parseImportedTab, pickTabFile } = await import('@/lib/import-tab');
    const picked = await pickTabFile(accept);
    if (!picked) return { status: 'cancelled' };

    if (format === 'markdown') {
      // Lazy-load the parser so its ~300 lines stay out of the editor's
      // initial bundle (same rationale as the template builders).
      const { buildTabFromMarkdown } = await import('@/lib/markdown-import');
      const result = buildTabFromMarkdown(picked.text, {
        tabName: active?.name,
        themeId: active?.theme,
      });
      if (!result.ok) return { status: 'error', error: result.error };
      replaceActiveTabContent(result.tab);
      track('Tab', 'Imported', 'Markdown');
      return { status: 'done' };
    }

    const result = parseImportedTab(picked.text);
    if (!result.ok) return { status: 'error', error: result.error };
    replaceActiveTabContent({ ...result.tab, elements: remintElementIds(result.tab.elements) });
    track('Tab', 'Imported', 'JSON');
    return { status: 'done' };
  };

  return { replaceActiveTabContent, importIntoActiveTab };
}
