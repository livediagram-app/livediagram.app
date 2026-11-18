// @vitest-environment jsdom
// Your microphone and camera in the mini view (docs/specs/008-canvas/avatar-mode.md "The mini view", "Your microphone
// and camera"; blueprint: space-mini-view.md "Your controls"; Work Tracker 992): the Call dock's own buttons, per phase
// and per share role.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  callSelf,
  resetCallSelf,
  setCallActions,
  setCallSelf,
  type CallActions,
  type CallSelf,
} from '@/lib/calls/calls-store';
import { CallStripGroup } from '../CallStripGroup';
import { MiniViewControls } from './MiniViewControls';

function storeActions(): CallActions {
  return {
    join: vi.fn(),
    toggleMute: vi.fn(() => setCallSelf({ muted: !callSelf().muted })),
    toggleCamera: vi.fn(() => setCallSelf({ camera: callSelf().camera === 'on' ? 'off' : 'on' })),
    toggleScreen: vi.fn(),
    raiseHand: vi.fn(),
    lowerHand: vi.fn(),
  };
}

function show(patch: Partial<CallSelf>, actions: CallActions | null = storeActions()) {
  act(() => {
    setCallActions(actions);
    setCallSelf({ available: true, canSpeak: true, ...patch });
  });
  return actions;
}

const group = () => screen.queryByRole('group', { name: 'Your microphone and camera' });
const buttons = () =>
  Array.from(group()?.querySelectorAll('button') ?? []).map((b) => b.getAttribute('aria-label'));

afterEach(() => {
  cleanup();
  act(() => resetCallSelf());
  vi.restoreAllMocks();
});

describe('MiniViewControls', () => {
  it('draws the live call microphone, named as on the dock, and a press mutes and unmutes', () => {
    render(<MiniViewControls />);
    const actions = show({ phase: 'live', mic: 'open', muted: true });
    const unmute = screen.getByRole('button', { name: 'Unmute' });
    expect(unmute.getAttribute('aria-pressed')).toBe('true');
    expect(unmute.textContent).toContain('Muted');
    fireEvent.click(unmute);
    expect(actions!.toggleMute).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Mute' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('a mute in the window shows on the dock at once, and one on the dock in the window', () => {
    render(
      <>
        <CallStripGroup />
        <MiniViewControls />
      </>,
    );
    show({ phase: 'live', mic: 'open', muted: true });
    const [dock, mini] = screen.getAllByRole('button', { name: 'Unmute' });
    fireEvent.click(mini!);
    expect(screen.getAllByRole('button', { name: 'Mute' })).toHaveLength(2);
    fireEvent.click(screen.getAllByRole('button', { name: 'Mute' })[0]!);
    expect(screen.getAllByRole('button', { name: 'Unmute' })).toHaveLength(2);
    expect(dock).toBeTruthy();
  });

  it('shows the camera only while it is on, to turn it off', () => {
    render(<MiniViewControls />);
    const actions = show({ phase: 'live', mic: 'open', muted: true });
    expect(buttons()).toEqual(['Unmute']);
    act(() => setCallSelf({ camera: 'on' }));
    expect(buttons()).toEqual(['Unmute', 'Turn Off Camera']);
    fireEvent.click(screen.getByRole('button', { name: 'Turn Off Camera' }));
    expect(actions!.toggleCamera).toHaveBeenCalledTimes(1);
    expect(buttons()).toEqual(['Unmute']);
  });

  it('shows the local preview camera too while it is on', () => {
    render(<MiniViewControls />);
    show({ available: false, canPreviewMic: true, canPreviewCamera: true, previewCamera: 'on' });
    expect(buttons()).toEqual(['Unmute', 'Turn Off Camera']);
  });

  // Work Tracker 1109: the window is a document of its own, and the hover card draws there, not in the Space's tab.
  it('draws its hover cards in the mini view’s own window', () => {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const pipDoc = frame.contentDocument!;
    const container = pipDoc.body.appendChild(pipDoc.createElement('div'));
    try {
      render(<MiniViewControls />, { container });
      show({ phase: 'live', mic: 'open', muted: true });
      const unmute = pipDoc.querySelector<HTMLButtonElement>('button[aria-label="Unmute"]')!;
      fireEvent.pointerEnter(unmute, { pointerType: 'mouse' });
      const card = pipDoc.querySelector('[data-hint="hover-card"]');
      expect(card?.textContent).toContain('Nobody hears you. Press to unmute.');
      expect(card?.parentElement).toBe(pipDoc.body);
      expect(document.querySelector('[data-hint]')).toBeNull();
    } finally {
      cleanup();
      frame.remove();
    }
  });

  it('shows the local preview microphone with no call, paused or failed', () => {
    render(<MiniViewControls />);
    for (const patch of [
      { available: false },
      { mode: 'off', phase: 'off' },
      { phase: 'error' },
    ] as Partial<CallSelf>[]) {
      show({ canPreviewMic: true, previewMic: 'off', mode: 'on', phase: 'off', ...patch });
      const unmute = screen.getByRole('button', { name: 'Unmute' });
      expect(unmute.textContent).toContain('Muted');
    }
  });

  it('draws nothing while the call connects, or with no preview to offer', () => {
    const { container } = render(<MiniViewControls />);
    show({ phase: 'joining' });
    expect(buttons()).toEqual([]);
    show({ available: false, canPreviewMic: false, phase: 'off' });
    expect(buttons()).toEqual([]);
    expect(container.querySelector('[data-mini-controls]')?.childElementCount).toBe(0);
  });

  // Share roles: only someone who may speak drives a microphone, as on the dock.
  it('draws nothing for a listener (a Viewer) or without a call to drive', () => {
    const { container } = render(<MiniViewControls />);
    show({ canSpeak: false, phase: 'live' });
    expect(container.innerHTML).toBe('');
    show({ phase: 'live', mic: 'open' }, null);
    expect(container.innerHTML).toBe('');
  });

  it('gives an Editor and a Participant the same microphone', () => {
    render(<MiniViewControls />);
    for (const canShare of [true, false]) {
      show({ phase: 'live', mic: 'open', muted: false, someoneNear: true, canShare });
      expect(screen.getByRole('button', { name: 'Mute' }).textContent).toContain('Mic');
    }
  });
});
