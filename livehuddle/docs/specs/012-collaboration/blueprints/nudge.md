# Nudge blueprint

Derived from [Nudge](../nudge.md).

## Files

| File                                                                                              | Role                                                                                                  |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `packages/api-schema/src/nudge.ts`                                                                | `NudgeOp`, `NudgeRefusedOp`, `parseNudge`, `NUDGE_COOLDOWN_MS`, `createNudgeLedger`, `nudgeCountdown` |
| `packages/api-schema/src/room-messages.ts`                                                        | `nudge` in `PRESENCE_OP_KINDS`, `nudge-refused` in `SYSTEM_OP_KINDS`, both in `RoomOp`                |
| `apps/api/src/room-op-gate.ts`                                                                    | Parses `nudge`; drops a Viewer's and a malformed one                                                  |
| `apps/api/src/room-nudge.ts`                                                                      | `nudgeIdentity`, `decideNudge`: self, absent target, cooldown                                         |
| `apps/api/src/document-room/document-room.ts`, `apps/api/src/document-room/room-call-sessions.ts` | Holds the ledger, addresses the nudge (`sendToPresence`) or answers `nudge-refused` to the sender     |
| `apps/editor/lib/nudge/nudge-inbox.ts`                                                            | Received ops fanned out; the sender (`setNudgeSender`); the per-person cooldown store and its hook    |
| `apps/editor/lib/nudge/desktop-notify.ts`                                                         | `notificationPermission`, `askNotificationPermission`, `showNudgeNotification`                        |
| `apps/editor/hooks/collab/useNudges.ts`                                                           | Sends, hears (sound, toast, notification), Go to, the one-time offer                                  |
| `apps/editor/components/dialogs/NudgeButton.tsx`                                                  | The row's button with its countdown tooltip                                                           |
| `apps/editor/components/dialogs/CollaboratorsDialog.tsx`                                          | Renders `NudgeButton` beside Follow for other people when `mayNudge(selfRole)`                        |
| `apps/editor/components/dialogs/settings/SettingsDesktopNotificationsRow.tsx`                     | The Desktop Notifications switch over preference and permission                                       |
| `apps/editor/lib/sounds/audio.ts`                                                                 | The nudge chime plays through the one context ([Join and leave sounds](join-and-leave-sounds.md))     |

## Domain and naming

- **Sender** and **target** are presence ids on the wire. **Identity** (the ledger's) is
  `personTag ?? presence.key ?? presenceId` on the server and `key ?? id` on the client.
- **Cooldown**: `NUDGE_COOLDOWN_MS` from the moment a nudge passed.

## Behaviour and state

Sender:

1. Nudge pressed: `nudgePerson({ id, key, name })`. If the client store says the identity is cooling, nothing is
   sent. Else the store notes `now`, `send({ kind: 'op', op: { kind: 'nudge', targetId: id } })`, an info toast
   "Nudged Sam", `Canvas · Used · Nudge`, then the one-time offer (below).
2. The room: gate (Viewer and malformed dropped) → `decideNudge` → `deliver` (`sendToPresence(targetId, op)`),
   `refuse` (`sendTo(ws, { kind: 'op', from: targetId, op: { kind: 'nudge-refused', targetId, retryInMs } })`) or
   `drop` (self, absent target).
3. `nudge-refused` received: the store sets that target's cooldown so `retryInMs` remain; an info toast "You nudged
   Sam recently. Try again in 1:42.".

Recipient (`nudge` received, `from` = sender presence id):

1. The sender's row from the roster gives the name ("Someone" when missing).
2. Unless Do Not Disturb: `playNudgeChime()`.
3. Action toast `{ key: 'nudge:' + from, message: 'Sam nudged you', actions: [Go to Sam], important: true }`.
4. If `document.visibilityState === 'hidden'`, not Do Not Disturb, `desktopNotifications !== false` and permission is
   `granted`: `new Notification('Sam nudged you in <Space>', { body: 'Click to go to them.', tag: 'nudge:' + from })`;
   `onclick`: `window.focus()`, Go to, `close()`.
5. The one-time offer.

Go to Sam: their tab from `remoteTabFocus` (switch if it differs); their point from `peerMotion.avatars` (walking)
else `peerMotion.cursors`; `centreOn(point)` when known. `Canvas · Used · NudgeGoTo`.

One-time offer: when `Notification` exists, permission is `default` and `desktopNotificationsOffered !== true`: an
offer toast; either answer writes `desktopNotificationsOffered: true`; Turn On asks the browser and, granted, writes
`desktopNotifications: true`.

## Interfaces and contracts

- `parseNudge(op)`: `{ kind: 'nudge', targetId }` with `targetId` a non-empty string of at most `PRESENCE_ID_MAX`,
  else null.
- `createNudgeLedger(windowMs)`: `check(sender, target, now)` returns `{ ok: true }` (and notes it) or
  `{ ok: false, retryInMs }`; prunes entries at least `windowMs` old whenever it holds more than 256.
- `nudgeCountdown(ms)`: `m:ss`, rounded up to the second ("1:42", "0:05").

## Data and persistence

- Preferences: `desktopNotifications?: boolean` (missing means on), `desktopNotificationsOffered?: boolean`.
- Nothing about a nudge is stored; the ledgers (room and client) are memory only.

## Errors and edge cases

- Target left between press and delivery: the room drops it; the sender's button still cools (it was sent).
- Room down: `send` queues in the outbox as every op does; the cooldown still starts.
- `Notification` constructor throws (some mobile browsers): caught, nothing shown; the toast stands.
- Permission revoked after it was on: the switch reads off with the blocked notice; nothing is shown.
- A setting changed while the browser's permission prompt is open: the switch's write is rebased onto the freshest
  preferences (`rebaseUserPreferences`), so the other change survives.

## Security and trust

- Only the target's socket receives a nudge; no bystander learns who nudged whom.
- The room's ledger is the rule; the client store is presentation. A client rotating its claimed key can only nudge
  again after reconnecting (a ticket mint), and a verified account's person tag cannot be rotated.
- A Viewer's nudge is dropped at the gate. `nudge-refused` from a client is dropped as every system op is.

## Performance and limits

- One map lookup and one socket scan (the target's) per nudge; nudges are human presses.
- Ledger: at most one entry per pair in the window, pruned past 256.
- The countdown re-renders only a cooling button, once a second, only while Collaborators is open.

## Presentation and UX

- Button: secondary, `xs`, "Nudge"; cooling: "Nudged", disabled, tooltip "Nudge again in 1:42"
  (`aria-label` "Nudge Sam" / "Nudged Sam, nudge again in 1:42").
- Toasts as in the spec. The notification title and body as in the spec.

## Accessibility

The button is a real button with a label naming the person; the disabled state carries the countdown in its label.
The toast is announced by the shared toast stack (polite live region).

## Observability

`console.warn('[nudge] refused', { retryInMs })` on the server when it refuses; `debugLog('[nudge] notification
failed')` on the client when the constructor throws.

## Testing

- `packages/api-schema/src/nudge.test.ts`: parse, ledger allow and refuse, retry time, prune, countdown.
- `apps/api/src/room-nudge.test.ts`: identity order, decide self, absent, cooldown.
- `apps/api/src/document-room.test.ts`: a Participant's nudge reaches the target only; a second in 2 minutes comes
  back `nudge-refused` to the sender; a Viewer's is dropped; one to self is dropped; a client's `nudge-refused` is
  dropped.
- `apps/api/src/room-op-gate.test.ts`: Editor and Participant pass, Viewer and malformed drop.
- `apps/editor/lib/nudge/nudge-inbox.test.ts`, `hooks/collab/useNudges.test.tsx`: cooldown, refusal, recipient
  sound, toast, notification on hidden only, permission granted / denied / default, Do Not Disturb, the offer once.
- `apps/editor/lib/nudge/nudge-cooldown.test.tsx`: the countdown ticks once a second while cooling and stops at 0;
  `apps/editor/lib/nudge/nudge-chime.test.ts`: the notes and gain.
- `apps/editor/components/dialogs/CollaboratorsDialog.nudge.test.tsx`: Nudge for others only, not for a Viewer,
  disabled with the countdown.
- Settings row: checked only when on and granted; asks from the press; blocked and unsupported notices.

## Constants and configuration

| Constant            | Value                                                                                   | Provenance                         | Safe range   |
| ------------------- | --------------------------------------------------------------------------------------- | ---------------------------------- | ------------ |
| `NUDGE_COOLDOWN_MS` | 120000                                                                                  | The owner's "once every 2 minutes" | fixed        |
| `NUDGE_NOTES`       | E5 659.25 Hz at 0 s, A5 880 Hz at 0.12 s, E6 1318.5 Hz at 0.24 s; 0.7 s each, peak 0.16 | Louder than the join chime         | peak 0.1-0.2 |
| Ledger prune size   | 256                                                                                     | `createKnockThrottle`'s bound      | 64-1024      |

## Assets and external resources

None: the chime is synthesised; the notification uses the browser's default icon.

## Defaults ledger

N1 to N4 in [DEFAULTS](DEFAULTS.md).
