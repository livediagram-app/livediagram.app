// One progress figure for the in-browser reader's model download.
//
// The model is ~160 MB, fetched once and kept in the browser's cache; the
// first photo import on a device pays for it, and a download that size with
// nothing moving on screen is indistinguishable from a hang. The library
// (transformers.js) reports it FILE BY FILE — a processor config, a tokenizer,
// three model files — each with its own loaded / total, and files it has not
// started yet are unknown. This adds what is known into one figure, so the
// bar only ever moves forward and the total grows as files are discovered.

// What the library's `progress_callback` hands over (the fields used here).
export type ModelProgressEvent = {
  status: string;
  file?: string;
  loaded?: number;
  total?: number;
};

export type ModelDownload = { loaded: number; total: number; done: boolean };

// `counts` says which files the bar is FOR — the weights. The small config
// files around them finish first and, counted, read as "100% of 0 MB".
export function downloadProgress(opts: { counts?: (file: string) => boolean } = {}) {
  const counts = opts.counts ?? (() => true);
  const files = new Map<string, { loaded: number; total: number }>();
  let ready = false;

  const update = (e: ModelProgressEvent) => {
    if (e.status === 'ready') {
      ready = true;
      return;
    }
    if (!e.file || !counts(e.file)) return;
    if (e.status === 'done') {
      const known = files.get(e.file);
      if (known) known.loaded = known.total;
      return;
    }
    // A file with no size yet says nothing a bar can show.
    if (e.status !== 'progress' || !e.total || e.total <= 0) return;
    files.set(e.file, { loaded: Math.min(e.loaded ?? 0, e.total), total: e.total });
  };

  const current = (): ModelDownload => {
    let loaded = 0;
    let total = 0;
    for (const f of files.values()) {
      loaded += f.loaded;
      total += f.total;
    }
    return { loaded, total, done: ready };
  };

  return { update, current };
}
