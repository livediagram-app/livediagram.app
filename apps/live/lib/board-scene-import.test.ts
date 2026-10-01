import { describe, expect, it, vi } from 'vitest';
import type { SceneItem } from '@/lib/board-scene/scene';
import { boardScene, inkStroke } from '@/lib/board-scene/test-scenes';
import { importBoardsAsDocuments, type NewBoardDocument } from './board-scene-import';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@/lib/offline/offline-store', () => ({ offlineCreateDocument: vi.fn() }));
vi.mock('@/lib/api-client', () => ({ apiCreateDocument: vi.fn() }));
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
