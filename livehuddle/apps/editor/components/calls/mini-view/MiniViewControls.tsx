'use client';

// Your microphone and camera at the mini view's foot (docs/specs/008-canvas/avatar-mode.md "The mini view", "Your
// microphone and camera"; blueprint: space-mini-view.md "Your controls"; Work Tracker 992): the Call dock's own buttons,
// so muting is one press from any app. The microphone follows the dock's phases; the camera shows only while on, to
// turn it off. No hang up: leaving a call is walking away. No hover cards: the window would have them drawn in the
// Space's tab.
import type { ReactNode } from 'react';
import {
  useCallActions,
  useCallSelf,
  type CallActions,
  type CallSelf,
} from '@/lib/calls/calls-store';
import { selfCamera } from '@/lib/calls/local-preview';
import { CallHoverCards, CallNames } from '../CallSegment';
import { CameraSegment, LiveMicSegment, PreviewMicSegment } from '../MicAndCameraSegments';

/**
 * The microphone the mini view shows, as the dock would: the call's in a live call, the local preview's with no call
 * (This Browser, calls off, paused or failed), none while the call connects.
 */
export function miniMicSegment(self: CallSelf, actions: CallActions): ReactNode {
  const paused = self.mode === 'off' && self.phase !== 'live';
  if (!self.available || paused || self.phase === 'error') {
    return <PreviewMicSegment self={self} actions={actions} />;
  }
  if (self.phase !== 'live') return null;
  return <LiveMicSegment self={self} actions={actions} />;
}

export function MiniViewControls() {
  const self = useCallSelf();
  const actions = useCallActions();
  // A listener (a Viewer) has no microphone or camera to drive, here as on the dock.
  if (!actions || !self.canSpeak) return null;
  return (
    <CallNames.Provider value>
      <CallHoverCards.Provider value={false}>
        <div
          role="group"
          aria-label="Your microphone and camera"
          data-mini-controls=""
          className="flex shrink-0 items-center justify-center gap-0.5 border-t border-slate-200 px-2 py-2 empty:hidden dark:border-slate-800"
        >
          {miniMicSegment(self, actions)}
          {selfCamera(self) === 'on' ? <CameraSegment self={self} actions={actions} /> : null}
        </div>
      </CallHoverCards.Provider>
    </CallNames.Provider>
  );
}
