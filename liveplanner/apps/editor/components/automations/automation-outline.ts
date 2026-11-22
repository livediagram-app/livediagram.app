'use client';

// The plan as a rule names it (docs/specs/026-plan/blueprints/automations.md "Editor": "Pickers read the plan outline
// the editor already holds"): its card types and their fields, its columns by status, its people and labels, its
// Form tabs and the boards' saved filters. The sentence (ruleSentence) and every step panel read it; nothing here is
// fetched. The tabs are read once, when the screen opens (PlanContext's planTabs reads them when called).

import { promptOf, questionsOf, readForm } from '@liveplanner/forms';
import {
  BUILT_IN_FIELD_NAMES,
  knownFieldKind,
  labelUsage,
  typeFieldLabel,
  unheardFields,
  normaliseBoardSetup,
  savedFilterKey,
  type Item,
  type ItemPerson,
  type ItemTypeDef,
  type RuleSentenceOutline,
  type StatusPhase,
} from '@liveplanner/items';
import { tabKindOf, type Tab } from '@liveplanner/project';
import { useAutomationsAccess } from '@liveworkspace/automations-ui/AutomationsContext';
import type { ItemSnapshot, ItemSnapshots } from '@liveworkspace/automations-ui/item';
import {
  snapshotListStore,
  useSnapshotList,
} from '@liveworkspace/automations-ui/item/snapshot-list';
import { useSnapshotsDoor } from '@liveworkspace/snapshots/ui';
import { useCallback, useMemo } from 'react';
import { usePlan } from '@/components/plan/PlanContext';

export type OutlineBoard = {
  // The board's element id (Email Received's board).
  id: string;
  tabId: string;
  tabName: string;
  title: string;
  filters: readonly { id: string; name: string }[];
};

export type AutomationOutline = RuleSentenceOutline & {
  types: readonly ItemTypeDef[];
  people: readonly ItemPerson[];
  // The columns by status, in the plan's order.
  columns: readonly { status: string; name: string }[];
  // Where each column sits in the work (a board's done columns, its in-progress ones), for the templates.
  phases: ReadonlyMap<string, StatusPhase>;
  labels: readonly string[];
  // Each Form tab, with its questions' words (a Form Response rule's Insert a Value offers their answers).
  forms: readonly OutlineForm[];
  boards: readonly OutlineBoard[];
  items: ReadonlyMap<string, Item>;
  // The plan's snapshots, read once when a Revert to Snapshot panel first shows (spec "Snapshot steps").
  snapshots: ItemSnapshots;
};

const NO_ITEMS: ReadonlyMap<string, Item> = new Map();
const NO_PHASES: ReadonlyMap<string, StatusPhase> = new Map();

export type OutlineForm = { id: string; name: string; questions?: readonly string[] };

// A Form tab's questions' words, in order, each once.
const questionNames = (tab: Tab): string[] => {
  const form = readForm(tab.form);
  if (!form) return [];
  return [
    ...new Set(
      questionsOf(form)
        .map((q) => promptOf(q).trim())
        .filter(Boolean),
    ),
  ];
};

/** The Form tabs and the boards with their saved filters, from the plan's tabs. */
export function tabsOutline(tabs: readonly Tab[]): {
  forms: OutlineForm[];
  boards: OutlineBoard[];
} {
  const forms: OutlineForm[] = [];
  const boards: OutlineBoard[] = [];
  for (const tab of tabs) {
    if (tabKindOf(tab) === 'form')
      forms.push({ id: tab.id, name: tab.name, questions: questionNames(tab) });
    for (const el of tab.elements) {
      if (el.type !== 'shape' || el.shape !== 'plan-board') continue;
      const setup = normaliseBoardSetup(el.planBoard);
      if (!setup) continue;
      boards.push({
        id: el.id,
        tabId: tab.id,
        tabName: tab.name,
        title: setup.title,
        filters: (setup.savedFilters ?? []).map((f) => ({ id: f.id, name: f.name })),
      });
    }
  }
  return { forms, boards };
}

// The built-in fields a rule reads and writes (spec "Triggers": Field Changed's list); the rest have their own steps
// (Move to Column, Flag) or are never a rule's (comments, votes, attachments).
export const RULE_BUILT_IN_FIELDS: ReadonlySet<string> = new Set([
  'title',
  'description',
  'assignee',
  'priority',
  'labels',
  'start',
  'due',
  'estimate',
  'checklist',
  'flagged',
]);

export type OutlineField = { id: string; name: string; kind: string };

/** The fields a rule may read or write, built-in and custom, each once, by the plan's names, in type order. */
export function outlineFields(types: readonly ItemTypeDef[]): OutlineField[] {
  const seen = new Set<string>();
  const out: OutlineField[] = [];
  for (const t of types) {
    for (const id of t.fields) {
      if (seen.has(id)) continue;
      const custom = t.custom?.find((f) => f.id === id);
      if (custom) out.push({ id, name: custom.label, kind: custom.kind });
      else if (RULE_BUILT_IN_FIELDS.has(id) && id in BUILT_IN_FIELD_NAMES)
        out.push({ id, name: typeFieldLabel(t, id), kind: knownFieldKind(id) ?? 'text' });
      else continue;
      seen.add(id);
    }
  }
  return out;
}

/** Field Changed's choices: the fields a write changes, so leaving out Time Spent, a Votes tally, a Comments field
 *  and a Calculated value, which it never hears (spec "Triggers"). */
export function fieldChangeFields(types: readonly ItemTypeDef[]): OutlineField[] {
  return outlineFields(types).filter((f) => unheardFields(types, [f.id]).length === 0);
}

// The plan's snapshots as Revert to Snapshot lists them, one read while the screen is open.
const PLAN_SNAPSHOTS = snapshotListStore();
const NO_DOOR = (): Promise<readonly ItemSnapshot[]> =>
  Promise.reject(new Error('Snapshots are not offered here'));

// The snapshots through the editor's door (an Editor of the whole plan, stored on the server: as the screen's own gate).
function usePlanSnapshots(): ItemSnapshots {
  const id = useAutomationsAccess()?.scope.itemId ?? '';
  const api = useSnapshotsDoor()?.door.api;
  const read = useCallback(
    async (): Promise<readonly ItemSnapshot[]> => (api ? (await api.list()).snapshots : NO_DOOR()),
    [api],
  );
  return useSnapshotList(PLAN_SNAPSHOTS, id, read, false);
}

export function useAutomationOutline(): AutomationOutline {
  const plan = usePlan();
  const snapshots = usePlanSnapshots();
  const types = plan?.types;
  const statusNames = plan?.statusNames;
  const phases = plan?.statusPhases ?? NO_PHASES;
  const people = plan?.people;
  const items = plan?.items ?? NO_ITEMS;
  const planTabs = plan?.planTabs;
  // The tabs once, as the screen opens: what a board's filters are called does not move under an open picker.
  const fromTabs = useMemo(() => tabsOutline(planTabs?.() ?? []), [planTabs]);
  // Labels change as cards do; counted only when the cards change.
  const labels = useMemo(() => labelUsage(items.values()).map((l) => l.label), [items]);
  return useMemo<AutomationOutline>(() => {
    const statuses = statusNames ?? new Map<string, string>();
    const filters = new Map<string, string>();
    for (const b of fromTabs.boards)
      for (const f of b.filters) filters.set(savedFilterKey(b.tabId, f.id), f.name);
    const tabs = new Map<string, string>();
    for (const f of fromTabs.forms) tabs.set(f.id, f.name);
    for (const b of fromTabs.boards) tabs.set(b.tabId, b.tabName);
    const boardNames = new Map(fromTabs.boards.map((b) => [b.id, b.title.trim() || 'Board']));
    return {
      types: types ?? [],
      statuses,
      columns: [...statuses].map(([status, name]) => ({ status, name })),
      phases,
      people: people ?? [],
      labels,
      tabs,
      filters,
      boardNames,
      forms: fromTabs.forms,
      boards: fromTabs.boards,
      items,
      // The editor never shows an id: a gone column, card type, field or Form tab reads in words.
      goneWords: true,
      snapshots,
    };
  }, [types, statusNames, phases, people, labels, fromTabs, items, snapshots]);
}
