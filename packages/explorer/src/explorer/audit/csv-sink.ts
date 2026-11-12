// Where Export CSV writes (liveworkspace/docs/specs/004-index/team-audit-log.md "The Audit Log on a team's view"): a
// file the reader chose, written a chunk at a time, in a browser with the File System Access API, so the largest
// export (200,000 rows, about 40 MB of text) never sits whole in memory. Elsewhere there is no sink, and the caller
// joins the text and saves one Blob as before.

/** A file being written a chunk at a time. */
export type CsvSink = {
  write: (chunk: string) => Promise<void>;
  /** Finishes the file. */
  close: () => Promise<void>;
  /** Drops what was written: no half file is left behind. */
  abort: () => Promise<void>;
};

type SaveFilePicker = (options: {
  suggestedName: string;
  types: { description: string; accept: Record<string, string[]> }[];
}) => Promise<{ createWritable: () => Promise<WritableFileStream> }>;

type WritableFileStream = {
  write: (chunk: string) => Promise<void>;
  close: () => Promise<void>;
  abort: () => Promise<void>;
};

/** What asking for a sink came to: a sink, the reader closing the picker, or a browser with no picker. */
export type SinkChoice = CsvSink | 'cancelled' | 'unsupported';

/**
 * Asks where to save `name`. The picker opens from the click's own user activation, so call this inside the click
 * handler before any await (before any fetch). Returns null when the browser has no picker, so the caller knows at
 * once; otherwise a promise of the choice.
 */
export function pickCsvSink(name: string): Promise<SinkChoice> | null {
  const picker = (window as { showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker;
  if (typeof picker !== 'function') return null;
  return picker
    .call(window, {
      suggestedName: name,
      types: [{ description: 'CSV file', accept: { 'text/csv': ['.csv'] } }],
    })
    .then(
      async (handle): Promise<SinkChoice> => {
        const stream = await handle.createWritable();
        return {
          write: (chunk) => stream.write(chunk),
          close: () => stream.close(),
          abort: () => stream.abort().catch(() => undefined),
        };
      },
      (e: unknown): SinkChoice =>
        // Closing the picker is a choice; anything else (a frame that may not open it) falls back to a download.
        e instanceof DOMException && e.name === 'AbortError' ? 'cancelled' : 'unsupported',
    );
}
