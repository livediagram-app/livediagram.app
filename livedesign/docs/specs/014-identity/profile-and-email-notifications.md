# Account settings & email notifications

**Status: shipped.** A signed-in user's account surface: their avatar, name,
email, and join date, plus the two account actions that once had no home of
their own, **delete my account** and **email notification preferences**.
Builds on transactional email ([Transactional email](transactional-email.md)) and the synced preference store
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
  avatar is the account's Google picture over its initial (see "Avatars" below). A guest sees a card
  explaining that they are working as a guest.
- **Email notifications** are the six rows in **Notifications > Email**
  (§3). Absent unless email is configured AND the reader is signed in, since
  a guest has no address to send to.
- **Delete account** is the `deleteAccount` row in **Account > Danger Zone**.

### Avatars

Every avatar of a person in livedesign is the one shared `PictureDisc` (`@liveworkspace/ui`, through
`@livedesign/ui`): their Google picture over their initials on their colour, the initials alone when there is no
picture or it fails to load. The rules are liveworkspace's, the same in every app (liveworkspace/docs/specs/003-accounts/accounts.md
"Profile pictures"):

- **Source.** The picture is the one Google gave the account at its last Google sign-in; an account made with an
  email code has none, and so does every guest.
- **Show My Google Picture.** A switch in liveworkspace.app's Settings › Profile, on by default. Off, other people see the initials;
  the person's own chrome (the header's account button, their own presence avatar, the composer beside their
  comments) still shows their picture, since it is their own screen.
- **Across tabs.** Each session reads the switch from its ID token's `picture_hidden`. Within the accounts Worker's
  30-second refresh-token reuse window, a second tab's refresh can replay the first tab's earlier response, minted
  before a save, which would briefly show a just-hidden picture. So a save notes its time in this browser
  (`livedesign:v2:picture-setting-saved-at`, any tab, `lib/own-picture.ts`), `POST /api/auth/token` says how old
  the ID token is by the api's clock (`tokenAgeMs`, from its `iat`), and a session whose token predates the save is
  refreshed once more; the fresh one stands.
- **Who sees it.** Only signed-in people see other people's pictures. A guest or a link visitor gets the same
  roster and participant reads with every picture taken out.
- **In the room.** The editor says `hello` with its published picture (`picture`, only while the switch is on),
  and an `identity` frame when the switch flips, so the roster changes in place without a rejoin. The api stamps
  `X-Verified-Account` on the socket (an account, not a guest or link visitor); the room keeps a picture only from
  such a session and only when it is a Google picture URL (`isProfilePictureUrl`, `@liveworkspace/sites/picture`),
  refused whole, never clamped, and strips every picture from the roster it sends a non-account session.
- **Participant reads.** `GET /api/participants/:id` answers `picture` only to a signed-in caller.
- **Where it shows.** Presence avatars (the tab stack, Collaborators), the cursor's name pill, the selection
  strip on an element, the header's account button and the comment composer's own avatar. Comment authors
  and team members keep their initials for now: livedesign has no batched read of their pictures yet, and an
  avatar must never cost a request of its own.

### `/explorer/profile` still resolves, deliberately

The route survives as a client-side redirect to
`/explorer?settings=notifications`, and **must keep doing so**: every
notification email ever sent carries that URL both as its "Manage your
notifications" link and as its `List-Unsubscribe` header ([Transactional email](transactional-email.md)). Those
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

Account self-deletion (`DELETE /api/account`, `apps/api/src/routes/account.ts`; `DeleteAccountDialog`, the
type-your-email confirmation) is the **Delete account** row on Settings › Account's Danger Zone, its one home. It
removes livedesign's data first, then closes the liveworkspace account, which closes it in every liveworkspace app
([Auth + guest access](auth-and-guest-access.md) "Deleting an account"): the data first, so a failure leaves a
signed-in person who can try again. The person's own designs go for good through the index, **including every one
in their [Trash](../013-workspace/trash.md)**, which the dialog and the Danger Zone row both say; up to 1,000 a
run, so a person with more is told to try again. Team designs stay with the team.

**Teams on deletion** are liveworkspace's: the accounts Worker removes the memberships and hands a team's designs on
([liveworkspace/docs/specs/003-accounts/accounts.md](../../../../liveworkspace/docs/specs/003-accounts/accounts.md) "Teams"). When the index reports the
closed account (`personClosed`, `apps/api/src/routes/internal-items.ts`), livedesign removes what it keeps for them
beside their designs (their images) and their name from each design of someone else's that names them.

## 2. Capabilities gains `emailEnabled`

`GET /api/capabilities` (the fail-closed feature probe the client already
uses for AI) gains `emailEnabled: boolean`, true only when
`emailEnabled(env)` (i.e. the `EMAIL` binding is present). `CapabilitiesResponse`
and `useCapabilities()` carry it through. The profile page hides the Email
notifications section entirely when it's false: with no email backend the
toggles would be inert, and a deployment without email should not advertise a
setting it can't honour.

## 3. Email notification preferences

Per-user flags, kept with the **same preferences** as the editor flags
([User preferences](../007-editor/user-preferences.md)): the person's liveworkspace account settings, synced
with `localStorage` and moved by the sign-up migration. `notifyInviteResponse`,
`notifyComments`, `notifyMilestones`, `notifyActionAssigned` and
`notifyMentions` are shared by every liveworkspace app (the All scope, so the
Settings dialog marks them **All apps**); `notifyDesignJoin` is livedesign's own:

```ts
// added to UserPreferences (docs/specs/007-editor/user-preferences.md)
notifyDesignJoin?: boolean;     // someone first opens one of my shared designs
notifyInviteResponse?: boolean;  // someone accepts/declines a team invite I (an admin) sent
notifyMentions?: boolean;        // a teammate @-mentions me in a comment (docs/specs/012-collaboration/comment-mentions.md)
```

Both **default on** (undefined === true): the user asked to be told, so the
toggle is an opt-**out**, mirroring [User preferences](../007-editor/user-preferences.md)'s `notificationsEnabled`. The
profile page reads/writes them through the existing
`readUserPreferences` / `writeUserPreferences(prefs, ownerId)` round-trip, so
a flip is saved to the account and syncs across devices and apps. Each flip emits
`UI` / `Toggled` / `NotifyDesignJoin{On,Off}` /
`NotifyInviteResponse{On,Off}` telemetry ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)) before persisting.

### Server-side read

The api worker decides whether to send a notification by reading the
recipient's settings server-side: `getNotificationPrefs(env, ownerId)`
(`apps/api/src/accounts/settings.ts`) makes one accounts settings read and
answers every flag, all on (notify) when nothing is stored or the accounts
Worker can't be reached. Only an explicit `false` turns one off. A missing key means
the default (on), so a user who has never touched the toggle still gets
notified.

## 4. The two notifications

Both are **transactional** (sent whenever email is on AND the recipient
hasn't opted out), best-effort in `ctx.waitUntil`, and never on the
request's critical path, the same contract as every [Transactional email](transactional-email.md) send. Recipients'
addresses come only from trusted server state (the account's verified
address, asked of the accounts Worker), never from a client header.

### a. Someone joins my design: `notifyDesignJoin`

The signal is **a new person opening one of my shared designs for the first
time**. liveworkspace's index records every visit through a link, and on a person's first it sends livedesign a
join notice (`notice`, `apps/api/src/routes/internal-items.ts`), which the api answers with the design room's
`joined(personId)` and `Document·Joined` by the link's level. A guest visit is counted as `Document·Joined` but never
emails: a guest token is free to get, so every fresh guest would be another first visit. The room's
`notifyDesignJoin`:

- no-ops unless `emailEnabled(env)`;
- resolves the owner's verified address from their liveworkspace account (so
  it only fires for a signed-in owner; a guest-owned design has no address
  and is silently skipped);
- no-ops when the owner's `notifyDesignJoin` pref is `false`;
- no-ops unless it wins the per-design throttle: at most one join email per
  design per 15 minutes (claimed inside the design's Durable Object, which sends the email,
  `apps/api/src/email/notifications.ts` `notifyDesignJoin`; the new-comment email's rule
  on its own claim);
- otherwise sends the **design-joined** email: "Someone just opened
  _{design name}_", with a CTA back to the design.

The design **name** is the recipient owner's _own_ content going back to
them, so including it does not widen the [Transactional email](transactional-email.md) §7 content rule (which is
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

Sent by liveworkspace, not livedesign: teams, their invitations and the
answer emails belong to the liveworkspace account, and the accounts Worker
tells each joined admin when an invitee accepts or declines, unless they have
turned `notifyInviteResponse` off ([liveworkspace/docs/specs/003-accounts/accounts.md](../../../../liveworkspace/docs/specs/003-accounts/accounts.md)
"Invitations"). It also counts those emails (`Email·Sent·InviteResponse`) under
the app the inviter signed up through. The switch stays in livedesign's
Settings because it is a setting every app shares.

## 5. Privacy / security

- Signed-in only; every recipient address comes from verified server state,
  never a client header (consistent with [Teams](../013-workspace/teams.md)'s removal of
  `X-Owner-Email` and [Transactional email](transactional-email.md) §7).
- The only user-influenced strings in a notification body (a design name, a
  joiner name) are HTML-escaped, and each is
  either the recipient's own content or already known to the recipient.
- Off by default at the deployment level (no `EMAIL` binding → no sends, no
  UI), and off per-notification when the recipient opts out. The no-required-SaaS rule
  stays intact ([Open source + distribution](../002-project-scope/open-source-and-business-model.md)): no required SaaS call, the toggles just hide.

## 6. Out of scope (for now)

A global "all email off" master switch (the lifecycle onboarding series still
has no unsubscribe, [Transactional email](transactional-email.md) §8), notification batching/digests, in-app
(non-email) notifications, and editing name/avatar from the profile page
(identity belongs to the liveworkspace account). The page reads identity; it doesn't write it.
