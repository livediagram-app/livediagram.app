// What a proximity call receives (docs/specs/012-collaboration/proximity-audio.md "Hearing"; video-and-screen-
// bubbles.md "Who sees what"): the speakers heard, from the walkers on your tab with something published, and the
// camera and screen bubbles seen, from those heard and on screen. Pure over the scene and the peers' locators; the
// call hands the answer to the SFU session.
import {
  CALL_SCREEN_TRACK_NAME,
  CALL_VIDEO_TRACK_NAME,
  callsModeAllows,
  type CallsMode,
} from '@livehuddle/api-schema';
import { pickSeen } from './bubbles';
import type { CallScene } from './call-config';
import type { CallMaximised, CallPeer } from './calls-store';
import { nextHeard, type Point } from './hearing';
import type { SfuWant } from './sfu-session';
import type { CallZoning } from './zones';

const NOBODY: ReadonlySet<string> = new Set();

export type SubscriptionInput = {
  prevHeard: ReadonlySet<string>;
  scene: CallScene;
  zoning: CallZoning;
  peers: ReadonlyMap<string, CallPeer>;
  // Do Not Disturb hears nobody (meeting-rooms-and-stage.md "Do Not Disturb").
  dnd: boolean;
  mode: CallsMode;
  maximised: CallMaximised | null;
  // Whether the page is visible; a hidden tab receives no bubbles.
  visible: boolean;
};

export type Subscriptions = { heard: ReadonlySet<string>; wants: SfuWant[] };

/**
 * Whose bubbles may be received: everyone heard but a speaker on a stage that does not show its cameras, unless you
 * speak from a stage too (speakers see each other as one room).
 */
export function seeable(heard: ReadonlySet<string>, zoning: CallZoning): ReadonlySet<string> {
  const stage = zoning.stage;
  if (!stage || stage.self || stage.unseen.size === 0) return heard;
  return new Set([...heard].filter((id) => !stage.unseen.has(id)));
}

/** Who is heard next and every track to receive: the microphones heard, then the cameras and screens seen. */
export function chooseSubscriptions(input: SubscriptionInput): Subscriptions {
  const { scene, peers, zoning } = input;
  // Do Not Disturb hears nobody: every subscription closes, bubbles too.
  if (input.dnd) return { heard: NOBODY, wants: [] };
  const candidates = new Map<string, Point>();
  for (const [id, at] of scene.walkers) {
    const peer = peers.get(id);
    if (peer && (peer.track || peer.video || peer.screen) && peer.tabId === scene.tabId) {
      candidates.set(id, at);
    }
  }
  const heard = nextHeard(input.prevHeard, scene.self, candidates, zoning);
  const wants: SfuWant[] = [];
  for (const id of heard) {
    const track = peers.get(id)?.track;
    if (track) wants.push(track);
  }
  const { maximised } = input;
  const seen = pickSeen({
    self: scene.self,
    heard: seeable(heard, zoning),
    walkers: scene.walkers,
    peers,
    view: scene.view ?? null,
    visible: input.visible,
    allowVideo: callsModeAllows(input.mode, 'video'),
    allowScreen: callsModeAllows(input.mode, 'screen'),
    maximised,
  });
  for (const id of seen.video) {
    const video = peers.get(id)?.video;
    const large = maximised?.id === id && maximised.media === 'video';
    if (video) wants.push(large ? { ...video, layer: 'f' } : video);
  }
  for (const id of seen.screen) {
    const screen = peers.get(id)?.screen;
    if (screen) wants.push(screen);
  }
  return { heard, wants };
}

/** The presence whose `trackName` a publishing session sends, from the locators the peers shared; null for none. */
export function presenceOf(
  peers: ReadonlyMap<string, CallPeer>,
  publisherSessionId: string,
  trackName: string,
): string | null {
  for (const [id, peer] of peers) {
    const locator =
      trackName === CALL_VIDEO_TRACK_NAME
        ? peer.video
        : trackName === CALL_SCREEN_TRACK_NAME
          ? peer.screen
          : peer.track;
    if (locator?.sessionId === publisherSessionId) return id;
  }
  return null;
}
