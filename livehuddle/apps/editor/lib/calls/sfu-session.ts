// This browser's one connection to Cloudflare Realtime's SFU (docs/specs/012-collaboration/blueprints/
// proximity-audio.md "Subscriptions"; video-and-screen-bubbles.md "Subscriptions"): one RTCPeerConnection and one
// Realtime session per call, each of its tracks (microphone, camera, screen) published once, and other people's
// tracks subscribed by publisher and track name, a camera on the simulcast layer asked for. Every mutation runs
// through one queue (Realtime refuses a second change on a session while one is unfinished), and a subscribe, close
// or layer change is reconciled against what is wanted when it runs, so a speaker who walks in and out while a request
// is in flight costs no stale call.
import {
  CALL_NOT_HEARD,
  CALL_TRACK_NAME,
  CALL_VIDEO_TRACK_NAME,
  type CallLayer,
  type CallSessionResponse,
  type CallSubscribeLocator,
  type CallTrackLocator,
  type CallTrackName,
  type CallTracksResponse,
} from '@livehuddle/api-schema';
import {
  apiCallClose,
  apiCallLayer,
  apiCallRenegotiate,
  apiCallTracks,
  CallsApiError,
  type CallsCaller,
} from '@/lib/api/calls';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';

/** The most tracks asked for in one request (the api's MAX_SUBSCRIBE_BATCH). */
export const SUBSCRIBE_BATCH = 16;
/**
 * A track the room said you may not hear yet (`not_heard`: positions lag, docs/specs/012-collaboration/
 * meeting-rooms-and-stage.md "Trust") is asked for again after this long, doubling while it is refused.
 */
export const NOT_HEARD_RETRY_MS = 2000;
export const NOT_HEARD_RETRY_MAX_MS = 16_000;

/** A track to receive: whose, which, and for a camera the layer (the small one when absent). */
export type SfuWant = CallSubscribeLocator;

const keyOf = (l: CallTrackLocator) => `${l.sessionId}|${l.trackName}`;
const refusalKey = (l: CallTrackLocator) => `${l.sessionId}|${l.trackName}|${l.token}`;
const layerOf = (l: SfuWant): CallLayer | undefined =>
  l.trackName === CALL_VIDEO_TRACK_NAME ? (l.layer ?? 'h') : undefined;

export type SfuEvents = {
  // Someone's track arrived: by publishing session and track name.
  onTrack: (publisherSessionId: string, trackName: string, stream: MediaStream) => void;
  // A subscription ended (its owner walked away, or it is no longer wanted): stop playing or showing it.
  onTrackEnded: (publisherSessionId: string, trackName: string) => void;
  // The connection failed for good.
  onFailed: () => void;
  // The calls kill switch paused calls: a publish, subscribe or close was refused with `paused`.
  onPaused: () => void;
  // The kill switch allows audio alone: a camera or screen request was refused with `audio-only`.
  onAudioOnly?: () => void;
  // The room said a track is not heard yet: the call proves its session again before the retry.
  onNotHeard?: () => void;
  // Realtime dropped this session (proximity-audio.md "A session that expires"): the call renews it.
  onSessionGone?: () => void;
};

type Subscription = { mid: string; locator: CallTrackLocator; layer: CallLayer | undefined };
type Relayer = { sub: Subscription; layer: CallLayer };

export class SfuSession {
  readonly sessionId: string;
  private readonly proof: { sessionId: string; sessionToken: string };
  private readonly pc: RTCPeerConnection;
  private queue: Promise<void> = Promise.resolve();
  private reconcileQueued = false;
  private closed = false;
  // Track key (publisher|name) → what is wanted now.
  private wanted = new Map<string, SfuWant>();
  // Track key → its subscription on this connection.
  private readonly subscribed = new Map<string, Subscription>();
  // mid → track key, so an arriving track knows whose it is.
  private readonly byMid = new Map<string, string>();
  // This browser's published tracks, by name: each published once, then swapped in place.
  private readonly senders = new Map<string, RTCRtpSender>();
  // Locators Realtime refused (a session that ended): not asked for again until the owner sends a new one.
  private readonly refused = new Set<string>();
  // Track key → the wait before asking again, for tracks the room said are not heard yet; a key here is held back.
  private readonly notHeard = new Map<string, number>();
  private readonly held = new Set<string>();
  private readonly caller: CallsCaller;
  private readonly events: SfuEvents;

  constructor(caller: CallsCaller, session: CallSessionResponse, events: SfuEvents) {
    this.caller = caller;
    this.events = events;
    this.sessionId = session.sessionId;
    this.proof = { sessionId: session.sessionId, sessionToken: session.sessionToken };
    this.pc = new RTCPeerConnection({ iceServers: session.iceServers, bundlePolicy: 'max-bundle' });
    this.pc.addEventListener('track', (e) => {
      const mid = e.transceiver.mid;
      const key = mid ? this.byMid.get(mid) : undefined;
      const sub = key ? this.subscribed.get(key) : undefined;
      if (!sub) return;
      this.events.onTrack(sub.locator.sessionId, sub.locator.trackName, new MediaStream([e.track]));
    });
    this.pc.addEventListener('iceconnectionstatechange', () => {
      if (this.pc.iceConnectionState === 'failed') this.events.onFailed();
    });
  }

  private enqueue(work: () => Promise<void>): Promise<void> {
    const run = this.queue.then(() => (this.closed ? undefined : work()));
    // One failed step must not stall the rest: it is logged and the queue moves on.
    this.queue = run.catch((error: unknown) => {
      debugLog('[calls] sfu step failed', error);
      if (!(error instanceof CallsApiError)) return;
      if (error.paused) this.events.onPaused();
      else if (error.audioOnly) this.events.onAudioOnly?.();
      else if (error.sessionGone) this.events.onSessionGone?.();
    });
    return run;
  }

  /**
   * Publish one of this browser's tracks once (the microphone unless named), with its encodings (a camera's two
   * simulcast layers, a screen's caps). Later tracks of the same name replace it without renegotiating.
   */
  publish(
    track: MediaStreamTrack,
    trackName: CallTrackName = CALL_TRACK_NAME,
    sendEncodings?: RTCRtpEncodingParameters[],
  ): Promise<void> {
    return this.enqueue(async () => {
      const sender = this.senders.get(trackName);
      if (sender) {
        await sender.replaceTrack(track);
        return;
      }
      const transceiver = this.pc.addTransceiver(track, {
        direction: 'sendonly',
        ...(sendEncodings ? { sendEncodings } : {}),
      });
      this.senders.set(trackName, transceiver.sender);
      try {
        await this.pc.setLocalDescription(await this.pc.createOffer());
        const mid = transceiver.mid;
        const sdp = this.pc.localDescription?.sdp;
        if (!mid || !sdp) throw new Error('no local offer');
        const publish = trackName === CALL_TRACK_NAME ? { sdp, mid } : { sdp, mid, trackName };
        const answer = await apiCallTracks(this.caller, { ...this.proof, publish });
        await this.applyAnswer(answer);
      } catch (error) {
        // Nothing claims a publish Realtime never took: the next one of this name negotiates afresh.
        this.senders.delete(trackName);
        transceiver.stop();
        throw error;
      }
    });
  }

  /** Swap a published track (null while it is off) without renegotiating. */
  async replaceTrack(trackName: CallTrackName, track: MediaStreamTrack | null): Promise<void> {
    await this.senders.get(trackName)?.replaceTrack(track);
  }

  /** Swap the microphone's track (null while it is closed) without renegotiating. */
  replaceMic(track: MediaStreamTrack | null): Promise<void> {
    return this.replaceTrack(CALL_TRACK_NAME, track);
  }

  /** The tracks to receive: a reconcile follows on the queue. */
  want(entries: readonly SfuWant[]): void {
    this.wanted = new Map(entries.map((l) => [keyOf(l), l]));
    // Called on every step anyone walks: nothing to do while what is subscribed is what is wanted.
    if (this.settled() || this.reconcileQueued) return;
    this.reconcileQueued = true;
    void this.enqueue(async () => {
      this.reconcileQueued = false;
      await this.reconcile();
    });
  }

  private joining(): SfuWant[] {
    const out: SfuWant[] = [];
    for (const [key, l] of this.wanted) {
      if (!this.subscribed.has(key) && !this.refused.has(refusalKey(l)) && !this.held.has(key)) {
        out.push(l);
      }
    }
    return out;
  }

  // Held camera subscriptions whose wanted layer changed (a maximise or a restore).
  private relayering(): Relayer[] {
    const out: Relayer[] = [];
    for (const [key, sub] of this.subscribed) {
      const want = this.wanted.get(key);
      const layer = want ? layerOf(want) : undefined;
      if (layer && layer !== sub.layer) out.push({ sub, layer });
    }
    return out;
  }

  private settled(): boolean {
    return (
      this.joining().length === 0 &&
      [...this.subscribed.keys()].every((k) => this.wanted.has(k)) &&
      this.relayering().length === 0
    );
  }

  private async reconcile(): Promise<void> {
    const leaving = [...this.subscribed].filter(([key]) => !this.wanted.has(key));
    if (leaving.length > 0) await this.unsubscribe(leaving.slice(0, SUBSCRIBE_BATCH));
    const relayer = this.relayering();
    if (relayer.length > 0) await this.relayer(relayer.slice(0, SUBSCRIBE_BATCH));
    const joining = this.joining();
    if (joining.length > 0) await this.subscribe(joining.slice(0, SUBSCRIBE_BATCH));
    // A crowd larger than one batch goes over several steps.
    if (!this.settled()) this.want([...this.wanted.values()]);
  }

  private async subscribe(locators: SfuWant[]): Promise<void> {
    const subscribe: CallSubscribeLocator[] = locators.map((l) => {
      const locator = { sessionId: l.sessionId, trackName: l.trackName, token: l.token };
      // The small layer is the route's default: only a maximised camera names one.
      return layerOf(l) === 'f' ? { ...locator, layer: 'f' } : locator;
    });
    const answer = await apiCallTracks(this.caller, { ...this.proof, subscribe });
    // Answered in order; a locator without a usable answer counts as refused, so it is never asked for in a loop.
    let notHeard = false;
    locators.forEach((l, i) => {
      const key = keyOf(l);
      const errorCode = answer.tracks[i]?.errorCode;
      if (errorCode === CALL_NOT_HEARD) {
        this.holdBack(key);
        notHeard = true;
        return;
      }
      const mid = errorCode ? undefined : answer.tracks[i]?.mid;
      if (!mid) {
        this.refused.add(refusalKey(l));
        return;
      }
      this.notHeard.delete(key);
      this.subscribed.set(key, { mid, locator: l, layer: layerOf(l) });
      this.byMid.set(mid, key);
    });
    if (notHeard) this.events.onNotHeard?.();
    if (answer.requiresImmediateRenegotiation && answer.sessionDescription) {
      await this.pc.setRemoteDescription(answer.sessionDescription);
      await this.pc.setLocalDescription(await this.pc.createAnswer());
      const sdp = this.pc.localDescription?.sdp;
      if (!sdp) throw new Error('no local answer');
      await apiCallRenegotiate(this.caller, { ...this.proof, sdp });
    }
  }

  // A camera's layer, switched in place (Realtime's tracks/update): no new subscription, no renegotiation.
  private async relayer(changes: Relayer[]): Promise<void> {
    // Marked first, so a refused update is not retried in a loop: the bubble keeps the layer it had.
    for (const change of changes) change.sub.layer = change.layer;
    const tracks = changes.map(({ sub, layer }) => ({
      mid: sub.mid,
      sessionId: sub.locator.sessionId,
      trackName: sub.locator.trackName,
      layer,
    }));
    await apiCallLayer(this.caller, { ...this.proof, tracks });
  }

  private async unsubscribe(leaving: [key: string, sub: Subscription][]): Promise<void> {
    const mids = leaving.map(([, sub]) => sub.mid);
    for (const [key, sub] of leaving) {
      this.subscribed.delete(key);
      this.byMid.delete(sub.mid);
      this.events.onTrackEnded(sub.locator.sessionId, sub.locator.trackName);
    }
    for (const t of this.pc.getTransceivers()) if (t.mid && mids.includes(t.mid)) t.stop();
    await this.pc.setLocalDescription(await this.pc.createOffer());
    const sdp = this.pc.localDescription?.sdp;
    const answer = await apiCallClose(this.caller, {
      ...this.proof,
      mids,
      ...(sdp ? { sdp } : {}),
    });
    await this.applyAnswer(answer);
  }

  private async applyAnswer(answer: CallTracksResponse): Promise<void> {
    if (answer.sessionDescription?.type === 'answer') {
      await this.pc.setRemoteDescription(answer.sessionDescription);
    }
  }

  /** This browser's locator for one of its tracks (the microphone unless named), shared in its `call-track` op. */
  locator(trackToken: string, trackName: CallTrackName = CALL_TRACK_NAME): CallTrackLocator {
    return { sessionId: this.sessionId, trackName, token: trackToken };
  }

  // Hold a not-heard track back, then ask again: the wait doubles while the room keeps saying no.
  private holdBack(key: string): void {
    const wait = this.notHeard.get(key) ?? NOT_HEARD_RETRY_MS;
    this.notHeard.set(key, Math.min(wait * 2, NOT_HEARD_RETRY_MAX_MS));
    this.held.add(key);
    setTimeout(() => {
      this.held.delete(key);
      if (!this.closed) this.want([...this.wanted.values()]);
    }, wait);
  }

  close(): void {
    this.closed = true;
    for (const sub of this.subscribed.values()) {
      this.events.onTrackEnded(sub.locator.sessionId, sub.locator.trackName);
    }
    this.subscribed.clear();
    this.byMid.clear();
    this.pc.close();
  }
}
