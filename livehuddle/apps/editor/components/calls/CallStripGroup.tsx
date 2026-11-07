'use client';

// The call group: proximity audio's controls, first on the avatar palette, at the strip's left (docs/specs/008-canvas/
// avatar-mode.md "The avatar palette"; docs/specs/012-collaboration/proximity-audio.md "Who is in a call" and "The
// microphone"; owner 2026-11-06, moved there from the bottom-right cluster). Before you join: one button, Join Audio
// (Listen In for a Viewer). Once in: the microphone, which mutes and unmutes and shows at a glance whether anyone
// hears you, and Leave Audio. While the calls kill switch pauses calls: Calls Paused, calm, never an error, and a press tries
// again (docs/specs/016-platform/calls-kill-switch.md "Calls Paused"). Nothing at all while calls are off or there is
// nobody to talk to. Once in, the camera and Share Screen sit beside the microphone (docs/specs/012-collaboration/
// video-and-screen-bubbles.md), reading Video Paused while the switch allows audio alone. The strip carries no help
// link (docs/specs/018-help/contextual-help-links.md). A stage adds Raise Hand (or the
// count of raised hands for its speakers) and, on a stage you may not speak from, a line under the group; Do Not
// Disturb adds a segment that clears it (meeting-rooms-and-stage.md "Raise hand", "The stage line", "Do Not Disturb").
// With no call to offer, or before joining, the camera and Share Screen still show where the browser can capture, as a
// local preview only you see (video-and-screen-bubbles.md "Local preview"). While a share is on, its controls are the
// Screen Share group's (ScreenShareStripGroup), not this group's.
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
import { useSyncExternalStore, type ReactNode } from 'react';
import {
  callSelf,
  onCallSelf,
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
const LeaveIcon = lucideGlyph(lucideHeadphoneOff, 16);
const PauseIcon = lucideGlyph(lucidePause, 16);
const VideoIcon = lucideGlyph(lucideVideo, 16);
const VideoOffIcon = lucideGlyph(lucideVideoOff, 16);
const ScreenIcon = lucideGlyph(lucideScreenShare, 16);
const ScreenOffIcon = lucideGlyph(lucideScreenShareOff, 16);

/** Why Join Audio is greyed while walking offers no call (proximity-audio.md "No call here"). */
export const NO_CALL_REASON: Record<'unsynced' | 'off', string> = {
  unsynced:
    'This space is only saved in your browser, so nobody else can join. Save it online to talk with people.',
  off: 'Calls are not available on this server.',
};

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
  live: { title: 'Mic: Live', description: 'The people near you hear you. Press to mute.' },
  'nobody-near': {
    title: 'Mic: Nobody Near',
    description: 'Your microphone is on, but nobody is close enough to hear you. Press to mute.',
  },
  muted: { title: 'Mic: Muted', description: 'Nobody hears you. Press to unmute.' },
  blocked: {
    title: 'Mic: Blocked',
    description:
      'Your browser refused the microphone. Allow it from the address bar, then join again. You still hear everyone.',
  },
  closed: {
    title: 'Mic: Off',
    description:
      'Nobody else is on this tab, so your microphone is off. It opens when somebody arrives.',
  },
  listening: {
    title: 'Mic: Listening',
    description: 'You hear the people near you. Your link lets you listen, not speak.',
  },
};

// A soft ring round the microphone while somebody hears you, breathing with your own level.
function LiveRing({ level }: { level: number }) {
  return (
    <span
      aria-hidden
      // On the solid brand of a live mic, so drawn in white.
      className="pointer-events-none absolute inset-0.5 rounded-[5px] ring-2 ring-white/70 ring-inset transition-[box-shadow,opacity] duration-150"
      style={{ opacity: 0.45 + level * 0.14 }}
    />
  );
}

// The group's frame: its buttons side by side, as the strip's others are, the stage line hung under it.
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

/**
 * What the group shows, coarsely (which kind of control, and the segments that come and go), so the strip measures
 * its named width afresh when the group grows or shrinks (useBarLabels' key) without re-measuring on every change of
 * the microphone's state as you walk.
 */
export function callGroupShape(self: CallSelf, doNotDisturb: boolean): string {
  if (!self.available)
    return `preview:${self.canSpeak && (self.canPreviewCamera || self.canPreviewScreen)}:${self.canSpeak ? self.unavailableReason : null}`;
  return [
    self.mode,
    self.phase === 'live' ? 'live' : 'join',
    self.canSpeak,
    self.canShare,
    doNotDisturb,
    self.hand,
    self.stage,
    self.handsUp > 0,
  ].join(':');
}

/** The group's shape, subscribed to alone: a string, so the strip re-renders only when the shape changes, never on
 *  the microphone level ticking as you talk (the group itself re-renders for that). */
export function useCallGroupShape(doNotDisturb: boolean): string {
  const shape = () => callGroupShape(callSelf(), doNotDisturb);
  return useSyncExternalStore(onCallSelf, shape, shape);
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
    // No call here (no room, calls off): Join Audio greyed with the reason (proximity-audio.md "No call here"), then the
    // camera and screen as a local preview.
    const reason = self.canSpeak ? self.unavailableReason : null;
    if (!reason && (!self.canSpeak || !(self.canPreviewCamera || self.canPreviewScreen)))
      return null;
    return (
      <>
        <CallGroup>
          {reason ? (
            <Segment
              label="Join Audio"
              name="Join Audio"
              title="Join Audio"
              description={NO_CALL_REASON[reason]}
              icon={<MicIcon />}
              unavailable
              glyphOnly
            />
          ) : null}
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
        <MediaSegments self={self} actions={actions} />
      </>
    );
  }

  if (self.phase === 'off' || self.phase === 'joining' || self.phase === 'error') {
    const joining = self.phase === 'joining';
    const name = self.canSpeak ? 'Join Audio' : 'Listen In';
    return (
      <>
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
          glyphOnly
          onClick={actions.join}
          disabled={joining}
          tone={self.phase === 'error' ? 'warn' : 'rest'}
        />
        <MediaSegments self={self} actions={actions} />
      </>
    );
  }

  const indicator = micIndicator(self);
  const text = INDICATOR_TEXT[indicator];
  const mutable = indicator !== 'listening' && indicator !== 'blocked';
  return (
    <>
      <StageLine barredBy={self.barredBy} onStage={self.stage === 'speaker'} />
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
        glyphOnly
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
      />
    </>
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

// Why a preview is yours alone, ending each preview hover card (video-and-screen-bubbles.md "Local preview").
function previewWhy(self: CallSelf): string {
  return self.available ? 'until you join audio' : 'here: this Space has no call to send it on';
}

function cameraText(self: CallSelf, live: boolean): MediaText {
  const camera = selfCamera(self);
  if (localOnly(self, 'video')) {
    return {
      label: 'Turn Off Camera',
      title: 'Camera: Preview',
      description: `Nothing is sent: only you see it ${previewWhy(self)}. Press to turn it off.`,
    };
  }
  if (!live && camera === 'off') {
    return {
      label: 'Turn On Camera',
      title: 'Camera: Off',
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
      title: 'Share Screen: Preview',
      description:
        live && !self.canShare
          ? 'Nothing is sent: your link lets you preview a screen, not share it. Press to stop.'
          : `Nothing is sent: only you see it ${why}. Press to stop.`,
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
  // (ScreenShareStripGroup; video-and-screen-bubbles.md "The screen share"), so this button gives way to it.
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
          glyphOnly
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
          glyphOnly
          onClick={actions.toggleScreen}
          disabled={screen === 'starting'}
          pressed={on}
          tone={on ? 'live' : 'rest'}
        />
      ) : null}
    </>
  );
}
