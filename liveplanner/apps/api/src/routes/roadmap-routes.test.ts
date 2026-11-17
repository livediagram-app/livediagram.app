import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoadmapResponse, RoadmapsResponse } from '@liveplanner/api-schema';
import type { Caller } from '../plan-room/automations/test-automation-world';
import { endRepeatWorld } from '../plan-room/test-repeat-world';
import { roadmapsOf } from '../roadmap/roadmap-store';
import { roadmapWorld, settingsOf, suggestionForm, type RoadmapWorld } from './roadmap-test-world';

// Who may publish a roadmap (docs/specs/026-plan/public-roadmap.md "Who may publish"; share-roles.md "Ownership"):
// the owner and team members, in person. Every share link (Editor, Participant, Viewer, one tab), an API token, a
// workbench session and a link visitor are refused on every route, and nothing changes.
vi.mock(
  '../auth/accounts',
  async () => (await import('../plan-room/test-accounts-mock')).accountsMock,
);

let w: RoadmapWorld;
beforeEach(async () => {
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  w = await roadmapWorld();
});
afterEach(() => {
  vi.restoreAllMocks();
  endRepeatWorld();
});

const ALLOWED: Caller[] = ['owner', 'team', 'guest'];
const REFUSED: Caller[] = [
  'editor_link',
  'tab_editor_link',
  'participant',
  'viewer',
  'token',
  'token_read_only',
  'token_tab',
  'workbench',
  'link_visitor',
];

describe('the owner and a team member', () => {
  it.each(ALLOWED)('%s may publish, change (keeping the link) and unpublish', async (who) => {
    const first = await w.as(who, 'GET', '/roadmaps');
    expect(first.status).toBe(200);
    expect(first.headers.get('Cache-Control')).toBe('no-store');
    const listed = await first.json<RoadmapsResponse>();
    expect(listed.roadmaps).toEqual([]);
    expect(listed.boards).toEqual([
      {
        id: 'b1',
        title: 'Kanban',
        tabId: 't1',
        tabName: 'Board',
        columns: [
          { status: 'backlog', name: 'Backlog', color: null },
          { status: 'todo', name: 'To Do', color: null },
          { status: 'doing', name: 'In Progress', color: null },
          { status: 'review', name: 'Review', color: null },
          { status: 'done', name: 'Done', color: null },
        ],
        types: [
          { id: 'task', name: 'Task', glyph: 'task', color: '#71717a' },
          { id: 'action', name: 'Action', glyph: 'action', color: '#dc2626' },
        ],
        publishable: true,
      },
    ]);
    expect(listed.forms).toEqual([
      { code: w.formCode, heading: 'Suggest an idea', tabName: 'Ideas', statuses: ['backlog'] },
    ]);

    const made = await w.as(who, 'PUT', '/roadmaps/b1', settingsOf({ formCode: w.formCode }));
    expect(made.status).toBe(201);
    const { roadmap } = await made.json<RoadmapResponse>();
    expect(roadmap).toMatchObject({ boardId: 'b1', title: 'Acme Roadmap', formCode: w.formCode });
    expect(roadmap.code).toMatch(/^lpr_[A-Za-z0-9_-]{22}$/);
    expect(roadmap.path).toBe(`/roadmap/A/${roadmap.code}`);

    const changed = await w.as(who, 'PUT', '/roadmaps/b1', settingsOf({ title: '  New name ' }));
    expect(changed.status).toBe(200);
    const after = (await changed.json<RoadmapResponse>()).roadmap;
    expect(after).toMatchObject({ code: roadmap.code, title: 'New name', formCode: null });

    const again = await (await w.as(who, 'GET', '/roadmaps')).json<RoadmapsResponse>();
    expect(again.roadmaps).toEqual([after]);

    expect((await w.as(who, 'DELETE', '/roadmaps/b1')).status).toBe(204);
    expect((await w.as(who, 'DELETE', '/roadmaps/b1')).status).toBe(204);
    expect(await roadmapsOf(w.planEnv(), 'A')).toEqual([]);
  });

  it('stores columns and types in the board order, whatever order the body names them', async () => {
    const r = await w.publish({ columns: ['done', 'todo'], types: ['action', 'task'] });
    expect(r.columns).toEqual(['todo', 'done']);
    expect(r.types).toEqual(['task', 'action']);
  });
});

describe('anyone else', () => {
  it.each(REFUSED)('%s is refused on every route and nothing changes', async (who) => {
    const live = await w.publish();
    for (const [method, path, body] of [
      ['GET', '/roadmaps'],
      ['PUT', '/roadmaps/b1', settingsOf({ title: 'Hijacked' })],
      ['DELETE', '/roadmaps/b1'],
    ] as const) {
      const res = await w.as(who, method, path, body);
      // A link visitor with no identity is turned away before the grant is read (requireOwner).
      expect([400, 401, 403], `${method} ${path}`).toContain(res.status);
      if (res.status === 403) expect(await res.json()).toEqual({ error: 'roadmap_needs_owner' });
    }
    const [row] = await roadmapsOf(w.planEnv(), 'A');
    expect(row).toMatchObject({ code: live.code, settings: { title: 'Acme Roadmap' } });
  });
});

describe('the settings', () => {
  it.each([
    ['no title', { title: '  ' }],
    ['a long title', { title: 'x'.repeat(81) }],
    ['no columns', { columns: [] }],
    ['a column the board lacks', { columns: ['todo', 'elsewhere'] }],
    ['a column twice', { columns: ['todo', 'todo'] }],
    ['no types', { types: [] }],
    ['a type the board does not show', { types: ['bug'] }],
    ['a field off the allowlist', { fields: ['assignee'] }],
    ['voting not a boolean', { voting: 'yes' }],
    ['an unknown form', { formCode: 'nope' }],
    ['a form code that is not a string', { formCode: 7 }],
  ])('refuses %s', async (_, patch) => {
    const res = await w.as('owner', 'PUT', '/roadmaps/b1', { ...settingsOf(), ...patch });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'roadmap_invalid' });
    expect(await roadmapsOf(w.planEnv(), 'A')).toEqual([]);
  });

  it('takes no fields at all', async () => {
    expect((await w.publish({ fields: [] })).fields).toEqual([]);
  });

  it('refuses a suggestion form whose cards would land in a shown column', async () => {
    await w.setForm(suggestionForm('todo'));
    const res = await w.as('owner', 'PUT', '/roadmaps/b1', settingsOf({ formCode: w.formCode }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'roadmap_suggestions_public' });
  });

  it('refuses an unknown board, a board id too long and a board with no columns', async () => {
    expect((await w.as('owner', 'PUT', '/roadmaps/nope', settingsOf())).status).toBe(400);
    expect((await w.as('owner', 'PUT', `/roadmaps/${'b'.repeat(201)}`, settingsOf())).status).toBe(
      400,
    );
    const { presetSetup } = await import('@liveplanner/items');
    await w.send('PUT', '/api/projects/A/tabs/t1', {
      id: 't1',
      name: 'Board',
      kind: 'board',
      elements: [
        {
          id: 'b1',
          type: 'shape',
          shape: 'plan-board',
          x: 0,
          y: 0,
          width: 800,
          height: 500,
          planBoard: presetSetup('all-cards'),
        },
      ],
    });
    expect((await w.as('owner', 'PUT', '/roadmaps/b1', settingsOf())).status).toBe(400);
  });

  it('answers 405 for another method and leaves other paths alone', async () => {
    expect((await w.as('owner', 'POST', '/roadmaps')).status).toBe(405);
    expect((await w.as('owner', 'GET', '/roadmaps/b1')).status).toBe(405);
    expect((await w.as('owner', 'PUT', '/roadmaps/b1', 'not json')).status).toBe(400);
  });
});
