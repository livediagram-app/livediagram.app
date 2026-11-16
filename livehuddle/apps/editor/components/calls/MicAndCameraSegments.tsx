'use client';

// The Call dock's microphone and Camera buttons (docs/specs/012-collaboration/proximity-audio.md "The microphone" and
// "No call here", video-and-screen-bubbles.md "The camera"), in a module of their own so the mini view draws the very
// same buttons (docs/specs/008-canvas/avatar-mode.md "The mini view", "Your microphone and camera"; Work Tracker 992).
// CallStripGroup lays them out on the dock; MiniViewControls at the mini view's foot.
import {
  lucideHeadphones,
  lucideMic,
  lucideMicOff,
  lucideVideo,
  lucideVideoOff,
} from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@livehuddle/ui';
import type { CallActions, CallSelf } from '@/lib/calls/calls-store';
import { localOnly, selfCamera } from '@/lib/calls/local-preview';
import { Segment } from './CallSegment';

const MicIcon = lucideGlyph(lucideMic, 16);
const MicOffIcon = lucideGlyph(lucideMicOff, 16);
const VideoIcon = lucideGlyph(lucideVideo, 16);
const VideoOffIcon = lucideGlyph(lucideVideoOff, 16);
const HeadphonesGlyph = lucideGlyph(lucideHeadphones, 16);

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

/** The live call's microphone: the indicator's state, a press mutes, unmutes or (Mic Blocked) asks again. */
export function LiveMicSegment({ self, actions }: { self: CallSelf; actions: CallActions }) {
  const indicator = micIndicator(self);
  const text = INDICATOR_TEXT[indicator];
  // Mic Blocked is pressed to ask the browser again (call-mic.ts).
  const mutable = indicator !== 'listening';
  return (
    <Segment
      label={self.muted ? 'Unmute' : indicator === 'listening' ? 'Listening' : 'Mute'}
      name={INDICATOR_NAME[indicator]}
      title={text.title}
      description={text.description}
      icon={
        indicator === 'listening' ? (
          <HeadphonesGlyph />
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

/** The microphone with no call: a local preview only you hear (proximity-audio.md "No call here"). */
export function PreviewMicSegment({ self, actions }: { self: CallSelf; actions: CallActions }) {
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

/** The Camera: the call's, or a local preview's with no call (video-and-screen-bubbles.md "The camera"). */
export function CameraSegment({ self, actions }: { self: CallSelf; actions: CallActions }) {
  const camera = selfCamera(self);
  const text = cameraText(self, self.phase === 'live');
  return (
    <Segment
      label={text.label}
      name={camera === 'starting' ? 'Starting…' : 'Camera'}
      title={text.title}
      description={text.description}
      icon={camera === 'on' ? <VideoIcon /> : <VideoOffIcon />}
      onClick={actions.toggleCamera}
      disabled={camera === 'starting'}
      pressed={camera === 'on'}
      tone={camera === 'on' ? 'live' : camera === 'blocked' ? 'warn' : 'rest'}
    />
  );
}
