# Assigned actions

**Status: implemented.** Assign a piece of work to a teammate directly from an
element on the canvas: a new **Assign Action** tile attaches a named, described,
assigned action to the element, optionally emailing the assignee. To make
room for it the context menu's collaboration band splits in two:
**Collaborate** (Assign Action + Comments, the people tiles) and
**Resources** (Link + Note, the attached-material tiles). The floating
**Collaborate Panel** (§5 — the merged Comments + Actions surface,
[Panel corner docking](../007-editor/panel-docking.md) docking) lists the tab's actions and comment threads and jumps
to them. Builds on teams ([Teams](../013-workspace/teams.md)) for the assignee picker, the
comment-thread element-data pattern (see `commentThread`), transactional
email ([Transactional & lifecycle email (Resend)](../014-identity/transactional-email.md)), and the profile notification toggles ([Account settings & email notifications](../014-identity/profile-and-email-notifications.md)).

An action is collaboration metadata on an element, exactly like a comment
thread: it lives in the element, persists through the normal tab autosave,
syncs to everyone in the realtime room, and is deliberately **not undoable**
(the carve-out comments already use): Cmd+Z must never silently
unassign someone's work.

## 1. Data model

At most **one action per element** (mirrors note + link, keeps the panel,
badge, and popover 1:1 with elements). The one exception is the **Action
panel** ([The Action Panel](action-panel.md)), a card whose job is to hold a list: it carries
`actions: ElementAction[]`. Everything that reads actions goes through
`elementActions(el)`, which returns that list or the single `action` as a
one-item list, so the Collaborate panel, the Activity page, the timeline and
the email treat both the same. A new optional field on boxed elements in
`packages/document`:

```ts
interface ElementAction {
  id: string;
  name: string; // required, short ("Confirm the retry budget")
  description: string; // optional detail, '' when empty
  assignee: {
    // The stable key: a Clerk user id, or — for a SELF-assignment made
    // while signed out — the guest participant id (docs/specs/014-identity/auth-and-guest-access.md hybrid
    // identity). Guests can only ever pick themselves, so a guest id
    // here always means "the assigner's own browser identity".
    // Null for an INVITED member who hasn't been identified with an
    // account yet — `memberId` is their key then.
    userId: string | null;
    // The team membership row id — set when the assignee was picked
    // from a team (joined or invited). For an invited member it is the
    // only stable key: the server resolves their invite email from the
    // membership row at send time (§4), so no address enters the blob.
    memberId?: string;
    name: string | null; // display name at assign time (render fallback: "Teammate")
  };
  // The team the assignee was picked from; null for a self-assignment
  // (Myself is not a team row).
  teamId: string | null;
  assignerId: string; // Clerk user id of who assigned it
  assignerName: string | null;
  status: 'open' | 'done';
  createdAt: number;
  updatedAt: number;
}

// on Element
action?: ElementAction;
```

**No email address is ever stored in the element blob.** Documents travel
(share links, embeds, exports); the blob carries only the Clerk `userId` /
membership `memberId` and a display name, all already visible to anyone the
assignee collaborates with. The assignee's address is resolved server-side
at send time (§4), never denormalised. An invited member's display name is
the email local-part prettified (the same `memberName` the team pane
shows), never the full address.

Assignee/assigner identity here is informational (who to render), not a
permission: anyone with edit access can complete, edit, or delete an action,
the same way they can edit any element content.

**A copy doesn't carry the action.** Copy / paste (both the OS clipboard and
the in-app fallback buffer) strips `action` along with comment threads and poll
responses: an action is work somebody handed to a person, with its own id in
the Activity index, not a property of the shape, so a pasted copy would be a
second action under the same id that nobody assigned.

## 2. The context-menu split, the tile, and the dialog

Today's single Collaborate category (`ElementContentSections.tsx`: Add/Edit
Link, Add/Edit Note, Comments) splits into **two categories in the same
collaboration band** ([Canvas and palette](../008-canvas/canvas-and-palette.md) band 4), in this order:

1. **Collaborate** (comment icon): the people tiles — **Assign Action**
   (new) and **Comments**.
2. **Resources** (link icon): the attached-material tiles — **Add/Edit
   Link** and **Add/Edit Note**. Link-cards keep their existing carve-out
   (their Link lives in its own category), so a link-card's Resources shows
   Note alone.

Both categories keep the old section's gate (boxed elements only, so arrows
are excluded just like today), each gets its own accordion section id
(`'collaborate'`, `'resources'`), and the band separator rules are
unchanged. The **Assign Action** tile:

- **Always shows, for everyone.** The feature is not sign-in gated:
  a signed-out user (or a Clerk-less self-host, [Open source + distribution](../002-project-scope/open-source-and-business-model.md)) can assign an
  action to **themselves** — the picker offers a pinned **Myself** row in
  every session, so actions double as personal to-dos on the document.
  Only assigning to OTHER people needs an account: teammates come from
  teams ([Teams](../013-workspace/teams.md)), so a signed-out picker shows Myself alone plus a
  gentle "sign in and join a team to assign teammates" nudge with the
  sign-in CTA ([Sign-in encouragement](../014-identity/sign-in-encouragement.md) encouragement, not a wall — [Auth + guest access](../014-identity/auth-and-guest-access.md)). No email is
  ever offered for a self-assignment (§4).
- When the element already has an action, the tile reads **View Action**
  and opens that action's popover (§3) instead of the assign dialog, the
  same open-what-exists behaviour as the Add/Edit Link and Note tiles.

Clicking it opens the **Assign Action dialog** (its own component under
`components/dialogs/`, per the no-god-files rule), with:

- **Assignee**: a pinned **Myself** row (every session — the signed-in
  account, or the guest participant identity), then the **joined members
  of the team whose shared library holds this document** (`GET
/api/teams/<documentTeamId>` members, via the existing api-client
  helper), each row showing the member's avatar bubble and display name
  (email local-part fallback, as TeamPane does). Members of the user's
  OTHER teams are deliberately not offered: they aren't members of this
  document's team, so they almost certainly can't open the document to
  complete the action — offering them just manufactures the §4 access
  warning. **Invited-but-not-joined members ARE offered** (with the same
  amber "Invited" badge the team pane uses): work often gets divided up
  while invites are still in flight. An invited member is keyed by their
  membership `memberId` (their `userId` when the lazy claim has already
  identified an account, else null), and picking one shows an
  informational hint — "{name} hasn't accepted the team invite yet;
  they'll get access when they join" — instead of the §4 access check,
  which needs an account to ask about. **Myself is preselected** when
  creating, so the common self-assignment is zero-click and handing off
  is one.
  Myself-only states, each with its own nudge: a **personal document**
  (no team library) offers the fix INLINE — "Move this document into a
  team library to assign teammates", with a button per joined team that
  performs the [Team shared documents](../013-workspace/team-shared-documents.md) placement move (`PUT /api/documents/<id>/folder`
  with the team id, landing at the team root) right from the dialog and
  reloads the picker with that team's members, no Explorer round-trip; a
  signed-in user with no teams gets the create-a-team link instead; a
  signed-in user **not a member of the document's team** (a share-link
  editor) gets a plain Myself-only picker; a signed-out user sees Myself
  plus the sign-in nudge (§2).
  The §4 access check stays as belt-and-braces on the picked assignee.
- **Action name**: required single-line text, **pre-filled from the
  element's label** (a table's first non-empty cell) when creating, so
  the default action reads as the work item it sits on; the text is
  selected on focus so typing replaces it in one keystroke.
- **Description**: optional multi-line text.
- **"Email {name} about this action"**: the shared iOS-style toggle
  (`ToggleSwitch`, the same control every settings row uses), **default
  on**, rendered only when `useCapabilities().emailEnabled` is true
  ([Account settings & email notifications](../014-identity/profile-and-email-notifications.md) §2): a self-host without Resend never advertises a send it
  can't perform. **Hidden entirely for a self-assignment** (guest or
  signed-in) — you don't email yourself about your own action, so the
  row disappears rather than defaulting off.

Confirming writes `el.action` (status `open`, assigner stamped from the
current user), persists via the normal tab path (`tickTabs`, not `commit`,
like comment mutations in `useEditorComments`), and, when the checkbox was
ticked, fires the notify request (§4) fire-and-forget: email failure must
never block or roll back the assignment.

Assigning requires **edit access** to the document: the action rides the tab
blob. View-role visitors see actions read-only (§7).

## 3. On-canvas surface: badge + popover

- **Badge**: the element-badges cluster (`element-badges.tsx`) gains an
  action badge alongside the comment badge, shown only while the element has
  an `open` action. Clicking it opens the action popover. Done actions show
  no badge (finished work should not shout). The cluster itself renders as
  **one connected pill** — link / note / action / comment as segments with
  hairline separators — rather than detached circles.
- **Popover**: `ActionPopover`, anchored on the element like
  `CommentThreadPopover`: the action name + description up top, one calm
  assignee/assigner meta row (avatar bubble, "Assigned to you"/name,
  "by {assigner} · {relative time}"), and an icon-button footer:
  - **Complete**: sets `status: 'done'` (and `updatedAt`). The action drops
    out of the badge and moves to the panel's Completed filter, staying on
    the element; the popover then offers **Reopen** (back to `open`),
    mirroring resolve/unresolve on comment threads.
  - **Edit**: reopens the assign dialog prefilled to change the name,
    description, or assignee. Changing the assignee re-offers the email
    checkbox (default checked) so the **new** assignee can be notified; an
    edit that keeps the assignee sends nothing.
  - **Delete**: removes `el.action` after a two-step inline confirm (the
    button re-arms as "Confirm delete", no nested dialog over a popover).
    Deleting the element deletes its action with it.

State + handlers live in their own hook (`useEditorActions` under
`hooks/collab/`, beside `useEditorComments`), composed into the editor
state; nothing is added to `useEditorState.ts` beyond the wiring call.

## 4. Email notification

A new **signed-in-only** endpoint on the api worker (Clerk JWT required,
401 otherwise):

```
POST /api/teams/<teamId>/notify-action
body: { assigneeUserId?, assigneeMemberId?, documentId, actionName, description? }
```

The server, not the client, establishes every fact that matters:

- verifies the **caller** is a joined member of `<teamId>`;
- verifies the **assignee** (`assigneeUserId`, or `assigneeMemberId` for
  an invited member) is a joined OR invited member of `<teamId>` (404
  otherwise, so there is no probing which users exist);
- verifies the caller can access `documentId` (owner, team library, or
  shared-with), and reads the **document name from D1**, not the body;
- resolves the assignee's address from trusted server state
  (`team_members.email` / `email_lifecycle`), never a client header
  ([Transactional & lifecycle email (Resend)](../014-identity/transactional-email.md) §7, [Account settings & email notifications](../014-identity/profile-and-email-notifications.md) §5);
- resolves the assigner's display name from the caller's own identity, so a
  spoofed `assignerName` in a tab blob can never sign an email;
- no-ops silently unless `emailEnabled(env)` and the assignee's
  `notifyActionAssigned` pref (§6) is on; an invited member with no
  account has no prefs yet, so the pref defaults to on and the invite
  email from the membership row is the destination.

Then it sends the **action-assigned** email (new template in
`email/templates.ts`, dispatcher in `email/notifications.ts` following the
`notifyDocumentJoin` shape, best-effort in `ctx.waitUntil`): "{assigner}
assigned you an action on _{document name}_", the action name, the first
~200 characters of the description, and a CTA linking to the document. All
user-influenced strings (action name, description, document name, assigner
name) are HTML-escaped. The content stays within [Transactional & lifecycle email (Resend)](../014-identity/transactional-email.md) §7: everything in
the mail is either the assigner's own words being delivered on their behalf
or a document/team fact the two already share.

**Invited-assignee caveat:** the panel's / popover's "mine" match is by
`userId`, so an action assigned to a not-yet-identified invitee (null
`userId`) renders by name but won't join their Mine view even after they
accept — acceptable v1: the action is still on the canvas, and reassigning
(or completing) it works for anyone with edit access. Invitees the lazy
claim already identified carry their real `userId` and match normally.

**Access caveat:** assigning is allowed on any document the assigner can
edit, including ones the assignee cannot open. The dialog does a REAL
check rather than guessing: picking an assignee fires
`GET /api/teams/<teamId>/access-check?assigneeUserId=&documentId=`, which
applies the same gates as notify-action (caller + assignee joined members
of the team, caller can access the document, 404s that never probe) and
answers `{ canAccess }` from the three legs the server can actually see —
the assignee owns the document, is a joined member of the document's
team-library team, or has previously opened it through a share link
(`shared_with`). Only a definite "no" shows the hint ("{name} can't open
this document yet: share it or move it to the team library"); while the
check is in flight nothing shows, and if it errors the dialog falls back
to the old heuristic (picked team ≠ the document's team → hedged "may not
be able to open" wording). Auto-sharing on assign is explicitly not done
(v1): quietly widening access as a side effect of an assignment is worse
than a dead CTA.

## 5. The Collaborate Panel

ONE docked panel ([Panel corner docking](../007-editor/panel-docking.md)) for both ways work gets discussed / divided
on a document — it replaced the separate Comments and Actions panels,
which crowded the same corner:

- `PanelId` `'collaborate'` in `lib/panel-layout.ts` (replacing the old
  `'comments'` + `'actions'` ids; stored layouts naming those are
  dropped by the normaliser and the merged panel takes its default
  corner), default corner `bottom-right` (only its reset target: it always
  renders as a popover); `CollaboratePanel.tsx` under `components/panels/` on
  `MovablePanel`, lazily imported and mounted from `useCanvasChromePanels.tsx`.
- **It lives behind a button in the bottom-right cluster.** A
  **Collaborate** button (speech-bubble glyph) sits **right after the Layers
  button**, in every layout ([Layers](../006-document/layers.md) is the model). It shows the tab's
  **open count** as a badge (the shared `CountBadge`, brand tone, hidden at
  zero). Pressing it opens the panel as a **popover hanging above it**
  (`computeDockAnchor(..., 'above')`) in **every** layout, desktop Floating
  included; a second press or a press outside closes it, and it shares the
  dock's one-open-at-a-time slot with Layers, Activity and the Explorer.
  Floating does not dock it in a corner the way it docks Layers: a panel
  this tall, docked bottom-right, ran up under the Palette on a short window,
  and a popover never meets another corner. It renders outside the corner
  layer for the same reason Toolbar's cluster popovers do.
- **The button shows only when it is relevant: the active tab has at least
  one comment thread OR one action**, open or resolved. Nothing to
  collaborate on, no button and no panel. Unlike Layers it is there for a
  **view-role** visitor too (they read threads and answer them); it hides in
  zen and during the welcome flow like the rest of the cluster ([Live app](../007-editor/live-app.md) "Mobile chrome").

**Settings › Panels › Collaborate › Enable Collaborate Panel** (`collaboratePanelEnabled`,
[User preferences](../007-editor/user-preferences.md)) turns the panel and its cluster button off, even while
the tab has threads or actions. Comments and actions keep working from the elements.

### The look

The panel follows the refreshed Collaborate cards ([Participant responses](participant-responses.md), [Q&A board](qa-board.md) "The look"): soft tinted rows rather than a ruled list, a friendly empty state with its glyph in a soft brand disc, round brand controls, count chips, and short motion that collapses under Reduce motion. It is editor chrome, not a card on a themed tab, so its accent is the **brand** colour rather than a tab theme's.

- **Header.** The title with the **open count** in a brand chip sitting directly beside it (`MovablePanel`'s `titleAdornment`), hidden at zero. It no longer floats in the middle of the header.
- **Open / Resolved.** A segmented control on the shared sliding pill (`SegmentSlider`), each side carrying its count. **Open** = open actions + unresolved comment threads; **Resolved** = completed actions + resolved comment threads (the thread still reopens from its element badge). It lands on Open, or Resolved when nothing is open.
- **Kind chips.** Under the segmented control, three small chips: **All** (the word), **Comments** (bubble glyph) and **Actions** (clipboard glyph), each with its count for the current side. Comments and Actions show only their glyph and count, so the row fits a narrow panel; their name is the chip's accessible name ("Comments 12") and its tooltip; the active one takes a soft brand fill. They show only when the tab has BOTH kinds; with one kind there is nothing to narrow. (They replace an unlabelled funnel button that cycled through three hidden states.)
- **Sections.** In the Open view, rows assigned to you lead under a **For You** label, and everything else follows under **Everything Else**. The labels show only when both groups have rows; a single group needs no heading.
- **Action rows** lead with a **round check**. Pressing it completes the action (or, in Resolved, reopens it) in place, through the same `completeAction` / `reopenAction` the card and popover use, with a brief pop; the row then moves to the other side. Read-only visitors see the check as a static status disc. The body is the action name (up to two lines, struck through once done) over a quiet meta line: the element label and the relative time. The assignee sits on the right: a **You** chip in brand for your own, otherwise an initials avatar with the name on its hover card.
- **Comment rows** lead with a bubble disc tinted in the latest author's colour, carrying the thread's comment count. The body is the element label over the latest comment, prefixed with its author's first name ("Priya: Agreed, let's queue it"), clamped to two lines, and the relative time sits top-right.
- **Rows** are rounded, tinted on hover, fully keyboard reachable (the row is a button; the check is its own button with a label naming the action), and slide in on a short stagger (`stagger-enter`).
- **Row click goes to the conversation.** For an ordinary element it
  selects the element and opens its matching popover (comment thread /
  action). For an element that **is** the conversation, a
  [Comment panel](comment-pin.md) (`comment-pin`) or an [Action panel](action-panel.md) (`action-card`),
  it selects the card and **scrolls the canvas to centre it** instead: the
  card already shows the thread or the action, so a popover beside it would
  only repeat it. As a popover the panel closes once a row is clicked, so it
  never covers where the click took you.
- **Density.** Rows breathe: 12px horizontal and 10px vertical padding, a
  6px gap between rows and 12px between sections, the body at a relaxed
  line height (the title 13px over a 11px meta line with 3px between), and
  the controls sit 10px apart. The rows scroll inside the panel past
  `min(26rem, 50vh)` so it never grows up into the Palette's corner, while
  the switch and chips stay put. It is an 18rem side panel (16rem before, which
  the looser rows would have squeezed).

### Empty states

A glyph in a soft brand disc, a Title Case heading, and one line:

| View                 | Heading              | Line                                                             |
| -------------------- | -------------------- | ---------------------------------------------------------------- |
| Open, everything     | All Caught Up        | Nothing open on this tab. New comments and actions show up here. |
| Open, comments       | No Open Comments     | Every thread on this tab is resolved.                            |
| Open, actions        | No Open Actions      | Every action on this tab is done.                                |
| Resolved, everything | Nothing Resolved Yet | Finished actions and resolved threads collect here.              |
| Resolved, comments   | No Resolved Comments | Resolved threads collect here.                                   |
| Resolved, actions    | No Completed Actions | Finished actions collect here.                                   |

The panel has no loading or error state of its own: its rows derive synchronously from the tab's elements, and it does not mount until there is something to list.

### Derivation

Rows come from the `actionRowsFromElements` + `commentRowsFromElements` derivations in `CollaboratePanel.tsx` (comment rows carry a `resolved` flag). Everything interleaves newest-first on its own timestamp (an action's createdAt, a thread's latest comment), with your own actions first.

## 6. Preference + profile toggle

One new opt-out flag in the [User preferences](../007-editor/user-preferences.md) preference blob, default **on**
(`undefined === true`, like every [Account settings & email notifications](../014-identity/profile-and-email-notifications.md) flag):

```ts
notifyActionAssigned?: boolean; // someone assigns me an action
```

- Server-side it joins `NotificationPrefs`
  (`apps/api/src/db/notification-prefs.ts`), read by the notify dispatcher.
- Client-side the profile page (`ProfilePane.tsx`, [Account settings & email notifications](../014-identity/profile-and-email-notifications.md)) gains a
  `NotificationRow`: "Someone assigns me an action", gated with the others
  on `emailEnabled`, flipping through the same `setFlag` round-trip.

This is the recipient-side kill switch the dialog checkbox cannot be: the
checkbox is the assigner's courtesy, the preference is the assignee's
consent.

## 7. Permissions, guests, view role

- **Assign / edit / complete / delete** require edit access to the document
  (the mutation is a tab write). Signed-out users can assign only to
  themselves (their guest participant id); assigning to teammates needs
  the signed-in team picker. Every edit-role collaborator can complete or
  delete any action, consistent with how all element content works today.
- **Guests and view-role visitors** still _see_ actions (badge, popover,
  panel): an assignee following a share link should find their action even
  before anyone grants them edit. They get no mutating controls. Dedicated
  view-role mutation routes (the comments `POST`/`DELETE` pattern) are a
  known follow-up, not v1.
- The notify endpoint leaks nothing across team boundaries: both parties
  must be joined members of the named team, and the response never includes
  the resolved address.

## 8. Telemetry

Per [Telemetry + public transparency dashboard](../017-telemetry/telemetry.md), one-liner `track` calls at the handlers. A dedicated
**Action** category (added to the closed `TELEMETRY_CATEGORIES` enum)
carries the events:

- `Action`/`Created` with type `EmailOn`/`EmailOff` (the dialog checkbox
  state at assign time);
- `Action`/`Changed` with type `Reassigned` (the edit changed the
  assignee) or `Edited` (name/description only);
- `Action`/`Resolved` (completed), `Action`/`Unresolved` (reopened),
  `Action`/`Deleted`;
- `Action`/`Opened` (the popover opened, from the tile, badge, or a
  panel row);
- the profile toggle flip emits `UI`/`Toggled`/`NotifyActionAssigned{On,Off}`,
  fired before persisting like every settings flip ([Account settings & email notifications](../014-identity/profile-and-email-notifications.md));
- `UI`/`Opened`/`ActionSignInNudge` when a signed-out user opens the
  dialog and sees the Myself-only picker with the sign-in nudge.

Never the action name, description, or any identity: types are preset
enum-ish tokens, not user content.

## 9. Out of scope (v1)

- ~~A cross-document "my actions" inbox~~ — shipped as the Explorer's
  **Activity** page ([Activity page](../013-workspace/activity-page.md)), exactly the way this bullet predicted:
  a D1 projection (`collab_actions`) written beside every tab save,
  with the per-element blob still the source of truth.
- Due dates, priorities, more than one action on an ordinary element (an
  Action panel is the place for a list), and multiple assignees.
- Auto-sharing the document with the assignee on assign (§4 caveat).
- View-role mutation endpoints (complete-without-edit-access).
- Reminder / nag emails; exactly one send per assignment or reassignment
  with the box ticked, nothing recurring.
- In-app (non-email) notifications.
