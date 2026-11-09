// docs/specs/012-collaboration/blueprints/proximity-audio.md "Audio graph" and "Performance and limits": a voice is
// placed again only when its volume or side moved by PLACE_EPSILON or more, so 20 heard voices in a busy office cost a
// few AudioParam events a second rather than two per voice per frame. Counts, not timings.
import { describe, expect, it, vi } from 'vitest';
import { AudioGraph } from './audio-graph';
import { CallReceiver } from './call-receiver';
import type { CallScene } from './call-config';
import type { CallZoning } from './zones';

const HEARD = 20;

function fakeContext() {
  const calls = { params: 0 };
  const param = () => ({ value: 0, setTargetAtTime: vi.fn(() => calls.params++) });
  const node = () => ({
    connect: (next: unknown) => next,
    disconnect: () => {},
    gain: param(),
    pan: param(),
  });
  return {
    calls,
    context: {
      currentTime: 0,
      destination: {},
      createGain: node,
      createStereoPanner: node,
      createMediaStreamSource: node,
      close: async () => {},
    },
  };
}

// Half the heard voices sit still around you (a meeting), half walk past, 2 px a frame.
function sceneAt(frame: number): CallScene {
  const walkers = new Map<string, { x: number; y: number }>();
  for (let i = 0; i < HEARD; i++) {
    const still = i % 2 === 0;
    walkers.set(`p${i}`, { x: -150 + i * 15 + (still ? 0 : frame * 2), y: 40 });
  }
  return { tabId: 't', self: { x: 0, y: 0 }, walkers, view: null, zones: [], stages: [] };
}

function paramsPerSecond(placesPerSecond: number): number {
  vi.stubGlobal(
    'Audio',
    class {
      muted = false;
      srcObject: unknown = null;
      play = async () => {};
    },
  );
  const { calls, context } = fakeContext();
  const graph = new AudioGraph(context as unknown as AudioContext);
  const receiver = new CallReceiver(graph);
  const heard = new Set<string>();
  for (let i = 0; i < HEARD; i++) {
    graph.attach(`p${i}`, {} as MediaStream);
    heard.add(`p${i}`);
  }
  const zoning: CallZoning = { self: null, of: new Map() };
  // One second warmed up, then one counted, at 60 frames a second, placed `placesPerSecond` times.
  const every = 60 / placesPerSecond;
  for (let f = 0; f < 60; f += every) receiver.place(heard, sceneAt(f), zoning);
  calls.params = 0;
  for (let f = 60; f < 120; f += every) receiver.place(heard, sceneAt(f), zoning);
  vi.unstubAllGlobals();
  return calls.params;
}

describe('placing heard voices', () => {
  it('places 20 heard voices, half walking, at frame rate and at the coalesced rate', () => {
    const atFrameRate = paramsPerSecond(60);
    const coalesced = paramsPerSecond(10);
    console.log('[call-receiver-bench] AudioParam events/s', { atFrameRate, coalesced });
    // Placed every frame with every value set, it was 2 x 20 x 60 = 2,400 a second. The still half now costs nothing,
    // and the walking half is placed at the coarse copy's rate.
    expect(atFrameRate).toBeLessThanOrEqual(HEARD * 60);
    expect(coalesced).toBeLessThanOrEqual(HEARD * 10);
    expect(coalesced).toBeGreaterThan(0);
  });
});
