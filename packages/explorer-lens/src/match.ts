// Narrowing a list by a lens (docs/specs/013-workspace/explorer-filters.md "Dimensions", "Matching").
// Rows are first reduced to subjects, so one rule serves documents, shared rows and, later, events.

import { isMadeByAiSource } from '@livediagram/api-schema';
import {
  KIND_VALUES,
  OPENS_IN_VALUES,
  TEMPLATE_VALUES,
  type EditedValue,
  type KindValue,
  type OpensInValue,
  type TemplateValue,
} from './dimensions';
import type { Lens, LensSubject } from './types';

const DAY_MS = 86_400_000;

/** The fields of a document summary the lens reads. `opensIn`, `tabKind` and `templateFamily` are
 *  the recorded creation intent; absent, null or retired values read as unknown. A document in
 *  this browser (Offline Mode) has no team, so it reads as `mine`. */
export type LensDocumentSummary = {
  name: string;
  savedAt: number;
  ownerId: string;
  teamId: string | null;
  source: string | null;
  opensIn?: string | null;
  tabKind?: string | null;
  templateFamily?: string | null;
};

function known<T extends string>(values: readonly T[], value: string | null | undefined): T | null {
  return values.find((candidate) => candidate === value) ?? null;
}

/** A personal, team or this-browser document as the reader sees it. The general diagram tab is
 *  no Kind value, so it reads as none. */
export function documentSubject(summary: LensDocumentSummary, viewerId: string): LensSubject {
  return {
    name: summary.name,
    savedAt: summary.savedAt,
    space: summary.teamId === null ? 'mine' : `team:${summary.teamId}`,
    people: summary.ownerId === viewerId ? 'me' : 'others',
    madeByAi: isMadeByAiSource(summary.source),
    opensIn: known<OpensInValue>(OPENS_IN_VALUES, summary.opensIn),
    kind: known<KindValue>(KIND_VALUES, summary.tabKind),
    template: known<TemplateValue>(TEMPLATE_VALUES, summary.templateFamily),
  };
}

/** A row of Shared with me: always someone else's, and silent on provenance, mode, kind and family. */
export function sharedSubject(item: { name: string; savedAt: number }): LensSubject {
  return {
    name: item.name,
    savedAt: item.savedAt,
    space: 'shared',
    people: 'others',
    madeByAi: null,
    opensIn: null,
    kind: null,
    template: null,
  };
}

/** Lower case with accents stripped, so "Café" and "cafe" compare equal. */
export function foldText(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/** The earliest save an Edited value includes, from `now` in local time. */
export function editedCutoff(value: EditedValue, now: number): number {
  const date = new Date(now);
  switch (value) {
    case 'today':
      return date.setHours(0, 0, 0, 0);
    case '7d':
      return now - 7 * DAY_MS;
    case '30d':
      return now - 30 * DAY_MS;
    case '12m':
      return date.setFullYear(date.getFullYear() - 1);
    case 'this-year':
      return new Date(date.getFullYear(), 0, 1).getTime();
  }
}

function nameHasEvery(name: string, words: readonly string[]): boolean {
  if (words.length === 0) return true;
  const folded = foldText(name);
  return words.every((word) => folded.includes(word));
}

/** Whether a set of values admits a subject's value: an unset dimension admits anything, a set one
 *  only its own values, and never an unknown. */
function admits<T>(values: readonly T[], value: T | null): boolean {
  return values.length === 0 || (value !== null && values.includes(value));
}

/** Compiles a lens once into a predicate: the cutoff and the folded words are worked out up front.
 *  Values of one dimension combine with or; dimensions combine with and. */
export function compileLens(lens: Lens, now: number): (subject: LensSubject) => boolean {
  const { filters } = lens;
  const words = lens.text.map(foldText);
  const cutoffs = filters.edited.map((value) => editedCutoff(value, now));
  const cutoff = cutoffs.length === 0 ? null : Math.min(...cutoffs);
  return (subject) =>
    admits(filters['opens-in'], subject.opensIn) &&
    admits(filters.kind, subject.kind) &&
    admits(filters.template, subject.template) &&
    (filters['made-by'].length === 0 || subject.madeByAi === true) &&
    (cutoff === null || subject.savedAt >= cutoff) &&
    admits(filters.people, subject.people) &&
    admits(filters.space, subject.space) &&
    nameHasEvery(subject.name, words);
}

export function matchesLens(subject: LensSubject, lens: Lens, now: number): boolean {
  return compileLens(lens, now)(subject);
}

/** The subjects the lens keeps, in their order, each with whatever else it carries. */
export function applyLens<T extends LensSubject>(
  subjects: readonly T[],
  lens: Lens,
  now: number,
): T[] {
  return subjects.filter(compileLens(lens, now));
}
