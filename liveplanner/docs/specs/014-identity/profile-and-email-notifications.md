# Account settings & email notifications

**Status: shipped.** A signed-in user's account surface: their avatar, name,
email, and join date, plus the two account actions that once had no home of
their own, **delete my account** and **email notification preferences**.
Builds on the email integration ([Transactional email](transactional-email.md)) and the synced preference store
([User preferences](../007-editor/user-preferences.md)).

Like [Transactional email](transactional-email.md) the email half is **entirely gated on the `EMAIL` binding**: when
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
  avatar is the account's Google picture over its initial ([Profile pictures](#profile-pictures)). A guest sees a
  card explaining that they are working as a guest.
- **Email notifications** are the six rows in **Notifications > Email**
  (§3). Absent unless email is configured AND the reader is signed in, since
  a guest has no address to send to.
- **Delete account** is the `deleteAccount` row in **Account > Danger Zone**.

### Profile pictures

An account that signed in with Google wears its Google picture wherever liveplanner draws that person's avatar,
over the initials it always had (liveworkspace/docs/specs/003-accounts/accounts.md "Profile pictures" is the platform's rule; this is
liveplanner's half). One avatar does it, `PictureDisc` from `@liveworkspace/ui`: fixed size so nothing moves, lazy,
sent with no referrer, sized with Google's `=s<px>-c`, and the initials again while it loads or if it fails. Only a
Google picture URL is ever drawn (`isProfilePictureUrl`, `@liveworkspace/sites/picture`).

- **Where it comes from.** The session: the api reads the ID token's `picture` and `picture_hidden` claims
  (`apps/api/src/routes/auth.ts`, `AuthUser.picture` / `pictureHidden`); the readable picture cookie carries the
  same for the account menu.
- **Show My Google Picture**, in Settings › Profile (liveworkspace's switch, one for every app). Off keeps the
  picture from everyone else; your own screen still shows it (the header's account button, your own presence
  entry, your own comments). A switch saved on the page takes effect at once: the open room is sent an `identity`
  frame and updates the roster in place.
- **Who sees others' pictures: signed-in accounts only.** The room keeps a `picture` from a `hello` or `identity`
  only from a session a signed-in account holds (the api stamps `X-Verified-Account` on the upgrade; a guest or a
  link visitor is `0`), and refuses one that is not a Google picture URL, whole. Each roster frame to a guest or link
  visitor has every picture taken out, so the URL never reaches them. `GET /api/participants/<id>` answers the
  picture only to a reader who is a signed-in account; every other read of a participant (a plan's owner, a
  comment's writer) leaves it out, and a picture is never written into a plan.
- **Where it shows today:** the presence stack and Collaborators dialog (`ParticipantAvatar`), the account button
  (`AuthControls`), a peer's cursor pill (`RemoteCursor`), your own comment composer and your own comment bubbles. A card's assignee, a swimlane and
  others' comments keep their initials: those people are named in the plan by id only, and fetching each one's
  picture would cost a request the page doesn't make yet.
- **Cost.** No request of its own: the picture rides the session, the room's existing frames and the participant
  read already made. One image per distinct picture, cached by the browser.

### `/explorer/profile` still resolves, deliberately

`/explorer/profile` and `/explorer?settings=notifications` **must keep resolving**: every notification email
ever sent carries one of them as its "Manage your notifications" link and as its `List-Unsubscribe` header
([Transactional email](transactional-email.md)). Those messages sit in inboxes indefinitely, and an
unsubscribe link that 404s is the one dead link a product cannot ship. Both open the Explorer
([Explorer structure](../013-workspace/explorer-structure.md)) with the Settings panel open in place on the account's
notification settings, where the same toggles live. `?settings=account` opens it on the account's profile, and any
other category on liveplanner's own settings.

### Reaching it

- **Header account menu** - `AuthControls`' dropdown has an **Account** item
  opening the editor's own Settings in place, or, where the header has no Settings, `/explorer?settings=account`,
  which opens the Settings panel on the account's profile.
- **Search** - every row is findable from the app-wide search panel, which
  opens Settings on the matching row ([User preferences](../007-editor/user-preferences.md)).

### Delete account moves here

Account self-deletion already exists end to end (`DELETE /api/account`,
[Auth + guest access](auth-and-guest-access.md#deleting-an-account); `DeleteAccountDialog`, the type-your-email confirmation). It used
to hang off the header dropdown; now that there is a dedicated account home,
the **Delete account** trigger lives on the profile page's Danger zone and is
**removed from the header menu** (one home for destructive account actions,
no drift). The dialog component itself is unchanged and simply reused: the
confirmation flow (type your email, then wipe liveplanner's data and close the
liveworkspace account, then end the session) is exactly as [Transactional email](transactional-email.md) describes.
Account deletion is immediate and total within liveplanner: it deletes the account's own projects for good
through the index, **including every one in its [Trash](../013-workspace/trash.md)**, which the
dialog and the Danger Zone row both say.

**Teams on deletion.** Teams are the liveworkspace account's: closing the account leaves every team there
first, a team it ran alone goes, and one where it was the only admin passes to the longest-standing member
([liveworkspace/docs/specs/003-accounts/accounts.md](../../../../liveworkspace/docs/specs/003-accounts/accounts.md) "Teams"). Plans filed in a team's
library stay with the team. liveplanner itself holds no team rows to clean up.

## 2. Capabilities gains `emailEnabled`

`GET /api/capabilities` (the fail-closed feature probe the client already
uses for AI) gains `emailEnabled: boolean`, true only when
`emailEnabled(env)` (i.e. the `EMAIL` binding is present). `CapabilitiesResponse`
and `useCapabilities()` carry it through. The profile page hides the Email
notifications section entirely when it's false: with no email backend the
toggles would be inert, and a deployment without email should not advertise a
setting it can't honour.

## 3. Email notification preferences

Per-user flags, stored with the editor flags in the **same synced
preferences** ([User preferences](../007-editor/user-preferences.md)), which the liveworkspace accounts database keeps,
reusing that store rather than minting a parallel one (it already
round-trips to localStorage and follows the account across devices and
apps). Most `notify*` switches are settings all liveworkspace apps share (the
`all` scope, marked "All apps" in Settings), so they read the same in every
app; `notifyProjectJoin` and `notifyFormResponses` are liveplanner's own:

```ts
// added to UserPreferences (docs/specs/007-editor/user-preferences.md)
notifyProjectJoin?: boolean;     // someone first opens one of my shared projects
notifyInviteResponse?: boolean;  // someone accepts/declines a team invite I (an admin) sent
notifyMentions?: boolean;        // a teammate @-mentions me in a comment (docs/specs/012-collaboration/comment-mentions.md)
notifyActionAssigned?: boolean;  // a teammate assigns me an action (docs/specs/012-collaboration/assigned-actions.md)
notifyMilestones?: boolean;      // my tenth plan, and my first share link (transactional-email.md #7)
notifyFormResponses?: boolean;   // someone fills in one of my forms (docs/specs/030-forms/forms.md)
```

All **default on** (undefined === true): the user asked to be told, so the
toggle is an opt-**out**, mirroring [User preferences](../007-editor/user-preferences.md)'s `notificationsEnabled`. The
profile page reads/writes them through the existing
`readUserPreferences` / `writeUserPreferences(prefs, ownerId)` round-trip, so
a flip reaches the accounts database within a moment and syncs across devices and apps. Each flip emits
`UI` / `Toggled` / `NotifyProjectJoin{On,Off}` /
`NotifyInviteResponse{On,Off}` telemetry ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)) before persisting.

### Server-side read

The api worker decides whether to send a notification by reading the
recipient's preferences server-side: `getNotificationPrefs(env, ownerId)`
(`apps/api/src/person/settings.ts`) does one settings read at the accounts
Worker (both scopes) and keeps the switches liveplanner sends by
(`notifyComments`, `notifyFormResponses`), returning `{}` (→ all defaults →
notify) when nothing is stored or the read fails. A missing key means
the default (on), so a user who has never touched the toggle still gets
notified.

The emails that can reach several people at once (a mention, an assignment, someone joining, the milestones)
read the switch together with the address, for everyone in one go: `notifyRecipients(env, ids, key)`
(`apps/api/src/person/notify.ts`, on `notificationRecipients` from `@liveworkspace/auth-client`) asks the
accounts Worker for the verified addresses and for that one key in the scope it lives in (`all`, or
`liveplanner.app` for `notifyProjectJoin`), two requests whatever the number of people
([liveworkspace/docs/specs/003-accounts/accounts.md](../../../../liveworkspace/docs/specs/003-accounts/accounts.md) "Notification emails"). A switch read
that fails counts as on; an address read that fails reaches nobody.

## 4. The two notifications

liveplanner sends the first (§a); the invite answer (§b) is the accounts Worker's.

Both are **transactional** (sent whenever email is on AND the recipient
hasn't opted out), best-effort in `ctx.waitUntil`, and never on the
request's critical path, the same contract as every [Transactional email](transactional-email.md) send. Recipients'
addresses come only from trusted server state (the account's verified
address, looked up at the accounts Worker with `accountEmails`), never from a
client header.

### a. Someone joins my plan: `notifyProjectJoin`

The signal is **a new person opening one of my shared plans for the first
time**, which the index sees: it records who came in through a link (its `shared_with`), whether by resolving
the link's code or by opening the plan with it, and when that row is new it tells liveplanner, after the write and
off its own request's path: `POST /api/internal/items/<id>/notices` with `{ type: 'joined', personId, level }`
and liveplanner's index key ([One Explorer contracts](../../../../liveworkspace/docs/specs/004-index/one-explorer-contracts.md)
"Notices"). liveplanner answers `202` at once and hands it to the plan's room, which runs
`notifyProjectJoin(env, plan, personId)`. A guest is no one joining (a guest id is free to mint, so every fresh
one would be another first visit), and neither is the owner. `notifyProjectJoin`:

- no-ops unless `emailEnabled(env)`, and for a guest or the owner;
- resolves the owner's address and switch at the accounts Worker in one go (so it only fires for an
  owner with an account and a verified address);
- no-ops when the owner's `notifyProjectJoin` switch is `false`;
- no-ops unless it wins the per-plan throttle: at most one join email per
  plan per 15 minutes (a `join` claim in the plan's own `notify_claims`, the new-comment email's rule);
- otherwise sends the **project-joined** email: "{joiner} opened one of your plans", naming the plan, with a
  CTA to the Explorer.

The project **name** is the recipient owner's _own_ content going back to
them, so including it does not widen the [Transactional email](transactional-email.md) §5 content rule (which is
about not leaking _other_ users' content). The joiner's display name is
included when known (the owner already sees it in live presence and the
Shared-with-you list); it's HTML-escaped like the team name.

The notification is on by default (an opt-out), so the email says so rather
than claiming the owner turned it on, and points at the notification settings.

Only the first visit notifies; repeat opens by the same person are silent,
so an active collaborator doesn't generate a mail per reload. This is the
only server-observable "join" signal; live-room reconnects in the Durable
Object are deliberately **not** wired (they'd be far too chatty).

### b. Someone responds to a team invite: `notifyInviteResponse`

Sent by liveworkspace, not liveplanner: teams, their invitations and the
answer emails belong to the liveworkspace account, and the accounts Worker
tells each joined admin when an invitee accepts or declines, unless they have
turned `notifyInviteResponse` off ([liveworkspace/docs/specs/003-accounts/accounts.md](../../../../liveworkspace/docs/specs/003-accounts/accounts.md)
"Invitations"). It also counts those emails (`Email·Sent·InviteResponse`) under
the app the inviter signed up through. The switch stays in liveplanner's
Settings because it is a setting every app shares.

## 5. Privacy / security

- Signed-in only; every recipient address comes from verified server state,
  never a client header (consistent with [Teams](../013-workspace/teams.md)'s removal of
  `X-Owner-Email` and [Transactional email](transactional-email.md) §5).
- The only user-influenced strings in a notification body (a plan name, a
  joiner name, an assigner's or author's name, an action, a quoted comment) are HTML-escaped, and each is
  either the recipient's own content or already known to the recipient.
- Off by default at the deployment level (no `EMAIL` binding → no sends, no
  UI), and off per-notification when the recipient opts out. Nothing
  breaks ([Business model + licence](../002-project-scope/business-model-and-licence.md)): no required SaaS call, the toggles just hide.

## 6. Out of scope (for now)

A global "all email off" master switch (the onboarding series is liveworkspace's, with its own `notifyTips` switch; [Transactional email](transactional-email.md) §6), notification batching/digests, in-app
(non-email) notifications, and editing name/avatar from the profile page
(identity belongs to the liveworkspace account). The page reads identity; it doesn't write it.
