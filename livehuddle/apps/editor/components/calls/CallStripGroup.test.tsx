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
import {
  AUDIO_HELD_TEXT,
  CALLS_PAUSED_ANNOUNCEMENT,
  CallStripGroup,
  MicMeter,
  PREVIEW_TEXT,
  micIndicator,
} from './CallStripGroup';
import { CallNames, Segment } from './CallSegment';
import { ScreenShareStripGroup } from './ScreenShareStripGroup';

// The call group and, while you share, the Screen Share group beside it, as the Call dock draws them.
const WithShare = () => (
  <>
    <CallStripGroup />
    <ScreenShareStripGroup />
  </>
);

const actions = {
  join: vi.fn(),
  toggleMute: vi.fn(),
  hear: vi.fn(),
  toggleCamera: vi.fn(),
  toggleScreen: vi.fn(),
  raiseHand: vi.fn(),
  lowerHand: vi.fn(),
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
describe('CallStripGroup', () => {
  it('draws nothing while calls are off', () => {
    const { container } = render(<CallStripGroup />);
    expect(container.innerHTML).toBe('');
    act(() => setCallSelf({ available: true }));
    expect(container.innerHTML).toBe('');
  });

  // docs/specs/018-help/contextual-help-links.md: the strip carries no help link, whatever its state.
  it('carries no calls help link before joining, once in, or while paused', () => {
    render(<CallStripGroup />);
    for (const state of [
      {},
      { phase: 'live', mic: 'open', someoneNear: true },
      { canSpeak: false, phase: 'live' },
      { mode: 'off' },
    ]) {
      show(state as Parameters<typeof show>[0]);
      expect(screen.queryByRole('link', { name: 'Learn about calls' })).toBeNull();
    }
  });

  // proximity-audio.md "Someone who arrives later": sound the browser holds back is offered back, never for nothing.
  it('offers Click to Hear while the sound is held back and somebody is heard', () => {
    render(<CallStripGroup />);
    show({ phase: 'live', muted: true, audioHeld: true, heard: new Set() });
    expect(screen.queryByRole('button', { name: 'Click to hear' })).toBeNull();
    show({ phase: 'live', muted: true, audioHeld: true, heard: new Set(['p1']) });
    const hear = screen.getByRole('button', { name: 'Click to hear' });
    expect(hear.className).toContain('amber');
    fireEvent.click(hear);
    expect(actions.hear).toHaveBeenCalledTimes(1);
    expect(AUDIO_HELD_TEXT.title).toBe('Sound Held Back');
    show({ phase: 'live', muted: true, audioHeld: false, heard: new Set(['p1']) });
    expect(screen.queryByRole('button', { name: 'Click to hear' })).toBeNull();
  });

  // Walking in joins by itself (proximity-audio.md "Who is in a call"): no Join Audio, no Listen In, no Leave.
  it('reads Connecting, greyed, while the call is on its way, for a speaker and a Viewer alike', () => {
    render(<CallStripGroup />);
    for (const patch of [{}, { phase: 'joining' }, { canSpeak: false }] as const) {
      show(patch);
      const connecting = screen.getByRole<HTMLButtonElement>('button', {
        name: 'Connecting audio',
      });
      expect(connecting.disabled).toBe(true);
      fireEvent.click(connecting);
    }
    expect(actions.join).not.toHaveBeenCalled();
    for (const name of ['Join Audio', 'Listen In', 'Leave Audio'])
      expect(screen.queryByRole('button', { name })).toBeNull();
  });

  it('offers a retry after a failure, in the warn tone, saying audio is unavailable', () => {
    render(<CallStripGroup />);
    show({ phase: 'error' });
    const retry = screen.getByRole('button', { name: 'Retry Audio' });
    expect(retry.className).toContain('amber');
    fireEvent.click(retry);
    expect(actions.join).toHaveBeenCalledTimes(1);
    fireEvent.pointerEnter(retry, { pointerType: 'mouse' });
    expect(document.body.textContent).toContain('Audio Unavailable');
    // A Viewer retries too.
    show({ phase: 'error', canSpeak: false });
    fireEvent.click(screen.getByRole('button', { name: 'Retry Audio' }));
    expect(actions.join).toHaveBeenCalledTimes(2);
  });

  // The calls kill switch (docs/specs/016-platform/calls-kill-switch.md "Calls Paused").
  it('reads Calls Paused for every role while the switch is off, calmly, and a press tries again', () => {
    const { container } = render(<CallStripGroup />);
    const live = () => container.querySelector('[aria-live]')!.textContent;
    show({});
    expect(live()).toBe('');
    show({ mode: 'off' });
    const button = screen.getByRole<HTMLButtonElement>('button', { name: 'Calls Paused' });
    expect(button.className).not.toMatch(/amber|rose/);
    expect(live()).toBe(CALLS_PAUSED_ANNOUNCEMENT);
    expect(screen.queryByRole('button', { name: 'Connecting audio' })).toBeNull();
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
    expect(screen.getByRole('button', { name: 'Connecting audio' })).toBeTruthy();
    expect(live()).toBe('');
  });

  it('once in, mutes and unmutes, with no Leave', () => {
    render(<CallStripGroup />);
    show({ phase: 'live', mic: 'open', someoneNear: true, level: 2 });
    const mute = screen.getByRole('button', { name: 'Mute' });
    expect(mute.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(mute);
    expect(actions.toggleMute).toHaveBeenCalledTimes(1);
    show({ muted: true });
    expect(screen.getByRole('button', { name: 'Unmute' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(screen.queryByRole('button', { name: 'Leave Audio' })).toBeNull();
  });

  // call-mic.ts: a press on Mic Blocked asks the browser again; a listener has nothing to mute.
  it('a blocked microphone is pressed to try again, and a listener has nothing to mute', () => {
    render(<CallStripGroup />);
    show({ phase: 'live', mic: 'blocked' });
    const blocked = screen.getByRole('button', { name: 'Mute' });
    expect(blocked.className).toContain('amber');
    fireEvent.click(blocked);
    expect(actions.toggleMute).toHaveBeenCalledTimes(1);
    fireEvent.pointerEnter(blocked, { pointerType: 'mouse' });
    expect(document.body.textContent).toContain('press to try again');
    show({ canSpeak: false, mic: 'closed' });
    const listening = screen.getByRole('button', { name: 'Listening' });
    expect(listening.getAttribute('aria-pressed')).toBeNull();
    fireEvent.click(listening);
    expect(actions.toggleMute).toHaveBeenCalledTimes(1);
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
      render(<CallStripGroup />);
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
      render(<WithShare />);
      show({ phase: 'live', canShare: true, camera: 'on', screen: 'on' });
      expect(button('Turn Off Camera')!.getAttribute('aria-pressed')).toBe('true');
      // One Stop Sharing, the Screen Share group's: the call group's Share gives way to it.
      const stops = screen.getAllByRole('button', { name: 'Stop Sharing' });
      expect(stops).toHaveLength(1);
      expect(stops[0]!.closest('[data-share-group]')).not.toBeNull();
      expect(screen.getByRole('status').getAttribute('aria-label')).toBe(
        'You are sharing your screen',
      );
      fireEvent.pointerDown(stops[0]!);
      fireEvent.click(stops[0]!);
      expect(actions.toggleScreen).toHaveBeenCalledTimes(1);
      show({ phase: 'live', camera: 'starting', screen: 'starting' });
      expect(button('Turn On Camera')!.disabled).toBe(true);
      expect(button('Share Screen')!.disabled).toBe(true);
      expect(screen.queryByRole('status')).toBeNull();
      show({ phase: 'live', camera: 'blocked', screen: 'off' });
      expect(button('Turn On Camera')!.disabled).toBe(false);
    });

    it('reads one calm Video Paused while calls are audio only', () => {
      render(<CallStripGroup />);
      show({ phase: 'live', canShare: true, mode: 'audio-only' });
      expect(button('Video Paused')).not.toBeNull();
      expect(button('Turn On Camera')).toBeNull();
      expect(button('Share Screen')).toBeNull();
      // The microphone carries on.
      expect(button('Mute')).not.toBeNull();
    });
  });

  // docs/specs/012-collaboration/video-and-screen-bubbles.md "Local preview".
  describe('a local preview', () => {
    const button = (name: string) => screen.queryByRole<HTMLButtonElement>('button', { name });
    const preview = { canPreviewCamera: true, canPreviewScreen: true };

    it('offers the camera and screen with no call, with no Join Audio', () => {
      render(<CallStripGroup />);
      show({ available: false, ...preview });
      expect(button('Join Audio')).toBeNull();
      expect(button('Connecting audio')).toBeNull();
      fireEvent.click(button('Turn On Camera')!);
      fireEvent.click(button('Share Screen')!);
      expect(actions.toggleCamera).toHaveBeenCalledTimes(1);
      expect(actions.toggleScreen).toHaveBeenCalledTimes(1);
      // A Viewer has none; nor does a browser that cannot capture.
      show({ available: false, canSpeak: false });
      expect(button('Turn On Camera')).toBeNull();
      show({ available: false, canSpeak: true, canPreviewCamera: false, canPreviewScreen: false });
      expect(button('Turn On Camera')).toBeNull();
    });

    it('says only you see a preview, in the strip and the Screen Share group', () => {
      render(<WithShare />);
      show({ available: false, ...preview, previewCamera: 'on', previewScreen: 'on' });
      expect(button('Turn Off Camera')!.getAttribute('aria-pressed')).toBe('true');
      expect(screen.getByRole('status').getAttribute('aria-label')).toBe(
        'Only you see your screen',
      );
      show({ previewCamera: 'starting', previewScreen: 'starting' });
      expect(button('Turn On Camera')!.disabled).toBe(true);
      expect(button('Share Screen')!.disabled).toBe(true);
    });

    it('sits beside Connecting and Calls Paused, and a Participant previews a screen in a call', () => {
      render(<WithShare />);
      show({ ...preview });
      expect(button('Connecting audio')).not.toBeNull();
      expect(button('Turn On Camera')).not.toBeNull();
      show({ ...preview, mode: 'off' });
      expect(button('Calls Paused')).not.toBeNull();
      expect(button('Turn On Camera')).not.toBeNull();
      // In a call, a Participant (no canShare) is offered the screen as a preview.
      show({ ...preview, mode: 'on', phase: 'live', canShare: false, previewScreen: 'on' });
      // The Screen Share group's alone.
      expect(screen.getAllByRole('button', { name: 'Stop Sharing' })).toHaveLength(1);
      expect(screen.getByRole('status').getAttribute('aria-label')).toBe(
        'Only you see your screen',
      );
    });
  });

  // docs/specs/012-collaboration/meeting-rooms-and-stage.md "Raise hand", "The stage line" and "Do Not Disturb".
  describe('the stage and Do Not Disturb', () => {
    const live = { phase: 'live', mic: 'open', someoneNear: true } as const;

    it('offers Raise Hand to the audience who may speak, never to a Viewer or with no stage live', () => {
      render(<CallStripGroup />);
      show({ ...live, stage: 'none' });
      expect(screen.queryByRole('button', { name: 'Raise Hand' })).toBeNull();
      show({ ...live, stage: 'audience' });
      fireEvent.click(screen.getByRole('button', { name: 'Raise Hand' }));
      expect(actions.raiseHand).toHaveBeenCalledTimes(1);
      show({ ...live, stage: 'audience', canSpeak: false });
      expect(screen.queryByRole('button', { name: 'Raise Hand' })).toBeNull();
    });

    it('reads Lower Hand while raised, and Speaking once let speak', () => {
      render(<CallStripGroup />);
      show({ ...live, stage: 'audience', hand: 'raised' });
      const lower = screen.getByRole('button', { name: 'Lower Hand' });
      expect(lower.getAttribute('aria-pressed')).toBe('true');
      fireEvent.click(lower);
      expect(actions.lowerHand).toHaveBeenCalledTimes(1);
      show({ ...live, stage: 'speaker', hand: 'speaking' });
      // In the brand's live tone, not the raised hand's amber.
      expect(screen.getByRole('button', { name: 'Lower Hand' }).className).toContain(
        'bg-brand-600',
      );
    });

    it('shows a speaker how many hands are up', () => {
      render(<CallStripGroup />);
      show({ ...live, stage: 'speaker', handsUp: 0 });
      expect(screen.queryByRole('button', { name: /raised hand/ })).toBeNull();
      show({ ...live, stage: 'speaker', handsUp: 1 });
      expect(screen.getByRole('button', { name: '1 raised hand' })).toBeTruthy();
      show({ ...live, stage: 'speaker', handsUp: 120 });
      expect(screen.getByRole('button', { name: '120 raised hands' }).textContent).toContain('99+');
    });

    it('says which stage bars you, over the group', () => {
      const { container } = render(<CallStripGroup />);
      const line = () => container.querySelector('[data-stage-line]')!;
      show({ ...live, barredBy: 'edit' });
      expect(line().textContent).toBe('Only Editors speak from this stage');
      show({ ...live, barredBy: 'take-part' });
      expect(line().textContent).toBe('Only Editors and Participants speak from this stage');
      show({ ...live, barredBy: null });
      expect(line().textContent).toBe('');
      expect(line().getAttribute('aria-live')).toBe('polite');
      // Hung over the group, which sits on the Call dock at the bottom of the canvas (under it would leave the screen).
      expect(line().className).toContain('bottom-full');
      expect(line().className).not.toContain('top-full');
    });

    it('shows Do Not Disturb in the strip, and a press clears it', () => {
      const clear = vi.fn();
      render(<CallStripGroup doNotDisturb onClearDoNotDisturb={clear} />);
      show(live);
      fireEvent.click(screen.getByRole('button', { name: 'Turn Off Do Not Disturb' }));
      expect(clear).toHaveBeenCalledTimes(1);
    });
  });
});

// docs/specs/008-canvas/avatar-mode.md "The Call dock": the group sits on the dock, bottom centre, as its buttons.
describe('the call group on the Call dock', () => {
  it('is one labelled group, with the tour anchor, followed by what the dock puts after it', () => {
    render(<CallStripGroup after={<span data-testid="after" />} />);
    show({});
    const group = screen.getByRole('group', { name: 'Call' });
    expect(group.getAttribute('data-tour-id')).toBe('call-button');
    expect(group.nextElementSibling?.getAttribute('data-testid')).toBe('after');
  });

  it('draws nothing after it, the divider included, while it draws nothing', () => {
    const { container } = render(<CallStripGroup after={<span data-testid="after" />} />);
    act(() => setCallActions(actions));
    act(() => setCallSelf({ available: false, canSpeak: false }));
    expect(container.innerHTML).toBe('');
  });

  // Owner, 2026-11-07: "On desktop add short labels to each, on mobile do not".
  const named = (ui = <CallStripGroup />) => (
    <CallNames.Provider value={true}>{ui}</CallNames.Provider>
  );

  it('names each button with a short label on a desktop', () => {
    render(named());
    show({ phase: 'live', mic: 'open', someoneNear: true, canShare: true });
    expect(screen.getByRole('button', { name: 'Mute' }).textContent).toBe('Mic');
    expect(screen.getByRole('button', { name: 'Turn On Camera' }).textContent).toBe('Camera');
    expect(screen.getByRole('button', { name: 'Share Screen' }).textContent).toBe('Share');
    show({ phase: 'off' });
    expect(screen.getByRole('button', { name: 'Connecting audio' }).textContent).toBe(
      'Connecting…',
    );
    show({ phase: 'error' });
    expect(screen.getByRole('button', { name: 'Retry Audio' }).textContent).toBe('Retry');
  });

  it('names the microphone by its state', () => {
    render(named());
    const mic = (label: string) => screen.getByRole('button', { name: label }).textContent;
    show({ phase: 'live', mic: 'open', someoneNear: false, muted: false });
    expect(mic('Mute')).toBe('Mic');
    show({ muted: true });
    expect(mic('Unmute')).toBe('Muted');
    show({ muted: false, mic: 'closed' });
    expect(mic('Mute')).toBe('Mic Off');
    show({ mic: 'blocked' });
    expect(mic('Mute')).toBe('Blocked');
    show({ canSpeak: false, mic: 'closed' });
    expect(mic('Listening')).toBe('Listening');
  });

  it('shows glyphs alone without names (a phone)', () => {
    render(<CallStripGroup />);
    show({ phase: 'live', mic: 'open', someoneNear: true, canShare: true });
    for (const name of ['Mute', 'Turn On Camera', 'Share Screen'])
      expect(screen.getByRole('button', { name }).textContent, name).toBe('');
  });

  it('names the camera and Share Screen by their state in the hover card', () => {
    render(<CallStripGroup />);
    show({ phase: 'live', mic: 'open', someoneNear: true, canShare: true, camera: 'on' });
    fireEvent.pointerEnter(screen.getByRole('button', { name: 'Turn Off Camera' }), {
      pointerType: 'mouse',
    });
    expect(document.body.textContent).toContain('Camera: On');
    fireEvent.pointerEnter(screen.getByRole('button', { name: 'Share Screen' }), {
      pointerType: 'mouse',
    });
    expect(document.body.textContent).toContain('Share Screen: Off');
    fireEvent.pointerEnter(screen.getByRole('button', { name: 'Mute' }), { pointerType: 'mouse' });
    expect(document.body.textContent).toContain('Mic: Live');
  });

  // Owner, 2026-11-06: "the same background as Say, rather than palette categories".
  it('is drawn as Say is, on the brand tint, and a live mic reads solid against it', () => {
    render(<CallStripGroup />);
    show({ phase: 'live', mic: 'open', someoneNear: false });
    const mic = screen.getByRole('button', { name: 'Mute' });
    for (const cls of ['h-9', 'rounded-md', 'bg-brand-50']) expect(mic.className).toContain(cls);
    expect(mic.className).not.toContain('h-11');
    expect(mic.className).not.toContain('border-l');
    show({ phase: 'live', mic: 'open', someoneNear: true });
    expect(screen.getByRole('button', { name: 'Mute' }).className).toContain('bg-brand-600');
  });
});

// The microphone's level meter (owner, 2026-11-07: "show my voice volume ... in the mic button as I speak").
describe('MicMeter', () => {
  const fill = (container: HTMLElement) =>
    container.querySelector<HTMLElement>('[data-mic-meter] > span')!;

  it('fills to the level, 0 to 4, clamped', () => {
    for (const [level, height] of [
      [0, '0%'],
      [1, '25%'],
      [2, '50%'],
      [4, '100%'],
      [9, '100%'],
      [-1, '0%'],
    ] as const) {
      const { container, unmount } = render(<MicMeter level={level} onSolid />);
      expect(container.querySelector('[data-mic-meter]')!.getAttribute('data-mic-meter')).toBe(
        String(level),
      );
      expect(fill(container).style.height).toBe(height);
      unmount();
    }
  });

  it('is white on a live mic, the brand tint otherwise', () => {
    const { container, rerender } = render(<MicMeter level={2} onSolid />);
    expect(fill(container).className).toContain('bg-white/30');
    rerender(<MicMeter level={2} onSolid={false} />);
    expect(fill(container).className).toContain('bg-brand-500/25');
  });

  it('shows in the microphone while it is open and unmuted, never while muted', () => {
    const { container } = render(<CallStripGroup />);
    const meter = () => container.querySelector<HTMLElement>('[data-mic-meter]');
    show({ phase: 'live', mic: 'open', someoneNear: true, level: 3 });
    expect(meter()!.getAttribute('data-mic-meter')).toBe('3');
    expect(meter()!.firstElementChild!.className).toContain('bg-white/30');
    show({ someoneNear: false, level: 1 });
    expect(meter()!.firstElementChild!.className).toContain('bg-brand-500/25');
    show({ muted: true });
    expect(meter()).toBeNull();
    show({ muted: false, mic: 'blocked' });
    expect(meter()).toBeNull();
  });
});

// docs/specs/012-collaboration/proximity-audio.md "No call here", "Local preview": walking with no call on offer, the
// microphone is a local preview only you see, with the camera and the screen.
describe('no call here', () => {
  const button = (name: string) => screen.queryByRole<HTMLButtonElement>('button', { name });
  const hover = (name: string) => {
    fireEvent.pointerEnter(button(name)!, { pointerType: 'mouse' });
    return document.body.textContent;
  };

  it('offers the microphone as a local preview, muted to start, and a press tries it', () => {
    render(<CallNames.Provider value={true}>{<CallStripGroup />}</CallNames.Provider>);
    show({ available: false, canPreviewMic: true });
    const mic = button('Unmute')!;
    expect(mic.getAttribute('aria-pressed')).toBe('true');
    expect(mic.textContent).toBe('Muted');
    expect(mic.className).toContain('rose');
    expect(hover('Unmute')).toContain('Mic: Muted');
    expect(document.body.textContent).toContain(PREVIEW_TEXT.micOff);
    fireEvent.click(mic);
    expect(actions.toggleMute).toHaveBeenCalledTimes(1);
    expect(actions.join).not.toHaveBeenCalled();
    expect(button('Join Audio')).toBeNull();
  });

  it('reads Starting, then Only You with its meter, then Blocked', () => {
    const { container } = render(
      <CallNames.Provider value={true}>{<CallStripGroup />}</CallNames.Provider>,
    );
    show({ available: false, canPreviewMic: true, previewMic: 'starting' });
    expect(button('Unmute')!.disabled).toBe(true);
    expect(button('Unmute')!.textContent).toBe('Starting…');
    show({
      available: false,
      canPreviewMic: true,
      canPreviewCamera: true,
      canPreviewScreen: true,
      previewMic: 'on',
      level: 2,
    });
    const on = button('Mute')!;
    expect(on.getAttribute('aria-pressed')).toBe('false');
    expect(on.textContent).toBe('Mic');
    expect(on.className).toContain('bg-brand-600');
    expect(container.querySelector('[data-mic-meter]')!.getAttribute('data-mic-meter')).toBe('2');
    expect(hover('Mute')).toContain('Mic: Only You');
    expect(document.body.textContent).toContain(PREVIEW_TEXT.micOn);
    show({
      available: false,
      canPreviewMic: true,
      canPreviewCamera: true,
      canPreviewScreen: true,
      previewMic: 'blocked',
    });
    expect(container.querySelector('[data-mic-meter]')).toBeNull();
    expect(button('Unmute')!.textContent).toBe('Blocked');
    expect(button('Unmute')!.className).toContain('amber');
    expect(hover('Unmute')).toContain('Mic: Blocked');
    expect(document.body.textContent).toContain(PREVIEW_TEXT.blocked);
  });

  it('offers a Viewer nothing, nor a browser that cannot capture', () => {
    const { container } = render(<CallStripGroup />);
    show({ available: false, canSpeak: false, canPreviewMic: true, canPreviewCamera: true });
    expect(container.innerHTML).toBe('');
    show({ available: false, canSpeak: true, canPreviewMic: false, canPreviewCamera: false });
    expect(container.innerHTML).toBe('');
  });

  it('sits before the camera and screen previews', () => {
    render(<CallStripGroup />);
    show({
      available: false,
      canPreviewMic: true,
      canPreviewCamera: true,
      canPreviewScreen: true,
    });
    const names = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'));
    expect(names).toEqual(['Unmute', 'Turn On Camera', 'Share Screen']);
  });

  it('keeps the preview microphone beside a retry and Calls Paused', () => {
    render(<CallStripGroup />);
    show({ phase: 'error', canPreviewMic: true });
    expect(button('Retry Audio')).not.toBeNull();
    expect(button('Unmute')).not.toBeNull();
    show({ phase: 'off', mode: 'off', canPreviewMic: true });
    expect(button('Calls Paused')).not.toBeNull();
    expect(button('Unmute')).not.toBeNull();
  });

  it('says only you see the camera and screen previews, in one short line', () => {
    render(<CallStripGroup />);
    show({ available: false, canPreviewCamera: true, canPreviewScreen: true });
    expect(hover('Turn On Camera')).toContain('Camera: Off');
    expect(document.body.textContent).toContain(PREVIEW_TEXT.cameraOff);
    expect(hover('Share Screen')).toContain(PREVIEW_TEXT.screenOff);
    show({
      available: false,
      canPreviewMic: true,
      canPreviewCamera: true,
      canPreviewScreen: true,
      previewCamera: 'on',
    });
    expect(hover('Turn Off Camera')).toContain('Camera: Only You');
    expect(document.body.textContent).toContain(PREVIEW_TEXT.cameraOn);
    show({
      available: false,
      canPreviewMic: true,
      canPreviewCamera: true,
      canPreviewScreen: true,
      previewCamera: 'blocked',
    });
    expect(hover('Turn On Camera')).toContain('Camera: Blocked');
  });

  it('a Participant in a call previews a screen, told the link cannot share', () => {
    render(<CallStripGroup />);
    show({ phase: 'live', mic: 'open', canShare: false, canPreviewScreen: true });
    expect(hover('Share Screen')).toContain(PREVIEW_TEXT.noShare);
  });
});

// A segment runs its press, and names itself only while the dock names its buttons.
describe('Segment', () => {
  it('runs its press, and shows its name only under CallNames', () => {
    const onClick = vi.fn();
    const segment = (
      <Segment
        label="Mute"
        name="Mic"
        title="Mic: Live"
        description="Why"
        icon={null}
        onClick={onClick}
      />
    );
    const { rerender } = render(segment);
    const button = screen.getByRole('button', { name: 'Mute' });
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(button.className).toContain('cursor-pointer');
    expect(button.textContent).toBe('');
    rerender(<CallNames.Provider value={true}>{segment}</CallNames.Provider>);
    expect(screen.getByRole('button', { name: 'Mute' }).textContent).toBe('Mic');
  });

  it('reads as a plain mark with no press', () => {
    render(
      <Segment label="Video Paused" name="Video Paused" title="t" description="d" icon={null} />,
    );
    expect(screen.getByRole('button', { name: 'Video Paused' }).className).toContain(
      'cursor-default',
    );
  });
});
