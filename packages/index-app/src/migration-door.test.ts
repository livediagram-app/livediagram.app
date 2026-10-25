// The migration door (docs/migration.md "The apps' migration door") and the legacy people merge, through the kit's
// router: its keys, its body checks, its answers.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MigrationRoomPayload } from '@liveworkspace/migration';
import { handleInternalItems, type InternalItemHandlers } from './internal';
import {
  MigrationTabTooLarge,
  checkMigrationTabSizes,
  parseMigrationPayload,
} from './migration-door';

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

function payloadOf(over: Partial<MigrationRoomPayload> = {}): MigrationRoomPayload {
  return {
    v: 1,
    app: 'livediagram',
    id: 'doc-1',
    name: 'Old document',
    ownerId: 'user_ali',
    teamId: null,
    createdAt: 1000,
    savedAt: 2000,
    source: null,
    presentation: null,
    opensIn: null,
    tabKind: null,
    tabs: [
      {
        id: 't1',
        name: 'Tab 1',
        orderIndex: 0,
        folder: null,
        addedAt: 1000,
        updatedAt: 2000,
        data: '{"elements":[]}',
        elementCount: 0,
      },
    ],
    changesets: [],
    imageGrants: [],
    imageOwners: [],
    plan: null,
    ...over,
  };
}

const ANSWER = { written: ['t1'], edited: [], meta: true };

function send(
  body: unknown,
  options: {
    auth?: string | null;
    key?: string;
    migrationKey?: string;
    path?: string;
    migrate?: InternalItemHandlers['migrate'];
  } = {},
) {
  const migrate = options.migrate ?? vi.fn(async () => ANSWER);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.auth !== null) headers.Authorization = `Bearer ${options.auth ?? 'mig'}`;
  return {
    migrate,
    res: handleInternalItems(
      new Request(`https://app.test${options.path ?? '/api/internal/items/doc-1/migration'}`, {
        method: 'PUT',
        headers,
        body: typeof body === 'string' ? body : JSON.stringify(body),
      }),
      {
        key: 'key' in options ? options.key : 'idx',
        app: 'livediagram',
        migrationKey: 'migrationKey' in options ? options.migrationKey : 'mig',
        handlers: { purge: async () => {}, migrate },
      },
    ),
  };
}

describe('PUT /api/internal/items/:id/migration', () => {
  it('writes a payload on MIGRATION_KEY or INDEX_KEY and answers the door answer', async () => {
    for (const auth of ['mig', 'idx']) {
      const { res, migrate } = send(payloadOf(), { auth });
      const r = await res;
      expect(r.status).toBe(200);
      expect(await r.json()).toEqual(ANSWER);
      expect(migrate).toHaveBeenCalledWith(payloadOf());
    }
  });

  it('is a plain 404 with neither key set, and 401 for a wrong or missing bearer', async () => {
    expect((await send(payloadOf(), { key: undefined, migrationKey: undefined }).res).status).toBe(
      404,
    );
    expect((await send(payloadOf(), { auth: 'nope' }).res).status).toBe(401);
    expect((await send(payloadOf(), { auth: null }).res).status).toBe(401);
    // MIGRATION_KEY alone opens no other door.
    const purge = await handleInternalItems(
      new Request('https://app.test/api/internal/items/doc-1', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer mig' },
      }),
      { key: 'idx', migrationKey: 'mig', handlers: { purge: async () => {} } },
    );
    expect(purge.status).toBe(401);
  });

  it('works with the migration key alone when the app has no index key', async () => {
    expect((await send(payloadOf(), { key: undefined }).res).status).toBe(200);
  });

  it('refuses a body that is not this app’s payload for this item', async () => {
    const bad: unknown[] = [
      'not json',
      payloadOf({ v: 2 as 1 }),
      payloadOf({ app: 'livedesign' }),
      payloadOf({ id: 'other' }),
      { ...payloadOf(), tabs: [{ id: 't1' }] },
      payloadOf({ tabs: [payloadOf().tabs[0]!, payloadOf().tabs[0]!] }),
      payloadOf({ plan: { itemTypes: null } as never }),
    ];
    for (const body of bad) {
      const { res, migrate } = send(body);
      expect((await res).status).toBe(400);
      expect(migrate).not.toHaveBeenCalled();
    }
  });

  it('refuses a body over 32 MiB by its declared length', async () => {
    const res = await handleInternalItems(
      new Request('https://app.test/api/internal/items/doc-1/migration', {
        method: 'PUT',
        headers: { Authorization: 'Bearer mig', 'Content-Length': String(33 * 1024 * 1024) },
        body: '{}',
      }),
      {
        key: 'idx',
        app: 'livediagram',
        migrationKey: 'mig',
        handlers: { purge: async () => {}, migrate: async () => ANSWER },
      },
    );
    expect(res.status).toBe(413);
  });

  it('answers 413 naming the tab when a tab is over the app’s cap, and 503 when the write fails', async () => {
    const tooLarge = send(payloadOf(), {
      migrate: async (p) => {
        checkMigrationTabSizes(p, 4);
        return ANSWER;
      },
    });
    const r = await tooLarge.res;
    expect(r.status).toBe(413);
    expect(await r.json()).toEqual({ error: 'tab_too_large', tabId: 't1', bytes: 15, cap: 4 });
    const down = send(payloadOf(), {
      migrate: async () => {
        throw new Error('down');
      },
    });
    expect((await down.res).status).toBe(503);
  });

  it('is a 404 for an app with no migrate handler', async () => {
    const res = await handleInternalItems(
      new Request('https://app.test/api/internal/items/doc-1/migration', {
        method: 'PUT',
        headers: { Authorization: 'Bearer idx' },
        body: JSON.stringify(payloadOf()),
      }),
      { key: 'idx', app: 'livediagram', handlers: { purge: async () => {} } },
    );
    expect(res.status).toBe(404);
  });
});

describe('parseMigrationPayload', () => {
  it('takes a liveplanner payload with no tabs (cards only) and its plan rows', () => {
    const plan = {
      itemTypes: null,
      itemTypesRev: 0,
      itemsRev: 1,
      itemsNextKey: 2,
      items: [
        {
          id: 'i1',
          type: 'task',
          itemKey: 1,
          rank: 'a',
          fields: '{}',
          rev: 1,
          createdAt: 1,
          updatedAt: 1,
          createdBy: null,
          updatedBy: null,
        },
      ],
      sheets: [],
      cells: [],
      formLinks: [],
    };
    const parsed = parseMigrationPayload(
      payloadOf({ app: 'liveplanner', tabs: [], plan }),
      'liveplanner',
      'doc-1',
    );
    expect(parsed.ok).toBe(true);
  });
});

describe('checkMigrationTabSizes', () => {
  it('measures UTF-8 bytes, not characters', () => {
    const tab = { ...payloadOf().tabs[0]!, data: 'é'.repeat(10) };
    expect(() => checkMigrationTabSizes(payloadOf({ tabs: [tab] }), 20)).not.toThrow();
    expect(() => checkMigrationTabSizes(payloadOf({ tabs: [tab] }), 19)).toThrow(
      MigrationTabTooLarge,
    );
  });
});

describe('the legacy people merge', () => {
  const merge = (person: string, body: unknown, personMerged = vi.fn(async () => {})) => ({
    personMerged,
    res: handleInternalItems(
      new Request(`https://app.test/api/internal/people/${person}/merge`, {
        method: 'POST',
        headers: { Authorization: 'Bearer idx', 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
      { key: 'idx', handlers: { purge: async () => {}, personMerged } },
    ),
  });

  it('merges an old guest into a guest or an account with legacy: true', async () => {
    for (const into of ['guest_new', 'user_u1']) {
      const { res, personMerged } = merge('guest_old', { into, legacy: true });
      expect((await res).status).toBe(200);
      expect(personMerged).toHaveBeenCalledWith('guest_old', into, { legacy: true });
    }
  });

  it('refuses a guest target without legacy, and a guest into itself with it', async () => {
    expect((await merge('guest_old', { into: 'guest_new' }).res).status).toBe(400);
    expect((await merge('guest_old', { into: 'guest_new', legacy: 'yes' }).res).status).toBe(400);
    expect((await merge('guest_old', { into: 'guest_old', legacy: true }).res).status).toBe(400);
    expect((await merge('guest_old', { into: 'team_x', legacy: true }).res).status).toBe(400);
  });
});
