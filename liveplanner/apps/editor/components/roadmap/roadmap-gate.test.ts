import { describe, expect, it } from 'vitest';
import type { RoadmapBoard } from '@liveplanner/api-schema';
import { boardIdsOnTab, roadmapScopeFor } from './roadmap-gate';
import {
  defaultRoadmapSettings,
  formFits,
  readsLikeTriage,
  settingsReady,
  withColumnToggled,
} from './roadmap-defaults';

// docs/specs/026-plan/public-roadmap.md "Who may publish" and "The settings": who sees the row (share roles: the owner
// and a team member only, a guest owner included), the tab's boards, and a new roadmap's defaults.
const OWNER_SCOPE = { ownerId: 'u1', projectId: 'p1', shareCode: null, tabId: null };
const base = {
  hydrated: true,
  embed: false,
  workbench: false,
  offline: false,
  scope: OWNER_SCOPE,
};

describe('roadmapScopeFor', () => {
  it('opens for the owner or a team member, a guest owner included', () => {
    expect(roadmapScopeFor(base)).toEqual({ ownerId: 'u1', projectId: 'p1' });
  });
  it.each([
    ['an Editor, Participant or Viewer share link', { scope: { ...OWNER_SCOPE, shareCode: 's' } }],
    ['a grant to one tab', { scope: { ...OWNER_SCOPE, tabId: 't1' } }],
    ['an embed', { embed: true }],
    ['a workbench frame', { workbench: true }],
    ['a plan kept Offline', { offline: true }],
    ['before the plan loads', { hydrated: false }],
    ['no plan', { scope: null }],
  ])('stays shut for %s', (_, patch) => {
    expect(roadmapScopeFor({ ...base, ...patch })).toBeNull();
  });
});

describe('boardIdsOnTab', () => {
  it("lists the tab's Plan boards in its order", () => {
    expect(
      boardIdsOnTab([
        { id: 'a', type: 'shape', shape: 'plan-board' },
        { id: 'b', type: 'shape', shape: 'rect' },
        { id: 'c', type: 'text' },
        { id: 'd', type: 'shape', shape: 'plan-board' },
      ]),
    ).toEqual(['a', 'd']);
  });
});

const BOARD: RoadmapBoard = {
  id: 'b1',
  title: '  ',
  tabName: 'Board',
  tabId: 't1',
  columns: [
    { status: 'new', name: 'Inbox', color: null },
    { status: 'todo', name: 'Planned', color: null },
  ],
  types: [{ id: 'task', name: 'Task', glyph: 'sparkles', color: 'violet' }],
  publishable: true,
};

describe('defaults', () => {
  it('hides triage columns, takes every type and Description, with voting on', () => {
    expect(defaultRoadmapSettings(BOARD)).toEqual({
      title: 'Board',
      columns: ['todo'],
      types: ['task'],
      fields: ['description'],
      voting: true,
      formCode: null,
    });
  });
  it('shows every column when they all read like triage, and names a nameless board', () => {
    const triage = {
      ...BOARD,
      tabName: '',
      columns: [
        { status: 'a', name: ' Under Review ', color: null },
        { status: 'b', name: 'BACKLOG', color: null },
      ],
    };
    expect(defaultRoadmapSettings(triage)).toMatchObject({ title: 'Roadmap', columns: ['a', 'b'] });
  });
  it.each(['Under Review', 'inbox', 'Triage', 'Ideas', 'To Review', 'New', 'Suggestions'])(
    'reads %s as triage',
    (name) => expect(readsLikeTriage(name)).toBe(true),
  );
  it('reads a shown column as not triage', () => expect(readsLikeTriage('Planned')).toBe(false));
});

describe('the rules', () => {
  const form = { code: 'f', heading: 'Ideas', tabName: 'Ideas', statuses: ['new'] };
  it('fits a form only while none of its cards would show', () => {
    expect(formFits(form, ['todo'])).toBe(true);
    expect(formFits(form, ['todo', 'new'])).toBe(false);
  });
  it('lets the form go when its column is ticked, and keeps it otherwise', () => {
    const s = { ...defaultRoadmapSettings(BOARD), formCode: 'f' };
    expect(withColumnToggled(s, 'new', BOARD, [form])).toMatchObject({
      columns: ['new', 'todo'],
      formCode: null,
    });
    const two = {
      ...BOARD,
      columns: [...BOARD.columns, { status: 'done', name: 'Done', color: null }],
    };
    expect(withColumnToggled(s, 'done', two, [form])).toMatchObject({
      columns: ['todo', 'done'],
      formCode: 'f',
    });
  });
  it('is ready with a title, a column and a type', () => {
    const s = defaultRoadmapSettings(BOARD);
    expect(settingsReady(s)).toBe(true);
    expect(settingsReady({ ...s, title: ' ' })).toBe(false);
    expect(settingsReady({ ...s, columns: [] })).toBe(false);
    expect(settingsReady({ ...s, types: [] })).toBe(false);
  });
});
