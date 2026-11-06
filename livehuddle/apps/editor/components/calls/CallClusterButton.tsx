'use client';

// Proximity audio's control in the bottom-right cluster, beside Avatar (docs/specs/012-collaboration/
// proximity-audio.md "Who is in a call" and "The microphone"). Before you join: one button, Join Audio (Listen In for
// a Viewer). Once in: a strip of the microphone, which mutes and unmutes and shows at a glance whether anyone hears
// you, and Leave Audio. While the calls kill switch pauses calls: Calls Paused, calm, never an error, and a press tries
// again (docs/specs/016-platform/calls-kill-switch.md "Calls Paused"). Nothing at all while calls are off or there is
// nobody to talk to. Once in, the camera and Share Screen sit beside the microphone (docs/specs/012-collaboration/
// video-and-screen-bubbles.md), reading Video Paused while the switch allows audio alone. The strip carries no help
// link (docs/specs/018-help/contextual-help-links.md). A stage adds Raise Hand (or the
// count of raised hands for its speakers) and, on a stage you may not speak from, a line above the strip; Do Not
// Disturb adds a segment that clears it (meeting-rooms-and-stage.md "Raise hand", "The stage line", "Do Not Disturb").
// With no call to offer, or before joining, the camera and Share Screen still show where the browser can capture, as a
// local preview only you see (video-and-screen-bubbles.md "Local preview").
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
import { lucideGlyph } from '@livehuddle/ui';
import { ClusterStrip } from '@liveworkspace/workbench/components/canvas/ClusterPopoverButton';
import {
  useCallActions,
  useCallSelf,
  type CallActions,
  type CallSelf,
} from '@/lib/calls/calls-store';
import { localOnly, selfCamera, selfScreen } from '@/lib/calls/local-preview';
import { ScreenShareBar } from './ScreenShareBar';
import { Segment } from './CallSegment';
import { DoNotDisturbSegment, HandSegment, StageLine } from './StageSegments';

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

export function CallClusterButton({
  doNotDisturb = false,
  onClearDoNotDisturb,
}: {
  // Your status is Do Not Disturb, and how to clear it (the Avatar panel's status setter).
  doNotDisturb?: boolean;
  onClearDoNotDisturb?: () => void;
} = {}) {
  const self = useCallSelf();
  const actions = useCallActions();
  if (!actions) return null;
  if (!self.available) {
    // No call here (no room, calls off): the camera and screen alone, as a local preview.
    if (!self.canSpeak || !(self.canPreviewCamera || self.canPreviewScreen)) return null;
    return (
      <>
        <ClusterStrip dataTourId="call-button">
          <MediaSegments self={self} actions={actions} first />
        </ClusterStrip>
        <ScreenShareBar />
      </>
    );
  }
  const paused = self.mode === 'off' && self.phase !== 'live';
  return (
    <>
      <CallControl
        self={self}
        actions={actions}
        paused={paused}
        doNotDisturb={doNotDisturb}
        onClearDoNotDisturb={onClearDoNotDisturb}
      />
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
        <MediaSegments self={self} actions={actions} />
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
        <MediaSegments self={self} actions={actions} />
      </ClusterStrip>
    );
  }

  const indicator = micIndicator(self);
  const text = INDICATOR_TEXT[indicator];
  const mutable = indicator !== 'listening' && indicator !== 'blocked';
  return (
    <div className="relative flex">
      <StageLine barredBy={self.barredBy} onStage={self.stage === 'speaker'} />
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
        {doNotDisturb ? <DoNotDisturbSegment onClear={onClearDoNotDisturb} /> : null}
        <HandSegment self={self} actions={actions} />
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
      </ClusterStrip>
    </div>
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

// Why a preview is yours alone, ending each preview hover card (video-and-screen-bubbles.md "Local preview").
function previewWhy(self: CallSelf): string {
  return self.available ? 'until you join audio' : 'here: this Space has no call to send it on';
}

function cameraText(self: CallSelf, live: boolean): MediaText {
  const camera = selfCamera(self);
  if (localOnly(self, 'video')) {
    return {
      label: 'Turn Off Camera',
      title: 'Only You See Your Camera',
      description: `Nothing is sent: only you see it ${previewWhy(self)}. Press to turn it off.`,
    };
  }
  if (!live && camera === 'off') {
    return {
      label: 'Turn On Camera',
      title: 'Camera',
      description: `Preview your camera in a bubble above your head. Only you see it ${previewWhy(self)}.`,
    };
  }
  return CAMERA_TEXT[camera === 'on' || camera === 'blocked' ? camera : 'off'];
}

function screenText(self: CallSelf, live: boolean): MediaText {
  const sending = self.screen === 'on';
  // A Participant previews a screen even in a call: sharing one is an Editor's.
  const why = live || self.canShare ? previewWhy(self) : 'here';
  if (localOnly(self, 'screen')) {
    return {
      label: 'Stop Sharing',
      title: 'Only You See Your Screen',
      description:
        live && !self.canShare
          ? 'Nothing is sent: your link lets you preview a screen, not share it. Press to stop.'
          : `Nothing is sent: only you see it ${why}. Press to stop.`,
    };
  }
  if (sending) {
    return {
      label: 'Stop Sharing',
      title: 'Sharing Your Screen',
      description: 'The people near you see your screen. Press to stop sharing.',
    };
  }
  if (live && self.canShare) {
    return {
      label: 'Share Screen',
      title: 'Share Screen',
      description:
        'Share a screen, window or tab in a bubble above your head to the people near you.',
    };
  }
  return {
    label: 'Share Screen',
    title: 'Share Screen',
    description:
      live && !self.canShare
        ? 'Preview a screen, window or tab above your head. Only you see it: your link lets you preview a screen, not share it.'
        : `Preview a screen, window or tab in a bubble above your head. Only you see it ${why}.`,
  };
}

// The camera and Share Screen (video-and-screen-bubbles.md "The camera", "The screen share", "Local preview", "The
// kill switch"): between the microphone and Leave once in, beside Join Audio before, and alone with no call. A Viewer
// has neither; in a call Share Screen sends for an Editor and previews for a Participant; under audio only in a call
// both give way to one calm Video Paused.
function MediaSegments({
  self,
  actions,
  first = false,
}: {
  self: CallSelf;
  actions: CallActions;
  // The strip's first segment: no hairline before it.
  first?: boolean;
}) {
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
        divided
      />
    );
  }
  const camera = selfCamera(self);
  const screen = selfScreen(self);
  const showCamera = live || self.canPreviewCamera || camera !== 'off';
  const showScreen = (live && self.canShare) || self.canPreviewScreen || screen !== 'off';
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
          divided={!first}
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
          divided={!first || showCamera}
        />
      ) : null}
    </>
  );
}
