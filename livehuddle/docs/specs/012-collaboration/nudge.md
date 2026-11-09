# Nudge

Getting one person's attention from the Collaborators list: a **Nudge** plays a sound on their screen, shows them who
nudged them with a way to find you, and, while their Space is a background tab, a desktop notification. Once every
2 minutes per person you nudge.

> "Second feature is that I can nudge somebody via the collaborators menu, once every 2 minutes. When I do a sound
> happens and ideally it notifies me somehow on my desktop machine when the tab isn't active" (the owner, 2026-11-09)

## Nudging

- **Where**: each other person's row in **Collaborators** ([Collaborator enhancements](collaborator-enhancements.md))
  has a **Nudge** button beside Follow. Your own row has none; an agent's row has none.
- **Once per 2 minutes per person** (`NUDGE_COOLDOWN_MS`, 120 000 ms): after you nudge someone, their Nudge button
  reads **Nudged** and is disabled, and its tooltip counts down: "Nudge again in 1:42". Nudging someone else is not
  held up by it.
- **The room enforces it too**: it lets one nudge from a sender to a target through per 2 minutes, by the sender's
  and the target's stable identity (a verified account's person tag, else their collaboration key, else their
  presence id), so a second tab, a reload or a script cannot nudge faster. A nudge it refuses comes back to the
  sender alone as `nudge-refused` with the time left, and the sender sees an info toast: "You nudged Sam recently.
  Try again in 1:42."; the button takes the room's countdown.
- **Telling the sender**: a nudge sent says so, "Nudged Sam" (info toast).
- **Never to yourself**: the button is not on your row, and the room drops a nudge addressed to the sender's own
  presence id.

## Being nudged

- **The sound**: a bright three-note chime (E5, A5, E6), louder than the join chime ([Join and leave
  sounds](join-and-leave-sounds.md)), so it is noticed. Played through the same one `AudioContext`, unlocked on your
  first press in the tab, so it sounds in a background tab. It plays whatever Join and Leave Sounds says (a nudge is
  a person asking for you), but not while your status is **Do Not Disturb**.
- **The toast**: an action toast, **"Sam nudged you"**, with **Go to Sam**: it switches to Sam's tab and centres your
  view on Sam (their character while they walk, else their cursor; their tab alone when neither is known). Keyed by
  the sender, so a second nudge replaces the first. It shows even with In-Editor Notifications off, as a knock does:
  it is a person asking for you. Shown on Do Not Disturb too, silently.
- **The desktop notification**: while the tab is hidden (`document.visibilityState === 'hidden'`), Desktop
  Notifications is on and the browser has granted permission, a system notification: title **"Sam nudged you in
  Weekly Standup"** (the Space's name), body "Click to go to them.". Clicking it focuses the tab and does what Go to
  Sam does. A visible tab gets no notification (the toast is in front of you). Never on Do Not Disturb.

## Desktop Notifications

- **Never asked on load.** The browser's permission prompt only ever opens from a press:
  - **Settings**: **Desktop Notifications** (Account › Notifications, In the Editor, beside Join and Leave Sounds;
    `desktopNotifications`, missing means on). Shown on only while it is on AND the browser has granted permission.
    Turning it on while the browser has not been asked asks it; granted, it is on; refused, it stays off.
  - **A one-time offer**: the first time you nudge someone or are nudged, while the browser has not been asked, a
    toast offers it: "Get a desktop notification when someone nudges you while this tab is in the background?" with
    **Turn On** (asks the browser) and **Not Now**. Either answer is remembered (`desktopNotificationsOffered`) and
    it is never offered again; Settings still has the switch.
- **Blocked or unsupported**: when the browser has refused (or never could, no `Notification` API), the switch is
  greyed and says why: "Your browser blocks notifications from this site. Allow them in your browser's site settings
  to turn this on." or "This browser can't show desktop notifications." The sound and the toast still work.

## The wire

Two presence ops ([API](../015-api/api.md) room ops):

| Op              | Shape                     | From          | Delivery                                                              |
| --------------- | ------------------------- | ------------- | --------------------------------------------------------------------- |
| `nudge`         | `{ targetId }`            | A client      | **Addressed** to `targetId` only (`sendToPresence`), never fanned out |
| `nudge-refused` | `{ targetId, retryInMs }` | The room only | To the sender's socket alone                                          |

- `nudge` is in `PRESENCE_OP_KINDS`: never ordered, logged or replayed, never touching the document. `targetId` is a
  presence id (at most `PRESENCE_ID_MAX` characters).
- `nudge-refused` is in `SYSTEM_OP_KINDS`, so the room drops one arriving from a client. Its `from` is the target's
  presence id, so the sender knows whose countdown it is.
- The room drops a malformed nudge, a Viewer's, one to the sender itself and one to a presence id not in the room.
- The cooldown ledger is memory only, keyed `sender:target` by stable identity, and pruned of entries older than
  2 minutes as it grows; it holds at most one entry per pair nudged in the last 2 minutes.

## Share roles

| Act                              | Editor | Participant | Viewer |
| -------------------------------- | ------ | ----------- | ------ |
| Nudge someone                    | Yes    | Yes         | No     |
| Be nudged (sound, toast, notice) | Yes    | Yes         | Yes    |
| Desktop Notifications setting    | Yes    | Yes         | Yes    |

A nudge reaches a person's desktop, past the tab, so it is taking part: a Viewer (who may have come in on a public
view link) watches and is never the one interrupting. The Collaborators list shows a Viewer no Nudge button
(`mayNudge`, the same rule as the session's `can.takePart`), and the room drops a Viewer's nudge. Anyone may be nudged.

## Telemetry ([Telemetry](../017-telemetry/telemetry.md))

`Canvas · Used · Nudge` on sending, as a knock is, `Canvas · Used · NudgeGoTo` on Go to (toast or notification). The
Settings switches fire `UI · DesktopNotificationsOn` / `UI · DesktopNotificationsOff`. Never who nudged whom.

## Not in scope

- Nudging someone who is not in the Space (that is an email or a mention).
- A message with the nudge.
- Push notifications to a closed tab (a nudge needs the Space open somewhere).
