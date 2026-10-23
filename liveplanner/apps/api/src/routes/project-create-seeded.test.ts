import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { getProject, getTab, listItems } from '../db';
import { makeTestRouteContext } from './test-route-context';
import { handleProjects } from './projects';
import { asUser } from './test-route-context';
import { compileSeededTabs } from './project-seed';

// A create's seeded tabs given as a template (docs/specs/015-api/api.md): compiled by
// applyReplace before anything is written, the intent derived from the first, a refusal naming the tab.

let db: SqliteD1;

function create(tabs: unknown[], extra: Record<string, unknown> = {}) {
  return handleProjects(
    makeTestRouteContext('POST', '/api/projects', {
      env: db.env,
      ...asUser('user_alice'),
      body: { id: 'd1', name: 'Shop', tabs, ...extra },
    }),
  );
}

beforeEach(() => {
  db = sqliteD1();
  vi.spyOn(console, 'info').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('seeded tabs compiled on create', () => {
  it('records the CLI as the source of a seeded create', async () => {
    const res = await create([{ id: 't1', name: 'Board', template: 'kanban' }], {
      source: 'cli',
    });
    expect(res.status).toBe(201);
    expect(await getTab(db.env, 'd1', 't1')).toBeTruthy();
    expect((await getProject(db.env, 'd1'))?.source).toBe('cli');
  });

  it('builds a template tab and derives the intent from it when none is given, a retro opening in Plan', async () => {
    expect((await create([{ id: 't1', name: 'Retro', template: 'team-retro' }])).status).toBe(201);
    expect((await getTab(db.env, 'd1', 't1'))?.elements.length).toBeGreaterThan(0);
    const summary = await getProject(db.env, 'd1');
    expect(summary).toMatchObject({
      opensIn: 'plan',
      tabKind: 'board',
      templateFamily: 'retrospective',
    });
  });

  it('makes a Plan template tab with no cards, opening in Plan', async () => {
    expect((await create([{ id: 't1', name: 'Board', template: 'kanban' }])).status).toBe(201);
    expect(await listItems(db.env, 'd1')).toEqual([]);
    const summary = await getProject(db.env, 'd1');
    expect(summary).toMatchObject({ opensIn: 'plan', templateFamily: 'kanban' });
  });

  it('adds every tab of a Plan template with several after the one named, each opening in Plan', async () => {
    expect(
      (
        await create([
          { id: 't1', name: 'Retro', template: 'team-retro' },
          { id: 't2', name: 'Notes', elements: [] },
        ])
      ).status,
    ).toBe(201);
    const doc = await getProject(db.env, 'd1');
    expect(doc?.tabs.map((t) => t.name)).toEqual([
      'Retro',
      'Actions',
      'Archive',
      'Overview',
      'Notes',
    ]);
    const actions = await getTab(db.env, 'd1', doc!.tabs[1]!.id);
    expect(actions?.elements.some((e) => e.type === 'shape' && e.shape === 'plan-board')).toBe(
      true,
    );
    expect(await listItems(db.env, 'd1')).toEqual([]);
  });

  // docs/specs/026-plan/item-types.md "The type catalogue": a template's boards choose a new project's card types.
  it('makes a Plan template’s project with exactly the card types its boards take', async () => {
    expect((await create([{ id: 't1', name: 'Hiring', template: 'hiring-pipeline' }])).status).toBe(
      201,
    );
    expect((await getProject(db.env, 'd1'))?.itemTypes?.types.map((t) => t.id)).toEqual([
      'role',
      'candidate',
      'onboarding-task',
    ]);
  });

  it('adds them to a catalogue the create gives, and leaves a template’s with no board alone', async () => {
    const own = {
      version: 1,
      types: [
        {
          id: 'task',
          label: 'Task',
          newTitle: 'New task',
          glyph: 'task',
          color: '#71717a',
          fields: ['title', 'status'],
        },
      ],
    };
    await create([{ id: 't1', name: 'Bugs', template: 'bug-triage' }], { itemTypes: own });
    expect((await getProject(db.env, 'd1'))?.itemTypes?.types.map((t) => t.id)).toEqual([
      'task',
      'bug',
    ]);
    await handleProjects(
      makeTestRouteContext('POST', '/api/projects', {
        env: db.env,
        ...asUser('user_alice'),
        body: {
          id: 'd2',
          name: 'Budget',
          tabs: [{ id: 't9', name: 'Budget', template: 'blank-spreadsheet' }],
        },
      }),
    );
    expect((await getProject(db.env, 'd2'))?.itemTypes ?? null).toBeNull();
  });

  it('keeps an intent the create gives', async () => {
    await create([{ id: 't1', name: 'Budget', template: 'blank-spreadsheet' }], {
      intent: { mode: 'plan' },
    });
    const summary = await getProject(db.env, 'd1');
    expect(summary).toMatchObject({ opensIn: 'plan', templateFamily: null });
  });

  it('refuses the whole create by the tab the engine refused, writing nothing', async () => {
    const res = await create([
      { id: 't1', name: 'Ok', elements: [] },
      { id: 't2', name: 'Bad', template: 'no-such-template' },
    ]);
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ tabId: 't2', text: expect.any(String) });
    expect(await getProject(db.env, 'd1')).toBeNull();
  });

  it('leaves an elements tab, and an unknown source, as they were', async () => {
    expect(
      (await create([{ id: 't1', name: 'Plain', elements: [] }], { source: 'web' })).status,
    ).toBe(201);
    expect((await getProject(db.env, 'd1'))?.source).toBeNull();
  });
});

describe('compileSeededTabs', () => {
  it('passes through what is not a single source: elements, two sources, no id, not a tab', () => {
    const tabs = [
      { id: 'a', name: 'A', elements: [] },
      { id: 'b', name: 'B', template: 'kanban', elements: [] },
      { name: 'C', template: 'kanban' },
      'not a tab',
    ];
    expect(compileSeededTabs(tabs, 'd1')).toEqual({ tabs, intent: null, templateElements: [] });
  });

  it("keeps a compiled tab's other fields, and themes it", () => {
    const out = compileSeededTabs(
      [
        {
          id: 't1',
          template: 'blank-spreadsheet',
          theme: 'ocean',
          background: 'dots',
        },
      ],
      'd1',
    );
    expect(out).toMatchObject({
      tabs: [{ id: 't1', background: 'dots', theme: 'ocean' }],
      intent: { mode: 'plan' },
    });
  });
});
