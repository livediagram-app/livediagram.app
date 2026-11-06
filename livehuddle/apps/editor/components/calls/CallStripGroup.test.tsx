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
  CALLS_PAUSED_ANNOUNCEMENT,
  CallStripGroup,
  NO_CALL_REASON,
  callGroupShape,
  micIndicator,
} from './CallStripGroup';
import { CallNames, Segment } from './CallSegment';
import { ScreenShareStripGroup } from './ScreenShareStripGroup';

// The call group and, while you share, the Screen Share group beside it, as the avatar palette draws them.
const WithShare = () => (
  <>
    <CallStripGroup />
    <ScreenShareStripGroup />
  </>
);

const actions = {
  join: vi.fn(),
  leave: vi.fn(),
  toggleMute: vi.fn(),
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

  it('offers Join Audio to a speaker and Listen In to a Viewer', () => {
    render(<CallStripGroup />);
    show({});
    fireEvent.click(screen.getByRole('button', { name: 'Join Audio' }));
    expect(actions.join).toHaveBeenCalledTimes(1);
    show({ canSpeak: false });
    expect(screen.getByRole('button', { name: 'Listen In' })).toBeTruthy();
  });

  it('waits while joining and offers a retry after a failure', () => {
    render(<CallStripGroup />);
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
    const { container } = render(<CallStripGroup />);
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
    fireEvent.click(screen.getByRole('button', { name: 'Leave Audio' }));
    expect(actions.leave).toHaveBeenCalledTimes(1);
  });

  it('a blocked microphone and a listener have nothing to mute', () => {
    render(<CallStripGroup />);
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

    it('offers the camera and screen with no call, alone with the help link', () => {
      render(<CallStripGroup />);
      show({ available: false, ...preview });
      expect(button('Join Audio')).toBeNull();
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

    it('sits beside Join Audio and Calls Paused, and a Participant previews a screen in a call', () => {
      render(<WithShare />);
      show({ ...preview });
      expect(button('Join Audio')).not.toBeNull();
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

    it('says which stage bars you, under the group', () => {
      const { container } = render(<CallStripGroup />);
      const line = () => container.querySelector('[data-stage-line]')!;
      show({ ...live, barredBy: 'edit' });
      expect(line().textContent).toBe('Only Editors speak from this stage');
      show({ ...live, barredBy: 'take-part' });
      expect(line().textContent).toBe('Only Editors and Participants speak from this stage');
      show({ ...live, barredBy: null });
      expect(line().textContent).toBe('');
      expect(line().getAttribute('aria-live')).toBe('polite');
      // Hung under the group, at the top of the canvas, not above it (it would leave the screen).
      expect(line().className).toContain('top-full');
      expect(line().className).not.toContain('bottom-full');
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

// docs/specs/008-canvas/avatar-mode.md "The avatar palette": the group sits at the left of the strip, as its buttons.
describe('the call group on the strip', () => {
  it('is one labelled group, with the tour anchor, followed by what the strip puts after it', () => {
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

  // Owner, 2026-11-06: "camera and share don't need labels, same with audio". Their name and state ride the hover
  // card and the label; Leave keeps its name.
  it('shows Join Audio, the microphone, the camera and Share as glyphs alone, even while the strip shows names', () => {
    const { rerender } = render(<CallStripGroup />);
    show({ canPreviewCamera: true, canPreviewScreen: true });
    rerender(
      <CallNames.Provider value={true}>
        <CallStripGroup />
      </CallNames.Provider>,
    );
    for (const name of ['Join Audio', 'Turn On Camera', 'Share Screen'])
      expect(screen.getByRole('button', { name }).textContent, name).toBe('');
    show({ phase: 'live', mic: 'open', someoneNear: true, canShare: true });
    for (const name of ['Mute', 'Turn On Camera', 'Share Screen'])
      expect(screen.getByRole('button', { name }).textContent, name).toBe('');
    expect(screen.getByRole('button', { name: 'Leave Audio' }).textContent).toBe('Leave');
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
    show({});
    const join = screen.getByRole('button', { name: 'Join Audio' });
    for (const cls of ['h-9', 'rounded-md', 'bg-brand-50']) expect(join.className).toContain(cls);
    expect(join.className).not.toContain('h-11');
    expect(join.className).not.toContain('border-l');
    show({ phase: 'live', mic: 'open', someoneNear: true });
    expect(screen.getByRole('button', { name: 'Mute' }).className).toContain('bg-brand-600');
  });
});

// docs/specs/012-collaboration/proximity-audio.md "No call here": walking with no call on offer, Join Audio stays,
// greyed with why, rather than vanishing.
describe('no call here', () => {
  const joinAudio = () => screen.getByRole('button', { name: 'Join Audio' });

  it('greys Join Audio in a Space kept in This Browser, and a press joins nothing', () => {
    render(<CallStripGroup />);
    show({ available: false, unavailableReason: 'unsynced' });
    expect(joinAudio().getAttribute('aria-disabled')).toBe('true');
    // aria-disabled, not disabled, so the hover card still says why.
    expect((joinAudio() as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(joinAudio());
    expect(actions.join).not.toHaveBeenCalled();
    fireEvent.pointerEnter(joinAudio(), { pointerType: 'mouse' });
    expect(document.body.textContent).toContain(NO_CALL_REASON.unsynced);
  });

  it('says calls are off on this server', () => {
    render(<CallStripGroup />);
    show({ available: false, unavailableReason: 'off' });
    expect(joinAudio().getAttribute('aria-disabled')).toBe('true');
    fireEvent.pointerEnter(joinAudio(), { pointerType: 'mouse' });
    expect(document.body.textContent).toContain(NO_CALL_REASON.off);
  });

  it('reads the two reasons as the spec words them', () => {
    expect(NO_CALL_REASON).toEqual({
      unsynced:
        'This space is only saved in your browser, so nobody else can join. Save it online to talk with people.',
      off: 'Calls are not available on this server.',
    });
  });

  it('offers a Viewer nothing to grey', () => {
    const { container } = render(<CallStripGroup />);
    show({ available: false, canSpeak: false, unavailableReason: 'unsynced' });
    expect(screen.queryByRole('button', { name: 'Join Audio' })).toBeNull();
    expect(container.innerHTML).toBe('');
  });

  it('sits before a local preview', () => {
    render(<CallStripGroup />);
    show({
      available: false,
      unavailableReason: 'unsynced',
      canPreviewCamera: true,
      canPreviewScreen: true,
    });
    const names = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'));
    expect(names).toEqual(['Join Audio', 'Turn On Camera', 'Share Screen']);
  });
});

// A greyed segment (CallSegment's `unavailable`) never runs its press.
describe('Segment unavailable', () => {
  it('calls no onClick, and is aria-disabled', () => {
    const onClick = vi.fn();
    render(
      <Segment
        label="Join Audio"
        name="Join Audio"
        title="Join Audio"
        description="Why"
        icon={null}
        onClick={onClick}
        unavailable
      />,
    );
    const button = screen.getByRole('button', { name: 'Join Audio' });
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
    expect(button.getAttribute('aria-disabled')).toBe('true');
  });

  it('runs its press when available', () => {
    const onClick = vi.fn();
    render(
      <Segment
        label="Join Audio"
        name="Join Audio"
        title="Join Audio"
        description="Why"
        icon={null}
        onClick={onClick}
      />,
    );
    const button = screen.getByRole('button', { name: 'Join Audio' });
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(button.getAttribute('aria-disabled')).toBeNull();
  });
});

describe('callGroupShape', () => {
  const self = (patch: Partial<CallSelf>) => ({
    ...callSelf(),
    available: true,
    canSpeak: true,
    ...patch,
  });
  it('changes when the group gains or loses a button', () => {
    const before = callGroupShape(self({}), false);
    expect(callGroupShape(self({ phase: 'live' }), false)).not.toBe(before);
    expect(callGroupShape(self({ phase: 'live' }), true)).not.toBe(
      callGroupShape(self({ phase: 'live' }), false),
    );
    expect(callGroupShape(self({ phase: 'live', hand: 'raised' }), false)).not.toBe(
      callGroupShape(self({ phase: 'live' }), false),
    );
  });

  it('changes with why there is no call, for a speaker alone', () => {
    const none = (patch: Partial<CallSelf>) => self({ available: false, ...patch });
    const unsynced = callGroupShape(none({ unavailableReason: 'unsynced' }), false);
    const off = callGroupShape(none({ unavailableReason: 'off' }), false);
    const nothing = callGroupShape(none({ unavailableReason: null }), false);
    expect(new Set([unsynced, off, nothing]).size).toBe(3);
    // A Viewer has no Join Audio to grey, so the reason changes nothing for them.
    expect(callGroupShape(none({ canSpeak: false, unavailableReason: 'unsynced' }), false)).toBe(
      callGroupShape(none({ canSpeak: false, unavailableReason: 'off' }), false),
    );
  });

  it('holds still as the microphone changes state on a walk', () => {
    const a = callGroupShape(self({ phase: 'live', someoneNear: true, level: 3 }), false);
    const b = callGroupShape(
      self({ phase: 'live', someoneNear: false, level: 0, muted: true }),
      false,
    );
    expect(a).toBe(b);
  });
});
