import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioGraph, GLIDE_S } from './audio-graph';

type FakeNode = {
  connect: (next: unknown) => unknown;
  disconnect: () => void;
  gain: { value: number; setTargetAtTime: (...a: unknown[]) => void };
  pan: { setTargetAtTime: (...a: unknown[]) => void };
  fftSize: number;
  getFloatTimeDomainData: (out: Float32Array) => void;
};
const node = (): FakeNode => {
  const n = {
    connect: vi.fn((next: unknown) => next),
    disconnect: vi.fn(),
    gain: { value: 1, setTargetAtTime: vi.fn() },
    pan: { setTargetAtTime: vi.fn() },
    fftSize: 2048,
    getFloatTimeDomainData: vi.fn((out: Float32Array) => out.fill(0.5)),
  };
  return n;
};

const first = (fn: { mock: { results: { value: unknown }[] } }) =>
  fn.mock.results[0]!.value as FakeNode;

function fakeContext() {
  return {
    currentTime: 3,
    destination: {},
    createGain: vi.fn<() => FakeNode>(node),
    createStereoPanner: vi.fn<() => FakeNode>(node),
    createAnalyser: vi.fn<() => FakeNode>(node),
    createMediaStreamSource: vi.fn<() => FakeNode>(node),
    close: vi.fn(async () => {}),
  };
}

beforeEach(() => {
  vi.stubGlobal(
    'Audio',
    class {
      muted = false;
      srcObject: unknown = null;
      play = vi.fn(async () => {});
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

// docs/specs/012-collaboration/blueprints/proximity-audio.md "Audio graph".
describe('AudioGraph', () => {
  it('plays a speaker silent until placed, then glides gain and pan', () => {
    const ctx = fakeContext();
    const graph = new AudioGraph(ctx as unknown as AudioContext);
    graph.attach('p1', {} as MediaStream);
    expect(graph.has('p1')).toBe(true);
    const gain = first(ctx.createGain);
    const pan = first(ctx.createStereoPanner);
    expect(gain.gain.value).toBe(0);
    graph.place('p1', 0.5, -0.4);
    graph.place('nobody', 1, 0);
    expect(gain.gain.setTargetAtTime).toHaveBeenCalledWith(0.5, 3, GLIDE_S);
    expect(pan.pan.setTargetAtTime).toHaveBeenCalledWith(-0.4, 3, GLIDE_S);
    graph.attach('p1', {} as MediaStream);
    expect(gain.disconnect).toHaveBeenCalled();
    graph.detach('p1');
    graph.detach('p1');
    expect(graph.has('p1')).toBe(false);
  });

  it('measures the microphone, and reads silence while not listening', () => {
    const ctx = fakeContext();
    const graph = new AudioGraph(ctx as unknown as AudioContext);
    expect(graph.micLevel()).toBe(0);
    graph.listenTo({} as MediaStream);
    expect(first(ctx.createAnalyser).fftSize).toBe(512);
    expect(graph.micLevel()).toBe(0.5);
    graph.listenTo({} as MediaStream);
    expect(ctx.createAnalyser).toHaveBeenCalledTimes(1);
    graph.attach('p2', {} as MediaStream);
    graph.close();
    expect(graph.has('p2')).toBe(false);
    expect(graph.micLevel()).toBe(0);
    expect(ctx.close).toHaveBeenCalled();
  });
});
