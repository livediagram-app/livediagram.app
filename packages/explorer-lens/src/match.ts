// Narrowing a list by a lens (docs/specs/013-workspace/explorer-filters.md "Dimensions", "Matching").
// Rows are first reduced to subjects, so one rule serves documents, shared rows and, later, events.

import {
  BOARD_VALUES,
  OPENS_IN_VALUES,
  type BoardValue,
  type EditedValue,
  type OpensInValue,
} from './dimensions';
import type { Lens, LensSubject } from './types';

const DAY_MS = 86_400_000;

/** The fields of a document summary the lens reads. `opensIn` / `boardType` are the recorded
 *  creation intent; absent, null or retired values read as unknown. */
export type LensDocumentSummary = {
  name: string;
  savedAt: number;
  ownerId: string;
  teamId: string | null;
  source: string | null;
  opensIn?: string | null;
  boardType?: string | null;
};

function known<T extends string>(values: readonly T[], value: string | null | undefined): T | null {
  return values.find((candidate) => candidate === value) ?? null;
}

/** A personal, team or this-browser document as the reader sees it. */
export function documentSubject(summary: LensDocumentSummary, viewerId: string): LensSubject {
  return {
    name: summary.name,
    savedAt: summary.savedAt,
    space: summary.teamId === null ? 'mine' : `team:${summary.teamId}`,
    people: summary.ownerId === viewerId ? 'me' : 'others',
    madeByAi: summary.source !== null,
    opensIn: known<OpensInValue>(OPENS_IN_VALUES, summary.opensIn),
    board: known<BoardValue>(BOARD_VALUES, summary.boardType),
  };
}

/** A row of Shared with me: always someone else's, and silent on provenance, mode and board. */
export function sharedSubject(item: { name: string; savedAt: number }): LensSubject {
  return {
    name: item.name,
    savedAt: item.savedAt,
    space: 'shared',
    people: 'others',
    madeByAi: null,
    opensIn: null,
    board: null,
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
    case 'year':
      return date.setFullYear(date.getFullYear() - 1);
  }
}

function nameHasEvery(name: string, words: readonly string[]): boolean {
  if (words.length === 0) return true;
  const folded = foldText(name);
  return words.every((word) => folded.includes(word));
}

/** Compiles a lens once into a predicate: the cutoff and the folded words are worked out up front. */
export function compileLens(lens: Lens, now: number): (subject: LensSubject) => boolean {
  const { filters } = lens;
  const words = lens.text.map(foldText);
  const cutoff = filters.edited === null ? null : editedCutoff(filters.edited, now);
  return (subject) =>
    (filters['opens-in'] === null || subject.opensIn === filters['opens-in']) &&
    (filters.board === null || subject.board === filters.board) &&
    (filters['made-by'] === null || subject.madeByAi === true) &&
    (cutoff === null || subject.savedAt >= cutoff) &&
    (filters.people === null || subject.people === filters.people) &&
    (filters.space === null || subject.space === filters.space) &&
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
