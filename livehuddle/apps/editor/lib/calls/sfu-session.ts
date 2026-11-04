// This browser's one connection to Cloudflare Realtime's SFU (docs/specs/012-collaboration/blueprints/
// proximity-audio.md "Subscriptions"): one RTCPeerConnection and one Realtime session, its microphone published once,
// and the speakers in earshot subscribed. Every mutation runs through one queue (Realtime refuses a second change on
// a session while one is unfinished), and a subscribe or close is reconciled against what is wanted when it runs, so a
// speaker who walks in and out while a request is in flight costs no stale call.
import {
  CALL_TRACK_NAME,
  type CallSessionResponse,
  type CallTrackLocator,
  type CallTracksResponse,
} from '@livehuddle/api-schema';
import {
  apiCallClose,
  apiCallRenegotiate,
  apiCallTracks,
  CallsApiError,
  type CallsCaller,
} from '@/lib/api/calls';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';

/** The most speakers asked for in one request (the api's MAX_SUBSCRIBE_BATCH). */
export const SUBSCRIBE_BATCH = 16;

const refusalKey = (l: CallTrackLocator) => `${l.sessionId}|${l.token}`;

export type SfuEvents = {
  // A speaker's microphone arrived, keyed by the publishing session.
  onTrack: (publisherSessionId: string, stream: MediaStream) => void;
  // A subscription ended (its speaker walked away): stop playing it.
  onTrackEnded: (publisherSessionId: string) => void;
  // The connection failed for good.
  onFailed: () => void;
  // The calls kill switch paused calls: a publish, subscribe or close was refused with `paused`.
  onPaused: () => void;
};

export class SfuSession {
  readonly sessionId: string;
  private readonly proof: { sessionId: string; sessionToken: string };
  private readonly pc: RTCPeerConnection;
  private queue: Promise<void> = Promise.resolve();
  private reconcileQueued = false;
  private closed = false;
  // Publisher session id → the locator to ask for, as wanted now.
  private wanted = new Map<string, CallTrackLocator>();
  // Publisher session id → the mid its subscription took on this connection.
  private readonly subscribed = new Map<string, string>();
  // mid → publisher session id, so an arriving track knows whose it is.
  private readonly byMid = new Map<string, string>();
  private micSender: RTCRtpSender | null = null;
  // Locators Realtime refused (a session that ended): not asked for again until the speaker sends a new one.
  private readonly refused = new Set<string>();
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
      const publisher = mid ? this.byMid.get(mid) : undefined;
      if (publisher) this.events.onTrack(publisher, new MediaStream([e.track]));
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
      if (error instanceof CallsApiError && error.paused) this.events.onPaused();
    });
    return run;
  }

  /** Publish the microphone once. Later microphones replace its track without renegotiating. */
  publish(track: MediaStreamTrack): Promise<void> {
    return this.enqueue(async () => {
      if (this.micSender) {
        await this.micSender.replaceTrack(track);
        return;
      }
      const transceiver = this.pc.addTransceiver(track, { direction: 'sendonly' });
      this.micSender = transceiver.sender;
      await this.pc.setLocalDescription(await this.pc.createOffer());
      const mid = transceiver.mid;
      const sdp = this.pc.localDescription?.sdp;
      if (!mid || !sdp) throw new Error('no local offer');
      const answer = await apiCallTracks(this.caller, { ...this.proof, publish: { sdp, mid } });
      await this.applyAnswer(answer);
    });
  }

  /** Swap the microphone's track (null while it is closed) without renegotiating. */
  async replaceMic(track: MediaStreamTrack | null): Promise<void> {
    await this.micSender?.replaceTrack(track);
  }

  /** The speakers to hear: a reconcile follows on the queue. */
  want(locators: readonly CallTrackLocator[]): void {
    this.wanted = new Map(locators.map((l) => [l.sessionId, l]));
    // Called on every step anyone walks: nothing to do while what is subscribed is what is wanted.
    if (this.settled() || this.reconcileQueued) return;
    this.reconcileQueued = true;
    void this.enqueue(async () => {
      this.reconcileQueued = false;
      await this.reconcile();
    });
  }

  private joining(): CallTrackLocator[] {
    return [...this.wanted.values()].filter(
      (l) => !this.subscribed.has(l.sessionId) && !this.refused.has(refusalKey(l)),
    );
  }

  private settled(): boolean {
    return (
      this.joining().length === 0 && [...this.subscribed.keys()].every((p) => this.wanted.has(p))
    );
  }

  private async reconcile(): Promise<void> {
    const leaving = [...this.subscribed].filter(([publisher]) => !this.wanted.has(publisher));
    if (leaving.length > 0) await this.unsubscribe(leaving.slice(0, SUBSCRIBE_BATCH));
    const joining = this.joining();
    if (joining.length > 0) await this.subscribe(joining.slice(0, SUBSCRIBE_BATCH));
    // A crowd larger than one batch goes over several steps.
    if (!this.settled()) this.want([...this.wanted.values()]);
  }

  private async subscribe(locators: CallTrackLocator[]): Promise<void> {
    const answer = await apiCallTracks(this.caller, { ...this.proof, subscribe: locators });
    // Answered in order; a locator without a usable answer counts as refused, so it is never asked for in a loop.
    locators.forEach((locator, i) => {
      const mid = answer.tracks[i]?.errorCode ? undefined : answer.tracks[i]?.mid;
      if (!mid) {
        this.refused.add(refusalKey(locator));
        return;
      }
      this.subscribed.set(locator.sessionId, mid);
      this.byMid.set(mid, locator.sessionId);
    });
    if (answer.requiresImmediateRenegotiation && answer.sessionDescription) {
      await this.pc.setRemoteDescription(answer.sessionDescription);
      await this.pc.setLocalDescription(await this.pc.createAnswer());
      const sdp = this.pc.localDescription?.sdp;
      if (!sdp) throw new Error('no local answer');
      await apiCallRenegotiate(this.caller, { ...this.proof, sdp });
    }
  }

  private async unsubscribe(leaving: [publisher: string, mid: string][]): Promise<void> {
    const mids = leaving.map(([, mid]) => mid);
    for (const [publisher, mid] of leaving) {
      this.subscribed.delete(publisher);
      this.byMid.delete(mid);
      this.events.onTrackEnded(publisher);
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

  /** This browser's locator for its own microphone, shared in its `call-track` op. */
  locator(trackToken: string): CallTrackLocator {
    return { sessionId: this.sessionId, trackName: CALL_TRACK_NAME, token: trackToken };
  }

  close(): void {
    this.closed = true;
    for (const publisher of this.subscribed.keys()) this.events.onTrackEnded(publisher);
    this.subscribed.clear();
    this.byMid.clear();
    this.pc.close();
  }
}
