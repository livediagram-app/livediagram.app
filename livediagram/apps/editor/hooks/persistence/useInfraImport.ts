// The infrastructure import and the update from a tab's files (docs/specs/020-import-export/infrastructure-import.md
// "The editor" and "Updating a tab from its files"; blueprint "The editor"). The parsers, the merge and the placement
// load here, on first use, so none of them reach the editor's first load. Each is one commit, so one undo takes it
// back with the tab's remembered files as they were.

import {
  savableElements,
  tabSourcesOf,
  type DiagramSources,
  type Element,
  type Tab,
} from '@livediagram/document';
import type { InfraFile, InfraFormat } from '@livediagram/document/infra-code';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { INFRA_LOCKED, infraImportOutcome, infraUpdateOutcome } from '@/lib/infra-import';
import type { ImportOutcome } from '@/lib/import-tab';
import { track } from '@/lib/telemetry';
import { getTheme } from '@/lib/themes';

const FORMAT_TELEMETRY: Record<InfraFormat, string> = {
  wrangler: 'Wrangler',
  compose: 'Compose',
  terraform: 'Terraform',
  kubernetes: 'Kubernetes',
};

type InfraImportDeps = {
  tabs: Tab[];
  activeId: string;
  commitTabs: (mapTabs: (ts: Tab[]) => Tab[]) => void;
  // The import's replace: one undo step, selection cleared, the view framed (useTabImport).
  replaceActiveTabContent: (tab: Tab) => void;
  setSelectedId: (id: string | null) => void;
  setEditingId: (id: string | null) => void;
  setFormatSourceId: (id: string | null) => void;
  setImportError: (message: string | null) => void;
  noteImport?: (tabId: string, elements: readonly Element[]) => void;
};

// Read the files and lay them out as the import draws them, the theme's presets rederived.
async function drawFiles(files: readonly InfraFile[], env: string | undefined, theme?: string) {
  const [infra, { layoutGraph, rederiveColorPresetForTheme }] = await Promise.all([
    import('@livediagram/document/infra-code'),
    import('@livediagram/document'),
  ]);
  const result = infra.infraGraph(files, env ? { env } : {});
  if (!result.ok) {
    const { file, message } = result.error;
    return { ok: false as const, error: file ? `${file}: ${message}` : message };
  }
  const look = getTheme(theme);
  const elements = layoutGraph(result.graph).map((el) =>
    el.type === 'shape' && el.colorPreset ? rederiveColorPresetForTheme(el, look) : el,
  );
  return { ok: true as const, infra, result, elements };
}

export function useInfraImport({
  tabs,
  activeId,
  commitTabs,
  replaceActiveTabContent,
  setSelectedId,
  setEditingId,
  setFormatSourceId,
  setImportError,
  noteImport,
}: InfraImportDeps) {
  // Draw the files as the tab, which remembers them.
  const importInfraFiles = async (
    files: readonly InfraFile[],
    env?: string,
  ): Promise<ImportOutcome> => {
    const active = tabs.find((t) => t.id === activeId);
    if (active?.locked) return { status: 'error', error: INFRA_LOCKED };
    const drawn = await drawFiles(files, env, active?.theme);
    if (!drawn.ok) return { status: 'error', error: drawn.error };
    const { infra, result, elements } = drawn;
    const sources: DiagramSources = {
      bridge: 'infra',
      files: infra.sourceFiles(files),
      ...(env ? { env } : {}),
      readAt: Date.now(),
      ...infra.drawnRecord(elements, result.graph),
    };
    replaceActiveTabContent({
      id: activeId,
      name: active?.name ?? '',
      elements,
      theme: active?.theme,
      sources,
    });
    track('Tab', 'Imported', FORMAT_TELEMETRY[result.files[0]!.format]);
    debugLog('[infra-import]', {
      formats: [...new Set(result.files.map((f) => f.format))],
      files: files.length,
      nodes: result.graph.nodes.length,
      edges: result.graph.edges.length,
      skipped: result.skipped.length,
      leftOut: result.leftOut,
    });
    return infraImportOutcome(elements, {
      skippedLine: infra.skippedLine(result.skipped),
      skippedKeys: result.skipped.length,
      leftOut: result.leftOut,
      maxNodes: infra.INFRA_MAX_NODES,
      linesLeftOut: result.linesLeftOut,
      linesKept: result.graph.edges.length,
    });
  };

  // Read the files again over the tab as people left it: their layout and edits stay, the files' changes land.
  const updateFromSources = async (
    files: readonly InfraFile[],
    env?: string,
  ): Promise<ImportOutcome> => {
    const active = tabs.find((t) => t.id === activeId);
    if (!active) return { status: 'error', error: 'This tab is not open.' };
    if (active.locked) return { status: 'error', error: INFRA_LOCKED };
    const record = tabSourcesOf(active);
    if (!record) return { status: 'error', error: 'This tab was not drawn from files.' };
    const drawn = await drawFiles(files, env, active.theme);
    if (!drawn.ok) return { status: 'error', error: drawn.error };
    const { infra, result, elements: fresh } = drawn;
    const merged = infra.mergeSourceGraph({
      tab: active.elements,
      record,
      fresh,
      graph: result.graph,
    });
    // Only what the api will save lands, as for every import.
    const { elements } = savableElements(merged.elements);
    const sources: DiagramSources = {
      bridge: 'infra',
      files: infra.sourceFiles(files),
      ...(env ? { env } : {}),
      readAt: Date.now(),
      nodes: merged.nodes,
      edges: merged.edges,
    };
    setImportError(null);
    noteImport?.(activeId, elements);
    commitTabs((ts) => ts.map((t) => (t.id === activeId ? { ...t, elements, sources } : t)));
    setSelectedId(null);
    setEditingId(null);
    setFormatSourceId(null);
    track('Tab', 'Imported', 'InfraUpdate');
    debugLog('[infra-update]', { files: files.length, ...merged.counts });
    return infraUpdateOutcome(elements, files.length, merged.counts, {
      skippedLine: infra.skippedLine(result.skipped),
      skippedKeys: result.skipped.length,
    });
  };

  return { importInfraFiles, updateFromSources };
}
