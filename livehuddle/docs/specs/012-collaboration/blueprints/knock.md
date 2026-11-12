# Knock blueprint

Derived from [Knock](../knock.md).

## Files

| File                                                                                        | Role                                                                                                              |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `packages/api-schema/src/knock.ts`                                                          | `AvatarKnockOp`, `AvatarKnockAnswerOp`, parsers, `KNOCK_THROTTLE_MS`, `createKnockThrottle`                       |
| `packages/api-schema/src/room-op-kinds.ts`, `packages/api-schema/src/room-op.ts`            | Both kinds in `PRESENCE_OP_KINDS` and the `RoomOp` union                                                          |
| `apps/api/src/room-op-gate.ts`                                                              | Parses both from any level; drops malformed ones                                                                  |
| `apps/api/src/document-room/document-room.ts`, `apps/api/src/document-room/room-message.ts` | Throttles knocks per sender (`knocks`), addresses answers (`sendToPresence`)                                      |
| `apps/editor/lib/calls/call-config.ts`                                                      | `CallSignal` carries both, sent through the call's room channel                                                   |
| `apps/editor/app/document/[id]/room-op-receive.ts`                                          | Hands received ops to `receiveKnockOp`                                                                            |
| `apps/editor/lib/office/knock-inbox.ts`                                                     | Parses and fans out received knocks and answers                                                                   |
| `apps/editor/lib/office/useMeetingPieces.ts`                                                | Sends knocks (`setKnocker`), shows the knock and answer toasts, the closed pod door toast, Let In standing you up |
| `packages/avatar/src/pod.ts`                                                                | `podDoorFront`: the strip in front of a pod's doorway                                                             |

## Flow

1. A Room Sign's Knock (or the pod door toast) calls the knocker; it sends `avatar-knock { roomId }` unless you
   knocked in the last 10 seconds, and marks the sign's button Knocked.
2. The room gate parses it; the room drops it if this sender knocked within `KNOCK_THROTTLE_MS`, else broadcasts.
3. Each receiver walking in Avatar mode, not on Do Not Disturb, whose own feet are in `roomId` (`zoneAt`), shows an
   action toast keyed by the knocker, so a repeat replaces it.
4. Let In or Not Now sends `avatar-knock-answer`, addressed to the knocker; Let In while seated in that pod first stands
   you up. The knocker sees an info toast.

Nothing is stored; the throttle map is per room instance, in memory, and forgets a sender when its socket closes.
