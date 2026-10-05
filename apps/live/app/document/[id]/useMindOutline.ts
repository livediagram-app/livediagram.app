'use client';

// Edit Outline (docs/specs/009-elements/mind-node.md "Edit Outline"): the map a root heads, written
// out as an indented outline in a dialog, and applied back on Save as ONE change (one undo step):
// lines keep their nodes, new lines become nodes dressed like their level (lib/mind-dress.ts), lines
// that are gone take their nodes with them, and the map is laid out again in the outline's order.
// The pure work is the document package's (mind-outline.ts); this holds the dialog's open root and
// commits.
import { useState } from 'react';
import {
  applyMindOutline,
  isMindNode,
  mindFlowOf,
  mindOutlineText,
  mindRootOf,
  parseMindOutline,
  type Element,
  type ShapeElement,
  type Tab,
} from '@livediagram/document';
import { dressMindConnector, dressMindNode } from '@/lib/mind-dress';
import { track } from '@/lib/telemetry';
import { debugLog } from '@/lib/debug-log';

export type MindOutlineApi = {
  // The root whose outline is open in the dialog, or null.
  openForId: string | null;
  // Whether `id` is a root whose outline may be edited now.
  canEdit: (id: string) => boolean;
  open: (id: string) => void;
  close: () => void;
  // The open map written out.
  text: () => string;
  // Applies `text` to the open map; false when it changed nothing (or could not apply).
  save: (text: string) => boolean;
};

const rootAt = (elements: Element[], id: string): ShapeElement | null => {
  const el = elements.find((e) => e.id === id);
  if (!el || !isMindNode(el)) return null;
  return mindRootOf(elements, el).id === el.id ? el : null;
};

export function useMindOutline(opts: {
  editsBlocked: boolean;
  activeId: string;
  activeTab: Tab;
  commitTabs: (updater: (tabs: Tab[]) => Tab[]) => void;
}): MindOutlineApi {
  const { editsBlocked, activeId, activeTab, commitTabs } = opts;
  const [openForId, setOpenForId] = useState<string | null>(null);
  // The dialog goes with its map: a root deleted (or a tab switched) meanwhile closes it.
  const openRoot = openForId ? rootAt(activeTab.elements, openForId) : null;
  if (openForId && !openRoot) setOpenForId(null);

  const canEdit = (id: string) =>
    !editsBlocked && !activeTab.locked && !!rootAt(activeTab.elements, id);

  const open = (id: string) => {
    if (!canEdit(id)) return;
    track('UI', 'Opened', 'MindOutline');
    setOpenForId(id);
  };

  const text = () => {
    if (!openRoot) return '';
    return mindOutlineText(
      activeTab.elements,
      openRoot.id,
      mindFlowOf(activeTab.elements, openRoot),
    );
  };

  const save = (input: string) => {
    if (!openRoot || editsBlocked) return false;
    const outline = parseMindOutline(input);
    if (!outline) return false;
    const rootId = openRoot.id;
    const dress = {
      newId: () => crypto.randomUUID(),
      node: (node: ShapeElement, from: ShapeElement | null) => dressMindNode(node, from, activeTab),
      connector: dressMindConnector,
    };
    // Checked against the tab as it stands, then applied inside the commit to the elements as they
    // stand there (an edit that landed in between is kept).
    if (!applyMindOutline(activeTab.elements, rootId, outline, dress)) return false;
    commitTabs((ts) =>
      ts.map((t) => {
        if (t.id !== activeId) return t;
        const next = applyMindOutline(t.elements, rootId, outline, dress);
        return next ? { ...t, elements: next } : t;
      }),
    );
    debugLog(`[mind-outline] saved root=${rootId}`);
    track('Element', 'Changed', 'MindOutline');
    return true;
  };

  return {
    openForId: openRoot ? openRoot.id : null,
    canEdit,
    open,
    close: () => setOpenForId(null),
    text,
    save,
  };
}
