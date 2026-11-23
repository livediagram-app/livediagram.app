'use client';

// Page labels in the editor (docs/specs/030-knowledgebase/page-surface.md "Page labels"; blueprint
// docs/specs/030-knowledgebase/blueprints/page-labels.md): the knowledgebase's labels from the settings store, the
// open page's own (its ids settled as every stored value is, since a peer's tab-meta patch is untrusted), how many
// pages carry each, who may change them, and the writes. A page's labels are its meta, outside the writing and its
// draft: they ride the tab's save and its `tab-meta` op, as the icon does. A label's own change is one write of the
// knowledgebase's list (label-writes.ts).
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import {
  MAX_PAGE_LABELS,
  labelPageCounts,
  labelsByUse,
  newLabelId,
  nextLabelColour,
  pageLabelsOf,
  parseTabLabels,
  withTabLabels,
  type KnowledgeLabel,
  type LabelColour,
  type Tab,
} from '@liveknowledge/document';
import { useEditorChrome, useEditorChromeStore } from '@/app/document/[id]/EditorContext';
import { sameTabsForBar } from '@/app/document/[id]/editor-view-bars';
import { useIsOfflineDocument } from '@/hooks/persistence/useIsOfflineDocument';
import { useToast } from '@/hooks/ui/useToast';
import { knowledgeSettingsStore } from '@/lib/knowledge-settings/knowledge-settings-store';
import { changeLabels, labelFailureText, type LabelTarget } from '@/lib/page-labels/label-writes';
import { track } from '@/lib/telemetry';

const NO_IDS: readonly string[] = Object.freeze([]);

// Settled once per stored list: the meta row and the picker read it on every store change.
const settled = new WeakMap<object, readonly string[]>();
export function labelIdsOfTab(tab: Pick<Tab, 'labels'>): readonly string[] {
  const raw: unknown = tab.labels;
  if (!Array.isArray(raw) || raw.length === 0) return NO_IDS;
  const held = settled.get(raw);
  if (held) return held;
  const ids = Object.freeze(parseTabLabels(raw));
  settled.set(raw, ids);
  return ids;
}

/** The knowledgebase's labels, in their stored order. */
export function useKnowledgeLabels(): readonly KnowledgeLabel[] {
  const documentId = useEditorChrome((s) => s.documentId);
  const read = () => knowledgeSettingsStore.labelsOf(documentId);
  return useSyncExternalStore(knowledgeSettingsStore.subscribe, read, read);
}

/** How many pages carry each label, from the tab list (one pass; a typing commit changes nothing here). */
export function useLabelCounts(): ReadonlyMap<string, number> {
  const tabs = useEditorChrome((s) => s.tabs, sameTabsForBar);
  return useMemo(() => labelPageCounts(tabs), [tabs]);
}

/** The labels most used first, then by name: what the picker and the filter's menu list. */
export function useLabelsByUse(): KnowledgeLabel[] {
  const labels = useKnowledgeLabels();
  const counts = useLabelCounts();
  return useMemo(() => labelsByUse(labels, counts), [labels, counts]);
}

/** The open page's label ids, settled. */
export function usePageLabelIds(): readonly string[] {
  return useEditorChrome((s) => labelIdsOfTab(s.activeTab));
}

/** The open page's labels that exist, in the page's order. */
export function usePageLabels(): KnowledgeLabel[] {
  const ids = usePageLabelIds();
  const labels = useKnowledgeLabels();
  return useMemo(() => pageLabelsOf(ids, labels), [ids, labels]);
}

/** Whether this person may label pages and change the labels: a writer of the whole knowledgebase (an Editor or a
 *  Participant), whenever the page is shown; never a Viewer, a link visitor or a link confined to one page. Labelling
 *  is how pages are found, not how one looks, so it is not held to edit mode. */
export function useLabelsEditable(): boolean {
  return useEditorChrome((s) => s.can.editPages && !s.isStructureReadOnly);
}

export type LabelActions = {
  /** Put the label on the open page, or take it off. */
  toggle: (id: string) => void;
  /** Make a label of this name and put it on the open page. */
  create: (name: string) => Promise<void>;
  rename: (id: string, name: string) => Promise<boolean>;
  recolour: (id: string, colour: LabelColour) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

/** The writes, each with a toast in words when it is refused. */
export function useLabelActions(): LabelActions {
  const chrome = useEditorChromeStore();
  const toast = useToast();
  const documentId = useEditorChrome((s) => s.documentId);
  const offline = useIsOfflineDocument(documentId);
  const targetOf = useCallback((): LabelTarget | null => {
    const s = chrome.get();
    if (!s.documentId) return null;
    return {
      who: { ownerId: s.selfParticipant.id, shareCode: s.sessionShareCode },
      documentId: s.documentId,
      offline,
    };
  }, [chrome, offline]);

  return useMemo(() => {
    const setPageLabels = (next: (ids: readonly string[]) => readonly string[]): boolean => {
      const s = chrome.get();
      const id = s.activeTab.id;
      const was = labelIdsOfTab(s.activeTab);
      const ids = next(was);
      if (ids.length > MAX_PAGE_LABELS) {
        toast.error(`A page carries at most ${MAX_PAGE_LABELS} labels.`);
        return false;
      }
      s.commitTabs((ts) => ts.map((t) => (t.id === id ? withTabLabels(t, ids) : t)));
      return true;
    };
    const attempt = async (run: (target: LabelTarget) => Promise<unknown>): Promise<boolean> => {
      // A label to change is listed only in an open knowledgebase.
      const target = targetOf()!;
      try {
        await run(target);
        return true;
      } catch (err) {
        toast.error(labelFailureText(err));
        return false;
      }
    };
    return {
      toggle: (labelId) => {
        const on = labelIdsOfTab(chrome.get().activeTab).includes(labelId);
        if (setPageLabels((ids) => (on ? ids.filter((x) => x !== labelId) : [...ids, labelId])))
          track('Element', on ? 'Deleted' : 'Added', 'Label');
      },
      create: async (name) => {
        const target = targetOf();
        if (!target) return;
        if (labelIdsOfTab(chrome.get().activeTab).length >= MAX_PAGE_LABELS) {
          toast.error(`A page carries at most ${MAX_PAGE_LABELS} labels.`);
          return;
        }
        const id = newLabelId();
        const colour = nextLabelColour(knowledgeSettingsStore.labelsOf(target.documentId));
        // The label shows on the page at once; changeLabels holds it in the store before it is sent.
        const made = changeLabels(target, { kind: 'add', id, name, colour }, Date.now());
        setPageLabels((ids) => [...ids, id]);
        track('Element', 'Added', 'Label');
        try {
          await made;
        } catch (err) {
          // Refused: the label is gone, and comes off the page again.
          setPageLabels((ids) => ids.filter((x) => x !== id));
          toast.error(labelFailureText(err));
        }
      },
      rename: async (id, name) => {
        const done = await attempt((t) =>
          changeLabels(t, { kind: 'rename', id, name }, Date.now()),
        );
        if (done) track('Element', 'Changed', 'Label');
        return done;
      },
      recolour: async (id, colour) => {
        if (await attempt((t) => changeLabels(t, { kind: 'recolour', id, colour }, Date.now())))
          track('Element', 'Changed', 'Label');
      },
      remove: async (id) => {
        await attempt((t) => changeLabels(t, { kind: 'delete', id }, Date.now()));
      },
    };
  }, [chrome, toast, targetOf]);
}
