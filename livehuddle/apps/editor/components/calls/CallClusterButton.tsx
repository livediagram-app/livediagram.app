'use client';

// Proximity audio's control in the bottom-right cluster, beside Avatar (docs/specs/012-collaboration/
// proximity-audio.md "Who is in a call" and "The microphone"). Before you join: one button, Join Audio (Listen In for
// a Viewer). Once in: a strip of the microphone, which mutes and unmutes and shows at a glance whether anyone hears
// you, and Leave Audio. While the calls kill switch pauses calls: Calls Paused, calm, never an error, and a press tries
// again (docs/specs/016-platform/calls-kill-switch.md "Calls Paused"). Nothing at all while calls are off or there is
// nobody to talk to. Once in, the camera and Share Screen sit beside the microphone (docs/specs/012-collaboration/
// video-and-screen-bubbles.md), reading Video Paused while the switch allows audio alone. In every state the strip
// ends in a `?` to the calls article (docs/specs/018-help/contextual-help-links.md).
import type { ReactNode } from 'react';
import {
  lucideHeadphoneOff,
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
import { HoverCard, lucideGlyph } from '@livehuddle/ui';
import { ClusterStrip } from '@liveworkspace/workbench/components/canvas/ClusterPopoverButton';
import { CLUSTER_CONTROL_REST } from '@liveworkspace/workbench/components/canvas/cluster-strip';
import { useDockNames } from '@liveworkspace/workbench/hooks/ui/useDockNames';
import {
  useCallActions,
  useCallSelf,
  type CallActions,
  type CallSelf,
} from '@/lib/calls/calls-store';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { ScreenShareBar } from './ScreenShareBar';

const MicIcon = lucideGlyph(lucideMic, 16);
const MicOffIcon = lucideGlyph(lucideMicOff, 16);
const HeadphonesIcon = lucideGlyph(lucideHeadphones, 16);
const LeaveIcon = lucideGlyph(lucideHeadphoneOff, 16);
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

const INDICATOR_TEXT: Record<MicIndicator, { title: string; description: string }> = {
  live: { title: 'Live', description: 'The people near you hear you. Press to mute.' },
  'nobody-near': {
    title: 'Nobody Near',
    description: 'Your microphone is on, but nobody is close enough to hear you. Press to mute.',
  },
  muted: { title: 'Muted', description: 'Nobody hears you. Press to unmute.' },
  blocked: {
    title: 'Mic Blocked',
    description:
      'Your browser refused the microphone. Allow it from the address bar, then join again. You still hear everyone.',
  },
  closed: {
    title: 'Mic Off',
    description:
      'Nobody else is on this tab, so your microphone is off. It opens when somebody arrives.',
  },
  listening: {
    title: 'Listening',
    description: 'You hear the people near you. Your link lets you listen, not speak.',
  },
};

function Segment(props: {
  label: string;
  name: string;
  title: string;
  description: string;
  icon: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  pressed?: boolean;
  divided?: boolean;
  tone?: 'rest' | 'live' | 'warn' | 'muted';
  children?: ReactNode;
}) {
  const named = useDockNames();
  const tone =
    props.tone === 'live'
      ? 'text-brand-700 hover:bg-brand-50 dark:text-brand-200 dark:hover:bg-brand-500/15'
      : props.tone === 'warn'
        ? 'text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-500/10'
        : props.tone === 'muted'
          ? 'text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10'
          : CLUSTER_CONTROL_REST;
  return (
    <HoverCard title={props.title} description={props.description}>
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={props.onClick}
        disabled={props.disabled}
        aria-label={props.label}
        aria-pressed={props.pressed}
        className={`relative flex h-11 items-center ${props.onClick ? 'cursor-pointer' : 'cursor-default'} justify-center transition disabled:cursor-wait disabled:opacity-60 ${
          named ? 'gap-2 px-3.5 text-sm font-medium' : 'w-11'
        } ${props.divided ? 'border-l border-slate-100 dark:border-slate-800' : ''} ${tone}`}
      >
        {props.children}
        {props.icon}
        {named ? <span aria-hidden>{props.name}</span> : null}
      </button>
    </HoverCard>
  );
}

// The strip's last segment: the calls article (docs/specs/018-help/contextual-help-links.md), the one help link a
// control with no panel or popover of its own can carry. The shared `?`, sized to the strip's height and parted from
// the button before it by the strip's hairline.
function CallHelpLink() {
  return (
    <HelpArticleLink
      article="proximityAudio"
      className="!h-11 !w-9 !rounded-none border-l border-slate-100 !text-[15px] dark:border-slate-800"
    />
  );
}

// A soft ring round the microphone while somebody hears you, breathing with your own level.
function LiveRing({ level }: { level: number }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-1.5 rounded-md ring-2 ring-brand-400/60 transition-[box-shadow,opacity] duration-150 dark:ring-brand-300/50"
      style={{ opacity: 0.45 + level * 0.14 }}
    />
  );
}

export function CallClusterButton() {
  const self = useCallSelf();
  const actions = useCallActions();
  if (!self.available || !actions) return null;
  const paused = self.mode === 'off' && self.phase !== 'live';
  return (
    <>
      <CallControl self={self} actions={actions} paused={paused} />
      <ScreenShareBar />
      {/* Polite, and always present, so the change to paused is read out when it happens. */}
      <span className="sr-only" aria-live="polite">
        {paused ? CALLS_PAUSED_ANNOUNCEMENT : ''}
      </span>
    </>
  );
}

function CallControl({
  self,
  actions,
  paused,
}: {
  self: CallSelf;
  actions: CallActions;
  paused: boolean;
}) {
  if (paused) {
    const trying = self.phase === 'joining';
    return (
      <ClusterStrip dataTourId="call-button">
        <Segment
          label="Calls Paused"
          name={trying ? 'Joining…' : 'Calls Paused'}
          title="Calls Paused"
          description="Calls are paused for now. Everything else in the Space carries on. Press to try again."
          icon={<PauseIcon />}
          onClick={actions.join}
          disabled={trying}
        />
        <CallHelpLink />
      </ClusterStrip>
    );
  }

  if (self.phase === 'off' || self.phase === 'joining' || self.phase === 'error') {
    const joining = self.phase === 'joining';
    const name = self.canSpeak ? 'Join Audio' : 'Listen In';
    return (
      <ClusterStrip dataTourId="call-button">
        <Segment
          label={name}
          name={joining ? 'Joining…' : name}
          title={self.phase === 'error' ? 'Audio Unavailable' : name}
          description={
            self.phase === 'error'
              ? 'Audio could not start. Press to try again.'
              : self.canSpeak
                ? 'Talk with the people near your character. Walk away to leave a conversation.'
                : 'Hear the people near your character. Your link lets you listen, not speak.'
          }
          icon={self.canSpeak ? <MicIcon /> : <HeadphonesIcon />}
          onClick={actions.join}
          disabled={joining}
          tone={self.phase === 'error' ? 'warn' : 'rest'}
        />
        <CallHelpLink />
      </ClusterStrip>
    );
  }

  const indicator = micIndicator(self);
  const text = INDICATOR_TEXT[indicator];
  const mutable = indicator !== 'listening' && indicator !== 'blocked';
  return (
    <ClusterStrip dataTourId="call-button">
      <Segment
        label={self.muted ? 'Unmute' : indicator === 'listening' ? 'Listening' : 'Mute'}
        name={text.title}
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
        {indicator === 'live' ? <LiveRing level={self.level} /> : null}
      </Segment>
      <MediaSegments self={self} actions={actions} />
      <Segment
        label="Leave Audio"
        name="Leave"
        title="Leave Audio"
        description="Stop hearing and being heard. Your microphone is released."
        icon={<LeaveIcon />}
        onClick={actions.leave}
        divided
      />
      <CallHelpLink />
    </ClusterStrip>
  );
}

type MediaText = { label: string; title: string; description: string };

const CAMERA_TEXT: Record<'on' | 'blocked' | 'off', MediaText> = {
  on: {
    label: 'Turn Off Camera',
    title: 'Camera On',
    description: 'The people near you see you. Press to turn it off.',
  },
  blocked: {
    label: 'Turn On Camera',
    title: 'Camera Blocked',
    description:
      'Your browser refused the camera. Allow it from the address bar, then press to try again.',
  },
  off: {
    label: 'Turn On Camera',
    title: 'Camera',
    description: 'Show your camera in a bubble above your head to the people near you.',
  },
};

// The camera and Share Screen, between the microphone and Leave (video-and-screen-bubbles.md "The camera", "The
// screen share", "The kill switch"). A Viewer has neither; Share Screen is an Editor's; under audio only both give way
// to one calm Video Paused.
function MediaSegments({ self, actions }: { self: CallSelf; actions: CallActions }) {
  if (!self.canSpeak) return null;
  if (!callsModeAllows(self.mode, 'video')) {
    return (
      <Segment
        label="Video Paused"
        name="Video Paused"
        title="Video Paused"
        description="Video and screen sharing are paused for now. Audio carries on."
        icon={<PauseIcon />}
        divided
      />
    );
  }
  const camera = self.camera;
  const cameraText = CAMERA_TEXT[camera === 'on' || camera === 'blocked' ? camera : 'off'];
  const sharing = self.screen === 'on';
  return (
    <>
      <Segment
        label={cameraText.label}
        name={camera === 'starting' ? 'Starting…' : 'Camera'}
        title={cameraText.title}
        description={cameraText.description}
        icon={camera === 'on' ? <VideoIcon /> : <VideoOffIcon />}
        onClick={actions.toggleCamera}
        disabled={camera === 'starting'}
        pressed={camera === 'on'}
        tone={camera === 'on' ? 'live' : camera === 'blocked' ? 'warn' : 'rest'}
        divided
      />
      {self.canShare ? (
        <Segment
          label={sharing ? 'Stop Sharing' : 'Share Screen'}
          name={self.screen === 'starting' ? 'Choosing…' : sharing ? 'Sharing' : 'Share'}
          title={sharing ? 'Sharing Your Screen' : 'Share Screen'}
          description={
            sharing
              ? 'The people near you see your screen. Press to stop sharing.'
              : 'Share a screen, window or tab in a bubble above your head to the people near you.'
          }
          icon={sharing ? <ScreenOffIcon /> : <ScreenIcon />}
          onClick={actions.toggleScreen}
          disabled={self.screen === 'starting'}
          pressed={sharing}
          tone={sharing ? 'live' : 'rest'}
          divided
        />
      ) : null}
    </>
  );
}
