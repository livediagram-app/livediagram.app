import { describe, expect, it } from 'vitest';
import { multiplayerDecision } from './room-multiplayer';

describe('multiplayerDecision', () => {
  it('does nothing while fewer than two people have said hello', () => {
    expect(multiplayerDecision([])).toEqual({ report: false, mark: [] });
    expect(multiplayerDecision([{ present: true }])).toEqual({ report: false, mark: [] });
    // A connected-but-silent socket is not on the roster.
    expect(multiplayerDecision([{ present: true }, { present: false }])).toEqual({
      report: false,
      mark: [],
    });
  });

  it('reports once when the roster first reaches two, marking both', () => {
    expect(multiplayerDecision([{ present: true }, { present: true }])).toEqual({
      report: true,
      mark: [0, 1],
    });
  });

  it('does not report again when a third joins an already-counted session', () => {
    expect(
      multiplayerDecision([
        { present: true, multiplayer: true },
        { present: true, multiplayer: true },
        { present: true },
      ]),
    ).toEqual({ report: false, mark: [2] });
  });

  it('keeps the session while anyone from it is still connected', () => {
    // B left, A stayed, C joined: the same continuous session.
    expect(multiplayerDecision([{ present: true, multiplayer: true }, { present: true }])).toEqual({
      report: false,
      mark: [1],
    });
  });
});
