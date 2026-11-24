import { describe, expect, it } from 'vitest';
import type { ConflictRow } from '@liveknowledge/knowledge';
import type { DocumentDTO } from '../types';
import { conflictRefsOf } from './page-read';

// Conflicts for agents (docs/specs/024-agents/knowledgebase-for-agents.md): each open conflict's question beside the
// other page, one entry a conflict, and only where the caller reads both pages.

const tab = (id: string, name: string, extra: object = {}) =>
  ({
    id,
    documentId: 'kb',
    name,
    orderIndex: 0,
    updatedAt: 0,
    ...extra,
  }) as DocumentDTO['tabs'][number];
const TABS = [tab('d', 'Deploys'), tab('h', 'Holidays'), tab('r', 'Rollbacks')];
const row = (id: string, question: string, a: string, b: string, foundAt: number): ConflictRow => ({
  id,
  question,
  aPassage: `${id}a`,
  aTab: a,
  aHash: 'x',
  bPassage: `${id}b`,
  bTab: b,
  bHash: 'y',
  foundAt,
});

describe('conflictRefsOf', () => {
  it('names none, one, and several conflicts, each with its question', () => {
    const rows = [
      row('c2', 'Who approves?', 'r', 'd', 2),
      row('c1', 'When do we deploy?', 'd', 'h', 1),
      // Another passage pair asking the same question is the same disagreement.
      row('c3', 'When do we deploy?', 'h', 'd', 1),
    ];
    const { byTab, byPassage } = conflictRefsOf(rows, TABS);
    expect(byTab.get('d')).toEqual([
      { tab: 'r', title: 'Rollbacks', question: 'Who approves?', foundAt: 2 },
      { tab: 'h', title: 'Holidays', question: 'When do we deploy?', foundAt: 1 },
    ]);
    expect(byTab.get('h')).toEqual([
      { tab: 'd', title: 'Deploys', question: 'When do we deploy?', foundAt: 1 },
    ]);
    expect(byPassage.get('c1a')).toEqual([
      { tab: 'h', title: 'Holidays', question: 'When do we deploy?', foundAt: 1 },
    ]);
    expect(conflictRefsOf([], TABS).byTab.size).toBe(0);
  });

  it('names a conflict only where the caller reads both pages', () => {
    const rows = [row('c1', 'When do we deploy?', 'd', 'h', 1), row('c2', 'Gone?', 'd', 'x', 1)];
    // A page out of the caller's scope, and a page the knowledgebase no longer holds, hide the conflict whole.
    const hidden = conflictRefsOf(rows, [tab('d', 'Deploys'), tab('h', '', { outOfScope: true })]);
    expect(hidden.byTab.size).toBe(0);
    expect(hidden.byPassage.size).toBe(0);
    // A link confined to one page reads no other.
    expect(conflictRefsOf(rows, TABS, 'h').byTab.size).toBe(0);
    expect(conflictRefsOf(rows, TABS, null).byTab.get('h')).toHaveLength(1);
  });
});
