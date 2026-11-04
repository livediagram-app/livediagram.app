// The data export's two readable formats on an app's export door (liveworkspace/docs/specs/003-accounts/data-export.md
// "The apps' doors"): an item's boards and sheets as CSV, and its comment threads in one shape for every app. Both are
// answered as JSON at `GET /api/internal/items/:id/export?format=csv|comments`, on the index's key or the app's
// DATA_EXPORT_KEY, beside the door's `svg` and `file` formats (internal.ts). Read only: nothing is cached or written
// on the app's side.

// The formats only the data export asks for. The `export` handler never sees them: each has its own handler.
export const DATA_EXPORT_FORMATS = ['csv', 'comments'] as const;
export type DataExportFormat = (typeof DATA_EXPORT_FORMATS)[number];

export const isDataExportFormat = (value: unknown): value is DataExportFormat =>
  typeof value === 'string' && (DATA_EXPORT_FORMATS as readonly string[]).includes(value);

// One table as a spreadsheet opens it: a Board tab's cards or a Sheet's cells, `name` the board's or sheet's own
// (the service makes it a file name), `csv` the text with no field that runs as a formula.
export type ExportTable = { name: string; kind: 'board' | 'sheet'; csv: string };

export type ExportTablesResult = { status: 'ok'; tables: ExportTable[] } | { status: 'not_found' };

// One comment as every app answers it. `authorId` is the account (or guest) that wrote it, null for one whose
// author is gone or was never recorded; `authorName` the name it was shown with. `createdAt` is epoch ms.
export type ExportComment = {
  id: string;
  authorId: string | null;
  authorName: string | null;
  text: string;
  createdAt: number | null;
};

// One thread: the tab it is on (null for a thread on no tab, a card's in a plan), what it is pinned to (an
// element's or a card's id, null for none), whether it is resolved, and its comments oldest first.
export type ExportThread = {
  id: string;
  tabId: string | null;
  tabName: string | null;
  on: string | null;
  resolved: boolean;
  comments: ExportComment[];
};

export type ExportCommentsResult =
  { status: 'ok'; threads: ExportThread[] } | { status: 'not_found' };

export type DataExportHandlers = {
  // The item's boards and sheets as CSV (an app without either leaves it out, and the door answers 404).
  exportTables?: (itemId: string) => Promise<ExportTablesResult>;
  // Every comment thread in the item, with each comment's author.
  exportComments?: (itemId: string) => Promise<ExportCommentsResult>;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

// GET /api/internal/items/:id/export?format=csv|comments: the caller's key is already checked.
export async function answerDataExport(
  id: string,
  format: DataExportFormat,
  handlers: DataExportHandlers,
): Promise<Response> {
  if (format === 'csv') {
    const run = handlers.exportTables;
    if (!run) return json({ error: 'not_found' }, 404);
    const result = await run(id);
    return result.status === 'ok'
      ? json({ tables: result.tables })
      : json({ error: 'not_found' }, 404);
  }
  const run = handlers.exportComments;
  if (!run) return json({ error: 'not_found' }, 404);
  const result = await run(id);
  return result.status === 'ok'
    ? json({ threads: result.threads })
    : json({ error: 'not_found' }, 404);
}
