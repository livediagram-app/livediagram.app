// Tab import (docs/specs/020-import-export/markdown-import.md), lifted out of useTabActions: the id re-mint imported
// elements go through, the single-undo-step content replace, and the format-dispatched importer (JSON / Markdown)
// with its lazy-loaded parsers.

import { remapElementRefs, savableElements, type Element, type Tab } from '@livepages/document';
import { mergeImportedTab } from '@/lib/import-merge';
import type { ImportOutcome } from '@/lib/import-tab';
import { track } from '@/lib/telemetry';
import { debugLog } from '@/lib/debug-log';

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
  // Arrow endpoints follow the new ids. Element links are left alone: a link names its tab too, and
  // that is still the source tab, where the original element still is.
  return { elements: remapElementRefs(minted, ids), ids };
}

// A tab's elements re-minted as above. Shared with useTabActions' Duplicate.
export function remintTabElements<T extends Pick<Tab, 'elements'>>(tab: T): T {
  return { ...tab, elements: remintElements(tab.elements).elements };
}

export type ImportFormat = 'json' | 'markdown';

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
}: TabImportDeps) {
  // Replace the ACTIVE tab's content with an imported tab — its
  // elements + theme/background, keeping the tab's own id and name.
  // Goes through `commitTabs` so the whole replace is a single undo
  // step (the warning in the Import dialog promises this). Selection /
  // edit state is cleared so nothing dangles over the new content.
  const replaceActiveTabContent = (raw: Tab) => {
    setImportError(null);
    // Only what the api will save lands: an element the validator refuses would make every later save of this tab
    // fail.
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

  // Import TEXT of a given format into the active tab (docs/specs/020-import-export/markdown-import.md). Shared by
  // the Import dialog's paste-editor path and the file path (which reads the file then hands the text here), so both
  // routes run the exact same parse + replace. The parsers are lazy-loaded so their code stays out of the editor's
  // initial bundle. Never throws — returns the outcome the dialog renders (close / stay / show error).
  const importTextIntoActiveTab = async (
    format: ImportFormat,
    text: string,
  ): Promise<ImportOutcome> => {
    const active = tabs.find((t) => t.id === activeId);
    if (active?.locked) {
      return { status: 'error', error: 'This tab is locked. Unlock it before importing.' };
    }

    if (format === 'markdown') {
      const { buildTabFromMarkdown, markdownImportOutcome } = await import('@/lib/markdown-import');
      const result = buildTabFromMarkdown(text, { tabName: active?.name });
      if (!result.ok) return { status: 'error', error: result.error };
      replaceActiveTabContent(result.tab);
      track('Tab', 'Imported', 'Markdown');
      // Tables written as lists: the dialog's report says so.
      return markdownImportOutcome(result.tables);
    }

    const { parseImportedTab } = await import('@/lib/import-tab');
    const result = parseImportedTab(text);
    if (!result.ok) return { status: 'error', error: result.error };
    replaceActiveTabContent(remintTabElements(result.tab));
    track('Tab', 'Imported', 'JSON');
    return { status: 'done' };
  };

  // Import a FILE into the active tab (docs/specs/020-import-export/markdown-import.md). Picks a file for the
  // chosen format, then hands its text to importTextIntoActiveTab so the file and paste paths converge on one
  // parser. Returns the dialog outcome; 'cancelled' when the file picker is dismissed.
  const importIntoActiveTab = async (format: ImportFormat): Promise<ImportOutcome> => {
    const active = tabs.find((t) => t.id === activeId);
    if (active?.locked) {
      return { status: 'error', error: 'This tab is locked. Unlock it before importing.' };
    }
    const accept =
      format === 'markdown'
        ? 'text/markdown,.md,.markdown,.mdown,.mkd,text/plain'
        : '.json,application/json';
    const { pickTabFile } = await import('@/lib/import-tab');
    const picked = await pickTabFile(accept);
    if (!picked) return { status: 'cancelled' };
    return importTextIntoActiveTab(format, picked.text);
  };

  return { replaceActiveTabContent, importIntoActiveTab, importTextIntoActiveTab };
}
