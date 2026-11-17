'use client';

// Recording a walkthrough (liveworkspace/docs/specs/006-media/walkthroughs.md "Recording"): set up (microphone,
// camera, corner, what to hide), a three-second count, the recording (sound and camera through the recorder, the
// canvas through the event log), then the save card. One state at a time; leaving any of them releases the devices.

import {
  CAMERA_CONSTRAINTS,
  MIC_CONSTRAINTS,
  NO_CAMERA,
  levelMeter,
  onDevice,
  useMediaDevices,
  type LevelMeter,
} from '@liveworkspace/capture';
import {
  sealWalkthroughEvents,
  WALKTHROUGH_MAX_MS,
  walkthroughMediaType,
  type WalkthroughCorner,
  type WalkthroughEvents,
  type WalkthroughSummary,
} from '@liveworkspace/media/walkthrough';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { WalkthroughApi } from './api';
import { canvasPoint, contentOf, elementIdAt, sizeOf } from './bridge';
import { createEventLog, type EventLog } from './event-log';
import type { WalkthroughHost } from './host';
import { startRecording, stopStream, type Recorded, type Recording } from './recorder';
import { recordView } from './timeline';

export const COUNTDOWN_FROM = 3;
// How often the recording's clock (and its waiting samples) is read.
const CLOCK_MS = 200;

export type RecorderPhase =
  | { kind: 'off' }
  | { kind: 'setup' }
  | { kind: 'countdown'; n: number }
  | { kind: 'recording'; elapsed: number }
  | {
      kind: 'review';
      recorded: Recorded;
      events: WalkthroughEvents;
      title: string;
      saving: 'events' | 'media' | null;
      error: string | null;
    };

export type RecorderState = ReturnType<typeof useRecorder>;

const now = () => performance.now();

/** True when the page's Permissions-Policy blocks the microphone, whatever the browser allows. */
function policyBlocksMicrophone(): boolean {
  const doc = document as Document & {
    permissionsPolicy?: { allowsFeature(feature: string): boolean };
    featurePolicy?: { allowsFeature(feature: string): boolean };
  };
  try {
    const policy = doc.permissionsPolicy ?? doc.featurePolicy;
    return policy ? !policy.allowsFeature('microphone') : false;
  } catch {
    return false;
  }
}

function deviceError(err: unknown, wantsCamera: boolean): string {
  const name = err instanceof DOMException ? err.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    if (policyBlocksMicrophone()) {
      return "This page can't use the microphone. Reload to get the latest version.";
    }
    return wantsCamera
      ? 'Allow the microphone and camera for this site in your browser, then try again.'
      : 'Allow the microphone for this site in your browser, then try again.';
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'That device is not connected. Pick another one.';
  }
  return "The microphone couldn't start. Close other apps using it, then try again.";
}

export function useRecorder(
  host: WalkthroughHost,
  api: WalkthroughApi | null,
  hidden: ReadonlySet<string>,
  onSaved: (walkthrough: WalkthroughSummary) => void,
) {
  const [phase, setPhase] = useState<RecorderPhase>({ kind: 'off' });
  const [microphone, setMicrophone] = useState<string | null>(null);
  const [camera, setCamera] = useState<string | null>(null);
  const [corner, setCorner] = useState<WalkthroughCorner>('bottom-left');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [deviceProblem, setDeviceProblem] = useState<string | null>(null);
  const [granted, setGranted] = useState(0);
  const active = phase.kind === 'setup' || phase.kind === 'countdown' || phase.kind === 'recording';
  const devices = useMediaDevices(phase.kind === 'setup', granted);

  const hostRef = useRef(host);
  const hiddenRef = useRef(hidden);
  useEffect(() => {
    hostRef.current = host;
    hiddenRef.current = hidden;
  });
  const streamRef = useRef<MediaStream | null>(null);
  const recordingRef = useRef<Recording | null>(null);
  const logRef = useRef<EventLog | null>(null);
  const startRef = useRef<{ at: number; tab: string; last: string; tabs: Set<string> } | null>(
    null,
  );
  const meterRef = useRef<LevelMeter | null>(null);
  const lastSlide = useRef<string | null>(null);

  // The devices, opened while setting up and held until the recording ends: picking another reopens them.
  const wantsCamera = camera !== NO_CAMERA;
  const setupOpen = phase.kind === 'setup';
  useEffect(() => {
    if (!setupOpen) return;
    let live = true;
    const open = async () => {
      const constraints: MediaStreamConstraints = {
        audio: onDevice(MIC_CONSTRAINTS, microphone).audio!,
        video: wantsCamera ? onDevice(CAMERA_CONSTRAINTS, camera).video! : false,
      };
      try {
        const next = await navigator.mediaDevices.getUserMedia(constraints);
        if (!live) return stopStream(next);
        stopStream(streamRef.current);
        streamRef.current = next;
        setStream(next);
        setDeviceProblem(null);
        setGranted((n) => n + 1);
      } catch (err) {
        if (!live) return;
        console.warn('[walkthroughs] devices refused', err);
        // A camera that won't start leaves the walkthrough to sound alone, rather than nothing.
        if (wantsCamera) {
          setCamera(NO_CAMERA);
          setDeviceProblem("The camera couldn't start, so this walkthrough records sound only.");
          return;
        }
        stopStream(streamRef.current);
        streamRef.current = null;
        setStream(null);
        setDeviceProblem(deviceError(err, false));
      }
    };
    void open();
    return () => {
      live = false;
    };
  }, [setupOpen, microphone, camera, wantsCamera]);

  // The level meter, over the open microphone.
  useEffect(() => {
    if (!stream || !active || stream.getAudioTracks().length === 0) return;
    const meter = levelMeter(stream);
    meterRef.current = meter;
    return () => {
      meter.close();
      meterRef.current = null;
    };
  }, [stream, active]);

  const release = useCallback(() => {
    recordingRef.current?.cancel();
    recordingRef.current = null;
    logRef.current = null;
    startRef.current = null;
    stopStream(streamRef.current);
    streamRef.current = null;
    setStream(null);
  }, []);

  // Leaving the page or the item mid-recording releases the devices.
  useEffect(() => release, [release]);

  const open = useCallback(() => {
    setDeviceProblem(null);
    setPhase({ kind: 'setup' });
  }, []);

  const close = useCallback(() => {
    release();
    setPhase({ kind: 'off' });
  }, [release]);

  const begin = useCallback(() => {
    const s = streamRef.current;
    if (!s) return;
    const camOn = s.getVideoTracks().length > 0;
    try {
      recordingRef.current = startRecording({
        stream: s,
        camera: camOn,
        onFull: () => void finishRef.current(),
      });
    } catch {
      setDeviceProblem(
        "This browser can't record a walkthrough. Try Chrome, Edge, Firefox or Safari.",
      );
      setPhase({ kind: 'setup' });
      return;
    }
    const h = hostRef.current;
    const at = now();
    const log = createEventLog(at, () => hiddenRef.current);
    logRef.current = log;
    startRef.current = { at, tab: h.tab, last: h.tab, tabs: new Set([h.tab]) };
    const content = contentOf(h.canvasRoot());
    if (content) {
      const { w, h: height } = sizeOf(content);
      log.view(at, recordView(h.viewport.get(), w, height));
    }
    lastSlide.current = h.slides?.current ?? null;
    if (h.slides?.current) log.slide(at, h.slides.current, h.slides.label ?? undefined);
    setPhase({ kind: 'recording', elapsed: 0 });
  }, []);

  const start = useCallback(() => {
    if (!streamRef.current) return;
    setPhase({ kind: 'countdown', n: COUNTDOWN_FROM });
  }, []);

  // The count: 3, 2, 1, then recording.
  const countdown = phase.kind === 'countdown' ? phase.n : null;
  useEffect(() => {
    if (countdown === null) return;
    const timer = setTimeout(() => {
      if (countdown > 1) setPhase({ kind: 'countdown', n: countdown - 1 });
      else begin();
    }, 1000);
    return () => clearTimeout(timer);
  }, [countdown, begin]);

  const finish = useCallback(async () => {
    const recording = recordingRef.current;
    const log = logRef.current;
    const started = startRef.current;
    if (!recording || !log || !started) return;
    recordingRef.current = null;
    const durationMs = Math.min(WALKTHROUGH_MAX_MS, Math.round(now() - started.at));
    const events = log.finish();
    const recorded = await recording.stop();
    stopStream(streamRef.current);
    streamRef.current = null;
    setStream(null);
    const h = hostRef.current;
    const fingerprints: Record<string, string> = {};
    for (const tab of started.tabs) {
      const print = h.fingerprint(tab);
      if (typeof print === 'string') fingerprints[tab] = print;
    }
    const sealed = sealWalkthroughEvents({
      v: 1,
      durationMs,
      camera: recorded.type.startsWith('video/'),
      corner,
      startTab: started.tab,
      hidden: [...hiddenRef.current],
      fingerprints,
      events,
    });
    setPhase({
      kind: 'review',
      recorded,
      events: sealed,
      title: `Walkthrough of ${h.tabName(started.tab)}`,
      saving: null,
      error: walkthroughMediaType(recorded.type)
        ? null
        : "This browser recorded in a format that can't be kept. Download a copy instead.",
    });
  }, [corner]);
  const finishRef = useRef(finish);
  useEffect(() => {
    finishRef.current = finish;
  });

  // While recording: the camera, the pointer, presses, tabs and slides into the log, and the clock.
  const recording = phase.kind === 'recording';
  useEffect(() => {
    if (!recording) return;
    const h = hostRef.current;
    const log = logRef.current!;
    const root = h.canvasRoot();
    const content = () => contentOf(hostRef.current.canvasRoot());
    const sampleView = () => {
      const c = content();
      if (!c) return;
      const { w, h: height } = sizeOf(c);
      log.view(now(), recordView(hostRef.current.viewport.get(), w, height));
    };
    const stopView = h.viewport.subscribe(sampleView);
    window.addEventListener('resize', sampleView);
    const onMove = (e: PointerEvent) => {
      const c = content();
      const id = elementIdAt(e.target);
      if (!c || (id && hiddenRef.current.has(id))) return log.cursor(now(), null);
      log.cursor(now(), canvasPoint(c, e.clientX, e.clientY));
    };
    const onLeave = () => log.cursor(now(), null);
    const onDown = (e: PointerEvent) => {
      const id = elementIdAt(e.target);
      if (id) log.point(now(), id);
    };
    root?.addEventListener('pointermove', onMove, { passive: true });
    root?.addEventListener('pointerleave', onLeave);
    root?.addEventListener('pointerdown', onDown, { capture: true, passive: true });
    const clock = setInterval(() => {
      const t = now();
      log.tick(t);
      const elapsed = t - startRef.current!.at;
      if (elapsed >= WALKTHROUGH_MAX_MS) void finishRef.current();
      else setPhase((p) => (p.kind === 'recording' ? { kind: 'recording', elapsed } : p));
    }, CLOCK_MS);
    return () => {
      stopView();
      window.removeEventListener('resize', sampleView);
      root?.removeEventListener('pointermove', onMove);
      root?.removeEventListener('pointerleave', onLeave);
      root?.removeEventListener('pointerdown', onDown, { capture: true });
      clearInterval(clock);
    };
  }, [recording]);

  // A tab or a slide changed while recording.
  useEffect(() => {
    const started = startRef.current;
    if (!recording || !started || started.last === host.tab) return;
    started.last = host.tab;
    started.tabs.add(host.tab);
    logRef.current?.tab(now(), host.tab);
  }, [recording, host.tab]);
  const slide = host.slides?.current ?? null;
  const slideLabel = host.slides?.label ?? null;
  useEffect(() => {
    if (!recording) return;
    if (slide === lastSlide.current) return;
    lastSlide.current = slide;
    logRef.current?.slide(now(), slide, slideLabel ?? undefined);
  }, [recording, slide, slideLabel]);

  const setTitle = useCallback((title: string) => {
    setPhase((p) => (p.kind === 'review' ? { ...p, title } : p));
  }, []);

  const save = useCallback(async () => {
    if (phase.kind !== 'review' || !api || phase.saving) return;
    const mediaType = walkthroughMediaType(phase.recorded.type);
    if (!mediaType) return;
    setPhase({ ...phase, saving: 'events', error: null });
    const result = await api.save(
      {
        title: phase.title,
        author: hostRef.current.author,
        media: phase.recorded.blob,
        mediaType,
        events: phase.events,
      },
      (stage) => setPhase((p) => (p.kind === 'review' ? { ...p, saving: stage } : p)),
    );
    if (result.ok) {
      setPhase({ kind: 'off' });
      onSaved(result.walkthrough);
    } else {
      setPhase((p) => (p.kind === 'review' ? { ...p, saving: null, error: result.message } : p));
    }
  }, [phase, api, onSaved]);

  const download = useCallback(() => {
    if (phase.kind !== 'review') return;
    const url = URL.createObjectURL(phase.recorded.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${phase.title || 'Walkthrough'}.${phase.recorded.type.endsWith('mp4') ? 'mp4' : 'webm'}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [phase]);

  return {
    phase,
    open,
    close,
    start,
    finish,
    save,
    setTitle,
    download,
    devices,
    microphone,
    setMicrophone,
    camera,
    setCamera,
    corner,
    setCorner,
    stream,
    deviceProblem,
    meter: meterRef,
  };
}
