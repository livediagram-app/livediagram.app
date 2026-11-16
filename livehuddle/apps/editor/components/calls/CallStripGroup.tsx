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
// While the browser holds the call's sound back and you hear somebody, Click to Hear leads the group (proximity-audio.md
// "Someone who arrives later").
import {
  lucideHeadphones,
  lucideMicOff,
  lucidePause,
  lucideScreenShare,
  lucideScreenShareOff,
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
import {
  CameraSegment,
  LiveMicSegment,
  PREVIEW_TEXT,
  PreviewMicSegment,
} from './MicAndCameraSegments';
import { DoNotDisturbSegment, HandSegment, StageLine } from './StageSegments';

const MicOffIcon = lucideGlyph(lucideMicOff, 16);
const HeadphonesIcon = lucideGlyph(lucideHeadphones, 16);
const PauseIcon = lucideGlyph(lucidePause, 16);
const ScreenIcon = lucideGlyph(lucideScreenShare, 16);
const ScreenOffIcon = lucideGlyph(lucideScreenShareOff, 16);

/** What a screen reader hears when the kill switch pauses calls (an `aria-live` region beside the control). */
export const CALLS_PAUSED_ANNOUNCEMENT = 'Calls are paused';

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

/**
 * Whether the call group draws anything: a running call to drive, and either a call here or a local preview for
 * someone who may speak. The Call dock reads it for the divider before Pop Out (the mini view).
 */
export function callGroupShows(self: CallSelf, actions: CallActions | null): boolean {
  if (!actions) return false;
  if (self.available) return true;
  return self.canSpeak && (self.canPreviewMic || self.canPreviewCamera || self.canPreviewScreen);
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
  if (!actions || !callGroupShows(self, actions)) return null;
  if (!self.available) {
    // No call here (no room, calls off): the microphone, the camera and the screen as a local preview only you see
    // (proximity-audio.md "No call here", "Local preview"), the microphone's hover card saying why nothing is sent.
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

  return (
    <>
      <StageLine barredBy={self.barredBy} onStage={self.stage === 'speaker'} />
      <AudioHeldSegment self={self} actions={actions} />
      <LiveMicSegment self={self} actions={actions} />
      {doNotDisturb ? <DoNotDisturbSegment onClear={onClearDoNotDisturb} /> : null}
      <HandSegment self={self} actions={actions} />
      <MediaSegments self={self} actions={actions} />
    </>
  );
}

/** Click to Hear's hover card: the browser holds the sound back, and a press anywhere starts it. */
export const AUDIO_HELD_TEXT = {
  title: 'Sound Held Back',
  description:
    'Your browser is holding back the call’s sound. Press here, or anywhere on the page, to hear the people near you.',
} as const;

/** Click to Hear: only while the browser holds the sound back and somebody is heard, so it never shows for nothing. */
function AudioHeldSegment({ self, actions }: { self: CallSelf; actions: CallActions }) {
  if (!self.audioHeld || self.heard.size === 0) return null;
  return (
    <Segment
      label="Click to hear"
      name="Click to Hear"
      title={AUDIO_HELD_TEXT.title}
      description={AUDIO_HELD_TEXT.description}
      icon={<HeadphonesIcon />}
      onClick={actions.hear}
      tone="warn"
    />
  );
}

type MediaText = { label: string; title: string; description: string };

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
  const scrText = screenText(self, live);
  const on = screen === 'on';
  return (
    <>
      {showCamera ? <CameraSegment self={self} actions={actions} /> : null}
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
