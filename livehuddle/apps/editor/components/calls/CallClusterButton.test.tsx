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
import { CALLS_PAUSED_ANNOUNCEMENT, CallClusterButton, micIndicator } from './CallClusterButton';

const actions = {
  join: vi.fn(),
  leave: vi.fn(),
  toggleMute: vi.fn(),
  toggleCamera: vi.fn(),
  toggleScreen: vi.fn(),
};

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

  // The calls kill switch (docs/specs/016-platform/calls-kill-switch.md "Calls Paused").
  it('reads Calls Paused for every role while the switch is off, calmly, and a press tries again', () => {
    const { container } = render(<CallClusterButton />);
    const live = () => container.querySelector('[aria-live]')!.textContent;
    show({});
    expect(live()).toBe('');
    show({ mode: 'off' });
    const button = screen.getByRole<HTMLButtonElement>('button', { name: 'Calls Paused' });
    expect(button.className).not.toMatch(/amber|rose/);
    expect(live()).toBe(CALLS_PAUSED_ANNOUNCEMENT);
    expect(screen.queryByRole('button', { name: 'Join Audio' })).toBeNull();
    fireEvent.click(button);
    expect(actions.join).toHaveBeenCalledTimes(1);
    show({ mode: 'off', phase: 'joining' });
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Calls Paused' }).disabled).toBe(
      true,
    );
    show({ mode: 'off', phase: 'off', canSpeak: false });
    expect(screen.getByRole('button', { name: 'Calls Paused' })).toBeTruthy();
    // Audio only changes nothing while calls are audio alone.
    show({ mode: 'audio-only' });
    expect(screen.getByRole('button', { name: 'Join Audio' })).toBeTruthy();
    expect(live()).toBe('');
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

  // docs/specs/012-collaboration/video-and-screen-bubbles.md "The camera", "The screen share", "Share roles".
  describe('the camera and Share Screen', () => {
    const button = (name: string) => screen.queryByRole<HTMLButtonElement>('button', { name });

    it('offers a camera to a speaker, Share Screen to an Editor, and neither to a Viewer', () => {
      render(<CallClusterButton />);
      show({ phase: 'live', mic: 'open' });
      fireEvent.click(button('Turn On Camera')!);
      expect(actions.toggleCamera).toHaveBeenCalledTimes(1);
      expect(button('Share Screen')).toBeNull();
      show({ phase: 'live', canShare: true });
      fireEvent.click(button('Share Screen')!);
      expect(actions.toggleScreen).toHaveBeenCalledTimes(1);
      show({ phase: 'live', canSpeak: false, canShare: false });
      expect(button('Turn On Camera')).toBeNull();
      expect(button('Share Screen')).toBeNull();
    });

    it('shows the camera on, starting and blocked, and a share running', () => {
      render(<CallClusterButton />);
      show({ phase: 'live', canShare: true, camera: 'on', screen: 'on' });
      expect(button('Turn Off Camera')!.getAttribute('aria-pressed')).toBe('true');
      // The strip's Stop Sharing, pressed, and the sharing bar's own.
      const stops = screen.getAllByRole('button', { name: 'Stop Sharing' });
      expect(stops.map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', null]);
      expect(screen.getByRole('status').textContent).toContain('You are sharing your screen');
      fireEvent.pointerDown(stops[1]!);
      fireEvent.click(stops[1]!);
      expect(actions.toggleScreen).toHaveBeenCalledTimes(1);
      show({ phase: 'live', camera: 'starting', screen: 'starting' });
      expect(button('Turn On Camera')!.disabled).toBe(true);
      expect(button('Share Screen')!.disabled).toBe(true);
      expect(screen.queryByRole('status')).toBeNull();
      show({ phase: 'live', camera: 'blocked', screen: 'off' });
      expect(button('Turn On Camera')!.disabled).toBe(false);
    });

    it('reads one calm Video Paused while calls are audio only', () => {
      render(<CallClusterButton />);
      show({ phase: 'live', canShare: true, mode: 'audio-only' });
      expect(button('Video Paused')).not.toBeNull();
      expect(button('Turn On Camera')).toBeNull();
      expect(button('Share Screen')).toBeNull();
      // The microphone carries on.
      expect(button('Mute')).not.toBeNull();
    });
  });
});
