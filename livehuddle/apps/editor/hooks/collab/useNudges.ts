'use client';

// Nudge (docs/specs/012-collaboration/nudge.md; blueprint blueprints/nudge.md): sending from the Collaborators list,
// and being nudged: the chime, the "Sam nudged you" toast with Go to Sam, the desktop notification while the tab is
// hidden, and the one-time offer to turn those notifications on. Composed once in useEditorState.

import { useCallback, useEffect } from 'react';
import { nudgeCountdown } from '@livehuddle/api-schema';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { useToast } from '@/hooks/ui/useToast';
import type { Participant } from '@/lib/identity';
import {
  askNotificationPermission,
  notificationPermission,
  showNudgeNotification,
} from '@/lib/nudge/desktop-notify';
import { playNudgeChime } from '@/lib/nudge/nudge-chime';
import {
  holdNudgeCooldown,
  onNudge,
  sendNudge,
  setNudgeSender,
  type NudgeTarget,
} from '@/lib/nudge/nudge-inbox';
import type { PeerMotion } from '@/lib/peer-motion';
import { quietForDoNotDisturb } from '@/lib/sounds/quiet';
import { track } from '@/lib/telemetry';
import { readUserPreferences, writeUserPreferences } from '@/lib/user-preferences';

type Point = { x: number; y: number };

export const NUDGE_OFFER_MESSAGE =
  'Get a desktop notification when someone nudges you while this tab is in the background?';

/** The toast a nudge shows its target. */
export function nudgedMessage(name: string): string {
  return `${name} nudged you`;
}

/** The desktop notification's title: who, and in which Space. */
export function nudgeNotificationTitle(name: string, space: string | null | undefined): string {
  const where = space?.trim();
  return where ? `${name} nudged you in ${where}` : `${name} nudged you`;
}

/** Someone's name from the roster, or "Someone". */
function nameOf(presence: readonly Participant[], id: string): string {
  return presence.find((p) => p.id === id)?.name?.trim() || 'Someone';
}

/** Where to look for someone: their character while they walk, else their cursor, on the tab they are on. */
export function whereIs(
  id: string,
  motion: PeerMotion,
  tabFocus: ReadonlyMap<string, string>,
): { tabId: string | null; at: Point | null } {
  const avatar = motion.avatars.get().get(id);
  if (avatar) return { tabId: avatar.tabId, at: { x: avatar.avatar.x, y: avatar.avatar.y } };
  const cursor = motion.cursors.get().get(id);
  if (cursor) return { tabId: cursor.tabId, at: { x: cursor.x, y: cursor.y } };
  return { tabId: tabFocus.get(id) ?? null, at: null };
}

export type NudgesDeps = {
  /** Sends one op through the room; absent while there is no room. */
  send: ((targetId: string) => void) | null;
  /** Whether this session may nudge: an Editor's or a Participant's (`can.takePart`). */
  canNudge: boolean;
  livePresence: readonly Participant[];
  peerMotion: PeerMotion;
  remoteTabFocus: ReadonlyMap<string, string>;
  activeId: string;
  setActiveId: (tabId: string) => void;
  centreOn: (at: Point) => void;
  documentName: string | null | undefined;
  ownerId: string | null;
};

export function useNudges(deps: NudgesDeps) {
  const toast = useToast();
  const latest = useLatest({ ...deps, toast });
  const { send, canNudge } = deps;

  useEffect(() => {
    if (!send || !canNudge) return;
    setNudgeSender(send);
    return () => setNudgeSender(null);
  }, [send, canNudge]);

  const goTo = useCallback(
    (id: string) => {
      const now = latest.current;
      const { tabId, at } = whereIs(id, now.peerMotion, now.remoteTabFocus);
      if (tabId && tabId !== now.activeId) now.setActiveId(tabId);
      if (at) now.centreOn(at);
      track('Canvas', 'Used', 'NudgeGoTo');
    },
    [latest],
  );

  // The one-time offer: the first nudge either way, while the browser has not been asked.
  const offerNotifications = useCallback(() => {
    const prefs = readUserPreferences();
    if (prefs.desktopNotificationsOffered === true) return;
    if (notificationPermission() !== 'default') return;
    const { ownerId } = latest.current;
    const answer = (patch: { desktopNotifications?: boolean }) =>
      writeUserPreferences(
        { ...readUserPreferences(), ...patch, desktopNotificationsOffered: true },
        ownerId,
      );
    latest.current.toast.offer({
      message: NUDGE_OFFER_MESSAGE,
      confirmLabel: 'Turn On',
      declineLabel: 'Not Now',
      onConfirm: () => {
        void askNotificationPermission().then((granted) =>
          answer(granted === 'granted' ? { desktopNotifications: true } : {}),
        );
      },
      onDecline: () => answer({}),
    });
  }, [latest]);

  useEffect(
    () =>
      onNudge((event) => {
        const now = latest.current;
        if (event.kind === 'refused') {
          const target = now.livePresence.find((p) => p.id === event.op.targetId);
          holdNudgeCooldown(target ?? { id: event.op.targetId }, event.op.retryInMs);
          now.toast.info(
            `You nudged ${target?.name ?? 'them'} recently. Try again in ${nudgeCountdown(event.op.retryInMs)}.`,
          );
          return;
        }
        const name = nameOf(now.livePresence, event.from);
        const quiet = quietForDoNotDisturb();
        if (!quiet) playNudgeChime();
        now.toast.action({
          key: `nudge:${event.from}`,
          message: nudgedMessage(name),
          actions: [
            {
              label: `Go to ${name}`,
              ariaLabel: `Go to ${name}`,
              onSelect: () => goTo(event.from),
            },
          ],
          important: true,
        });
        const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
        if (hidden && !quiet && readUserPreferences().desktopNotifications !== false) {
          showNudgeNotification({
            title: nudgeNotificationTitle(name, now.documentName),
            body: 'Click to go to them.',
            tag: `nudge:${event.from}`,
            onClick: () => goTo(event.from),
          });
        }
        offerNotifications();
      }),
    [latest, goTo, offerNotifications],
  );

  /** Nudge one person from Collaborators: sent once per 2 minutes per person. */
  const nudge = useCallback(
    (target: NudgeTarget) => {
      if (!latest.current.canNudge) return;
      if (!sendNudge(target)) return;
      track('Canvas', 'Used', 'Nudge');
      latest.current.toast.info(`Nudged ${target.name}`);
      offerNotifications();
    },
    [latest, offerNotifications],
  );

  return { nudge, canNudge };
}
