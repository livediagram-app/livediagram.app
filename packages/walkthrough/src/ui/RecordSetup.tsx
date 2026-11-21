'use client';

// Record a Walkthrough's set-up (liveworkspace/docs/specs/006-media/walkthroughs.md "Recording"), a popover beside
// Tools and a drawer on a phone, as Add Connection is (owner, 2026-11-17: it floated over the canvas): the microphone and
// camera, the level meter, the bubble's corner, Hide From Recording, and Start Recording, which closes Tools for the
// count. Loaded when it first opens.
import { DevicePicker, NO_CAMERA } from '@liveworkspace/capture';
import { WALKTHROUGH_CORNERS, type WalkthroughCorner } from '@liveworkspace/media/walkthrough';
import { Button, CountBadge, HoverCard } from '@liveworkspace/ui';
import type { Walkthroughs } from '../useWalkthroughs';
import { LevelBar } from './Bubble';
import { HideIcon, RecordIcon } from './icons';
import { Problem } from './record-parts';

export default function RecordSetup({
  walkthroughs,
  titleId,
  onStarted,
}: {
  walkthroughs: Walkthroughs;
  titleId: string;
  // Recording begins: Tools closes, so the canvas is clear for the count.
  onStarted: () => void;
}) {
  const { recorder } = walkthroughs;
  const ready = recorder.stream !== null;
  const cameraOn =
    recorder.cameraOn &&
    recorder.camera !== NO_CAMERA &&
    (recorder.stream?.getVideoTracks().length ?? 0) > 0;
  return (
    <section
      aria-label="Record a Walkthrough"
      data-walkthrough-setup=""
      className="flex flex-col gap-4 p-5"
    >
      <div>
        <h2 id={titleId} className="text-[16px] font-semibold text-slate-900 dark:text-slate-50">
          Record a Walkthrough
        </h2>
        <p className="mt-1 text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
          Your voice, your camera if you turn it on, and how you move around the canvas, for anyone
          who opens it.
        </p>
      </div>
      <DevicePicker
        devices={recorder.devices}
        microphone={recorder.microphone}
        camera={recorder.camera}
        onMicrophone={recorder.setMicrophone}
        onCamera={recorder.setCamera}
        cameraOn={recorder.cameraOn}
        onCameraOn={recorder.setCameraOn}
        onAllow={recorder.allow}
      />
      <div className="flex items-center gap-3">
        <HoverCard
          title="Microphone Level"
          description="Moves as you speak, so you know you are heard before you record."
        >
          <span className="w-[4.6rem] shrink-0 cursor-default text-xs font-medium text-slate-600 dark:text-slate-300">
            Mic Level
          </span>
        </HoverCard>
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
      <footer className="flex items-center justify-between gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
        <HideControls walkthroughs={walkthroughs} />
        <Button
          variant="primary"
          size="sm"
          disabled={!ready}
          onClick={() => {
            recorder.start();
            onStarted();
          }}
          className="ml-auto"
        >
          <span className="inline-flex items-center gap-1.5">
            <RecordIcon size={10} className="text-rose-300" />
            Start Recording
          </span>
        </Button>
      </footer>
    </section>
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

// Hide From Recording, before the recording only (owner, 2026-11-17): once it runs, what is hidden is settled. Picking
// itself runs from the picking bar (PickingBar), the set-up giving way to it.
function HideControls({ walkthroughs }: { walkthroughs: Walkthroughs }) {
  const { hiding } = walkthroughs;
  const count = hiding.hidden.size;
  // Nothing on this tab can be hidden (a Sheet, a Form, an empty canvas): no control rather than a dead one.
  if (!hiding.canHide) return null;
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
        Hide From Recording
        {count > 0 ? <CountBadge count={count} label={`${count} hidden`} /> : null}
      </button>
    </HoverCard>
  );
}
