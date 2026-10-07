'use client';

// The editor's side of the workbench messages (docs/specs/013-workspace/blueprints/workbench-embeds.md
// "Workbench messages"): `ready` once the document is in, `tab` on every later tab change, `selection`
// once the selection has been still for WORKBENCH_SELECTION_SETTLE_MS and only when its text changed
// (WB17), and the workbench's `reveal` and `theme`. Messages are built after the settle, off the input
// event, so a marquee drag costs one reference. Nothing runs outside a workbench.
import { useEffect, useEffectEvent, useRef } from 'react';
import {
  CHANGESET_REVEAL_MS,
  WORKBENCH_SELECTION_SETTLE_MS,
  type ShareRole,
} from '@livediagram/api-schema';
import { computeRefs, resolveRef, type Tab } from '@livediagram/document';
import { selectionReference } from '@livediagram/document-views';
import { setAppearanceOverride } from '@livediagram/ui';
import type { WorkbenchSession } from '@/components/providers/workbench-session-context';
import type { RevealStore } from '@/lib/changeset-reveals';
import { selectionIds, type SelectionStore } from '@/lib/selection-store';

export function useWorkbenchMessages(opts: {
  workbench: WorkbenchSession | null;
  hydrated: boolean;
  documentId: string | null;
  documentName: string;
  tabs: readonly Tab[];
  activeId: string;
  sessionRole: ShareRole;
  selection: SelectionStore;
  // The last revision the editor knows for a tab (useTabRevisions).
  revOf: (tabId: string) => number;
  // The changeset toast's Show: the tab, then the elements framed.
  revealInView: (tabId: string, ids: readonly string[]) => void;
  reveals: RevealStore;
  // The person's colour, for the reveal outline (WB18).
  selfColor: string;
}): void {
  const { workbench, hydrated, documentId, activeId, selection } = opts;
  const port = workbench?.port ?? null;
  // Where messages go, once the document is in.
  const target = port !== null && hydrated && documentId !== null ? { port, documentId } : null;
  type Target = NonNullable<typeof target>;
  const targetKey = target ? `${target.documentId}` : null;

  const activeTabOf = () => opts.tabs.find((t) => t.id === opts.activeId);

  // The scheme follows the workbench (WB15): the system's until it says.
  useEffect(() => {
    if (!port) return;
    setAppearanceOverride('system');
  }, [port]);

  const lastSent = useRef<string | null>(null);
  const sendSelection = useEffectEvent(({ port, documentId }: Target) => {
    const tab = activeTabOf();
    if (!tab) return;
    const { selectedId, multiSelectedIds } = selection.get();
    const rev = opts.revOf(tab.id);
    const { text, count } = selectionReference({
      documentId,
      documentName: opts.documentName,
      tab,
      tabIds: opts.tabs.map((t) => t.id),
      rev,
      selectedIds: [...selectionIds(selectedId, multiSelectedIds)],
    });
    if (text === lastSent.current) return;
    lastSent.current = text;
    port.send({
      type: 'livediagram:selection',
      v: 1,
      documentId,
      documentName: opts.documentName,
      tabId: tab.id,
      rev,
      count,
      reference: text,
    });
  });

  // Every change restarts the wait; the selection is read once it has been still.
  const settleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const scheduleSelection = useEffectEvent((to: Target) => {
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => sendSelection(to), WORKBENCH_SELECTION_SETTLE_MS);
  });
  const targetNow = useEffectEvent(() => target);
  useEffect(() => {
    const to = targetNow();
    if (!to) return;
    const unsubscribe = selection.subscribe(() => scheduleSelection(to));
    return () => {
      unsubscribe();
      clearTimeout(settleTimer.current);
    };
  }, [targetKey, selection]);

  // `ready` once; `tab` on every later change. Each restarts the selection's wait, so the workbench
  // hears what is selected on the tab now shown (nothing, after a switch: the whole tab).
  const sentReady = useRef(false);
  const announceTab = useEffectEvent((to: Target) => {
    const { port, documentId } = to;
    const tab = activeTabOf();
    if (!tab) return;
    if (!sentReady.current) {
      sentReady.current = true;
      port.send({
        type: 'livediagram:ready',
        v: 1,
        documentId,
        documentName: opts.documentName,
        tabId: tab.id,
        tabName: tab.name,
        role: opts.sessionRole,
      });
    } else {
      port.send({ type: 'livediagram:tab', v: 1, tabId: tab.id, tabName: tab.name });
    }
    scheduleSelection(to);
  });
  useEffect(() => {
    const to = targetNow();
    if (to) announceTab(to);
  }, [targetKey, activeId]);

  const revealCount = useRef(0);
  const reveal = useEffectEvent((refs: readonly string[]) => {
    const tab = activeTabOf();
    if (!tab) return;
    const table = computeRefs(tab.elements.map((el) => el.id));
    const ids = new Set<string>();
    let missed = 0;
    for (const ref of refs) {
      const found = resolveRef(ref, table);
      if (found.kind === 'found') ids.add(found.id);
      else missed += 1;
    }
    if (missed > 0) console.warn('[workbench] reveal-missed', { count: missed });
    if (ids.size === 0) return;
    opts.revealInView(tab.id, [...ids]);
    revealCount.current += 1;
    opts.reveals.add({
      changesetId: `workbench-reveal-${revealCount.current}`,
      tabId: tab.id,
      color: opts.selfColor,
      ids: [...ids],
      until: Date.now() + CHANGESET_REVEAL_MS,
    });
  });

  useEffect(() => {
    if (!port) return;
    return port.subscribe((message) => {
      if (message.type === 'livediagram:theme') setAppearanceOverride(message.colourScheme);
      else if (message.type === 'livediagram:reveal') reveal(message.refs);
    });
  }, [port]);
}
