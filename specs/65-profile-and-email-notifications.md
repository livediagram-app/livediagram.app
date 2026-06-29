# 65 — Profile page & email notifications

**Status: in progress.** A signed-in user's account home in the Explorer:
their avatar, name, email, and join date in one place, plus the two
account actions that previously had no home of their own — **delete my
account** and **email notification preferences**. Builds on the Resend
integration (spec/64) and the synced preference store (spec/20).

Like spec/64 the email half is **entirely gated on `RESEND_API_KEY`**: when
email is off, the notification toggles are hidden (they'd do nothing) and no
notification email is ever sent. Guests have no account, so the whole page is
signed-in only.

## 1. The profile page

A new Explorer section at **`/explorer/profile`** (`profile` `SelectedNode`
kind, registered in `app/explorer/routes.ts` like every other section). It
renders inside the normal Explorer chrome (sidebar + header) via
`ExplorerPane`, like Tokens / Themes. Signed-in only: a guest who deep-links
it sees the same "sign in" prompt the Tokens pane shows, never a broken page.

The page shows, read from Clerk's `useUser()` on the client (no new API):

- **Avatar** — `user.imageUrl` when `user.hasImage`, else the same
  initial-letter bubble the header pill uses (shared look, spec/04).
- **Name** — `user.fullName ?? username ?? email`.
- **Email** — `user.primaryEmailAddress.emailAddress`.
- **Joined** — `user.createdAt`, formatted as a plain date.

Below the identity card sit two sections: **Email notifications** (§3) and a
**Danger zone** with **Delete account**.

### Reaching it

- **Sidebar** — the existing "Hi {name}" greeting at the top of
  `ExplorerSidebar` becomes a button that navigates to the profile when
  signed in (plain text for guests, who have no profile).
- **Header account menu** — `AuthControls`' dropdown gains a **Profile** item
  (a link to `/explorer/profile`) above Sign out, so the profile is reachable
  from anywhere the header chrome renders (editor + explorer).

### Delete account moves here

Account self-deletion already exists end to end (`DELETE /api/account`,
spec/64 §; `DeleteAccountDialog`, the type-your-email confirmation). It used
to hang off the header dropdown; now that there is a dedicated account home,
the **Delete account** trigger lives on the profile page's Danger zone and is
**removed from the header menu** (one home for destructive account actions,
no drift). The dialog component itself is unchanged and simply reused — the
confirmation flow (type your email, then Clerk re-verification, then wipe) is
exactly as spec/64 describes.

## 2. Capabilities gains `emailEnabled`

`GET /api/capabilities` (the fail-closed feature probe the client already
uses for AI) gains `emailEnabled: boolean`, true only when
`emailEnabled(env)` (i.e. `RESEND_API_KEY` is set). `CapabilitiesResponse`
and `useCapabilities()` carry it through. The profile page hides the Email
notifications section entirely when it's false: with no email backend the
toggles would be inert, and a self-host without Resend should not advertise a
setting it can't honour.

## 3. Email notification preferences

Two new per-user flags, stored in the **same `user_preferences` JSON blob**
as the editor flags (spec/20) — reusing that synced store rather than minting
a parallel one (no migration; the blob already round-trips D1 ↔ localStorage
and survives the sign-up migration). They are account/email settings that
happen to share spec/20's storage:

```ts
// added to UserPreferences (spec/20)
notifyDiagramJoin?: boolean;     // someone first opens one of my shared diagrams
notifyInviteResponse?: boolean;  // someone accepts/declines a team invite I (an admin) sent
```

Both **default on** (undefined === true): the user asked to be told, so the
toggle is an opt-**out**, mirroring spec/20's `notificationsEnabled`. The
profile page reads/writes them through the existing
`readUserPreferences` / `writeUserPreferences(prefs, ownerId)` round-trip, so
a flip persists to D1 immediately and syncs across devices. Each flip emits
`UI` / `Toggled` / `NotifyDiagramJoin{On,Off}` /
`NotifyInviteResponse{On,Off}` telemetry (spec/22) before persisting.

### Server-side read

The api worker decides whether to send a notification by reading the
recipient's preference blob server-side: `getNotificationPrefs(env, ownerId)`
does a single `SELECT prefs FROM user_preferences` and parses it, returning
`{}` (→ all defaults → notify) on a missing/corrupt row. A missing key means
the default (on), so a user who has never touched the toggle still gets
notified.

## 4. The two notifications

Both are **transactional** (sent whenever email is on AND the recipient
hasn't opted out), best-effort in `ctx.waitUntil`, and never on the
request's critical path — same contract as every spec/64 send. Recipients'
addresses come only from trusted server state (the verified
`email_lifecycle.email` written at first sighting, or the inviter-typed
`team_members.email`), never from a client header.

### a. Someone joins my diagram — `notifyDiagramJoin`

The signal is **a new person opening one of my shared diagrams for the first
time**: the share-resolve path (`GET /api/share/<code>`) already records a
visitor in `shared_with` via `recordSharedAccess`, but only when the visitor
identifies and isn't the owner. `recordSharedAccess` now reports whether the
row was **new** (first visit) vs a repeat. On a new visit the worker fires
`notifyDiagramJoin(env, diagram, joinerName)` which:

- no-ops unless `emailEnabled(env)`;
- resolves the owner's email from `email_lifecycle` (so it only fires for a
  signed-in Clerk owner who has a stored verified address — a guest-owned
  diagram has no address and is silently skipped);
- no-ops when the owner's `notifyDiagramJoin` pref is `false`;
- otherwise sends the **diagram-joined** email: "Someone just opened
  _{diagram name}_", with a CTA back to the diagram.

The diagram **name** is the recipient owner's _own_ content going back to
them, so including it does not widen the spec/64 §7 content rule (which is
about not leaking _other_ users' content). The joiner's display name is
included when known (the owner already sees it in live presence and the
Shared-with-you list); it's HTML-escaped like the team name.

Only the first visit notifies — repeat opens by the same person are silent,
so an active collaborator doesn't generate a mail per reload. This is the
only server-observable "join" signal; live-room reconnects in the Durable
Object are deliberately **not** wired (they'd be far too chatty).

### b. Someone responds to a team invite — `notifyInviteResponse`

When an invitee **accepts** (`POST …/members/<id>/accept`) or **declines**
(the `DELETE …/members/<id>` on a still-`invited` row), the worker fires
`notifyInviteResponse(env, team, responderEmail, accepted)` which:

- no-ops unless `emailEnabled(env)`;
- finds the team's **joined admins** (`listTeamAdminUserIds`), resolves each
  one's email from `email_lifecycle`;
- skips any admin whose `notifyInviteResponse` pref is `false`;
- sends each remaining admin the **invite-response** email: "_{email}_
  accepted / declined your invitation to _{team name}_".

The responder address and team name are both already known to the inviting
admin (they typed the address, they named the team), so this stays within
spec/64 §7. **Leaving** a team (removing a `joined` row) is not an invite
_response_ and does not notify; only the invited→accepted / invited→declined
transitions do.

## 5. Privacy / security

- Signed-in only; every recipient address comes from verified server state,
  never a client header (consistent with spec/32's removal of
  `X-Owner-Email` and spec/64 §7).
- The only user-influenced strings in a notification body (a diagram name, a
  joiner name, a responder email, a team name) are HTML-escaped, and each is
  either the recipient's own content or already known to the recipient.
- Off by default at the deployment level (no `RESEND_API_KEY` → no sends, no
  UI), and off per-notification when the recipient opts out. Self-hosting
  stays intact (spec/03): no required SaaS call, the toggles just hide.

## 6. Out of scope (for now)

A global "all email off" master switch (the lifecycle onboarding series still
has no unsubscribe, spec/64 §8), notification batching/digests, in-app
(non-email) notifications, and editing name/avatar from the profile page
(identity is managed in Clerk). The page reads identity; it doesn't write it.
