import { describe, expect, it, vi } from 'vitest';
import type { SceneItem } from '@/lib/board-scene/scene';
import { boardScene, inkStroke } from '@/lib/board-scene/test-scenes';
import {
  BOARD_TOO_BIG,
  importBoardsAsDocuments,
  type NewBoardDocument,
} from './board-scene-import';
import { ApiError } from '@/lib/api/core';
import { MAX_TAB_BYTES, tabDataBytes } from '@livediagram/api-schema';

const textItem = (text: string): SceneItem => ({
  key: 't',
  kind: 'text',
  x: 0,
  y: 0,
  width: 100,
  height: 20,
  autoWidth: false,
  text: { text: text || ' x', fontPx: 22, family: 'sans', colour: 'ink' },
});

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@/lib/offline/offline-store', () => ({ offlineCreateDocument: vi.fn() }));
vi.mock('@/lib/api-client', async () => ({
  apiCreateDocument: vi.fn(),
  ApiError: (await vi.importActual<typeof import('@/lib/api/core')>('@/lib/api/core')).ApiError,
}));
import { offlineCreateDocument } from '@/lib/offline/offline-store';
import { apiCreateDocument } from '@/lib/api-client';

// docs/specs/020-import-export/board-import.md "new-document", used outside the editor (the
// Explorer page): only an owner, offline or not, an optional folder.
const square: SceneItem = {
  key: 's',
  kind: 'shape',
  shape: 'rectangle',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  stroke: inkStroke(),
};
const seams = { hugText: async <T>(els: T) => els };

describe('importBoardsAsDocuments', () => {
  it('files cloud documents in the folder given, and says when they are made', async () => {
    const onDocumentsCreated = vi.fn();
    const outcome = await importBoardsAsDocuments([boardScene([square], { title: 'Retro' })], {
      ownerId: 'o',
      offline: false,
      folderId: 'f1',
      onDocumentsCreated,
      ...seams,
    });
    expect(apiCreateDocument).toHaveBeenCalledWith(
      'o',
      expect.objectContaining({ name: 'Retro', folderId: 'f1' }),
    );
    expect(onDocumentsCreated).toHaveBeenCalledTimes(1);
    expect(outcome).toMatchObject({ status: 'done', documents: [{ name: 'Retro' }] });
  });

  it('makes Offline Mode documents in this browser, filed and dated, their images embedded', async () => {
    const sessions: unknown[] = [];
    await importBoardsAsDocuments(
      [
        boardScene([{ key: 'i', kind: 'image', x: 0, y: 0, width: 5, height: 5, asset: 'a' }], {
          createdAt: '2020-08-14T12:00:00Z',
          assets: [{ key: 'a', source: { kind: 'data-url', dataUrl: 'data:image/png;base64,AA' } }],
        }),
      ],
      {
        ownerId: 'o',
        offline: true,
        folderId: 'f2',
        createImageSession: async (o) => {
          sessions.push(o);
          return {
            store: vi.fn(async () => ({ ok: false as const, failure: 'unsupported' as const })),
          };
        },
        ...seams,
      },
    );
    expect(sessions).toEqual([{ ownerId: 'o', documentId: null, offline: true }]);
    expect(offlineCreateDocument).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Whiteboard, 14 Aug 2020' }),
      expect.any(Number),
      { createdAt: Date.UTC(2020, 7, 14, 12), savedAt: undefined, folderId: 'f2' },
    );
  });

  it('names a board the server refuses as too large, logs it, and lands the rest', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const made: NewBoardDocument[] = [];
    const outcome = await importBoardsAsDocuments(
      [boardScene([square], { title: 'Huge' }), boardScene([square], { title: 'Small' })],
      {
        ownerId: 'o',
        offline: false,
        createDocument: async (d) => {
          if (d.name === 'Huge') throw new ApiError('create document', 413, 'payload_too_large');
          made.push(d);
        },
        ...seams,
      },
    );
    expect(made.map((d) => d.name)).toEqual(['Small']);
    expect(outcome).toMatchObject({
      status: 'done',
      failures: [{ title: 'Huge', message: BOARD_TOO_BIG }],
    });
    expect(BOARD_TOO_BIG).toBe('This board is too big for one document');
    expect(warn).toHaveBeenCalledWith(
      '[board-scene] board too big',
      expect.objectContaining({ board: 1, bytes: expect.any(Number) }),
    );
    warn.mockRestore();
  });

  it('refuses a cloud board over the tab cap before asking the server, at the boundary', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const made: NewBoardDocument[] = [];
    const run = async (label: string, offline: boolean) =>
      importBoardsAsDocuments([boardScene([textItem(label)], { title: 'Big' })], {
        ownerId: 'o',
        offline,
        createDocument: async (d) => {
          made.push(d);
        },
        ...seams,
      });
    // Find the label length that lands the tab exactly at the cap.
    await run('', true);
    const base = tabDataBytes(made.pop()!.tabs[0]!);
    const atCap = 'x'.repeat(MAX_TAB_BYTES - base);
    expect((await run(atCap, false)).status).toBe('done');
    expect(tabDataBytes(made.pop()!.tabs[0]!)).toBe(MAX_TAB_BYTES);
    const over = await run(atCap + 'x', false);
    expect(over).toMatchObject({ status: 'error', error: BOARD_TOO_BIG });
    expect(made).toHaveLength(0);
    expect(warn).toHaveBeenCalledWith(
      '[board-scene] board too big',
      expect.objectContaining({ bytes: MAX_TAB_BYTES + 1, cap: MAX_TAB_BYTES }),
    );
    // In this browser there is no row cap: an Offline Mode board of that size still lands.
    expect((await run(atCap + 'x', true)).status).toBe('done');
    warn.mockRestore();
  });

  it('takes a document maker of its own', async () => {
    const made: NewBoardDocument[] = [];
    await importBoardsAsDocuments([boardScene([square])], {
      ownerId: 'o',
      offline: false,
      createDocument: async (d) => {
        made.push(d);
      },
      ...seams,
    });
    expect(made[0]!.folderId).toBeUndefined();
    expect(made[0]!.tabs[0]).toMatchObject({ kind: 'whiteboard' });
  });
});
