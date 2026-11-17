'use client';

// The recording dock (liveworkspace/docs/specs/006-media/walkthroughs.md "Recording"), at the bottom centre of the
// canvas: the set-up card, the count, the compact recording bar and the save card, one at a time.

import { DevicePicker, NO_CAMERA } from '@liveworkspace/capture';
import {
  WALKTHROUGH_CORNERS,
  WALKTHROUGH_MAX_MS,
  type WalkthroughCorner,
} from '@liveworkspace/media/walkthrough';
import {
  Button,
  CloseIcon,
  ConfirmPopover,
  CountBadge,
  HoverCard,
  TextInput,
} from '@liveworkspace/ui';
import { useState, type ReactNode } from 'react';
import { formatClock } from '../timeline';
import type { Walkthroughs } from '../useWalkthroughs';
import { LevelBar } from './Bubble';
import { DownloadIcon, HideIcon, RecordIcon, StopIcon, WarningIcon } from './icons';

const CARD =
  'pointer-events-auto rounded-2xl border border-slate-200 bg-white/95 shadow-2xl shadow-slate-900/15 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95 dark:shadow-black/40';
const LAST_MINUTE_MS = WALKTHROUGH_MAX_MS - 60_000;

export function RecordDock({ walkthroughs }: { walkthroughs: Walkthroughs }) {
  const { recorder } = walkthroughs;
  const phase = recorder.phase;
  if (phase.kind === 'off') return null;
  return (
    <div
      data-walkthrough-dock={phase.kind}
      className="pointer-events-none absolute inset-x-0 bottom-16 z-40 flex justify-center px-4"
    >
      {phase.kind === 'setup' ? <SetupCard walkthroughs={walkthroughs} /> : null}
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

function HideControls({
  walkthroughs,
  compact,
}: {
  walkthroughs: Walkthroughs;
  compact?: boolean;
}) {
  const { hiding, host } = walkthroughs;
  const count = hiding.hidden.size;
  if (hiding.picking) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-[12px] text-slate-600 dark:text-slate-300">
          {compact ? 'Press to hide' : 'Press elements to hide them'}
        </span>
        <Button variant="secondary" size="xs" onClick={() => hiding.hideAll(host.selection())}>
          Hide Selection
        </Button>
        <Button variant="primary" size="xs" onClick={() => hiding.setPicking(false)}>
          Done
        </Button>
      </div>
    );
  }
  return (
    <HoverCard
      title="Hide From Recording"
      description="Pick elements viewers of this walkthrough won't see."
    >
      <button
        type="button"
        aria-pressed={false}
        onClick={() => hiding.setPicking(true)}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <HideIcon size={14} />
        {compact ? 'Hide' : 'Hide From Recording'}
        {count > 0 ? <CountBadge count={count} label={`${count} hidden`} /> : null}
      </button>
    </HoverCard>
  );
}

function CornerPicker({
  corner,
  onCorner,
}: {
  corner: WalkthroughCorner;
  onCorner: (c: WalkthroughCorner) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Bubble corner"
      className="grid h-8 w-11 shrink-0 grid-cols-2 gap-0.5 rounded-md border border-slate-200 p-0.5 dark:border-slate-700"
    >
      {(['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const)
        .filter((c) => WALKTHROUGH_CORNERS.includes(c))
        .map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={corner === c}
            aria-label={c.replace('-', ' ')}
            onClick={() => onCorner(c)}
            className={`cursor-pointer rounded-sm transition ${
              corner === c
                ? 'bg-brand-600'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700'
            }`}
          />
        ))}
    </div>
  );
}

function SetupCard({ walkthroughs }: { walkthroughs: Walkthroughs }) {
  const { recorder, discard } = walkthroughs;
  const ready = recorder.stream !== null;
  const cameraOn =
    recorder.camera !== NO_CAMERA && (recorder.stream?.getVideoTracks().length ?? 0) > 0;
  return (
    <section
      aria-label="Record a Walkthrough"
      className={`${CARD} flex w-[min(25rem,100%)] flex-col gap-3 p-4`}
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[14px] font-semibold text-slate-900 dark:text-slate-50">
            Record a Walkthrough
          </h2>
          <p className="mt-0.5 text-[12px] leading-snug text-slate-500 dark:text-slate-400">
            Your voice, your camera and how you move around the canvas, for anyone who opens it.
          </p>
        </div>
        <HoverCard title="Close">
          <button
            type="button"
            aria-label="Close"
            onClick={discard}
            className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <CloseIcon size={12} />
          </button>
        </HoverCard>
      </header>
      <DevicePicker
        devices={recorder.devices}
        microphone={recorder.microphone}
        camera={recorder.camera}
        onMicrophone={recorder.setMicrophone}
        onCamera={recorder.setCamera}
      />
      <div className="flex items-center gap-3">
        <span className="w-[4.6rem] shrink-0 text-xs font-medium text-slate-600 dark:text-slate-300">
          Level
        </span>
        <LevelBar meter={recorder.meter} className="flex-1" />
        {cameraOn ? (
          <HoverCard
            title="Bubble Corner"
            description="Where your camera shows, recorded and played back."
          >
            <span>
              <CornerPicker corner={recorder.corner} onCorner={recorder.setCorner} />
            </span>
          </HoverCard>
        ) : null}
      </div>
      {recorder.deviceProblem ? <Problem>{recorder.deviceProblem}</Problem> : null}
      <footer className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
        <HideControls walkthroughs={walkthroughs} />
        {walkthroughs.hiding.picking ? null : (
          <Button variant="primary" size="sm" disabled={!ready} onClick={recorder.start}>
            <span className="inline-flex items-center gap-1.5">
              <RecordIcon size={10} className="text-rose-300" />
              Start Recording
            </span>
          </Button>
        )}
      </footer>
    </section>
  );
}

function Problem({ children, tone = 'amber' }: { children: ReactNode; tone?: 'amber' | 'rose' }) {
  return (
    <p
      role="alert"
      className={`flex items-start gap-1.5 rounded-lg px-2.5 py-2 text-[12px] leading-snug ${
        tone === 'rose'
          ? 'bg-rose-50 text-rose-900 dark:bg-rose-500/10 dark:text-rose-100'
          : 'bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-100'
      }`}
    >
      <WarningIcon aria-hidden className="mt-px shrink-0" />
      {children}
    </p>
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
  const late = elapsed >= LAST_MINUTE_MS;
  return (
    <section
      aria-label="Recording"
      className={`${CARD} flex items-center gap-3 rounded-full py-1.5 pl-4 pr-1.5`}
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
        {formatClock(elapsed)} / {formatClock(WALKTHROUGH_MAX_MS)}
        {late ? <span className="ml-1.5 font-normal">1 minute left</span> : null}
      </span>
      <LevelBar meter={recorder.meter} className="hidden w-14 md:block" />
      <span className="h-5 w-px bg-slate-200 dark:bg-slate-700" />
      <HideControls walkthroughs={walkthroughs} compact />
      {walkthroughs.hiding.picking ? null : (
        <>
          <DiscardButton onDiscard={discard} size="xs" />
          <Button
            variant="primary"
            size="xs"
            onClick={() => void recorder.finish()}
            className="rounded-full"
          >
            <span className="inline-flex items-center gap-1.5">
              <StopIcon size={10} />
              Finish
            </span>
          </Button>
        </>
      )}
    </section>
  );
}

function SaveCard({ walkthroughs }: { walkthroughs: Walkthroughs }) {
  const { recorder, discard } = walkthroughs;
  const phase = recorder.phase;
  if (phase.kind !== 'review') return null;
  const saving = phase.saving !== null;
  const stoppedAtLimit = phase.events.durationMs >= WALKTHROUGH_MAX_MS - 1000;
  const megabytes = (phase.recorded.blob.size / (1024 * 1024)).toFixed(1);
  return (
    <section
      aria-label="Save Walkthrough"
      className={`${CARD} flex w-[min(25rem,100%)] flex-col gap-3 p-4`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !saving && e.target instanceof HTMLInputElement)
          void recorder.save();
      }}
    >
      <header>
        <h2 className="text-[14px] font-semibold text-slate-900 dark:text-slate-50">
          Save Walkthrough
        </h2>
        <p className="mt-0.5 text-[12px] tabular-nums text-slate-500 dark:text-slate-400">
          {formatClock(phase.events.durationMs)} · {megabytes} MB
          {stoppedAtLimit ? ' · Stopped at 10 minutes, the longest a walkthrough may be.' : ''}
        </p>
      </header>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Title</span>
        <TextInput
          value={phase.title}
          maxLength={120}
          disabled={saving}
          onChange={(e) => recorder.setTitle(e.target.value)}
          autoFocus
        />
      </label>
      {saving ? (
        <div className="flex flex-col gap-1.5" role="status">
          <span className="text-[12px] text-slate-600 dark:text-slate-300">
            {phase.saving === 'events' ? 'Starting the upload' : `Uploading ${megabytes} MB`}
          </span>
          <span className="relative block h-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <span className="absolute inset-y-0 left-0 w-1/3 animate-[walkthrough-upload_1.2s_ease-in-out_infinite] rounded-full bg-brand-600 motion-reduce:animate-none" />
          </span>
        </div>
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
            {saving ? 'Saving' : 'Save'}
          </Button>
        </span>
      </footer>
    </section>
  );
}
