# Account settings & email notifications

A signed-in person's account surface: their avatar, name, email and join date, plus the two account actions,
**delete my account** and **email notification preferences**. Builds on the email integration
([Transactional & lifecycle email](transactional-email.md)) and the synced preference store
([User preferences](../007-editor/user-preferences.md)).

Like [Transactional & lifecycle email](transactional-email.md) the email half is **entirely gated on the `EMAIL`
binding** (Cloudflare Email Service's `send_email`): when email is off, the notification switches are absent (they'd
do nothing) and no notification email is ever sent.

## 1. Where it lives

**In the Settings dialog** ([User preferences](../007-editor/user-preferences.md)), under **Account** and its
**Notifications** sub-category (`SettingsAccountRows.tsx`, rows in `settings-catalogue.ts`). One place for every
preference, so the email switches are found where every other setting is.

- **Identity** (avatar, name, email, joined) is the `identity` row in the **Account** category. Read from the
  liveworkspace account on the client, never written: names and emails belong to the liveworkspace account, so it is
  a card, not a form. The avatar is the account's Google picture when it signed in with Google, over its initial
  (which shows when there is none or it fails to load); a person who turns **Show My Google Picture** off in
  Settings › Profile still sees their own picture here and in the header, but presence, cursors and everything others
  see show the initial. A guest sees a card explaining that they are working as a guest. The picture's rules are
  liveworkspace's (liveworkspace/docs/specs/003-accounts/accounts.md "Profile pictures"): only account sessions are sent anyone's
  picture, never a guest or a link visitor.
- **Email notifications** are the seven switches in **Notifications > Email** (§3). Absent unless email is
  configured AND the reader is signed in, since a guest has no address to send to; a guest sees one row saying to
  sign in to choose.
- **Delete account** is the `deleteAccount` row in **Account > Danger Zone**, which opens `DeleteAccountDialog`
  (type your email, then the code emailed to the account, to confirm).

### The old profile address

`/explorer/profile` is one of the shared Explorer's retired addresses: liveworkspace's Explorer opens Settings on
Notifications in its place (`RETIRED_TARGETS.profile`). It must keep doing so: every notification email carries a
"Manage your notifications" link and a `List-Unsubscribe` header, and those messages sit in inboxes indefinitely.
New mail links at `/explorer?settings=notifications` directly (`apps/api/src/email/templates.ts`).

### Reaching it

- **Header account menu**: `AuthControls`' dropdown has an **Account** item that opens Settings on Account, so it is
  reachable from anywhere the header chrome renders.
- **Search**: every row is findable from the app-wide search panel, which opens Settings on the matching row
  ([User preferences](../007-editor/user-preferences.md)).

### Deleting an account

The confirmation flow (type your email, then the code emailed to the account, then wipe what livediagram keeps, then close the liveworkspace account, then
end the session) is [Auth + guest access](auth-and-guest-access.md#deleting-an-account)'s, and what is wiped is
[API](../015-api/api.md#owner-keyed-data) "Owner-keyed data". Closing the liveworkspace account closes it in every
app, so the dialog says the person's work in every app goes, the Trash included. Teams, memberships and their heirs
are liveworkspace's to settle when the account closes ([Teams](../013-workspace/teams.md)).

## 2. Capabilities carry `emailEnabled`

`GET /api/capabilities` (the fail-closed feature probe) carries `emailEnabled: boolean`, true only when
`emailEnabled(env)` (the `EMAIL` binding is present). `CapabilitiesResponse` and `useCapabilities()` carry it
through. Settings hides the email switches entirely when it is false: with no email backend the switches would be
inert, and a deployment without email should not advertise a setting it can't honour.

## 3. Email notification preferences

Per-person flags, stored in the **same preferences** as the editor flags
([User preferences](../007-editor/user-preferences.md)), which liveworkspace keeps. All but `notifyDocumentJoin` are
in the `all` scope every liveworkspace app shares, so a switch flipped here is flipped in every app:

| Key                    | Label                             | When it emails                                                   |
| ---------------------- | --------------------------------- | ---------------------------------------------------------------- |
| `notifyDocumentJoin`   | Someone Joins My Canvas           | A new person opens one of your shared canvases                   |
| `notifyComments`       | Someone Comments on My Canvas     | Someone leaves a comment on a canvas you own                     |
| `notifyMentions`       | Someone Mentions Me in a Comment  | A teammate @mentions you in a comment                            |
| `notifyActionAssigned` | Someone Assigns Me an Action      | A teammate assigns you an action on an element                   |
| `notifyInviteResponse` | Someone Responds to a Team Invite | Someone you invited accepts or declines (liveworkspace sends it) |
| `notifyTips`           | Tips and Check-Ins                | Occasional getting-started tips, and a nudge after a long gap    |
| `notifyMilestones`     | Milestones                        | A note when you hit one, like sharing your first canvas          |

Every switch **defaults on** (undefined === true): an opt-**out**. Settings reads and writes them through the
`readUserPreferences` / `writeUserPreferences(prefs, ownerId)` round-trip, so a flip persists to the server at once
and syncs across devices. Each flip emits `UI` / `Toggled` / `Notify<Key>{On,Off}` telemetry
([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)) before persisting.

### Server-side read

The api worker decides whether to send by reading the recipient's preferences server-side: `getNotificationPrefs`
(`apps/api/src/liveworkspace/notification-prefs.ts`) makes one accounts read of both scopes, falling back to all
defaults (notify) when nothing is kept or liveworkspace can't be reached. A missing key means the default (on).

## 4. The notifications

They are **transactional** (sent whenever email is on AND the recipient hasn't opted out), best-effort in
`waitUntil`, and never on the request's critical path, the same contract as every
[Transactional & lifecycle email](transactional-email.md) send. They go through the shared notifier
(`createNotifier` from `@liveworkspace/auth-client`, wired in `apps/api/src/email/notifications.ts`). Recipients'
addresses come only from liveworkspace, which answers each account's verified address, never from a client header.

### Someone joins my canvas (`notifyDocumentJoin`)

The signal is **a signed-in person opening one of my canvases through a share link for the first time**: the index's
`joined` notice, which the canvas's Durable Object runs (`DocumentRoom.joined`). A guest identity is free to make, so
a guest's first visit never emails. The notifier:

- no-ops unless `emailEnabled(env)`;
- resolves the owner's verified address from liveworkspace (a guest-owned canvas has no address and is skipped);
- no-ops when the owner's `notifyDocumentJoin` is `false`;
- no-ops unless it wins the per-canvas throttle: at most one join email per canvas per 15 minutes
  (`JOIN_NOTIFY_THROTTLE_MS`, a claim in the canvas's own `notify_claims`);
- otherwise sends the **document-joined** email: "Someone just opened _{canvas name}_", with a link back to it.

The canvas **name** is the owner's own content going back to them, so including it does not widen the
[Transactional & lifecycle email](transactional-email.md) §7 content rule (which is about not leaking _other_ people's
content). The joiner's display name is included when known (the owner already sees it in live presence); it is
HTML-escaped. The notification is on by default, so the email says so rather than claiming the owner turned it on,
and points at the notification settings. Only the first visit notifies, so an active collaborator doesn't generate a
mail per reload; live-room reconnects are deliberately not wired.

### Someone responds to a team invite (`notifyInviteResponse`)

Team invitations are liveworkspace's ([Teams](../013-workspace/teams.md)), and so is the email telling a team's admins
an invite was accepted or declined: liveworkspace sends it and counts it. livediagram keeps the switch in Settings, in
the shared `all` scope liveworkspace reads, and sends nothing itself.

## 5. Privacy / security

- Signed-in only; every recipient address comes from verified server state, never a client header
  ([Transactional & lifecycle email](transactional-email.md) §7).
- The only user-influenced strings in a notification body (a canvas name, a joiner name) are HTML-escaped, and each
  is either the recipient's own content or already known to the recipient.
- Off at the deployment level with no `EMAIL` binding (no sends, no switches), and off per notification when the
  recipient opts out. No required SaaS call
  ([Open source + distribution](../002-project-scope/open-source-and-business-model.md)): the switches just hide.

## 6. Out of scope

A global "all email off" master switch, notification batching or digests, in-app (non-email) notifications, and
editing name or avatar here (identity belongs to the liveworkspace account).
