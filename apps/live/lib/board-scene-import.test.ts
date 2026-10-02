import { describe, expect, it, vi } from 'vitest';
import type { SceneItem } from '@/lib/board-scene/scene';
import { boardScene, inkStroke } from '@/lib/board-scene/test-scenes';
import type { Element, Tab } from '@livediagram/document';
import {
  BOARD_TOO_BIG,
  importBoardsAsDocuments,
  importDocuments,
  type ImportDocumentSource,
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
  sizing: 'wrap',
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
    // The probe's label is ' x' (two characters).
    const atCap = 'x'.repeat(MAX_TAB_BYTES - base + 2);
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
    expect(made[0]!.tabs[0]).toMatchObject({ opensIn: 'draw' });
  });
});

// docs/specs/020-import-export/drawio-import.md "Import as new documents": the new-document target
// for importers whose documents arrive as ready tabs (draw.io: one tab per page).
describe('importDocuments', () => {
  const tab = (name: string, label = 'x'): Tab => ({
    id: crypto.randomUUID(),
    name,
    elements: [
      {
        id: crypto.randomUUID(),
        type: 'text',
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        label,
      } as Element,
    ],
  });
  const landed = { landed: { text: 2 }, degraded: [], skipped: [] };
  const source = (
    name: string,
    tabs: Tab[],
    extra: Partial<ImportDocumentSource> = {},
  ): ImportDocumentSource => ({
    name,
    kind: 'diagram',
    createdAt: '2026-03-01T10:00:00Z',
    modifiedAt: '2026-03-12T10:00:00Z',
    prepare: async () => ({ tabs, report: landed }),
    ...extra,
  });

  it('makes one document per source with its ready tabs, named and dated as given', async () => {
    const made: NewBoardDocument[] = [];
    const outcome = await importDocuments([source('Plan', [tab('Overview'), tab('Detail')])], {
      ownerId: 'o',
      offline: false,
      createDocument: async (doc) => void made.push(doc),
    });
    expect(made).toHaveLength(1);
    expect(made[0]).toMatchObject({
      name: 'Plan',
      createdAt: Date.parse('2026-03-01T10:00:00Z'),
      savedAt: Date.parse('2026-03-12T10:00:00Z'),
    });
    expect(made[0]!.tabs.map((t) => t.name)).toEqual(['Overview', 'Detail']);
    expect(outcome).toMatchObject({
      status: 'done',
      documents: [{ name: 'Plan' }],
      scene: { landed: { text: 2 } },
    });
  });

  it('leaves out a page too large to store, names it, and lands the rest', async () => {
    const huge = tab('Network', 'x'.repeat(MAX_TAB_BYTES));
    const made: NewBoardDocument[] = [];
    const outcome = await importDocuments([source('Plan', [tab('Overview'), huge])], {
      ownerId: 'o',
      offline: false,
      createDocument: async (doc) => void made.push(doc),
    });
    expect(made[0]!.tabs.map((t) => t.name)).toEqual(['Overview']);
    expect(outcome).toMatchObject({
      status: 'done',
      failures: [{ title: 'Plan', message: "Page 'Network' is too large to store" }],
    });
  });

  it('fails a document none of whose pages fit, and keeps the others', async () => {
    const huge = tab('Only', 'x'.repeat(MAX_TAB_BYTES));
    const made: NewBoardDocument[] = [];
    const outcome = await importDocuments([source('Big', [huge]), source('Small', [tab('One')])], {
      ownerId: 'o',
      offline: false,
      createDocument: async (doc) => void made.push(doc),
    });
    expect(made.map((d) => d.name)).toEqual(['Small']);
    expect(outcome).toMatchObject({ failures: [{ title: 'Big', message: BOARD_TOO_BIG }] });
  });

  it('lists a source that could not be prepared, with its reason', async () => {
    const outcome = await importDocuments(
      [
        source('Broken', [], { prepare: async () => ({ error: 'This file is damaged.' }) }),
        source('Fine', [tab('One')]),
      ],
      { ownerId: 'o', offline: false, createDocument: async () => {} },
    );
    expect(outcome).toMatchObject({
      status: 'done',
      documents: [{ name: 'Fine' }],
      failures: [{ title: 'Broken', message: 'This file is damaged.' }],
    });
  });

  it('has no size limit offline', async () => {
    const huge = tab('Network', 'x'.repeat(MAX_TAB_BYTES));
    const made: NewBoardDocument[] = [];
    await importDocuments([source('Plan', [huge])], {
      ownerId: 'o',
      offline: true,
      createDocument: async (doc) => void made.push(doc),
    });
    expect(made[0]!.tabs).toHaveLength(1);
  });
});
