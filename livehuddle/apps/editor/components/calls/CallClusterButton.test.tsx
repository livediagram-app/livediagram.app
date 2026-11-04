// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  callSelf,
  resetCallSelf,
  setCallActions,
  setCallSelf,
  type CallSelf,
} from '@/lib/calls/calls-store';
import { CallClusterButton, micIndicator } from './CallClusterButton';

const actions = { join: vi.fn(), leave: vi.fn(), toggleMute: vi.fn() };

function show(patch: Partial<CallSelf>) {
  act(() => {
    setCallActions(actions);
    setCallSelf({ available: true, canSpeak: true, ...patch });
  });
}

afterEach(() => {
  cleanup();
  act(() => resetCallSelf());
  vi.clearAllMocks();
});

// docs/specs/012-collaboration/proximity-audio.md "Who is in a call", "Share roles" and "The microphone".
describe('CallClusterButton', () => {
  it('draws nothing while calls are off', () => {
    const { container } = render(<CallClusterButton />);
    expect(container.innerHTML).toBe('');
    act(() => setCallSelf({ available: true }));
    expect(container.innerHTML).toBe('');
  });

  it('offers Join Audio to a speaker and Listen In to a Viewer', () => {
    render(<CallClusterButton />);
    show({});
    fireEvent.click(screen.getByRole('button', { name: 'Join Audio' }));
    expect(actions.join).toHaveBeenCalledTimes(1);
    show({ canSpeak: false });
    expect(screen.getByRole('button', { name: 'Listen In' })).toBeTruthy();
  });

  it('waits while joining and offers a retry after a failure', () => {
    render(<CallClusterButton />);
    show({ phase: 'joining' });
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Join Audio' }).disabled).toBe(
      true,
    );
    show({ phase: 'error' });
    fireEvent.click(screen.getByRole('button', { name: 'Join Audio' }));
    expect(actions.join).toHaveBeenCalled();
  });

  it('once in, mutes and unmutes, and leaves', () => {
    render(<CallClusterButton />);
    show({ phase: 'live', mic: 'open', someoneNear: true, level: 2 });
    const mute = screen.getByRole('button', { name: 'Mute' });
    expect(mute.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(mute);
    expect(actions.toggleMute).toHaveBeenCalledTimes(1);
    show({ muted: true });
    expect(screen.getByRole('button', { name: 'Unmute' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Leave Audio' }));
    expect(actions.leave).toHaveBeenCalledTimes(1);
  });

  it('a blocked microphone and a listener have nothing to mute', () => {
    render(<CallClusterButton />);
    show({ phase: 'live', mic: 'blocked' });
    fireEvent.click(screen.getByRole('button', { name: 'Mute' }));
    expect(actions.toggleMute).not.toHaveBeenCalled();
    show({ canSpeak: false, mic: 'closed' });
    expect(
      screen.getByRole('button', { name: 'Listening' }).getAttribute('aria-pressed'),
    ).toBeNull();
  });

  it('names the indicator state', () => {
    const self = (patch: Partial<CallSelf>) => ({ ...callSelf(), canSpeak: true, ...patch });
    expect(micIndicator(self({ canSpeak: false }))).toBe('listening');
    expect(micIndicator(self({ mic: 'blocked', muted: true }))).toBe('blocked');
    expect(micIndicator(self({ mic: 'open', muted: true }))).toBe('muted');
    expect(micIndicator(self({ mic: 'closed' }))).toBe('closed');
    expect(micIndicator(self({ mic: 'open', someoneNear: true }))).toBe('live');
    expect(micIndicator(self({ mic: 'open', someoneNear: false }))).toBe('nobody-near');
  });
});
