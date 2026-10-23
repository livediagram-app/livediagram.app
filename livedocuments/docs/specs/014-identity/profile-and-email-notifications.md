# Account settings & email notifications

**Status: shipped.** A signed-in user's account surface: their avatar, name,
email, and join date, plus the two account actions that once had no home of
their own, **delete my account** and **email notification preferences**.
Builds on the Resend integration ([Transactional email (Resend)](transactional-email.md)) and the synced preference store
([User preferences](../007-editor/user-preferences.md)).

Like [Transactional email (Resend)](transactional-email.md) the email half is **entirely gated on `RESEND_API_KEY`**: when
email is off, the notification toggles are absent (they'd do nothing) and no
notification email is ever sent.

## 1. Where it lives

**In the Settings dialog** ([User preferences](../007-editor/user-preferences.md)), under **Account** and its **Notifications** sub-category.

It began as its own Explorer section at `/explorer/profile`, which made sense
when Settings held a handful of editor toggles. Once every preference in the
product moved into Settings, a separate account page was a second place to
look for the same kind of thing, and the email toggles in particular were
findable only by someone who already knew the page existed. The page was
retired and its three parts redistributed:

- **Identity** (avatar, name, email, joined) is the `identity` row in the
  **Account** category. Read from the liveworkspace account on the client, never written: names
  and emails belong to the liveworkspace account, so it is a card, not a form. The
  avatar is the account's initial. A guest sees a card explaining that they are working as a guest.
- **Email notifications** are the six rows in **Notifications > Email**
  (§3). Absent unless Resend is configured AND the reader is signed in, since
  a guest has no address to send to.
- **Delete account** is the `deleteAccount` row in **Account > Danger Zone**.

### `/explorer/profile` still resolves, deliberately

The route survives as a client-side redirect to
`/explorer?settings=notifications`, and **must keep doing so**: every
notification email ever sent carries that URL both as its "Manage your
notifications" link and as its `List-Unsubscribe` header ([Transactional email (Resend)](transactional-email.md)). Those
messages sit in inboxes indefinitely, and an unsubscribe link that 404s is
the one dead link a product cannot ship. New mail links at the deep link
directly.

### Reaching it

- **Header account menu** - `AuthControls`' dropdown has an **Account** item
  deep-linking `/explorer?settings=account`, so it is reachable from anywhere
  the header chrome renders (editor + explorer).
- **Search** - every row is findable from the app-wide search panel, which
  opens Settings on the matching row ([User preferences](../007-editor/user-preferences.md)).

### Delete account moves here

Account self-deletion already exists end to end (`DELETE /api/account`,
[Auth + guest access](auth-and-guest-access.md#deleting-an-account); `DeleteAccountDialog`, the type-your-email confirmation). It used
to hang off the header dropdown; now that there is a dedicated account home,
the **Delete account** trigger lives on the profile page's Danger zone and is
**removed from the header menu** (one home for destructive account actions,
no drift). The dialog component itself is unchanged and simply reused — the
confirmation flow (type your email, then wipe livedocuments's data and close the
liveworkspace account, then end the session) is exactly as [Transactional & lifecycle email (Resend)](transactional-email.md) describes.
Account deletion is immediate and total within livedocuments: it deletes the account's own documents for good
through the index, **including every one in its [Trash](../013-workspace/trash.md)**, which the
dialog and the Danger Zone row both say.

**Teams on deletion.** Teams are the liveworkspace account's: closing the account leaves every team there
first, a team it ran alone goes, and one where it was the only admin passes to the longest-standing member
([liveworkspace/docs/accounts.md](../../../../liveworkspace/docs/accounts.md) "Teams"). Documents filed in a team's
library stay with the team. livedocuments itself holds no team rows to clean up.

## 2. Capabilities gains `emailEnabled`

`GET /api/capabilities` (the fail-closed feature probe the client already
uses for AI) gains `emailEnabled: boolean`, true only when
`emailEnabled(env)` (i.e. `RESEND_API_KEY` is set). `CapabilitiesResponse`
and `useCapabilities()` carry it through. The profile page hides the Email
notifications section entirely when it's false: with no email backend the
toggles would be inert, and a self-host without Resend should not advertise a
setting it can't honour.

## 3. Email notification preferences

Two per-user flags, stored with the editor flags in the **same synced
preferences** ([User preferences](../007-editor/user-preferences.md)), which the liveworkspace accounts database keeps —
reusing that store rather than minting a parallel one (it already
round-trips to localStorage and survives the sign-up migration). Every
`notify*` switch is a setting all liveworkspace apps share (the `all`
scope), so it reads the same in every app:

```ts
// added to UserPreferences (docs/specs/007-editor/user-preferences.md)
notifyDocumentJoin?: boolean;     // someone first opens one of my shared documents
notifyInviteResponse?: boolean;  // someone accepts/declines a team invite I (an admin) sent
notifyMentions?: boolean;        // a teammate @-mentions me in a comment (docs/specs/012-collaboration/comment-mentions.md)
notifyActionAssigned?: boolean;  // a teammate assigns me an action (docs/specs/012-collaboration/assigned-actions.md)
notifyMilestones?: boolean;      // my tenth document, and my first share link (transactional-email.md #6)
```

All **default on** (undefined === true): the user asked to be told, so the
toggle is an opt-**out**, mirroring [User preferences](../007-editor/user-preferences.md)'s `notificationsEnabled`. The
profile page reads/writes them through the existing
`readUserPreferences` / `writeUserPreferences(prefs, ownerId)` round-trip, so
a flip reaches the accounts database within a moment and syncs across devices and apps. Each flip emits
`UI` / `Toggled` / `NotifyDocumentJoin{On,Off}` /
`NotifyInviteResponse{On,Off}` telemetry ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)) before persisting.

### Server-side read

The api worker decides whether to send a notification by reading the
recipient's preferences server-side: `getNotificationPrefs(env, ownerId)`
(`apps/api/src/person/settings.ts`) does one settings read at the accounts
Worker and keeps the `notify*` keys, returning `{}` (→ all defaults → notify)
when nothing is stored or the read fails. A missing key means
the default (on), so a user who has never touched the toggle still gets
notified.

The emails that can reach several people at once (a mention, an assignment, someone joining, the milestones)
read the switch together with the address, for everyone in one go: `notifyRecipients(env, ids, key)`
(`apps/api/src/person/notify.ts`, on `notificationRecipients` from `@liveworkspace/auth-client`) asks the
accounts Worker for the verified addresses and for that one key in the scope it lives in (`all`, or
`livedocuments.app` for `notifyDocumentJoin`), two requests whatever the number of people
([liveworkspace/docs/accounts.md](../../../../liveworkspace/docs/accounts.md) "Notification emails"). A switch read
that fails counts as on; an address read that fails reaches nobody.

## 4. The two notifications

livedocuments sends the first (§a); the invite answer (§b) is the accounts Worker's.

Both are **transactional** (sent whenever email is on AND the recipient
hasn't opted out), best-effort in `ctx.waitUntil`, and never on the
request's critical path — same contract as every [Transactional email (Resend)](transactional-email.md) send. Recipients'
addresses come only from trusted server state (the account's verified
address, looked up at the accounts Worker with `accountEmails`, or the
inviter-typed `team_members.email`), never from a client header.

### a. Someone joins my document — `notifyDocumentJoin`

The signal is **a new person opening one of my shared documents for the first
time**, which the index sees: it records who came in through a link (its `shared_with`), whether by resolving
the link's code or by opening the document with it, and when that row is new it tells livedocuments, after the write and
off its own request's path: `POST /api/internal/items/<id>/notices` with `{ type: 'joined', personId, level }`
and livedocuments's index key ([One Explorer contracts](../../../../liveworkspace/docs/one-explorer-contracts.md)
"Notices"). livedocuments answers `202` at once and hands it to the document's room, which runs
`notifyDocumentJoin(env, document, personId)`. A guest is no one joining (a guest id is free to mint, so every fresh
one would be another first visit), and neither is the owner. `notifyDocumentJoin`:

- no-ops unless `emailEnabled(env)`, and for a guest or the owner;
- resolves the owner's address and switch at the accounts Worker in one go (so it only fires for an
  owner with an account and a verified address);
- no-ops when the owner's `notifyDocumentJoin` switch is `false`;
- no-ops unless it wins the per-plan throttle: at most one join email per
  document per 15 minutes (a `join` claim in the document's own `notify_claims`, the new-comment email's rule);
- otherwise sends the **document-joined** email: "{joiner} opened one of your documents", naming the document, with a
  CTA to the Explorer.

The document **name** is the recipient owner's _own_ content going back to
them, so including it does not widen the [Transactional email (Resend)](transactional-email.md) §5 content rule (which is
about not leaking _other_ users' content). The joiner's display name is
included when known (the owner already sees it in live presence and the
Shared-with-you list); it's HTML-escaped like the team name.

The notification is on by default (an opt-out), so the email says so rather
than claiming the owner turned it on, and points at the notification settings.

Only the first visit notifies — repeat opens by the same person are silent,
so an active collaborator doesn't generate a mail per reload. This is the
only server-observable "join" signal; live-room reconnects in the Durable
Object are deliberately **not** wired (they'd be far too chatty).

### b. Someone responds to a team invite — `notifyInviteResponse`

Sent by liveworkspace, not livedocuments: teams, their invitations and the
answer emails belong to the liveworkspace account, and the accounts Worker
tells each joined admin when an invitee accepts or declines, unless they have
turned `notifyInviteResponse` off ([liveworkspace/docs/accounts.md](../../../../liveworkspace/docs/accounts.md)
"Invitations"). It also counts those emails (`Email·Sent·InviteResponse`) under
the app the inviter signed up through. The switch stays in livedocuments'
Settings because it is a setting every app shares.

## 5. Privacy / security

- Signed-in only; every recipient address comes from verified server state,
  never a client header (consistent with [Teams](../013-workspace/teams.md)'s removal of
  `X-Owner-Email` and [Transactional email (Resend)](transactional-email.md) §5).
- The only user-influenced strings in a notification body (a document name, a
  joiner name, an assigner's or author's name, an action, a quoted comment) are HTML-escaped, and each is
  either the recipient's own content or already known to the recipient.
- Off by default at the deployment level (no `RESEND_API_KEY` → no sends, no
  UI), and off per-notification when the recipient opts out. Self-hosting
  stays intact ([Open source + distribution](../002-project-scope/open-source-and-business-model.md)): no required SaaS call, the toggles just hide.

## 6. Out of scope (for now)

A global "all email off" master switch (the lifecycle onboarding series still
has no unsubscribe, [Transactional email (Resend)](transactional-email.md) §8), notification batching/digests, in-app
(non-email) notifications, and editing name/avatar from the profile page
(identity belongs to the liveworkspace account). The page reads identity; it doesn't write it.
