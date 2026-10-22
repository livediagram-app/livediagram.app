// Runs operations (the line form, a JSON line each for an add) on the Sprint 14 Dashboard (or a given tab) with
// deterministic ids, and reads what came out; shared by the operation suites. A line that does not parse answers its
// errors.

import type { Element, Tab } from '@liveplanner/project';
import { applyEditOperations } from '../apply';
import { parseEditOperations } from '../parse';
import type { ApplyOptions, ApplyOutcome } from '../types';
import { fixedIds, sprintDashboard } from './sprint-dashboard';

export function run(
  text: string,
  tab: Tab = sprintDashboard(),
  options: ApplyOptions = {},
): ApplyOutcome {
  const parsed = parseEditOperations(text);
  return 'errors' in parsed
    ? parsed
    : applyEditOperations(tab, parsed.operations, { makeId: fixedIds(), ...options });
}

// An add's JSON line.
export const addLine = (element: Record<string, unknown>) => JSON.stringify({ op: 'add', element });

// The dashboard with its elements changed.
export function dashboardWith(change: (el: Element) => Element): Tab {
  const tab = sprintDashboard();
  return { ...tab, elements: tab.elements.map(change) };
}

export const lockedDashboard = (...ids: string[]) =>
  dashboardWith((el) => (ids.includes(el.id) ? { ...el, locked: true } : el));

export const elementOf = (tab: Tab, id: string): Element | undefined =>
  tab.elements.find((e) => e.id === id);
