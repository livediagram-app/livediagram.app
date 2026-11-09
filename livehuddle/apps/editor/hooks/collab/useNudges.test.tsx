// @vitest-environment jsdom

// Nudge (docs/specs/012-collaboration/nudge.md "Nudging", "Being nudged", "Desktop Notifications", "Share roles";
// blueprint "Testing").
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ToastActionSpec, ToastOffer } from '@/hooks/ui/useToast';
import type { Participant } from '@/lib/identity';
import { createPeerMotion } from '@/lib/peer-motion';
import { receiveNudgeOp, resetNudges } from '@/lib/nudge/nudge-inbox';
import { setQuietForDoNotDisturb } from '@/lib/sounds/quiet';
import {
  nudgedMessage,
  nudgeNotificationTitle,
  NUDGE_OFFER_MESSAGE,
  useNudges,
  whereIs,
  type NudgesDeps,
} from './useNudges';

const toast = vi.hoisted(() => ({
  info: vi.fn(),
  action: vi.fn(),
  offer: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  dismissAction: vi.fn(),
}));
vi.mock('@/hooks/ui/useToast', () => ({ useToast: () => toast }));
const chime = vi.hoisted(() => vi.fn());
vi.mock('@/lib/nudge/nudge-chime', () => ({ playNudgeChime: chime }));
const tracked = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track: tracked }));
const prefs = vi.hoisted(() => ({ value: {} as Record<string, unknown>, writes: [] as unknown[] }));
vi.mock('@/lib/user-preferences', () => ({
  readUserPreferences: () => prefs.value,
  writeUserPreferences: (next: Record<string, unknown>) => {
    prefs.value = next;
    prefs.writes.push(next);
  },
}));

type Shown = {
  title: string;
  options: { body: string; tag: string };
  onclick: null | (() => void);
};
class FakeNotification {
  static permission: NotificationPermission = 'default';
  static shown: Shown[] = [];
  static answer: NotificationPermission = 'granted';
  static requestPermission = vi.fn(() => Promise.resolve(FakeNotification.answer));
  onclick: null | (() => void) = null;
  close = vi.fn();
  constructor(title: string, options: { body: string; tag: string }) {
    FakeNotification.shown.push(this as unknown as Shown);
    Object.assign(this, { title, options });
  }
}

const sam: Participant = { id: 's1', key: 'k-sam', name: 'Sam', color: '#000', status: 'online' };

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => (hidden ? 'hidden' : 'visible'),
  });
}

function mount(over: Partial<NudgesDeps> = {}) {
  const send = vi.fn();
  const deps: NudgesDeps = {
    send,
    canNudge: true,
    livePresence: [sam],
    peerMotion: createPeerMotion(),
    remoteTabFocus: new Map([['s1', 't2']]),
    activeId: 't1',
    setActiveId: vi.fn(),
    centreOn: vi.fn(),
    documentName: 'Weekly Standup',
    ownerId: 'guest_1',
    ...over,
  };
  const hook = renderHook((d: NudgesDeps) => useNudges(d), { initialProps: deps });
  return { ...hook, deps, send };
}

beforeEach(() => {
  resetNudges();
  vi.clearAllMocks();
  prefs.value = {};
  prefs.writes = [];
  setQuietForDoNotDisturb(false);
  setHidden(false);
  FakeNotification.permission = 'default';
  FakeNotification.shown = [];
  FakeNotification.answer = 'granted';
  (window as unknown as { Notification?: unknown }).Notification = FakeNotification;
});
afterEach(() => {
  cleanup();
  delete (window as unknown as { Notification?: unknown }).Notification;
});

describe('useNudges: sending', () => {
  it('sends to the person once per 2 minutes, says so and counts it', () => {
    const { result, send } = mount();
    act(() => result.current.nudge({ id: 's1', key: 'k-sam', name: 'Sam' }));
    act(() => result.current.nudge({ id: 's1', key: 'k-sam', name: 'Sam' }));
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith('s1');
    expect(toast.info).toHaveBeenCalledWith('Nudged Sam');
    expect(tracked).toHaveBeenCalledWith('Canvas', 'Used', 'Nudge');
  });

  it('sends nothing for a Viewer (can.takePart false)', () => {
    const { result, send } = mount({ canNudge: false });
    act(() => result.current.nudge({ id: 's1', name: 'Sam' }));
    expect(send).not.toHaveBeenCalled();
    expect(result.current.canNudge).toBe(false);
  });

  it('takes the room refusal: cooldown held, the sender told how long is left', () => {
    mount();
    act(() => receiveNudgeOp('s1', { kind: 'nudge-refused', targetId: 's1', retryInMs: 102_000 }));
    expect(toast.info).toHaveBeenCalledWith('You nudged Sam recently. Try again in 1:42.');
  });

  it('words a refusal for someone who has since left', () => {
    mount();
    act(() =>
      receiveNudgeOp('gone', { kind: 'nudge-refused', targetId: 'gone', retryInMs: 5_000 }),
    );
    expect(toast.info).toHaveBeenCalledWith('You nudged them recently. Try again in 0:05.');
  });
});

describe('useNudges: being nudged', () => {
  it('plays the chime and shows the toast with Go to, which moves to their tab and centres on them', () => {
    const peerMotion = createPeerMotion();
    peerMotion.avatars.set(
      new Map([['s1', { tabId: 't2', avatar: { x: 40, y: 80, facing: 'down' } as never }]]),
    );
    const { deps } = mount({ peerMotion });
    act(() => receiveNudgeOp('s1', { kind: 'nudge', targetId: 'me' }));
    expect(chime).toHaveBeenCalledTimes(1);
    const spec = toast.action.mock.calls[0]![0] as ToastActionSpec;
    expect(spec).toMatchObject({ key: 'nudge:s1', message: 'Sam nudged you', important: true });
    act(() => spec.actions[0]!.onSelect());
    expect(deps.setActiveId).toHaveBeenCalledWith('t2');
    expect(deps.centreOn).toHaveBeenCalledWith({ x: 40, y: 80 });
    expect(tracked).toHaveBeenCalledWith('Canvas', 'Used', 'NudgeGoTo');
  });

  it('notifies the desktop only while hidden and granted, and the click goes to them', () => {
    FakeNotification.permission = 'granted';
    const { deps } = mount();
    act(() => receiveNudgeOp('s1', { kind: 'nudge', targetId: 'me' }));
    expect(FakeNotification.shown).toHaveLength(0);
    setHidden(true);
    const focus = vi.spyOn(window, 'focus').mockImplementation(() => {});
    act(() => receiveNudgeOp('s1', { kind: 'nudge', targetId: 'me' }));
    expect(FakeNotification.shown).toHaveLength(1);
    const shown = FakeNotification.shown[0]!;
    expect(shown.title).toBe('Sam nudged you in Weekly Standup');
    expect(shown.options).toEqual({ body: 'Click to go to them.', tag: 'nudge:s1' });
    act(() => shown.onclick!());
    expect(focus).toHaveBeenCalled();
    expect(deps.setActiveId).toHaveBeenCalledWith('t2');
  });

  it.each(['denied', 'default'] as const)(
    'shows no notification with permission %s, the sound and toast still work',
    (permission) => {
      FakeNotification.permission = permission;
      prefs.value = { desktopNotificationsOffered: true };
      setHidden(true);
      mount();
      act(() => receiveNudgeOp('s1', { kind: 'nudge', targetId: 'me' }));
      expect(FakeNotification.shown).toHaveLength(0);
      expect(chime).toHaveBeenCalledTimes(1);
      expect(toast.action).toHaveBeenCalledTimes(1);
    },
  );

  it('shows no notification with Desktop Notifications off', () => {
    FakeNotification.permission = 'granted';
    prefs.value = { desktopNotifications: false };
    setHidden(true);
    mount();
    act(() => receiveNudgeOp('s1', { kind: 'nudge', targetId: 'me' }));
    expect(FakeNotification.shown).toHaveLength(0);
  });

  it('is silent with no notification on Do Not Disturb, the toast still shown', () => {
    FakeNotification.permission = 'granted';
    setQuietForDoNotDisturb(true);
    setHidden(true);
    mount();
    act(() => receiveNudgeOp('s1', { kind: 'nudge', targetId: 'me' }));
    expect(chime).not.toHaveBeenCalled();
    expect(FakeNotification.shown).toHaveLength(0);
    expect(toast.action).toHaveBeenCalledTimes(1);
  });

  it.each(['edit', 'participate', 'view'] as const)(
    'a %s session is nudged like anyone',
    (level) => {
      mount({ canNudge: level !== 'view' });
      act(() => receiveNudgeOp('s1', { kind: 'nudge', targetId: 'me' }));
      expect(chime).toHaveBeenCalledTimes(1);
      expect(toast.action).toHaveBeenCalledTimes(1);
    },
  );

  it('names an unknown sender Someone', () => {
    mount({ livePresence: [] });
    act(() => receiveNudgeOp('s5', { kind: 'nudge', targetId: 'me' }));
    expect((toast.action.mock.calls[0]![0] as ToastActionSpec).message).toBe('Someone nudged you');
  });
});

describe('useNudges: the one-time offer', () => {
  it('offers once while the browser has not been asked; Turn On asks and turns it on', async () => {
    const { result } = mount();
    act(() => result.current.nudge({ id: 's1', key: 'k-sam', name: 'Sam' }));
    expect(toast.offer).toHaveBeenCalledTimes(1);
    const offer = toast.offer.mock.calls[0]![0] as ToastOffer;
    expect(offer.message).toBe(NUDGE_OFFER_MESSAGE);
    await act(async () => {
      offer.onConfirm();
      await Promise.resolve();
    });
    expect(FakeNotification.requestPermission).toHaveBeenCalled();
    expect(prefs.value).toEqual({ desktopNotifications: true, desktopNotificationsOffered: true });
    act(() => receiveNudgeOp('s1', { kind: 'nudge', targetId: 'me' }));
    expect(toast.offer).toHaveBeenCalledTimes(1);
  });

  it('Not Now is remembered; a refused prompt leaves it off', async () => {
    mount();
    act(() => receiveNudgeOp('s1', { kind: 'nudge', targetId: 'me' }));
    (toast.offer.mock.calls[0]![0] as ToastOffer).onDecline();
    expect(prefs.value).toEqual({ desktopNotificationsOffered: true });
    prefs.value = {};
    FakeNotification.answer = 'denied';
    act(() => receiveNudgeOp('s1', { kind: 'nudge', targetId: 'me' }));
    await act(async () => {
      (toast.offer.mock.calls[1]![0] as ToastOffer).onConfirm();
      await Promise.resolve();
    });
    expect(prefs.value).toEqual({ desktopNotificationsOffered: true });
  });

  it('never offers once permission is decided, or without the API', () => {
    FakeNotification.permission = 'granted';
    mount();
    act(() => receiveNudgeOp('s1', { kind: 'nudge', targetId: 'me' }));
    delete (window as unknown as { Notification?: unknown }).Notification;
    act(() => receiveNudgeOp('s1', { kind: 'nudge', targetId: 'me' }));
    expect(toast.offer).not.toHaveBeenCalled();
  });
});

describe('helpers', () => {
  it('words the toast and the notification', () => {
    expect(nudgedMessage('Sam')).toBe('Sam nudged you');
    expect(nudgeNotificationTitle('Sam', '  ')).toBe('Sam nudged you');
    expect(nudgeNotificationTitle('Sam', 'Standup')).toBe('Sam nudged you in Standup');
  });

  it('finds someone by character, then cursor, then tab', () => {
    const motion = createPeerMotion();
    const focus = new Map([['a', 't3']]);
    expect(whereIs('a', motion, focus)).toEqual({ tabId: 't3', at: null });
    motion.cursors.set(new Map([['a', { tabId: 't4', x: 1, y: 2 }]]));
    expect(whereIs('a', motion, focus)).toEqual({ tabId: 't4', at: { x: 1, y: 2 } });
    expect(whereIs('b', motion, focus)).toEqual({ tabId: null, at: null });
  });

  it('goes nowhere it does not know', () => {
    const { deps } = mount({ remoteTabFocus: new Map(), activeId: 't1' });
    act(() => receiveNudgeOp('s1', { kind: 'nudge', targetId: 'me' }));
    act(() => (toast.action.mock.calls[0]![0] as ToastActionSpec).actions[0]!.onSelect());
    expect(deps.setActiveId).not.toHaveBeenCalled();
    expect(deps.centreOn).not.toHaveBeenCalled();
  });
});
