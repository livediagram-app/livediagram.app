// The mint route's side of the hearing check (#483): the room's answer splits a subscribe, refused tracks come back
// `not_heard` in their place, and a room that cannot answer refuses nobody.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { splitByHearing, withRefusals } from './subscribe-hearing';

const a = { sessionId: 'A', trackName: 'mic', token: 'k' };
const b = { sessionId: 'B', trackName: 'screen', token: 'k' };
const c = { sessionId: 'C', trackName: 'cam', token: 'k', layer: 'f' as const };

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('splitByHearing', () => {
  it('keeps what the room says is heard and marks the rest by position', async () => {
    const ask = vi.fn(async (_asks: unknown) => ['heard', 'stopped', 'apart'] as const);
    const split = await splitByHearing([a, b, c], async (asks) => [...(await ask(asks))]);
    expect(ask).toHaveBeenCalledWith([
      { sessionId: 'A', trackName: 'mic' },
      { sessionId: 'B', trackName: 'screen' },
      { sessionId: 'C', trackName: 'cam' },
    ]);
    expect(split.allowed).toEqual([a]);
    expect([...split.refused]).toEqual([1, 2]);
    expect(console.warn).toHaveBeenCalledWith('[calls] not heard', 'stopped', 'screen');
  });

  it('refuses nobody when the room cannot answer, or answers short', async () => {
    const thrown = await splitByHearing([a, b], async () => {
      throw new Error('room timeout');
    });
    expect(thrown.allowed).toEqual([a, b]);
    expect(console.warn).toHaveBeenCalledWith('[calls] hearing unanswered', 'Error: room timeout');
    const short = await splitByHearing([a, b], async () => ['apart']);
    expect(short.allowed).toEqual([b]);
  });
});

describe('withRefusals', () => {
  it("puts a refusal back in each refused track's place, around Realtime's answer", () => {
    const answer = {
      requiresImmediateRenegotiation: true,
      sessionDescription: { type: 'offer' as const, sdp: 'v=0' },
      tracks: [{ mid: '1', sessionId: 'A', trackName: 'mic' }],
    };
    expect(withRefusals([a, b, c], new Set([1, 2]), answer)).toEqual({
      requiresImmediateRenegotiation: true,
      sessionDescription: { type: 'offer', sdp: 'v=0' },
      tracks: [
        { mid: '1', sessionId: 'A', trackName: 'mic' },
        { sessionId: 'B', trackName: 'screen', errorCode: 'not_heard' },
        { sessionId: 'C', trackName: 'cam', errorCode: 'not_heard' },
      ],
    });
  });

  it('answers every track refused without asking Realtime, and keeps a short answer in order', () => {
    expect(withRefusals([a], new Set([0]), null)).toEqual({
      requiresImmediateRenegotiation: false,
      tracks: [{ sessionId: 'A', trackName: 'mic', errorCode: 'not_heard' }],
    });
    expect(
      withRefusals([a, b], new Set(), { requiresImmediateRenegotiation: false, tracks: [] }),
    ).toEqual({ requiresImmediateRenegotiation: false, tracks: [{}, {}] });
  });
});
