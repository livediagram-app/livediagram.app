'use client';

// Proximity audio's door in the canvas (docs/specs/012-collaboration/proximity-audio.md "Who is in a call"): learns
// whether calls are on and joins by itself the moment you walk where there is a call (owner, 2026-11-07: "Joining
// audio and leaving audio ... is friction"), hearing the people near you at once, your microphone muted until you
// unmute. It loads the call's code then, feeds it where everyone stands, and ends it on leaving the mode, the room or
// the page. The camera and screen share buttons (docs/specs/012-collaboration/video-and-screen-bubbles.md) drive the
// same call, and with no call to send on, a local preview only you see (the same spec's "Local preview"), which a call
// takes on join; the microphone has one too (local-mic.ts).
import { useEffect, useMemo, useRef, useState } from 'react';
import { apiGetCapabilities } from '@/lib/api/capabilities';
import type { CallsCaller } from '@/lib/api/calls';
import { track } from '@/lib/telemetry';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { callSelf, resetCallSelf, setCallActions, setCallSelf, setCallsMode } from './calls-store';
import { canCapture, LocalPreview, type PreviewCapture } from './local-preview';
import { LocalMic } from './local-mic';
import type { ViewRect } from './bubbles';
import type { Point } from './hearing';
import type { CallScene, CallSignal, ProximityCall } from './proximity-call';
import type { CallStage } from './stage';
import type { CallZone } from './zones';

/** The call's code, loaded when walking first joins a call (blueprint "Performance and limits"). */
export const loadProximityCall = () => import('./proximity-call');

export type ProximityCallDeps = {
  // Avatar mode is on (a walking character has a place to be heard from).
  inMode: boolean;
  // Who asks the mint route, null without a saved Space.
  caller: CallsCaller | null;
  // An Editor or a Participant (`can.takePart`): a Viewer listens.
  canSpeak: boolean;
  // An Editor (`can.level === 'edit'`): may share a screen.
  canShare?: boolean;
  // Sends to the room; absent without a room, which keeps calls away.
  send?: (signal: CallSignal) => void;
  tabId: string;
  self: Point | null;
  // Every other walker on this tab, by presence id.
  walkers: readonly { id: string; at: Point }[];
  // The canvas area on screen, in canvas px: a bubble off it is not received.
  view?: ViewRect | null;
  // The tab's visible Office rooms, each one call (meeting-rooms-and-stage.md "Rooms are calls").
  zones?: readonly CallZone[];
  // The tab's visible stages, each heard by the whole tab (meeting-rooms-and-stage.md "The stage").
  stages?: readonly CallStage[];
  // Your status is Do Not Disturb: nobody's voice or bubbles reach you (meeting-rooms-and-stage.md).
  doNotDisturb?: boolean;
  // An Editor stopped your screen share, by presence id (video-and-screen-bubbles.md "Share roles", #504).
  onShareStopped?: (by: string) => void;
  // The local preview's capture calls, for tests; the browser's otherwise.
  capture?: PreviewCapture;
};

const NO_ZONES: readonly CallZone[] = [];

const NO_RESUME = () => {};

/**
 * A call joined without a press (walking in) starts its audio suspended, as browsers keep sound from a page until it
 * is touched: the next press or key anywhere resumes it. Already running (the join came from a press): nothing to do.
 * Answers the way to stop waiting, which removes all three listeners, as the first press does: a call that ends
 * before any press (leaving, a tab change, a rejoin, closing the canvas) leaves none behind holding its context.
 */
export function resumeOnGesture(context: AudioContext, target: Window = window): () => void {
  if (context.state !== 'suspended') return NO_RESUME;
  const events = ['pointerdown', 'keydown', 'touchend'] as const;
  const stop = () => {
    for (const e of events) target.removeEventListener(e, resume, true);
  };
  const resume = () => {
    stop();
    if (context.state === 'suspended') void context.resume().catch(() => {});
  };
  for (const e of events) target.addEventListener(e, resume, true);
  return stop;
}
const NO_STAGES: readonly CallStage[] = [];

// Whether this deployment has calls, paused or not; the kill switch's mode goes to the store (Calls Paused).
function useCallsEnabled(wanted: boolean): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    if (!wanted) return;
    let live = true;
    void apiGetCapabilities().then((caps) => {
      if (!live) return;
      setEnabled(caps.callsEnabled === true);
      if (caps.callsMode) setCallsMode(caps.callsMode);
    });
    return () => {
      live = false;
    };
  }, [wanted]);
  return enabled;
}

export function useProximityCall(deps: ProximityCallDeps): void {
  const roomOpen = deps.inMode && !!deps.send && !!deps.caller;
  const callsEnabled = useCallsEnabled(roomOpen);
  const available = roomOpen && callsEnabled;

  const callRef = useRef<ProximityCall | null>(null);
  const latest = useRef(deps);
  // The camera and screen with no call to send them (video-and-screen-bubbles.md "Local preview"): one per canvas.
  const [preview] = useState(() => new LocalPreview(deps.capture));
  // The microphone with no call to send it on (proximity-audio.md "Local preview"): one per canvas.
  const [localMic] = useState(() => new LocalMic(deps.capture?.getUserMedia));
  // Join, for walking in (below) as well as the buttons' retry.
  const joinRef = useRef<(() => void) | null>(null);
  // Bumped by every join and every end, so a call whose code arrives after you left (the mode, the tab, the canvas)
  // is never started: walking in joins at once, and leaving again before the code loads is common.
  const joinSeq = useRef(0);
  // The current call's wait for a press to resume its audio (resumeOnGesture), ended with the call.
  const stopResume = useRef(NO_RESUME);
  const endCall = () => {
    joinSeq.current++;
    callRef.current?.stop();
    callRef.current = null;
    stopResume.current();
    stopResume.current = NO_RESUME;
  };

  const scene: CallScene = useMemo(
    () => ({
      tabId: deps.tabId,
      self: deps.self,
      walkers: new Map(deps.walkers.map((w) => [w.id, w.at])),
      view: deps.view ?? null,
      zones: deps.zones ?? NO_ZONES,
      stages: deps.stages ?? NO_STAGES,
    }),
    [deps.tabId, deps.self, deps.walkers, deps.view, deps.zones, deps.stages],
  );
  const sceneRef = useRef(scene);
  // The buttons read the latest props and positions through these, so their actions stay stable.
  useEffect(() => {
    latest.current = deps;
    sceneRef.current = scene;
  });

  const canShare = deps.canShare === true;
  // A preview sends nothing, so anyone who may take part has one, in the mode, where the browser can capture.
  const previewable = deps.inMode && deps.canSpeak;
  useEffect(() => {
    setCallSelf({
      available,
      canSpeak: deps.canSpeak,
      canShare,
      canPreviewCamera: previewable && (!!deps.capture?.getUserMedia || canCapture('camera')),
      canPreviewScreen: previewable && (!!deps.capture?.getDisplayMedia || canCapture('screen')),
      canPreviewMic: previewable && (!!deps.capture?.getUserMedia || canCapture('camera')),
    });
  }, [available, deps.canSpeak, canShare, previewable, deps.capture]);

  // The buttons' actions, stable for the life of the canvas: each reads the latest props through the ref.
  useEffect(() => {
    const stop = endCall;
    // A live call that may send this kind drives it as before; anything else is the preview's.
    const liveCall = () => {
      const call = callRef.current;
      return call && !call.ended && callSelf().phase === 'live' ? call : null;
    };
    const join = () => {
      const { caller, send, canSpeak, canShare } = latest.current;
      if (!caller || !send) return;
      if (callRef.current) {
        // Join again after a failure, or after a pause ended the call, starts fresh; a running call is left alone.
        if (!callRef.current.ended && callSelf().phase !== 'error') return;
        callRef.current.stop();
        callRef.current = null;
      }
      // The call takes the microphone over from the preview, muted, as every call starts.
      localMic.stop();
      // Made inside a press where there is one (a retry), so the browser lets it play; walking in waits for the next.
      const context = new AudioContext();
      stopResume.current();
      stopResume.current = resumeOnGesture(context);
      setCallSelf({ phase: 'joining' });
      track('Canvas', 'Used', canSpeak ? 'AudioJoin' : 'AudioListen');
      const seq = ++joinSeq.current;
      void loadProximityCall()
        .then(({ ProximityCall }) => {
          if (seq !== joinSeq.current) {
            void context.close().catch(() => {});
            return;
          }
          const call = new ProximityCall({
            caller,
            canSpeak,
            canShare: canShare === true,
            context,
            send: (signal) => latest.current.send?.(signal),
            onShareStopped: (by) => latest.current.onShareStopped?.(by),
            preview,
          });
          callRef.current = call;
          call.setDoNotDisturb(latest.current.doNotDisturb === true);
          call.update(sceneRef.current);
          return call.start();
        })
        .catch((error: unknown) => {
          debugLog('[calls] load failed', error);
          void context.close().catch(() => {});
          if (seq === joinSeq.current) setCallSelf({ phase: 'error' });
        });
    };
    joinRef.current = join;
    setCallActions({
      join,
      toggleMute: () => {
        const call = liveCall();
        if (call) {
          call.toggleMute();
          track('UI', 'Changed', 'AudioMute');
          return;
        }
        // A call on its way: its microphone is not there to unmute yet.
        if (callRef.current && !callRef.current.ended) return;
        if (localMic.on || callSelf().previewMic === 'starting') {
          localMic.stop();
          return;
        }
        if (!callSelf().canPreviewMic) return;
        track('UI', 'Changed', 'AudioMute');
        void localMic.start();
      },
      toggleCamera: () => {
        const self = callSelf();
        if (self.previewCamera === 'on' || self.previewCamera === 'starting') {
          preview.stop('camera');
          return;
        }
        const call = liveCall();
        if (call && latest.current.canSpeak) {
          // A refusal from before the join is the call's to retry now.
          if (self.previewCamera === 'blocked') preview.stop('camera');
          if (self.camera !== 'on') track('Canvas', 'Used', 'CameraOn');
          void call.toggleCamera();
          return;
        }
        if (!self.canPreviewCamera) return;
        track('Canvas', 'Used', 'CameraOn');
        void preview.start('camera');
      },
      toggleScreen: () => {
        const self = callSelf();
        if (self.previewScreen === 'on' || self.previewScreen === 'starting') {
          preview.stop('screen');
          return;
        }
        const call = liveCall();
        if (call && latest.current.canShare) {
          if (self.screen !== 'on') track('Canvas', 'Used', 'ScreenShare');
          void call.toggleScreen();
          return;
        }
        if (!self.canPreviewScreen) return;
        track('Canvas', 'Used', 'ScreenShare');
        void preview.start('screen');
      },
      raiseHand: () => callRef.current?.raiseHand(),
      lowerHand: () => callRef.current?.lowerHand(),
    });
    return () => {
      joinRef.current = null;
      stop();
      preview.stopAll();
      localMic.stop();
      resetCallSelf();
    };
  }, [preview, localMic]);

  // Leaving the mode, the room or the tab ends the call (the spec's "Who is in a call").
  useEffect(() => {
    if (available) return;
    endCall();
    // A join still loading when the call went away reads off, not Connecting.
    if (callSelf().phase === 'joining') setCallSelf({ phase: 'off' });
  }, [available]);
  // Leaving the mode (or losing the right to take part) stops a preview too; a tab change ends both.
  useEffect(() => {
    if (previewable) return;
    preview.stopAll();
    localMic.stop();
  }, [previewable, preview, localMic]);
  const tabRef = useRef(deps.tabId);
  useEffect(() => {
    if (tabRef.current === deps.tabId) return;
    tabRef.current = deps.tabId;
    endCall();
    if (callSelf().phase === 'joining') setCallSelf({ phase: 'off' });
    preview.stopAll();
    localMic.stop();
  }, [deps.tabId, preview, localMic]);

  useEffect(() => {
    callRef.current?.update(scene);
  }, [scene]);

  const doNotDisturb = deps.doNotDisturb === true;
  useEffect(() => {
    callRef.current?.setDoNotDisturb(doNotDisturb);
  }, [doNotDisturb]);

  // Walking where there is a call joins it (proximity-audio.md "Who is in a call"): on arriving, and again after a tab
  // change ended the last one. A failure or a pause waits for a press (the control's retry), never a loop.
  useEffect(() => {
    if (!available) return;
    if (callRef.current && !callRef.current.ended) return;
    const phase = callSelf().phase;
    if (phase === 'error' || phase === 'joining' || callSelf().mode === 'off') return;
    joinRef.current?.();
  }, [available, deps.tabId]);
}
