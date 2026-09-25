'use client';

import type { ModelDownload as Download } from '@/lib/reading/download-progress';
import { ModelDownload } from './ModelDownload';
import type { ProcessorReason, ReaderBackend } from '@/lib/reading/reader-protocol';
import type { ReaderFallback } from '@/lib/reading/types';

// Why the reader is on the processor, said in the author's terms.
const PROCESSOR_WHY: Record<ProcessorReason, string> = {
  'no-webgpu': 'this browser has no WebGPU',
  'no-adapter': 'no graphics card is available to the browser',
  'no-f16': 'your graphics card can’t run the model’s half-precision maths',
  'gpu-failed': 'the graphics card failed to start the model',
};

// What the surface is doing, said ON the photograph (spec/139 Phase 9).
//
// Pills rather than a panel: the photo is the whole interface, and a strip of
// chrome beside it would be the sidebar coming back through the window. They
// float in a fixed row at the top of the frame, so one appearing or going
// never moves anything else.

function Pill({
  tone = 'quiet',
  testId,
  children,
}: {
  tone?: 'quiet' | 'warn';
  testId?: string;
  children: React.ReactNode;
}) {
  return (
    <p
      data-testid={testId}
      className={`pointer-events-auto flex max-w-[min(32rem,80vw)] items-center gap-2 rounded-full px-3 py-1.5 text-xs shadow-lg backdrop-blur ${
        tone === 'warn' ? 'bg-amber-100/95 text-amber-900' : 'bg-slate-900/85 text-white'
      }`}
    >
      {children}
    </p>
  );
}

export function PhotoStatus({
  detecting,
  foundNothing,
  dropped = 0,
  labelError = null,
  modelDownload,
  readSoFar = 0,
  readTotal = 0,
  readerBackend,
  readerWhy,
  readerFallback,
  revealed,
  detected,
  reading,
  readError,
}: {
  detecting: boolean;
  foundNothing: boolean;
  // Notes found beyond what one photo may yield, and left out.
  dropped?: number;
  // Why a label file could not be opened over this photo.
  labelError?: string | null;
  // The reading model's download, while it runs.
  modelDownload?: Download;
  // How far the reader has got, and where a reader that runs HERE runs.
  readSoFar?: number;
  readTotal?: number;
  readerBackend?: ReaderBackend;
  // Why a reader that runs HERE is on the processor.
  readerWhy?: ProcessorReason;
  // The hosted reader's budget was spent and this device reads instead.
  readerFallback?: ReaderFallback;
  revealed: number;
  detected: number;
  reading: boolean;
  readError: string | null;
}) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center gap-2 p-3"
    >
      {detecting ? (
        <Pill testId="photo-finding">
          <span
            aria-hidden
            className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-slate-500 border-t-brand-400"
          />
          Finding the stickies…
        </Pill>
      ) : null}
      {revealed < detected ? (
        <Pill>
          Detecting… {revealed} of {detected}
        </Pill>
      ) : null}
      {reading ? (
        <Pill testId="photo-reading">
          <span
            aria-hidden
            className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-slate-500 border-t-brand-400"
          />
          {/* Whole phrases: only the engine's reason may wrap. */}
          <span className="shrink-0 whitespace-nowrap">Reading the words…</span>
          {readTotal > 0 ? (
            <span className="shrink-0 whitespace-nowrap tabular-nums text-slate-300">
              {readSoFar} of {readTotal}
            </span>
          ) : null}
          {readerBackend === 'webgpu' ? (
            <span className="text-slate-300">· on your graphics card</span>
          ) : readerBackend === 'wasm' ? (
            // A big wall is minutes here, not seconds: say so, rather than
            // let a slow bar pass for a stuck one.
            <span className="text-slate-300">
              · on the processor, which is slower
              {readerWhy ? `: ${PROCESSOR_WHY[readerWhy]}` : null}
            </span>
          ) : null}
        </Pill>
      ) : null}
      {readerFallback === 'budget' ? (
        // Whose budget it was (the deployment's key, or the author's free
        // share) is deliberately not said.
        <Pill tone="warn" testId="photo-reader-fallback">
          Free monthly budget reached. Reading on this device instead.
        </Pill>
      ) : null}
      {readError === 'reader_unavailable' ? (
        // The in-browser model never started: not the photograph's fault, and
        // not a partial read — say what it is.
        <Pill tone="warn" testId="photo-reader-unavailable">
          The reading model couldn&rsquo;t start in this browser. Type the words in yourself, or try
          again later.
        </Pill>
      ) : readError?.startsWith('partial:') ? (
        // PART of the run is not all of it. The words that arrived are on their
        // notes; this says how many did not, so the author knows which boxes
        // are blank because nobody read them rather than because the paper was
        // blank.
        <Pill tone="warn">
          {readError.slice('partial:'.length)} notes could not be read. Type those in yourself.
        </Pill>
      ) : readError ? (
        <Pill tone="warn">
          The reader could not finish ({readError}). Type the words in yourself.
        </Pill>
      ) : null}
      {modelDownload && !modelDownload.done && modelDownload.total > 0 ? (
        <ModelDownload download={modelDownload} />
      ) : null}
      {labelError ? (
        <Pill tone="warn" testId="photo-label-error">
          {labelError}
        </Pill>
      ) : null}
      {dropped > 0 ? (
        <Pill tone="warn" testId="photo-dropped">
          {dropped} more notes were found than one photo can bring in. Photograph the wall in
          sections to get them all.
        </Pill>
      ) : null}
      {foundNothing ? (
        <Pill tone="warn" testId="photo-found-nothing">
          No stickies found in this photo. Fill the frame with the wall, shoot straight on, and give
          it good light — then try another photo. You can still drag a box around a note to add it
          by hand.
        </Pill>
      ) : null}
    </div>
  );
}
