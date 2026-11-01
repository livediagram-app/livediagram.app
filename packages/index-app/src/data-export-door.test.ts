// The data export's formats on the export door (data-export-door.ts): csv and comments, the data export's key that
// opens the export door alone, and the keys that never open those two formats.
import { describe, expect, it, vi } from 'vitest';
import { handleInternalItems, type InternalItemHandlers } from './internal';
import { isDataExportFormat } from './data-export-door';

const OPTIONS = {
  key: 'index-key',
  exportKey: 'media-key',
  driveKey: 'drive-key',
  dataExportKey: 'export-key',
};

const get = (path: string, auth: string) =>
  new Request(`https://app.test/api/internal/${path}`, {
    headers: { Authorization: `Bearer ${auth}` },
  });

const send = (
  req: Request,
  handlers: Partial<InternalItemHandlers>,
  options: Partial<typeof OPTIONS> = OPTIONS,
) =>
  handleInternalItems(req, {
    key: undefined,
    ...options,
    handlers: { purge: async () => {}, ...handlers },
  });

const TABLES = [{ name: 'Sprint', kind: 'board' as const, csv: 'Title\nShip it\n' }];
const THREADS = [
  {
    id: 'T1',
    tabId: 'tab1',
    tabName: 'Main',
    on: 'el1',
    resolved: false,
    comments: [
      { id: 'C1', authorId: 'user_ada', authorName: 'Ada', text: 'Looks good', createdAt: 5 },
    ],
  },
];

describe('the csv format', () => {
  it('answers the tables as JSON on the data export key', async () => {
    const exportTables = vi.fn(async () => ({ status: 'ok' as const, tables: TABLES }));
    const exported = vi.fn();
    const res = await send(get('items/A/export?format=csv', 'export-key'), {
      exportTables,
      export: exported,
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await res.json()).toEqual({ tables: TABLES });
    expect(exportTables).toHaveBeenCalledWith('A');
    expect(exported).not.toHaveBeenCalled();
  });

  it('takes the index key too', async () => {
    const exportTables = vi.fn(async () => ({ status: 'ok' as const, tables: [] }));
    const res = await send(get('items/A/export?format=csv', 'index-key'), { exportTables });
    expect(res.status).toBe(200);
  });

  it('is a 404 for an item the app has no such item, and for an app without the handler', async () => {
    const missing = await send(get('items/A/export?format=csv', 'export-key'), {
      exportTables: async () => ({ status: 'not_found' }),
    });
    expect(missing.status).toBe(404);
    const none = await send(get('items/A/export?format=csv', 'export-key'), {});
    expect(none.status).toBe(404);
  });

  it('never opens to the media or the Drive key', async () => {
    const exportTables = vi.fn(async () => ({ status: 'ok' as const, tables: TABLES }));
    for (const key of ['media-key', 'drive-key']) {
      const res = await send(get('items/A/export?format=csv', key), { exportTables });
      expect(res.status).toBe(401);
    }
    expect(exportTables).not.toHaveBeenCalled();
  });
});

describe('the comments format', () => {
  it('answers the threads as JSON', async () => {
    const exportComments = vi.fn(async () => ({ status: 'ok' as const, threads: THREADS }));
    const res = await send(get('items/A/export?format=comments', 'export-key'), {
      exportComments,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ threads: THREADS });
  });

  it('is a 404 for a missing item or a missing handler', async () => {
    expect(
      (
        await send(get('items/A/export?format=comments', 'export-key'), {
          exportComments: async () => ({ status: 'not_found' }),
        })
      ).status,
    ).toBe(404);
    expect((await send(get('items/A/export?format=comments', 'export-key'), {})).status).toBe(404);
  });

  it('is a plain 404 when neither key it takes is configured', async () => {
    const res = await send(
      get('items/A/export?format=comments', 'media-key'),
      { exportComments: async () => ({ status: 'ok', threads: [] }) },
      { exportKey: 'media-key' },
    );
    expect(res.status).toBe(404);
  });
});

describe('the data export key', () => {
  it('opens the svg and file formats', async () => {
    const run = vi.fn(async () => ({
      status: 'ok' as const,
      body: '<svg/>',
      contentType: 'image/svg+xml',
      version: 3,
    }));
    for (const format of ['svg', 'file']) {
      const res = await send(get(`items/A/export?format=${format}`, 'export-key'), {
        export: run,
      });
      expect(res.status).toBe(200);
    }
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('opens no other door', async () => {
    const purge = vi.fn(async () => {});
    const res = await handleInternalItems(
      new Request('https://app.test/api/internal/items/A', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer export-key' },
      }),
      { ...OPTIONS, handlers: { purge } },
    );
    expect(res.status).toBe(401);
    expect(purge).not.toHaveBeenCalled();
    const imported = await handleInternalItems(
      new Request('https://app.test/api/internal/items/import', {
        method: 'POST',
        headers: { Authorization: 'Bearer export-key', 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner: 'user_ada', folderId: null, name: 'A', file: '{}' }),
      }),
      { ...OPTIONS, handlers: { purge, import: async () => ({ status: 'ok', id: 'N' }) } },
    );
    expect(imported.status).toBe(401);
  });
});

describe('isDataExportFormat', () => {
  it('names csv and comments only', () => {
    expect(isDataExportFormat('csv')).toBe(true);
    expect(isDataExportFormat('comments')).toBe(true);
    expect(isDataExportFormat('svg')).toBe(false);
    expect(isDataExportFormat(null)).toBe(false);
  });
});
