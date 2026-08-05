import { beforeEach, describe, expect, it, vi } from 'vitest';

const trackMock = vi.fn();
vi.mock('@/lib/telemetry', () => ({
  track: (...args: unknown[]) => trackMock(...args),
}));

const { reportMultiplayerPresence, resetMultiplayerPresenceReports } =
  await import('./multiplayer-telemetry');

describe('reportMultiplayerPresence', () => {
  beforeEach(() => {
    trackMock.mockClear();
    resetMultiplayerPresenceReports();
  });

  it('reports once when a peer joins the room', () => {
    reportMultiplayerPresence('d1', 2);
    expect(trackMock).toHaveBeenCalledExactlyOnceWith('Diagram', 'Used', 'Multiplayer');
  });

  // Presence lands as a frame per change, so an unguarded emit would count a
  // single session dozens of times and drown every other number on the tab.
  it('stays silent on later presence frames for the same diagram', () => {
    reportMultiplayerPresence('d1', 2);
    reportMultiplayerPresence('d1', 3);
    reportMultiplayerPresence('d1', 2);
    expect(trackMock).toHaveBeenCalledTimes(1);
  });

  // The room's presence list includes us, so one participant is solo.
  it('says nothing when we are alone in the room', () => {
    reportMultiplayerPresence('d1', 1);
    reportMultiplayerPresence('d1', 0);
    expect(trackMock).not.toHaveBeenCalled();
  });

  // A reconnect re-runs the effect with a fresh socket; the question is
  // whether this OPEN was collaborative, answered once.
  it('reports a second diagram separately', () => {
    reportMultiplayerPresence('d1', 2);
    reportMultiplayerPresence('d2', 2);
    expect(trackMock).toHaveBeenCalledTimes(2);
  });

  it('ignores a null diagram id', () => {
    reportMultiplayerPresence(null, 5);
    expect(trackMock).not.toHaveBeenCalled();
  });
});
