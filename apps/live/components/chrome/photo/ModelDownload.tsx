'use client';

import type { ModelDownload as Download } from '@/lib/reading/download-progress';

// The in-browser reader's model arriving (spec/139 Phase 9): ~160 MB, fetched
// once per device and kept in the browser's cache. A download that size with
// nothing moving on screen reads as a hang, so it gets a real bar — megabytes
// and a share — and a word that this is the one time it costs anything.

const MB = 1024 * 1024;

export function ModelDownload({ download }: { download: Download }) {
  const share = download.total > 0 ? Math.round((download.loaded / download.total) * 100) : 0;
  return (
    <div
      data-testid="photo-model-download"
      className="pointer-events-auto flex w-[min(26rem,80vw)] flex-col gap-1.5 rounded-2xl bg-slate-900/90 px-3 py-2 text-xs text-white shadow-lg backdrop-blur"
    >
      <p className="flex justify-between gap-3">
        <span>Downloading the reading model — only the first time</span>
        <span className="tabular-nums text-slate-300">
          {Math.round(download.loaded / MB)} of {Math.round(download.total / MB)} MB
        </span>
      </p>
      <div
        role="progressbar"
        aria-label="Reading model download"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={share}
        className="h-1.5 w-full overflow-hidden rounded-full bg-white/15"
      >
        {/* No width transition: the library reports progress many times a
            second, and a 300 ms transition restarted on every report never
            caught up — measured at 8% on screen while the download was at 47%.
            The reports are frequent enough to move the bar smoothly. */}
        <div className="h-full rounded-full bg-brand-400" style={{ width: `${share}%` }} />
      </div>
    </div>
  );
}
