'use client';

// The plan as a rule names it (docs/specs/026-plan/blueprints/automations.md "Editor": "Pickers read the plan outline
// the editor already holds"): its card types and their fields, its columns by status, its people and labels, its
// Form tabs and the boards' saved filters. The sentence (ruleSentence) and every step panel read it; nothing here is
// fetched. The tabs are read once, when the screen opens (PlanContext's planTabs reads them when called).

import { useMemo } from 'react';
import {
  BUILT_IN_FIELD_NAMES,
  knownFieldKind,
  labelUsage,
  typeFieldLabel,
  normaliseBoardSetup,
  type Item,
  type ItemPerson,
  type ItemTypeDef,
  type RuleSentenceOutline,
} from '@liveplanner/items';
import { tabKindOf, type Tab } from '@liveplanner/project';
import { usePlan } from '@/components/plan/PlanContext';

export type OutlineBoard = {
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
  labels: readonly string[];
  forms: readonly { id: string; name: string }[];
  boards: readonly OutlineBoard[];
  items: ReadonlyMap<string, Item>;
};

const NO_ITEMS: ReadonlyMap<string, Item> = new Map();

/** The Form tabs and the boards with their saved filters, from the plan's tabs. */
export function tabsOutline(tabs: readonly Tab[]): {
  forms: { id: string; name: string }[];
  boards: OutlineBoard[];
} {
  const forms: { id: string; name: string }[] = [];
  const boards: OutlineBoard[] = [];
  for (const tab of tabs) {
    if (tabKindOf(tab) === 'form') forms.push({ id: tab.id, name: tab.name });
    for (const el of tab.elements) {
      if (el.type !== 'shape' || el.shape !== 'plan-board') continue;
      const setup = normaliseBoardSetup(el.planBoard);
      if (!setup) continue;
      boards.push({
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

export function useAutomationOutline(): AutomationOutline {
  const plan = usePlan();
  const types = plan?.types;
  const statusNames = plan?.statusNames;
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
    for (const b of fromTabs.boards) for (const f of b.filters) filters.set(f.id, f.name);
    const tabs = new Map<string, string>();
    for (const f of fromTabs.forms) tabs.set(f.id, f.name);
    for (const b of fromTabs.boards) tabs.set(b.tabId, b.tabName);
    return {
      types: types ?? [],
      statuses,
      columns: [...statuses].map(([status, name]) => ({ status, name })),
      people: people ?? [],
      labels,
      tabs,
      filters,
      forms: fromTabs.forms,
      boards: fromTabs.boards,
      items,
    };
  }, [types, statusNames, people, labels, fromTabs, items]);
}
