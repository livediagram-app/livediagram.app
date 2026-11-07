'use client';

// The call group: proximity audio's controls, on the Call dock at the bottom centre (CallDock; docs/specs/008-canvas/
// avatar-mode.md "The Call dock"; docs/specs/012-collaboration/proximity-audio.md "Who is in a call" and "The
// microphone"; owner 2026-11-07, moved there from the avatar palette). Each is named beside its glyph with a short label
// on a desktop (Mic, Camera, Share), a glyph alone on a phone. There is no Join or Leave (owner, 2026-11-07: "Joining
// audio and leaving audio ... is friction"): walking where there is a call joins it, hearing the people near you, and
// the microphone starts muted, unmuted with a press. While it connects: Connecting, greyed. While the calls kill switch
// pauses calls: Calls Paused, calm, never an error, and a press tries again (docs/specs/016-platform/calls-kill-switch.md
// "Calls Paused"); a failure reads Retry. The camera and Share Screen sit beside the microphone (docs/specs/
// 012-collaboration/video-and-screen-bubbles.md), reading Video Paused while the switch allows audio alone. The dock
// carries no help link (docs/specs/018-help/contextual-help-links.md). A stage adds Raise Hand (or the count of raised
// hands for its speakers) and, on a stage you may not speak from, a line over the group; Do Not Disturb adds a segment
// that clears it (meeting-rooms-and-stage.md "Raise hand", "The stage line", "Do Not Disturb"). With no call to offer
// (This Browser, no calls on the server, calls paused), the microphone, the camera and Share Screen still show where
// the browser can capture, as a local preview only you see (proximity-audio.md and video-and-screen-bubbles.md "Local
// preview"). While a share is on, its controls are the Screen Share group's (ScreenShareStripGroup), not this group's.
import {
  lucideHeadphones,
  lucideMic,
  lucideMicOff,
  lucidePause,
  lucideScreenShare,
  lucideScreenShareOff,
  lucideVideo,
  lucideVideoOff,
} from '@liveworkspace/icons/lucide';
import { callsModeAllows } from '@livehuddle/api-schema';
import { lucideGlyph } from '@livehuddle/ui';
import type { ReactNode } from 'react';
import {
  useCallActions,
  useCallSelf,
  type CallActions,
  type CallSelf,
} from '@/lib/calls/calls-store';
import { localOnly, selfCamera, selfScreen } from '@/lib/calls/local-preview';
import { Segment } from './CallSegment';
import { DoNotDisturbSegment, HandSegment, StageLine } from './StageSegments';

const MicIcon = lucideGlyph(lucideMic, 16);
const MicOffIcon = lucideGlyph(lucideMicOff, 16);
const HeadphonesIcon = lucideGlyph(lucideHeadphones, 16);
const PauseIcon = lucideGlyph(lucidePause, 16);
const VideoIcon = lucideGlyph(lucideVideo, 16);
const VideoOffIcon = lucideGlyph(lucideVideoOff, 16);
const ScreenIcon = lucideGlyph(lucideScreenShare, 16);
const ScreenOffIcon = lucideGlyph(lucideScreenShareOff, 16);

/** What a screen reader hears when the kill switch pauses calls (an `aria-live` region beside the control). */
export const CALLS_PAUSED_ANNOUNCEMENT = 'Calls are paused';

/** What the microphone shows: the indicator's four states, plus a listener's. */
export type MicIndicator = 'live' | 'nobody-near' | 'muted' | 'blocked' | 'closed' | 'listening';

export function micIndicator(self: CallSelf): MicIndicator {
  if (!self.canSpeak) return 'listening';
  if (self.mic === 'blocked') return 'blocked';
  if (self.muted) return 'muted';
  if (self.mic === 'closed') return 'closed';
  return self.someoneNear ? 'live' : 'nobody-near';
}

/** The microphone's short label beside its glyph on a desktop (the Call dock); the hover card carries the rest. */
const INDICATOR_NAME: Record<MicIndicator, string> = {
  live: 'Mic',
  'nobody-near': 'Mic',
  muted: 'Muted',
  blocked: 'Blocked',
  closed: 'Mic Off',
  listening: 'Listening',
};

const INDICATOR_TEXT: Record<MicIndicator, { title: string; description: string }> = {
  live: { title: 'Mic: Live', description: 'The people near you hear you. Press to mute.' },
  'nobody-near': {
    title: 'Mic: Nobody Near',
    description: 'Your microphone is on, but nobody is close enough to hear you. Press to mute.',
  },
  muted: { title: 'Mic: Muted', description: 'Nobody hears you. Press to unmute.' },
  blocked: {
    title: 'Mic: Blocked',
    description:
      'Your browser refused the microphone. Allow it from the address bar, then press to try again. You still hear everyone.',
  },
  closed: {
    title: 'Mic: Off',
    description: 'Your microphone is opening. Press to mute.',
  },
  listening: {
    title: 'Mic: Listening',
    description: 'You hear the people near you. Your link lets you listen, not speak.',
  },
};

/**
 * Your voice in the microphone button as you speak (owner, 2026-11-07: "show my voice volume etc in the mic button as
 * I speak so I can see how loud it is etc and see when I am transmitting"): a fill rising from the button's foot with
 * your level, 0 to 4, gliding between steps. Drawn while the microphone is open and unmuted, a call's or the local
 * preview's, so it moving means your voice is being picked up; the button's solid brand says somebody hears it.
 */
export function MicMeter({ level, onSolid }: { level: number; onSolid: boolean }) {
  return (
    <span
      aria-hidden
      data-mic-meter={level}
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"
    >
      <span
        className={`absolute inset-x-0 bottom-0 transition-[height] duration-150 ease-out motion-reduce:transition-none ${
          onSolid ? 'bg-white/30' : 'bg-brand-500/25 dark:bg-brand-400/30'
        }`}
        style={{ height: `${(Math.min(4, Math.max(0, level)) / 4) * 100}%` }}
      />
    </span>
  );
}

// The group's frame: its buttons side by side, the stage line hung over it.
function CallGroup({ children }: { children: ReactNode }) {
  return (
    <div
      role="group"
      aria-label="Call"
      data-call-group=""
      data-tour-id="call-button"
      className="relative flex shrink-0 items-center gap-0.5"
    >
      {children}
    </div>
  );
}

export function CallStripGroup({
  doNotDisturb = false,
  onClearDoNotDisturb,
  after,
}: {
  // Your status is Do Not Disturb, and how to clear it (the avatar palette's status setter).
  doNotDisturb?: boolean;
  onClearDoNotDisturb?: () => void;
  // Drawn after the group only while it shows (the strip's divider between the call and the look).
  after?: ReactNode;
} = {}) {
  const self = useCallSelf();
  const actions = useCallActions();
  if (!actions) return null;
  if (!self.available) {
    // No call here (no room, calls off): the microphone, the camera and the screen as a local preview only you see
    // (proximity-audio.md "No call here", "Local preview"), the microphone's hover card saying why nothing is sent.
    if (!self.canSpeak || !(self.canPreviewMic || self.canPreviewCamera || self.canPreviewScreen))
      return null;
    return (
      <>
        <CallGroup>
          <PreviewMicSegment self={self} actions={actions} />
          <MediaSegments self={self} actions={actions} />
        </CallGroup>
        {after}
      </>
    );
  }
  const paused = self.mode === 'off' && self.phase !== 'live';
  return (
    <>
      <CallGroup>
        <CallControl
          self={self}
          actions={actions}
          paused={paused}
          doNotDisturb={doNotDisturb}
          onClearDoNotDisturb={onClearDoNotDisturb}
        />
        {/* Polite, and always present, so the change to paused is read out when it happens. */}
        <span className="sr-only" aria-live="polite">
          {paused ? CALLS_PAUSED_ANNOUNCEMENT : ''}
        </span>
      </CallGroup>
      {after}
    </>
  );
}

function CallControl({
  self,
  actions,
  paused,
  doNotDisturb,
  onClearDoNotDisturb,
}: {
  self: CallSelf;
  actions: CallActions;
  paused: boolean;
  doNotDisturb: boolean;
  onClearDoNotDisturb?: () => void;
}) {
  if (paused) {
    const trying = self.phase === 'joining';
    return (
      <>
        <Segment
          label="Calls Paused"
          name={trying ? 'Joining…' : 'Calls Paused'}
          title="Calls Paused"
          description="Calls are paused for now. Everything else in the Space carries on. Press to try again."
          icon={<PauseIcon />}
          onClick={actions.join}
          disabled={trying}
        />
        <PreviewMicSegment self={self} actions={actions} />
        <MediaSegments self={self} actions={actions} />
      </>
    );
  }

  if (self.phase === 'error') {
    return (
      <>
        <Segment
          label="Retry Audio"
          name="Retry"
          title="Audio Unavailable"
          description="Audio could not start. Press to try again."
          icon={self.canSpeak ? <MicOffIcon /> : <HeadphonesIcon />}
          onClick={actions.join}
          tone="warn"
        />
        <PreviewMicSegment self={self} actions={actions} />
        <MediaSegments self={self} actions={actions} />
      </>
    );
  }

  // On its way in: walking joins by itself, muted (proximity-audio.md "Who is in a call").
  if (self.phase === 'off' || self.phase === 'joining') {
    return (
      <>
        <Segment
          label="Connecting audio"
          name="Connecting…"
          title="Connecting Audio"
          description={
            self.canSpeak
              ? 'Joining the people near your character, your microphone muted.'
              : 'Joining the people near your character. Your link lets you listen, not speak.'
          }
          icon={self.canSpeak ? <MicOffIcon /> : <HeadphonesIcon />}
          disabled
        />
        <MediaSegments self={self} actions={actions} />
      </>
    );
  }

  const indicator = micIndicator(self);
  const text = INDICATOR_TEXT[indicator];
  // Mic Blocked is pressed to ask the browser again (call-mic.ts).
  const mutable = indicator !== 'listening';
  return (
    <>
      <StageLine barredBy={self.barredBy} onStage={self.stage === 'speaker'} />
      <Segment
        label={self.muted ? 'Unmute' : indicator === 'listening' ? 'Listening' : 'Mute'}
        name={INDICATOR_NAME[indicator]}
        title={text.title}
        description={text.description}
        icon={
          indicator === 'listening' ? (
            <HeadphonesIcon />
          ) : indicator === 'muted' || indicator === 'blocked' ? (
            <MicOffIcon />
          ) : (
            <MicIcon />
          )
        }
        onClick={mutable ? actions.toggleMute : undefined}
        pressed={mutable ? self.muted : undefined}
        tone={
          indicator === 'live'
            ? 'live'
            : indicator === 'blocked'
              ? 'warn'
              : indicator === 'muted'
                ? 'muted'
                : 'rest'
        }
      >
        {indicator === 'live' || indicator === 'nobody-near' ? (
          <MicMeter level={self.level} onSolid={indicator === 'live'} />
        ) : null}
      </Segment>
      {doNotDisturb ? <DoNotDisturbSegment onClear={onClearDoNotDisturb} /> : null}
      <HandSegment self={self} actions={actions} />
      <MediaSegments self={self} actions={actions} />
    </>
  );
}

/**
 * A local preview's hover cards, one short line each (owner, 2026-11-07: "shorten the tooltips when local, its way to
 * long"): the title says Only You, so the line says only what a press does.
 */
export const PREVIEW_TEXT = {
  micOn: 'Nothing is sent. Press to mute.',
  micOff: 'Try your mic. Nothing is sent.',
  cameraOn: 'Nothing is sent. Press to turn off.',
  cameraOff: 'Try your camera. Nothing is sent.',
  screenOn: 'Nothing is sent. Press to stop.',
  screenOff: 'Try sharing. Nothing is sent.',
  blocked: 'Allow it in the address bar, then press again.',
  noShare: 'Your link lets you preview, not share.',
} as const;

function PreviewMicSegment({ self, actions }: { self: CallSelf; actions: CallActions }) {
  if (!self.canSpeak || !self.canPreviewMic) return null;
  const state = self.previewMic;
  const on = state === 'on';
  return (
    <Segment
      label={on ? 'Mute' : 'Unmute'}
      name={
        state === 'starting' ? 'Starting…' : on ? 'Mic' : state === 'blocked' ? 'Blocked' : 'Muted'
      }
      title={on ? 'Mic: Only You' : state === 'blocked' ? 'Mic: Blocked' : 'Mic: Muted'}
      description={
        on ? PREVIEW_TEXT.micOn : state === 'blocked' ? PREVIEW_TEXT.blocked : PREVIEW_TEXT.micOff
      }
      icon={on ? <MicIcon /> : <MicOffIcon />}
      onClick={actions.toggleMute}
      disabled={state === 'starting'}
      pressed={!on}
      tone={on ? 'live' : state === 'blocked' ? 'warn' : 'muted'}
    >
      {on ? <MicMeter level={self.level} onSolid /> : null}
    </Segment>
  );
}

type MediaText = { label: string; title: string; description: string };

const CAMERA_TEXT: Record<'on' | 'blocked' | 'off', MediaText> = {
  on: {
    label: 'Turn Off Camera',
    title: 'Camera: On',
    description: 'The people near you see you. Press to turn it off.',
  },
  blocked: {
    label: 'Turn On Camera',
    title: 'Camera: Blocked',
    description:
      'Your browser refused the camera. Allow it from the address bar, then press to try again.',
  },
  off: {
    label: 'Turn On Camera',
    title: 'Camera: Off',
    description: 'Show your camera in a bubble above your head to the people near you.',
  },
};

function cameraText(self: CallSelf, live: boolean): MediaText {
  const camera = selfCamera(self);
  if (localOnly(self, 'video')) {
    return {
      label: 'Turn Off Camera',
      title: 'Camera: Only You',
      description: PREVIEW_TEXT.cameraOn,
    };
  }
  if (!live && camera === 'off') {
    return {
      label: 'Turn On Camera',
      title: 'Camera: Off',
      description: PREVIEW_TEXT.cameraOff,
    };
  }
  if (!live && camera === 'blocked') {
    return { label: 'Turn On Camera', title: 'Camera: Blocked', description: PREVIEW_TEXT.blocked };
  }
  return CAMERA_TEXT[camera === 'on' || camera === 'blocked' ? camera : 'off'];
}

function screenText(self: CallSelf, live: boolean): MediaText {
  const sending = self.screen === 'on';
  // A Participant previews a screen even in a call: sharing one is an Editor's.
  if (localOnly(self, 'screen')) {
    return {
      label: 'Stop Sharing',
      title: 'Share Screen: Only You',
      description: live && !self.canShare ? PREVIEW_TEXT.noShare : PREVIEW_TEXT.screenOn,
    };
  }
  if (sending) {
    return {
      label: 'Stop Sharing',
      title: 'Share Screen: On',
      description: 'The people near you see your screen. Press to stop sharing.',
    };
  }
  if (live && self.canShare) {
    return {
      label: 'Share Screen',
      title: 'Share Screen: Off',
      description:
        'Share a screen, window or tab in a bubble above your head to the people near you.',
    };
  }
  return {
    label: 'Share Screen',
    title: 'Share Screen: Off',
    description: live && !self.canShare ? PREVIEW_TEXT.noShare : PREVIEW_TEXT.screenOff,
  };
}

// The camera and Share Screen (video-and-screen-bubbles.md "The camera", "The screen share", "Local preview", "The
// kill switch"): beside the microphone, in a call or as a local preview with none. A Viewer
// has neither; in a call Share Screen sends for an Editor and previews for a Participant; under audio only in a call
// both give way to one calm Video Paused.
function MediaSegments({ self, actions }: { self: CallSelf; actions: CallActions }) {
  if (!self.canSpeak) return null;
  const live = self.phase === 'live';
  if (live && !callsModeAllows(self.mode, 'video')) {
    return (
      <Segment
        label="Video Paused"
        name="Video Paused"
        title="Video Paused"
        description="Video and screen sharing are paused for now. Audio carries on."
        icon={<PauseIcon />}
      />
    );
  }
  const camera = selfCamera(self);
  const screen = selfScreen(self);
  const showCamera = live || self.canPreviewCamera || camera !== 'off';
  // While the share is on, Stop Sharing is the Screen Share group's, which takes the look's place in the strip
  // (ScreenShareStripGroup, after this group on the Call dock; video-and-screen-bubbles.md "The screen share"), so this
  // button gives way to it.
  const showScreen =
    screen !== 'on' && ((live && self.canShare) || self.canPreviewScreen || screen !== 'off');
  const camText = cameraText(self, live);
  const scrText = screenText(self, live);
  const on = screen === 'on';
  return (
    <>
      {showCamera ? (
        <Segment
          label={camText.label}
          name={camera === 'starting' ? 'Starting…' : 'Camera'}
          title={camText.title}
          description={camText.description}
          icon={camera === 'on' ? <VideoIcon /> : <VideoOffIcon />}
          onClick={actions.toggleCamera}
          disabled={camera === 'starting'}
          pressed={camera === 'on'}
          tone={camera === 'on' ? 'live' : camera === 'blocked' ? 'warn' : 'rest'}
        />
      ) : null}
      {showScreen ? (
        <Segment
          label={scrText.label}
          name={screen === 'starting' ? 'Choosing…' : on ? 'Sharing' : 'Share'}
          title={scrText.title}
          description={scrText.description}
          icon={on ? <ScreenOffIcon /> : <ScreenIcon />}
          onClick={actions.toggleScreen}
          disabled={screen === 'starting'}
          pressed={on}
          tone={on ? 'live' : 'rest'}
        />
      ) : null}
    </>
  );
}
