// The index's id rules: what it keys by is letters, digits, `-` and `_`; the parts of an item an app names
// (tabs, elements, actions) are whatever the app's own document allows, within the length.
import { COLLAB_CARDS_TAB } from '@liveworkspace/index-client';
import { describe, expect, it } from 'vitest';
import { isId, isPartId } from './codec';
import { ID_MAX } from './config';
import { body, call, makeItem, person, useHarness } from './test-support';

useHarness();

describe('isId', () => {
  it('takes every id the index mints or is handed', () => {
    for (const id of [
      crypto.randomUUID(),
      `user_${crypto.randomUUID().replaceAll('-', '')}`,
      'user_2abcDEF123',
      `guest_${crypto.randomUUID()}`,
      'a1b2c3d4e5f6a1b2c3d4e5f6',
      'Ab3dEf6hIj9k',
      'x'.repeat(ID_MAX),
    ]) {
      expect(isId(id)).toBe(true);
    }
  });

  it('refuses anything else', () => {
    for (const id of [
      '',
      'x'.repeat(ID_MAX + 1),
      'a b',
      'a/b',
      'a:b',
      'a.b',
      'a%2Fb',
      '~cards',
      'é',
      'a\nb',
      7,
      null,
      undefined,
    ]) {
      expect(isId(id)).toBe(false);
    }
  });
});

describe('isPartId', () => {
  it('takes any non-empty id within the length, as the apps allow', () => {
    for (const id of [COLLAB_CARDS_TAB, 'node.1', 'Step 1', 'é', 'x'.repeat(ID_MAX)]) {
      expect(isPartId(id)).toBe(true);
    }
    for (const id of ['', 'x'.repeat(ID_MAX + 1), 7, null]) expect(isPartId(id)).toBe(false);
  });
});

describe('ids on the wire', () => {
  it('refuses an item, folder or team id with other characters', async () => {
    const ada = await person('user_a', { teams: [{ id: 'team1' }] });
    const post = (path: string, payload: unknown) =>
      call(path, { method: 'POST', auth: ada.auth, body: payload });
    expect(await body(await post('/items', { app: 'liveplanner', id: 'a b' }))).toEqual({
      error: 'invalid_body',
    });
    expect(await body(await post('/items', { app: 'liveplanner', folderId: 'a:b' }))).toEqual({
      error: 'invalid_folder',
    });
    expect(await body(await post('/folders', { name: 'F', id: 'a.b' }))).toEqual({
      error: 'invalid_folder',
    });
    const list = await call('/items?space=team:a%20b', { auth: ada.auth });
    expect(list.status).toBe(400);
  });

  it('keeps a pushed element and action id the app allows', async () => {
    const ada = await person('user_a');
    const item = await makeItem(ada.auth);
    const res = await call(`/app/items/${item.id}/collab/tab.1`, {
      method: 'PUT',
      auth: 'lp-key',
      headers: { 'X-Index-App': 'liveplanner' },
      body: {
        threads: [
          {
            elementId: 'node.1',
            elementLabel: 'Card',
            resolved: false,
            commentCount: 1,
            participantIds: ['user_a'],
            mentionedIds: [],
            latestText: 'Hi',
            latestAuthorName: 'Ada',
            firstAt: 1,
            latestAt: 2,
          },
        ],
        actions: [],
      },
    });
    expect(res.status).toBe(204);
  });
});
