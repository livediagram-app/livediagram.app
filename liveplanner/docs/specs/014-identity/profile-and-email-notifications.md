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
confirmation flow (type your email, then wipe liveplanner's data and close the
liveworkspace account, then end the session) is exactly as [Transactional email (Resend)](transactional-email.md) describes.
Account deletion is immediate and total within liveplanner: it deletes the account's own projects for good
through the index, **including every one in its [Trash](../013-workspace/trash.md)**, which the
dialog and the Danger Zone row both say.

**Teams on deletion.** Teams are the liveworkspace account's: closing the account leaves every team there
first, a team it ran alone goes, and one where it was the only admin passes to the longest-standing member
([liveworkspace/docs/accounts.md](../../../../liveworkspace/docs/accounts.md) "Teams"). Plans filed in a team's
library stay with the team. liveplanner itself holds no team rows to clean up.

## 2. Capabilities gains `emailEnabled`

`GET /api/capabilities` (the fail-closed feature probe the client already
uses for AI) gains `emailEnabled: boolean`, true only when
`emailEnabled(env)` (i.e. `RESEND_API_KEY` is set). `CapabilitiesResponse`
and `useCapabilities()` carry it through. The profile page hides the Email
notifications section entirely when it's false: with no email backend the
toggles would be inert, and a deployment without Resend should not advertise a
setting it can't honour.

## 3. Email notification preferences

Per-user flags, stored with the editor flags in the **same synced
preferences** ([User preferences](../007-editor/user-preferences.md)), which the liveworkspace accounts database keeps —
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
notifyFormResponses?: boolean;   // someone fills in one of my forms (docs/specs/030-forms/forms.md)
```

Both **default on** (undefined === true): the user asked to be told, so the
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

## 4. The two notifications

**liveplanner sends neither (October 2026).** The first visit through a share link was recorded in liveplanner's
`shared_with`, and visits and shares are the index's now ([one-explorer.md](../../../../liveworkspace/docs/one-explorer.md)),
so the join email has no signal; its switch (`notifyProjectJoin`) and template kind remain, and §a describes how it
was sent, for when a signal returns. The invite answer (§b) is the accounts Worker's.

Both are **transactional** (sent whenever email is on AND the recipient
hasn't opted out), best-effort in `ctx.waitUntil`, and never on the
request's critical path — same contract as every [Transactional email (Resend)](transactional-email.md) send. Recipients'
addresses come only from trusted server state (the account's verified
address, looked up at the accounts Worker with `accountEmails`), never from a
client header.

### a. Someone joins my project — `notifyProjectJoin`

The signal is **a new person opening one of my shared projects for the first
time**: the share-resolve path (`GET /api/share/<code>`) already records a
visitor in `shared_with` via `recordSharedAccess`, but only when the visitor
identifies and isn't the owner. `recordSharedAccess` now reports whether the
row was **new** (first visit) vs a repeat. On a new visit by a **verified**
visitor (a signed-in session or API token, `ctx.verifiedUserId`) the worker fires
`notifyProjectJoin(env, liveDoc, joinerName)`. A guest id was
unproven and free to mint then, so every fresh one would be another first visit;
a guest visit is still recorded in `shared_with` and counted as
`Project·Joined`, but never emails. `notifyProjectJoin`:

- no-ops unless `emailEnabled(env)`;
- resolves the owner's email at the accounts Worker (so it only fires for an
  owner with an account and a verified address — a guest-owned project has
  no address and is silently skipped);
- no-ops when the owner's `notifyProjectJoin` pref is `false`;
- no-ops unless it wins the per-project throttle: at most one join email per
  project per 15 minutes (`claimJoinNotify`, an atomic conditional `UPDATE` of
  `projects.join_notified_at`; the new-comment email's rule
  on its own column);
- otherwise sends the **project-joined** email: "Someone just opened
  _{project name}_", with a CTA back to the project.

The project **name** is the recipient owner's _own_ content going back to
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

Sent by liveworkspace, not liveplanner: teams, their invitations and the
answer emails belong to the liveworkspace account, and the accounts Worker
tells each joined admin when an invitee accepts or declines, unless they have
turned `notifyInviteResponse` off ([liveworkspace/docs/accounts.md](../../../../liveworkspace/docs/accounts.md)
"Invitations"). It also counts those emails (`Email·Sent·InviteResponse`) under
the app the inviter signed up through. The switch stays in liveplanner's
Settings because it is a setting every app shares.

## 5. Privacy / security

- Signed-in only; every recipient address comes from verified server state,
  never a client header (consistent with [Teams](../013-workspace/teams.md)'s removal of
  `X-Owner-Email` and [Transactional email (Resend)](transactional-email.md) §5).
- The only user-influenced strings in a notification body (a project name, a
  joiner name, a responder email, a team name) are HTML-escaped, and each is
  either the recipient's own content or already known to the recipient.
- Off by default at the deployment level (no `RESEND_API_KEY` → no sends, no
  UI), and off per-notification when the recipient opts out. Nothing
  breaks ([Business model + licence](../002-project-scope/business-model-and-licence.md)): no required SaaS call, the toggles just hide.

## 6. Out of scope (for now)

A global "all email off" master switch (the onboarding series is liveworkspace's, with its own `notifyTips` switch; [Transactional email (Resend)](transactional-email.md) §6), notification batching/digests, in-app
(non-email) notifications, and editing name/avatar from the profile page
(identity belongs to the liveworkspace account). The page reads identity; it doesn't write it.
