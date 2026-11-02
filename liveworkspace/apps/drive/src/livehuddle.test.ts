// livehuddle, mirrored while still held (liveworkspace/docs/specs/005-drive/drive.md "Who and what", "The apps"): the
// index's picture keeps a person's own Spaces and drops the ones only shared with them (at any share level) or in a
// team, and the service reaches livehuddle's doors at its origin with its own key.
import { describe, expect, it } from 'vitest';
import { createAppDoors } from './app-doors';
import type { Env } from './env';
import { createIndexApi } from './index-api';

const space = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  app: 'livehuddle',
  title: `Space ${id}`,
  folderId: null,
  teamId: null,
  trashedAt: null,
  sharedVia: null,
  createdAt: 1,
  updatedAt: 2,
  ...extra,
});

function indexOf(items: unknown[], trash: unknown[] = []): Env {
  const answer = (path: string) =>
    path.endsWith('/items')
      ? { items, nextCursor: null }
      : path.endsWith('/trash')
        ? { items: trash, nextCursor: null }
        : { folders: [], nextCursor: null };
  return {
    INDEX_KEY_DRIVE: 'index-drive-key',
    INDEX: {
      fetch: async (input: RequestInfo | URL) =>
        Response.json(
          answer(new URL(String(input instanceof Request ? input.url : input)).pathname),
        ),
    },
  } as unknown as Env;
}

describe('the picture of a person with livehuddle Spaces', () => {
  it('mirrors their own Spaces, never one shared with them at any level, in a team, or of no known app', async () => {
    const env = indexOf(
      [
        space('own'),
        // Reached only through a share link, whatever its level (Editor, Participant or Viewer).
        space('editor', { sharedVia: 'edit-code' }),
        space('participant', { sharedVia: 'participate-code' }),
        space('viewer', { sharedVia: 'view-code' }),
        space('team', { teamId: 'team_1' }),
        space('other', { app: 'livenotes' }),
      ],
      [space('binned', { trashedAt: 5 }), space('team-binned', { trashedAt: 5, teamId: 'team_1' })],
    );
    const picture = await createIndexApi(env).forPerson('user_ada').picture();
    expect(picture.items).toEqual([
      {
        id: 'own',
        app: 'livehuddle',
        name: 'Space own',
        folderId: null,
        updatedAt: 2,
        createdAt: 1,
      },
    ]);
    expect(picture.trash).toEqual([
      { id: 'binned', app: 'livehuddle', name: 'Space binned', trashedAt: 5 },
    ]);
  });
});

describe("livehuddle's doors", () => {
  const env = {
    APP_ORIGIN_LIVEHUDDLE: 'http://localhost:3500/',
    DRIVE_KEY_LIVEHUDDLE: 'dev-livehuddle-drive-key',
  } as unknown as Env;

  it('exports a Space at its origin with its own key, and opens it at its Space address', async () => {
    const calls: { url: string; auth: string | null }[] = [];
    const doors = createAppDoors(env, async (input, init) => {
      calls.push({
        url: String(input),
        auth: new Headers(init?.headers).get('Authorization'),
      });
      return new Response('{"kind":"livehuddle.document"}', {
        status: 200,
        headers: { ETag: '"1234"' },
      });
    });
    expect(await doors.exportFile('livehuddle', 'sp1')).toEqual({
      body: '{"kind":"livehuddle.document"}',
      version: 1234,
    });
    expect(calls).toEqual([
      {
        url: 'http://localhost:3500/api/internal/items/sp1/export?format=file',
        auth: 'Bearer dev-livehuddle-drive-key',
      },
    ]);
    expect(doors.itemUrl('livehuddle', 'sp1')).toBe('http://localhost:3500/document/sp1');
  });

  it('refuses an import while livehuddle has no key, as for any app not configured', async () => {
    const doors = createAppDoors({} as Env, async () => {
      throw new Error('no call without a key');
    });
    expect(
      await doors.importFile('livehuddle', {
        owner: 'user_ada',
        folderId: null,
        name: 'S',
        file: '{}',
      }),
    ).toEqual({ ok: false, error: 'not_configured' });
    expect(doors.itemUrl('livehuddle', 'sp1')).toBeNull();
  });
});
