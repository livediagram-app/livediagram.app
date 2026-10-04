// The document at a glance (docs/specs/024-agents/blueprints/document-views.md "overview", VW37): one
// line per tab, built from each tab's header facts so the caller never holds every tab body at once.
import type { OverviewView, ViewDoor } from '@livediagram/api-schema';
import { computeRefs } from '@livediagram/document';
import { fitLines, type ViewLine } from './budget';
import { headerSegments, type HeaderFacts } from './header';
import { jsonString, plural } from './text';

export type OverviewDocument = { id: string; name: string; savedAt: number };
// A tab outside a tab-scoped visitor's scope is named by its id alone; its body is never read.
export type OverviewTabInput =
  { id: string; outOfScope: true } | { id: string; outOfScope: false; facts: HeaderFacts };
export type OverviewOptions = { now: number; budget?: number; door?: ViewDoor };

const TAB = { one: 'tab', many: 'tabs' };
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const AGE_DAYS_MAX = 30;

// `just now`, `5m ago`, `3h ago`, `12d ago`, else the UTC date.
export function editedAge(savedAt: number, now: number): string {
  const age = now - savedAt;
  if (age < MINUTE) return 'just now';
  if (age < HOUR) return `${Math.floor(age / MINUTE)}m ago`;
  if (age < DAY) return `${Math.floor(age / HOUR)}h ago`;
  if (age < AGE_DAYS_MAX * DAY) return `${Math.floor(age / DAY)}d ago`;
  return new Date(savedAt).toISOString().slice(0, 10);
}

export function overviewView(
  document: OverviewDocument,
  tabs: readonly OverviewTabInput[],
  options: OverviewOptions,
): { text: string; json: OverviewView } {
  const refs = computeRefs(tabs.map((t) => t.id));
  const entries = tabs.map((tab) => {
    const ref = refs.refOf(tab.id);
    if (tab.outOfScope) {
      return {
        line: { text: `  tab ${ref} (out of scope)`, noun: TAB },
        json: { outOfScope: true as const, ref },
      };
    }
    const facts: HeaderFacts = { ...tab.facts, tab: { ...tab.facts.tab, ref } };
    const line: ViewLine = {
      text: `  tab ${ref} ${jsonString(facts.tab.name)} · ${headerSegments(facts)}`,
      noun: TAB,
    };
    return { line, json: { ...facts, view: 'overview' as const, outOfScope: false as const } };
  });
  const header = `doc ${document.id} ${jsonString(document.name)} · ${plural(tabs.length, 'tab', 'tabs')} · edited ${editedAge(document.savedAt, options.now)}`;
  const fitted = fitLines({
    header,
    lines: entries.map((e) => e.line),
    budget: options.budget,
    door: options.door ?? 'cli',
  });
  return {
    text: fitted.text,
    json: {
      document: { ...document, tabs: tabs.length },
      tabs: entries.slice(0, fitted.kept).map((e) => e.json),
      elision: fitted.elision,
    },
  };
}
