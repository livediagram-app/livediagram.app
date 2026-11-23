'use client';

// The recording dock (liveworkspace/docs/specs/006-media/walkthroughs.md "Recording"): the count, the compact recording
// bar and the save card, one at a time (the set-up is a page inside Tools, RecordSetup.tsx), and before them the picking
// bar while the set-up picks what to hide (PickingBar, "Picking steps aside"). The picking bar, the count and the bar sit
// under the palette strip where the palette tray goes (owner, 2026-11-17, as "Click to drop" does); without a strip,
// and for the save card, at the bottom centre of the canvas.

import { Button, ConfirmPopover } from '@liveworkspace/ui';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  PALETTE_TRAY_GAP_PX,
  trayHost,
  traySlot,
  usePaletteStripBox,
} from '@liveworkspace/workbench/components/chrome/PaletteTray';
import { stoppedAtLimit, stoppedNote } from '../limit-state';
import { formatClock } from '../timeline';
import {
  formatTimeLeft,
  megabytes,
  uploadPercent,
  type WalkthroughUpload,
} from '../upload-progress';
import type { Walkthroughs } from '../useWalkthroughs';
import { LevelBar } from './Bubble';
import { Problem } from './record-parts';
import { DownloadIcon, StopIcon } from './icons';
import { PickingBar } from './PickingBar';

const CARD =
  'pointer-events-auto rounded-2xl border border-slate-200 bg-white/95 shadow-2xl shadow-slate-900/15 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95 dark:shadow-black/40';

export function RecordDock({ walkthroughs }: { walkthroughs: Walkthroughs }) {
  const { recorder } = walkthroughs;
  const phase = recorder.phase;
  const picking = phase.kind === 'setup' && walkthroughs.hiding.picking;
  const slim = picking || phase.kind === 'countdown' || phase.kind === 'recording';
  const strip = usePaletteStripBox(slim);
  if (phase.kind === 'off') return null;
  if (slim && strip && typeof document !== 'undefined') {
    const host = trayHost();
    const slot = traySlot(strip, window.innerWidth);
    return createPortal(
      <div
        data-walkthrough-dock={phase.kind}
        data-walkthrough-dock-at="palette"
        // Over the palette tray's slot: its hints step aside while recording (they are not recorded anyway).
        className="pointer-events-none fixed z-[var(--z-chrome)] flex justify-center"
        style={{
          left: slot.left - host.dx,
          width: slot.width,
          top: strip.bottom + PALETTE_TRAY_GAP_PX - host.dy,
        }}
      >
        {phase.kind === 'countdown' ? (
          <div
            className={`${CARD} rounded-xl px-3 py-1.5 text-[13px] font-medium text-slate-700 dark:text-slate-200`}
          >
            Recording starts in {phase.n}
          </div>
        ) : phase.kind === 'recording' ? (
          <RecordingBar walkthroughs={walkthroughs} elapsed={phase.elapsed} />
        ) : (
          <PickingBar walkthroughs={walkthroughs} card={CARD} />
        )}
      </div>,
      host.node,
    );
  }
  return (
    <div
      data-walkthrough-dock={phase.kind}
      className="pointer-events-none absolute inset-x-0 bottom-16 z-40 flex justify-center px-4"
    >
      {phase.kind === 'countdown' ? (
        <div
          className={`${CARD} px-4 py-2.5 text-[13px] font-medium text-slate-700 dark:text-slate-200`}
        >
          Recording starts in {phase.n}
        </div>
      ) : null}
      {phase.kind === 'recording' ? (
        <RecordingBar walkthroughs={walkthroughs} elapsed={phase.elapsed} />
      ) : null}
      {phase.kind === 'review' ? <SaveCard walkthroughs={walkthroughs} /> : null}
      {picking ? <PickingBar walkthroughs={walkthroughs} card={CARD} /> : null}
    </div>
  );
}

/** The big 3, 2, 1 over the canvas. */
export function Countdown({ n }: { n: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center">
      <span
        key={n}
        aria-live="assertive"
        className="flex h-28 w-28 animate-[walkthrough-count_1s_ease-out] items-center justify-center rounded-full bg-slate-900/80 text-6xl font-semibold tabular-nums text-white shadow-2xl backdrop-blur motion-reduce:animate-none"
      >
        {n}
      </span>
    </div>
  );
}

function DiscardButton({ onDiscard, size = 'sm' }: { onDiscard: () => void; size?: 'xs' | 'sm' }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <Button variant="ghost" size={size} onClick={(e) => setAnchor(e.currentTarget)}>
        Discard
      </Button>
      {anchor ? (
        <ConfirmPopover
          anchor={anchor}
          message="Discard this recording? It can't be recovered."
          confirmLabel="Discard"
          onCancel={() => setAnchor(null)}
          onConfirm={() => {
            setAnchor(null);
            onDiscard();
          }}
        />
      ) : null}
    </>
  );
}

function RecordingBar({ walkthroughs, elapsed }: { walkthroughs: Walkthroughs; elapsed: number }) {
  const { recorder, discard } = walkthroughs;
  // The recorder's own limit: the server's with Pro on, else the length a walkthrough always had.
  const late = elapsed >= recorder.maxMs - 60_000;
  return (
    <section
      aria-label="Recording"
      // The palette tray's shape: a 12 px card whose controls sit 4 px in, their 8 px corners nesting in its own.
      className={`${CARD} flex items-center gap-3 !rounded-xl py-1 pl-3 pr-1`}
    >
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        <span className="absolute inset-0 animate-ping rounded-full bg-rose-500/70 motion-reduce:animate-none" />
        <span className="relative h-2.5 w-2.5 rounded-full bg-rose-600" />
      </span>
      <span
        className={`text-[13px] font-medium tabular-nums ${
          late ? 'text-amber-600 dark:text-amber-400' : 'text-slate-800 dark:text-slate-100'
        }`}
      >
        {formatClock(elapsed)} / {formatClock(recorder.maxMs)}
        {late ? <span className="ml-1.5 font-normal">1 minute left</span> : null}
      </span>
      <LevelBar meter={recorder.meter} className="hidden w-14 md:block" />
      <span className="h-5 w-px bg-slate-200 dark:bg-slate-700" />
      {/* No Hide here (owner, 2026-11-17): what is hidden is chosen in the set-up, before the recording starts. */}
      <DiscardButton onDiscard={discard} size="xs" />
      <Button
        variant="primary"
        size="xs"
        onClick={() => void recorder.finish()}
        className="!rounded-lg"
      >
        <span className="inline-flex items-center gap-1.5">
          <StopIcon size={10} />
          Finish
        </span>
      </Button>
    </section>
  );
}

function SaveCard({ walkthroughs }: { walkthroughs: Walkthroughs }) {
  const { recorder, discard } = walkthroughs;
  const phase = recorder.phase;
  if (phase.kind !== 'review') return null;
  const saving = phase.saving !== null;
  const stopped = stoppedAtLimit(phase.events.durationMs, recorder.maxMs);
  return (
    <section
      aria-label="Save Walkthrough"
      className={`${CARD} flex w-[min(25rem,100%)] flex-col gap-3 p-4`}
    >
      <header>
        <h2 className="text-[14px] font-semibold text-slate-900 dark:text-slate-50">
          {phase.error ? 'Walkthrough Not Saved' : 'Saving Walkthrough'}
        </h2>
        <p className="mt-0.5 text-[12px] tabular-nums text-slate-500 dark:text-slate-400">
          {formatClock(phase.events.durationMs)} · {megabytes(phase.recorded.blob.size)} MB
          {stopped ? ` · ${stoppedNote(recorder.maxMs, walkthroughs.limits !== null)}` : ''}
        </p>
      </header>
      {saving ? (
        <UploadStatus stage={phase.saving} upload={phase.upload} bytes={phase.recorded.blob.size} />
      ) : null}
      {phase.error ? <Problem tone="rose">{phase.error}</Problem> : null}
      <footer className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
        {phase.error ? (
          <Button variant="secondary" size="sm" onClick={recorder.download}>
            <span className="inline-flex items-center gap-1.5">
              <DownloadIcon size={13} />
              Download a Copy
            </span>
          </Button>
        ) : (
          <span />
        )}
        <span className="flex items-center gap-2">
          {saving ? null : <DiscardButton onDiscard={discard} />}
          <Button
            variant="primary"
            size="sm"
            busy={saving}
            disabled={!walkthroughs.canRecord}
            onClick={() => void recorder.save()}
          >
            {saving ? 'Saving' : 'Try Again'}
          </Button>
        </span>
      </footer>
    </section>
  );
}

const TRACK = 'relative block h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700';

// The save's progress (each app's walkthroughs.md "Save"): starting, then a bar of the media's bytes sent with the
// percentage, the megabytes and about how long is left, then finishing while the server stores it. Only the stage
// is announced (role="status"); the numbers move too often to read out, and the bar carries them for a screen reader.
function UploadStatus({
  stage,
  upload,
  bytes,
}: {
  stage: 'events' | 'media' | null;
  upload: WalkthroughUpload | null;
  bytes: number;
}) {
  if (stage !== 'media' || !upload) {
    return (
      <div data-walkthrough-upload="starting" className="flex flex-col gap-1.5">
        <span role="status" className="text-[12px] text-slate-600 dark:text-slate-300">
          {stage === 'events' ? 'Starting the upload' : `Uploading ${megabytes(bytes)} MB`}
        </span>
        <span className={TRACK}>
          <span className="absolute inset-y-0 left-0 w-1/3 animate-[walkthrough-upload_1.2s_ease-in-out_infinite] rounded-full bg-brand-600 motion-reduce:animate-none" />
        </span>
      </div>
    );
  }
  const percent = uploadPercent(upload);
  const done = percent >= 100;
  const amount = `${megabytes(upload.sent)} of ${megabytes(upload.total)} MB`;
  const left = done
    ? 'Almost done'
    : upload.leftMs === null
      ? 'Working out the time left'
      : formatTimeLeft(upload.leftMs);
  return (
    <div data-walkthrough-upload={done ? 'finishing' : 'sending'} className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3 text-[12px]">
        <span className="min-w-0 truncate text-slate-600 dark:text-slate-300">
          <span role="status" className="font-medium text-slate-800 dark:text-slate-100">
            {done ? 'Finishing' : 'Uploading'}
          </span>
          <span className="tabular-nums"> · {amount}</span>
        </span>
        <span className="shrink-0 font-semibold tabular-nums text-slate-800 dark:text-slate-100">
          {percent}%
        </span>
      </div>
      <span
        role="progressbar"
        aria-label="Upload"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={`${percent}%, ${amount}, ${left}`}
        className={TRACK}
      >
        <span
          className="absolute inset-y-0 left-0 rounded-full bg-brand-600 transition-[width] duration-500 ease-out motion-reduce:transition-none"
          style={{ width: `${percent}%` }}
        />
      </span>
      <span className="text-[12px] tabular-nums text-slate-500 dark:text-slate-400">{left}</span>
    </div>
  );
}
