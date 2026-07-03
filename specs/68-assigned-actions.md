# 68 — Assigned actions

**Status: implemented.** Assign a piece of work to a teammate directly from a
diagram element: a new **Assign Action** tile attaches a named, described,
assigned action to the element, optionally emailing the assignee. To make
room for it the context menu's collaboration band splits in two:
**Collaborate** (Assign Action + Comments, the people tiles) and
**Resources** (Link + Note, the attached-material tiles). An **Actions
Panel** (the Comments Panel pattern, spec/63 docking) lists the tab's
outstanding actions and jumps to them. Builds on teams (spec/32) for the assignee picker, the
comment-thread element-data pattern (see `commentThread`), transactional
email (spec/64), and the profile notification toggles (spec/65).

An action is collaboration metadata on an element, exactly like a comment
thread: it lives in the element, persists through the normal tab autosave,
syncs to everyone in the realtime room, and is deliberately **not undoable**
(the spec/12 carve-out comments already use): Cmd+Z must never silently
unassign someone's work.

## 1. Data model

At most **one action per element** (mirrors note + link, keeps the panel,
badge, and popover 1:1 with elements). A new optional field on boxed
elements in `packages/diagram`:

```ts
interface ElementAction {
  id: string;
  name: string; // required, short ("Confirm the retry budget")
  description: string; // optional detail, '' when empty
  assignee: {
    userId: string; // Clerk user id: the stable key
    name: string | null; // display name at assign time (render fallback: "Teammate")
  };
  teamId: string; // the team the assignee was picked from
  assignerId: string; // Clerk user id of who assigned it
  assignerName: string | null;
  status: 'open' | 'done';
  createdAt: number;
  updatedAt: number;
}

// on Element
action?: ElementAction;
```

**No email address is ever stored in the element blob.** Diagrams travel
(share links, embeds, exports); the blob carries only the Clerk `userId` and
a display name, both already visible to anyone the assignee collaborates
with. The assignee's address is resolved server-side at send time (§4),
never denormalised.

Assignee/assigner identity here is informational (who to render), not a
permission: anyone with edit access can complete, edit, or delete an action,
the same way they can edit any element content.

## 2. The context-menu split, the tile, and the dialog

Today's single Collaborate category (`ElementContentSections.tsx`: Add/Edit
Link, Add/Edit Note, Comments) splits into **two categories in the same
collaboration band** (spec/09 band 4), in this order:

1. **Collaborate** (comment icon): the people tiles — **Assign Action**
   (new) and **Comments**.
2. **Resources** (link icon): the attached-material tiles — **Add/Edit
   Link** and **Add/Edit Note**. Link-cards keep their existing carve-out
   (their Link lives in its own category), so a link-card's Resources shows
   Note alone.

Both categories keep the old section's gate (boxed elements only, so arrows
are excluded just like today), each gets its own accordion section id
(`'collaborate'`, `'resources'`), and the band separator rules are
unchanged. For a guest the Collaborate category simply shows Comments alone,
because the **Assign Action** tile is:

- **Signed-in users only.** Teams are Clerk-gated (spec/32), so a guest has
  nobody to assign to; the tile is hidden for guests rather than dangling a
  sign-in wall off the canvas (spec/04).
- When the element already has an action, the tile reads **View Action**
  and opens that action's popover (§3) instead of the assign dialog, the
  same open-what-exists behaviour as the Add/Edit Link and Note tiles.

Clicking it opens the **Assign Action dialog** (its own component under
`components/dialogs/`, per the no-god-files rule), with:

- **Assignee**: a picker over the **joined members of every team the
  current user has joined** (`GET /api/teams` then `GET /api/teams/<id>`
  members, via the existing `useTeams` / api-client helpers), grouped by
  team when the user is in more than one, each row showing the member's
  avatar bubble, display name (email local-part fallback, as TeamPane does),
  and team. Invited-but-not-joined members are excluded (no `userId` yet,
  and possibly no account). Self-assignment is allowed: it is an ordinary
  membership. A user with **no joined teams** sees an empty state linking to
  the Explorer's Teams section instead of the picker.
- **Action name**: required single-line text.
- **Description**: optional multi-line text.
- **"Email {name} about this action"**: a checkbox, **default checked**,
  rendered only when `useCapabilities().emailEnabled` is true (spec/65 §2):
  a self-host without Resend never advertises a send it can't perform.

Confirming writes `el.action` (status `open`, assigner stamped from the
current user), persists via the normal tab path (`tickTabs`, not `commit`,
like comment mutations in `useEditorComments`), and, when the checkbox was
ticked, fires the notify request (§4) fire-and-forget: email failure must
never block or roll back the assignment.

Assigning requires **edit access** to the diagram: the action rides the tab
blob. View-role visitors see actions read-only (§7).

## 3. On-canvas surface: badge + popover

- **Badge**: the element-badges cluster (`element-badges.tsx`) gains an
  action badge alongside the comment badge, shown only while the element has
  an `open` action. Clicking it opens the action popover. Done actions show
  no badge (finished work should not shout).
- **Popover**: `ActionPopover`, anchored on the element like
  `CommentThreadPopover`, showing the action name, description, assignee
  (avatar bubble + name), who assigned it and when (relative time), and:
  - **Complete**: sets `status: 'done'` (and `updatedAt`). The action drops
    out of the panel and badge but stays on the element; the popover then
    offers **Reopen** (back to `open`), mirroring resolve/unresolve on
    comment threads.
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
body: { assigneeUserId, diagramId, actionName, description? }
```

The server, not the client, establishes every fact that matters:

- verifies the **caller** is a joined member of `<teamId>`;
- verifies the **assignee** (`assigneeUserId`) is a joined member of
  `<teamId>` (404 otherwise, so there is no probing which users exist);
- verifies the caller can access `diagramId` (owner, team library, or
  shared-with), and reads the **diagram name from D1**, not the body;
- resolves the assignee's address from trusted server state
  (`team_members.email` / `email_lifecycle`), never a client header
  (spec/64 §7, spec/65 §5);
- resolves the assigner's display name from the caller's own identity, so a
  spoofed `assignerName` in a tab blob can never sign an email;
- no-ops silently unless `emailEnabled(env)` and the assignee's
  `notifyActionAssigned` pref (§6) is on.

Then it sends the **action-assigned** email (new template in
`email/templates.ts`, dispatcher in `email/notifications.ts` following the
`notifyDiagramJoin` shape, best-effort in `ctx.waitUntil`): "{assigner}
assigned you an action on _{diagram name}_", the action name, the first
~200 characters of the description, and a CTA linking to the diagram. All
user-influenced strings (action name, description, diagram name, assigner
name) are HTML-escaped. The content stays within spec/64 §7: everything in
the mail is either the assigner's own words being delivered on their behalf
or a diagram/team fact the two already share.

**Access caveat:** assigning is allowed on any diagram the assigner can
edit, including personal ones the assignee cannot open. When the picked
team's library does not contain the diagram, the dialog shows a small hint
("{name} may not be able to open this diagram: share it or move it to the
team library"). Auto-sharing on assign is explicitly not done (v1): quietly
widening access as a side effect of an assignment is worse than a dead CTA.

## 5. The Actions Panel

A new docked panel (spec/63) mirroring the Comments Panel:

- New `PanelId` `'actions'` in `lib/panel-layout.ts`, default corner
  `top-right` stacked with Comments; `ActionsPanel.tsx` under
  `components/panels/` on `MovablePanel`, collapsible, default-collapsed,
  lazily imported and mounted from `useCanvasChromePanels.tsx`.
- **Mounted only when the active tab has at least one element with an
  `open` action.** No outstanding actions, no panel, exactly the
  Comments Panel contract. Done actions never resurrect it.
- Rows (an `actionRowsFromElements(elements)` derivation beside
  `commentRowsFromElements`): the element label (same "Untitled" fallbacks),
  the action name, the assignee's avatar bubble + name, and relative
  `createdAt` time, newest first. Rows whose assignee is the **current
  user** carry an "Assigned to you" accent and sort first: the panel's
  first job is "what's mine here".
- **Row click selects the element and opens its action popover** (the
  jump-to-element behaviour Comments rows have). Header shows the
  outstanding count in the same brand-coloured pill.

## 6. Preference + profile toggle

One new opt-out flag in the spec/20 preference blob, default **on**
(`undefined === true`, like every spec/65 flag):

```ts
notifyActionAssigned?: boolean; // someone assigns me an action
```

- Server-side it joins `NotificationPrefs`
  (`apps/api/src/db/notification-prefs.ts`), read by the notify dispatcher.
- Client-side the profile page (`ProfilePane.tsx`, spec/65) gains a
  `NotificationRow`: "Someone assigns me an action", gated with the others
  on `emailEnabled`, flipping through the same `setFlag` round-trip.

This is the recipient-side kill switch the dialog checkbox cannot be: the
checkbox is the assigner's courtesy, the preference is the assignee's
consent.

## 7. Permissions, guests, view role

- **Assign / edit / complete / delete** require edit access to the diagram
  (the mutation is a tab write) and a signed-in assigner (the picker is
  teams). Every edit-role collaborator can complete or delete any action,
  consistent with how all element content works today.
- **Guests and view-role visitors** still _see_ actions (badge, popover,
  panel): an assignee following a share link should find their action even
  before anyone grants them edit. They get no mutating controls. Dedicated
  view-role mutation routes (the comments `POST`/`DELETE` pattern) are a
  known follow-up, not v1.
- The notify endpoint leaks nothing across team boundaries: both parties
  must be joined members of the named team, and the response never includes
  the resolved address.

## 8. Telemetry

Per spec/22, one-liner `track` calls at the handlers. A dedicated
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
  fired before persisting like every settings flip (spec/65).

Never the action name, description, or any identity: types are preset
enum-ish tokens, not user content.

## 9. Out of scope (v1)

- A cross-diagram "my actions" inbox (would want a D1 table rather than
  blob-scans; the per-element blob model is chosen deliberately to match
  comments, and a table can be added later without moving the source of
  truth).
- Due dates, priorities, more than one action per element, and multiple
  assignees.
- Auto-sharing the diagram with the assignee on assign (§4 caveat).
- View-role mutation endpoints (complete-without-edit-access).
- Reminder / nag emails; exactly one send per assignment or reassignment
  with the box ticked, nothing recurring.
- In-app (non-email) notifications.
