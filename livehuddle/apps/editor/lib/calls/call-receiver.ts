// What a proximity call does with what it receives (docs/specs/012-collaboration/proximity-audio.md "Hearing";
// video-and-screen-bubbles.md "The bubble"): a microphone into the audio graph, placed by distance and side, and a
// camera or screen into its owner's bubble. The SFU names a track by its publishing session; the peers' locators say
// whose it is.
import type { AudioGraph } from './audio-graph';
import { MEDIA_OF, type CallScene } from './call-config';
import { presenceOf } from './call-subscriptions';
import { callPeers, setCallMedia } from './calls-store';
import { placeFor, togetherWith } from './hearing';
import type { CallZoning } from './zones';

export class CallReceiver {
  private readonly graph: AudioGraph;
  // Publisher session and track → the presence id it was received for, so an ended track finds its owner even after
  // the owner's locator has gone.
  private readonly owners = new Map<string, string>();

  constructor(graph: AudioGraph) {
    this.graph = graph;
  }

  /** Place every speaker heard: full volume in a shared room or from a stage, by distance in the open, by side. */
  place(heard: ReadonlySet<string>, scene: CallScene, zoning: CallZoning): void {
    const self = scene.self;
    if (!self) return;
    for (const id of heard) {
      const at = scene.walkers.get(id);
      if (!at) continue;
      const { gain, pan } = placeFor(self, at, togetherWith(id, zoning));
      this.graph.place(id, gain, pan);
    }
  }

  /** A track arrived; a microphone was attached when it answers true, so the caller places it. */
  onTrack(publisherSessionId: string, trackName: string, stream: MediaStream): boolean {
    const id = presenceOf(callPeers(), publisherSessionId, trackName);
    if (!id) return false;
    this.owners.set(`${publisherSessionId}|${trackName}`, id);
    const media = MEDIA_OF[trackName];
    if (media) {
      setCallMedia(id, media, stream);
      return false;
    }
    this.graph.attach(id, stream);
    return true;
  }

  onTrackEnded(publisherSessionId: string, trackName: string): void {
    const key = `${publisherSessionId}|${trackName}`;
    const id = this.owners.get(key) ?? presenceOf(callPeers(), publisherSessionId, trackName);
    this.owners.delete(key);
    if (!id) return;
    const media = MEDIA_OF[trackName];
    if (media) setCallMedia(id, media, null);
    else this.graph.detach(id);
  }

  clear(): void {
    this.owners.clear();
  }
}
