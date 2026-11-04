'use client';

// Proximity audio's door in the canvas (docs/specs/012-collaboration/proximity-audio.md "Who is in a call"): learns
// whether calls are on, offers Join Audio or Listen In through the calls store, loads the call itself only when
// somebody presses it, feeds it where everyone stands, and ends it on leaving the mode, the room or the page. The
// camera and screen share buttons (docs/specs/012-collaboration/video-and-screen-bubbles.md) drive the same call.
import { useEffect, useMemo, useRef, useState } from 'react';
import { apiGetCapabilities } from '@/lib/api/capabilities';
import type { CallsCaller } from '@/lib/api/calls';
import { track } from '@/lib/telemetry';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { callSelf, resetCallSelf, setCallActions, setCallSelf, setCallsMode } from './calls-store';
import type { ViewRect } from './bubbles';
import type { Point } from './hearing';
import type { CallScene, CallSignal, ProximityCall } from './proximity-call';
import type { CallZone } from './zones';

// Do Not Disturb (Work Tracker #319) hides other people's bars from you; until it lands, nobody is in it.
export const DO_NOT_DISTURB = false;

/** The call's code, loaded on the first Join press (blueprint "Performance and limits"). */
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
};

const NO_ZONES: readonly CallZone[] = [];

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

  const scene: CallScene = useMemo(
    () => ({
      tabId: deps.tabId,
      self: deps.self,
      walkers: new Map(deps.walkers.map((w) => [w.id, w.at])),
      view: deps.view ?? null,
      zones: deps.zones ?? NO_ZONES,
    }),
    [deps.tabId, deps.self, deps.walkers, deps.view, deps.zones],
  );
  const sceneRef = useRef(scene);
  // The buttons read the latest props and positions through these, so their actions stay stable.
  useEffect(() => {
    latest.current = deps;
    sceneRef.current = scene;
  });

  const canShare = deps.canShare === true;
  useEffect(() => {
    setCallSelf({ available, canSpeak: deps.canSpeak, canShare });
  }, [available, deps.canSpeak, canShare]);

  // The buttons' actions, stable for the life of the canvas: each reads the latest props through the ref.
  useEffect(() => {
    const stop = () => {
      callRef.current?.stop();
      callRef.current = null;
    };
    setCallActions({
      join: () => {
        const { caller, send, canSpeak, canShare } = latest.current;
        if (!caller || !send) return;
        if (callRef.current) {
          // Join again after a failure, or after a pause ended the call, starts fresh; a running call is left alone.
          if (!callRef.current.ended && callSelf().phase !== 'error') return;
          callRef.current.stop();
          callRef.current = null;
        }
        // Made inside the press, so the browser lets it play.
        const context = new AudioContext();
        setCallSelf({ phase: 'joining' });
        track('Canvas', 'Used', canSpeak ? 'AudioJoin' : 'AudioListen');
        void loadProximityCall()
          .then(({ ProximityCall }) => {
            const call = new ProximityCall({
              caller,
              canSpeak,
              canShare: canShare === true,
              context,
              send: (signal) => latest.current.send?.(signal),
            });
            callRef.current = call;
            call.update(sceneRef.current);
            return call.start();
          })
          .catch((error: unknown) => {
            debugLog('[calls] load failed', error);
            void context.close().catch(() => {});
            setCallSelf({ phase: 'error' });
          });
      },
      leave: stop,
      toggleMute: () => {
        callRef.current?.toggleMute();
        track('UI', 'Changed', 'AudioMute');
      },
      toggleCamera: () => {
        const call = callRef.current;
        if (!call) return;
        if (callSelf().camera !== 'on') track('Canvas', 'Used', 'CameraOn');
        void call.toggleCamera();
      },
      toggleScreen: () => {
        const call = callRef.current;
        if (!call) return;
        if (callSelf().screen !== 'on') track('Canvas', 'Used', 'ScreenShare');
        void call.toggleScreen();
      },
    });
    return () => {
      stop();
      resetCallSelf();
    };
  }, []);

  // Leaving the mode, the room or the tab ends the call (the spec's "Who is in a call").
  useEffect(() => {
    if (available) return;
    callRef.current?.stop();
    callRef.current = null;
  }, [available]);
  const tabRef = useRef(deps.tabId);
  useEffect(() => {
    if (tabRef.current === deps.tabId) return;
    tabRef.current = deps.tabId;
    callRef.current?.stop();
    callRef.current = null;
  }, [deps.tabId]);

  useEffect(() => {
    callRef.current?.update(scene);
  }, [scene]);
}
