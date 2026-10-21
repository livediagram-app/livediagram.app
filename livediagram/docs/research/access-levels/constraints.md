# Access levels: the constraints any model must satisfy

Research note for the access-levels design. It asks one question: whatever levels we choose, what must
the model honour, given how livediagram is actually built? It then weighs four candidate models against
those constraints. Read-only research; it decides nothing. Sources are the specs and code on `main` at
`fc2d2d650`, plus the draft spec and blueprint on the `docs/agent-cli` branch, cited as _worktree_.

## Summary

- **Today's "view" link is not look-only.** It already comments, deletes its own comments, answers
  live polls, adds to and upvotes Q&A boards, and presses Bring Focus. It cannot cast dots, estimates,
  temperature checks, Done checks, quiz answers or ideas. No proposed level matches that set exactly,
  so every model either widens former view links or narrows them; "zero loss, no escalation" is only
  exactly achievable if one level is defined as today's view set.
- **Ownership is already a separate dimension in code**, not an edit level: the share family, the
  password, delete and moving out sit behind `ownsDocument`, and the realtime room receives an owner
  bit (`X-Verified-Owner`) beside the role. Team members get edit plus delete and move, but not
  sharing. Full API tokens inherit their owner's ownership powers.
- **The hardest constraints are not in the UI.** They are: (1) participation by a non-editor must
  persist without any editor saving; (2) participant identity (the collab key) is claimed and visible
  to every peer, which is only safe today because only editors can write answers; (3) the old api
  worker reads any unknown role as **edit**, so a naive migration escalates during the deploy window.
- **Recommendation in brief:** a three-level content ladder (Viewer, Participant, Editor) with
  ownership as an explicit, separate grant, delivered expand-then-contract so no old reader ever sees
  an unknown role. Facilitation stays a baton among editors for now. Details at the end.

## How others frame it (brief)

Only enough to anchor terms; the product survey is another angle's job.

- Google Docs offers **Viewer, Commenter, Editor** per file
  ([Google Drive Help: share files](https://support.google.com/drive/answer/2494822)), and treats
  **ownership** as a separate, transferable thing rather than a fourth role
  ([Google Drive Help: make someone else the owner](https://support.google.com/drive/answer/2494892)).
- Figma's **can view** already includes commenting: "People with can view access can only perform
  certain 'read only' actions, like inspecting properties, following, and commenting"
  ([Figma: guide to sharing and permissions](https://help.figma.com/hc/en-us/articles/1500007609322-Guide-to-sharing-and-permissions)).
  Today's livediagram view link is Figma-shaped, not Google-shaped.

## What exists today

### Grants

| Who                               | How the server knows                                                                                                                | Content level | Ownership powers                                                      |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------- | --------------------------------------------------------------------- |
| Personal owner (guest or account) | `isPersonalOwner` on the hybrid id ([document-access.ts](../../../apps/api/src/auth/document-access.ts))                            | edit          | all: share family, password, delete, move, tab link                   |
| Team document owner               | verified account id and still a joined member (`ownsDocument`, [context.ts](../../../apps/api/src/routes/context.ts))               | edit          | all, as above                                                         |
| Joined team member                | verified account id, `team_members.status = 'joined'`                                                                               | edit          | delete and move only (`mayDeleteDocument`); **not** sharing           |
| Share-link holder                 | bearer code, optional password, optional expiry, optional tab scope                                                                 | link's role   | none                                                                  |
| Embed visitor                     | same as share link, inside an iframe, no identity screen                                                                            | link's role   | none                                                                  |
| API token, full                   | `lvd_` hash resolves to its account; flows through every gate as that account                                                       | owner's       | owner's (it passes `ownsDocument`), minus session-only administration |
| API token, read-only              | as above, refused on every `POST`/`PUT`/`DELETE` at one choke point ([index.ts](../../../apps/api/src/index.ts), `read_only_token`) | read          | none in practice (every ownership action is a write)                  |

Sources: [Team shared documents](../../specs/013-workspace/team-shared-documents.md),
[Public API and API tokens §3.4](../../specs/015-api/public-api-and-tokens.md),
[Auth and guest access](../../specs/014-identity/auth-and-guest-access.md).

### What each link role can do today

| Capability                                                           | Path                                                                            | view | edit |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---- | ---- |
| Open, read every admitted tab, pan, zoom, follow, be seen            | `gateRead`; presence ops                                                        | yes  | yes  |
| Cursor, select, laser, avatar, reaction, viewport, Bring Focus       | presence ops (`PRESENCE_OP_KINDS`)                                              | yes  | yes  |
| Answer a live poll                                                   | `poll-answer`, classed as **presence**                                          | yes  | yes  |
| Add a comment (also how one replies), delete one's own               | REST, `gateRead`, author stamped server-side                                    | yes  | yes  |
| Add to and upvote a Q&A board                                        | REST `POST .../qa`, `gateRead`; the room writes D1                              | yes  | yes  |
| Resolve, reopen, delete others' comments                             | room `el-delta` or tab `PUT`                                                    | no   | yes  |
| Dots, estimates, temperature checks, Done check, quiz answers, ideas | room `vote` / `el-delta` (mutation)                                             | no   | yes  |
| Change elements, tabs, document                                      | room mutations, tab `PUT`                                                       | no   | yes  |
| Run session tools, hold the facilitator baton                        | `canHold` is edit-only ([facilitator.ts](../../../apps/api/src/facilitator.ts)) | no   | yes  |

Sources: [room-messages.ts](../../../packages/api-schema/src/room-messages.ts) (op classes),
[document-room.ts](../../../apps/api/src/document-room.ts) (`sender.role !== 'edit' && !isPresenceOp`),
[API app](../../specs/015-api/api.md) (comment and Q&A rows),
[Per-participant responses](../../specs/012-collaboration/participant-responses.md) ("Edit-role only"),
[Session tools](../../specs/012-collaboration/session-tools.md) ("the facilitator and participants share an edit link"),
[Quiz](../../specs/012-collaboration/quiz.md) ("View-role visitors cannot answer").

The consequence: **a retrospective today needs an edit link for everybody who votes**, which is the
problem a Participant level solves.

## Constraints

Each is numbered so the model evaluation can cite it. "Must" means violating it breaks a shipped promise
or opens a hole; "should" is a strong preference.

### Identity and grants

- **C1. Bearer, not person.** Share links grant to whoever holds the code; holders are usually guests
  with no account ([Auth and guest access](../../specs/014-identity/auth-and-guest-access.md)). A level
  must live on the **link**, not on a person, and must work for guests. Per-person grants (Google
  style) are impossible without accounts, and self-hosting without Clerk has none (C17).
- **C2. Revocation is per link.** Removing one person from a level means revoking or rescoping the
  link. A level change on an existing link must end its live sessions, as revoke and rescope already
  do (`closeSessionsOfChangedLink`, `share-revoked`, `share-rescoped`), because a room session's role
  is fixed at the upgrade.
- **C3. Teams grant edit to every joined member** and own nothing extra
  ([Team shared documents](../../specs/013-workspace/team-shared-documents.md)). A model must say
  whether team membership stays edit (it is the team's whole payoff) and must not let a team member
  gain sharing by accident: today only the document's owner (still a joined member) may share a team
  document.
- **C4. Ownership is already separate in code.** `ownsDocument` fronts the share family, the password,
  delete, moving out and tab linking; the room's `X-Verified-Owner` bit (owner may always take the
  baton) is a separate header from `X-Verified-Role`. A model that folds ownership into the level
  ladder would have to undo that separation.
- **C5. Tab scope is orthogonal to role.** "Role and scope are independent: a tab-scoped link can be
  view or edit" ([Tab-scoped share links](../../specs/013-workspace/tab-scoped-share-links.md)). Every
  new level must compose with scope: participation ops must carry a `tabId` so `scopedSenderMayRelay`
  can confine them, and `deniedComment`-style refusals must answer 404 on another tab.
- **C6. Password and expiry are orthogonal.** They sit on the document and the link
  ([Share password](../../specs/013-workspace/share-password.md),
  [Share link expiry](../../specs/013-workspace/share-link-expiry.md)) and must not vary by level.
- **C7. `shared_with` is joined by role.** `GET /api/shared` returns a live code "matching the
  visitor's recorded role and scope". A migration that rewrites `share_links.role` must rewrite
  `shared_with.role` in the same batch, or visitors' Shared-with-you entries lose their code.

### Embeds

- **C8. Embeds suppress the identity screen** ([Embeds](../../specs/013-workspace/embeds.md)), and
  third-party iframe storage is partitioned per embedding site. A participating embed therefore
  contributes under a default guest name, with a fresh guest id and collab key per host site. An embed
  of a Participant link on a public page is an anonymous, unlimited ballot box (C11). A model must say
  whether embeds honour levels above Viewer, and with what identity.

### Realtime room

- **C9. The room gate is binary today**: non-presence ops from a non-edit session are dropped, and
  `drag-preview` is edit-only. Any middle level needs a per-op minimum role, and for `el-delta` that
  means reading `delta.kind` (payload inspection). The fall-through must stay "edit only": the
  room-messages comment records that a mutation kind misfiled as presence "hands view-role visitors a
  write path".
- **C10. `poll-answer` is classed as presence.** A look-only Viewer level therefore requires moving it
  under a participation gate; otherwise a "look only" link can still answer polls.
- **C11. Participant identity is claimed and public.** Answers, dots and Done checks are keyed by the
  **collab key**, which the client claims in `hello` and the room relays to every peer on the roster
  ([Per-participant responses](../../specs/012-collaboration/participant-responses.md)); the `vote` op
  carries a client-supplied `voter`. The spec's own justification is that "any edit-role peer can
  already write any id into the document". Once a **non-editor** may answer, that argument fails: a
  participant could claim a peer's key and overwrite or withdraw their answer, or exceed the dot
  budget (enforced client-side). A participation level must be paired with a server-bound key (for
  example minted into the room ticket from the caller's owner id, never shown raw) and with
  room-side checks that the `voter` / `participantId` equals the sender's bound key. Comments (author
  stamped), Q&A (voter derived server-side) and polls (keyed by server-minted presence id) already
  satisfy this.
- **C12. The baton is edit-only and the owner bit is narrow.** `canHold` requires edit because
  "everything it governs writes to the document"; timers and vote rounds ride ordinary `tab` /
  `tab-meta` ops, which the room deliberately does not inspect
  ([Facilitator](../../specs/012-collaboration/facilitator.md)). Granting facilitation to a non-editor
  needs payload-level classification of those ops. Separately, the upgrade sets `X-Verified-Owner: 1`
  only on the bare-`o` path, which `isPersonalOwner` restricts to personal documents
  ([document-room-routes.ts](../../../apps/api/src/routes/document-room-routes.ts)); on a team
  document no session appears to carry the owner bit, so "the owner can always take it back" seems
  not to hold there. Worth confirming before ownership is made explicit.
- **C13. Roles survive hibernation in the socket attachment** (`verifiedRole?: 'edit' | 'view'`).
  New code must read attachments written by old code, and an unknown or missing role must act as the
  lowest level (it already does: undefined is "not edit").

### Persistence

- **C14. Only editors save tabs.** The tab `PUT` is `gateEdit`; non-editors' participation reaches D1
  only when some editor's later save carries an `X-Room-Cursor` and the api merges the room's ledger
  ([Collaboration race hardening](../../specs/012-collaboration/collab-race-hardening.md) phase 3). No
  cursor, another epoch or no save at all means no merge. A room full of participants whose editor is
  idle, previewing as viewer (the preview turns autosave off) or gone, loses their answers. A
  participation level **must** persist without an editor. Two shipped patterns exist: the comment
  pattern (REST endpoint writes D1, then relays the delta through `/mutation`) and the Q&A pattern
  (the room serialises writes and writes D1 itself with compare-and-swap). The worktree blueprint
  leaves this open (Open A5).
- **C15. Poll answers are ephemeral by design** ([Live poll](../../specs/012-collaboration/live-poll.md));
  they need no persistence path, only a role gate.

### API tokens and agents

- **C16. One choke point, binary today.** `tokenAuth?.readOnly && isWrite` refuses at the dispatcher.
  A middle token level needs a method-and-path classifier (the worktree's `requiredTokenRole`), and
  the grant itself should take the token's level as a ceiling so a future route cannot exceed it.
  Agents act as their owner ([worktree] `docs/specs/024-agents/agent-presence.md`): presence and
  comments need the middle level, changesets need edit; an edit token used on a document where its
  owner holds only a lower link must get the lower of the two.
- **C17. Tokens carry ownership today.** A full token passes `ownsDocument`, so the MCP
  `share_document` tool mints links and tokens can delete to the Trash. Mapping "full" to "Editor"
  without also preserving ownership powers is a loss of ability; keeping them makes ownership a token
  dimension too. Administration (teams, tokens, account) stays session-only whatever the level.
- **C18. MCP vocabulary leaks to agents.** `share_document.role` is `z.enum(['view', 'edit'])`,
  default `view`, described as "recipients can open and read but not change it"
  ([schema.ts](../../../packages/agent-verbs/src/mcp/schema.ts)). If "view" becomes look-only, agents' default links
  silently lose commenting; the default must be chosen deliberately, and MCP clients cache tool
  schemas, so an old schema may send `view` meaning the old thing.

### Offline, self-hosting, telemetry

- **C19. Offline documents have no server, no links, no room** ([Offline Mode](../../specs/006-document/offline-mode.md));
  their holder is always the owner. Level-derived editor flags must default to owner there.
- **C20. Self-hosting without Clerk is guests only**: no teams, no tokens (a token's owner is always an
  account). Every level must work through share links alone, and nothing may require an account.
- **C21. Telemetry types are closed enum values.** `Document·Shared` (client, before the request) and
  `Document·Joined` (server, `link.role === 'edit' ? 'Edit' : 'View'` in
  [share.ts](../../../apps/api/src/routes/share.ts)) are typed by role
  ([Telemetry](../../specs/017-telemetry/telemetry.md)). Migrating stored `view` links changes what
  historic `View` meant; the dashboard needs the cut-over recorded, and old bundles keep emitting the
  old types until reloaded.

### Migration and deploy window

- **C22. Zero loss, no escalation.** Every existing link and token must keep every ability it has and
  gain nothing a reasonable owner would object to. Concretely: edit links stay edit; read-only tokens
  stay read-only; full tokens keep content and ownership powers; view links keep commenting, polls and
  Q&A (anything less is a loss). Gaining dots and answers is a widening that needs Webber's explicit
  consent (worktree Open A1).
- **C23. The schema enforces two roles.** `share_links.role` and `shared_with.role` carry
  `CHECK (role IN ('edit', 'view'))` ([0003](../../../apps/api/migrations/0003_share_links.sql),
  [0010](../../../apps/api/migrations/0010_shared_with.sql)). SQLite cannot alter a CHECK in place; it
  needs the table rebuild procedure ([SQLite: ALTER TABLE](https://www.sqlite.org/lang_altertable.html#otheralter)).
- **C24. Old readers fail open.** During the deploy window the migration is applied just before the
  new api worker goes live ([Deployment](../../specs/016-platform/deployment.md)), so the old worker
  briefly reads new rows. Its readers behave as follows:

  | Reader (old code)                           | Unknown role becomes                  | Effect                                        |
  | ------------------------------------------- | ------------------------------------- | --------------------------------------------- |
  | `rowToShareLink` (api)                      | **edit** (by design, see its comment) | **escalation**: a new middle-level link edits |
  | `consumeWsTicket` (api)                     | refused (null)                        | fail closed                                   |
  | `X-Verified-Role` parse (room)              | undefined, acts as non-edit           | fail closed                                   |
  | `apiLoadShared` (editor bundle)             | edit                                  | editing UI, every save 403                    |
  | collaborator roster (editor bundle)         | "Editor" badge                        | misleading label                              |
  | token resolution, if `read_only` is dropped | query error                           | 500, fail closed but broken                   |

  So the new levels must never be readable by old api code: either ship fail-closed readers first and
  migrate in a later deploy (expand, then contract), or keep a legacy column old code reads safely
  (for example `role` holding `view` for every non-edit level, beside a new `level` column; and
  `read_only = 1` for every token below edit). Old **editor** bundles are not prompted to reload,
  because the [new version prompt](../../specs/016-platform/new-version-prompt.md) fires only on a
  `DOCUMENT_FORMAT` bump; a role change is not one.

### Share dialog and role pill (WCAG 2.2 AA)

- **C25. Text contrast 4.5:1** ([WCAG 2.2, 1.4.3](https://www.w3.org/TR/WCAG22/#contrast-minimum)):
  the pass stub prints the role word at 10 px semibold, which is not large text. Measured today
  (light theme): white on `brand-500` (`#0ea5e9`) **2.77:1** and white on `violet-500` (`#8b5cf6`)
  **4.23:1**, both below AA, so the existing stubs fail before any new level is added
  ([share-dialog-parts.tsx](../../../apps/live/components/dialogs/share-dialog-parts.tsx)). Candidates
  that pass: white on `brand-600` 4.10 (still fails), `sky-700` 5.93, `teal-700` 5.47, `violet-600`
  5.70, `amber-700` 5.02, `indigo-700` 7.90. The role pill passes: `amber-800` on `amber-100` 6.37,
  `emerald-800` on `emerald-100` 6.78; a third tone such as `teal-800` on `teal-100` reaches 6.73.
- **C26. Non-text contrast 3:1** for the selected card border and the status icon
  ([1.4.11](https://www.w3.org/TR/WCAG22/#non-text-contrast)), and **colour never the only cue**
  ([1.4.1](https://www.w3.org/TR/WCAG22/#use-of-color)): each level needs its own glyph and word, not
  just a hue. Four hues that stay distinct for colour-blind users are harder than three.
- **C27. Keyboard and semantics.** The cards are one `radiogroup` with roving focus and arrow keys;
  each extra card must keep a 24 px minimum target
  ([2.5.8](https://www.w3.org/TR/WCAG22/#target-size-minimum)) and must not overflow the dialog at
  narrow widths (three columns fit from `sm`; four likely need two rows).
- **C28. Copy must say what someone can do, in one line**, and the pill must name the level the
  person actually holds. The owner's view preview (`canToggleRole`) is two-state today; more levels
  means deciding which levels the preview can show.

## Candidate models

Notation: today's view link set is **V** (read, presence, polls, comments add and delete-own, Q&A add
and upvote). "Session marks" means dots, estimates, temperature checks, Done check, quiz answers,
ideas.

### At a glance

| Constraint                       | (1) view / comment / edit       | (2) viewer / participant / editor + ownership | (3) viewer / commenter / participant / editor                        | (4) roles + facilitator capability          |
| -------------------------------- | ------------------------------- | --------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------- |
| C22 view links lose nothing      | yes (map to comment)            | yes (map to participant)                      | yes (map to commenter, if commenter = V)                             | as its base model                           |
| C22 view links gain nothing      | no: gain session marks, resolve | no: gain session marks                        | **yes**, if commenter = V                                            | as its base model                           |
| C17 tokens keep ownership powers | implicit, unnamed               | **explicit**                                  | implicit unless paired with (2)                                      | as its base model                           |
| C9 room gate                     | per-op table, 3 levels          | per-op table, 3 levels                        | per-op table, 4 levels; commenter vs participant split by delta kind | plus payload inspection of `tab-meta` (C12) |
| C11 server-bound key needed      | yes                             | yes                                           | yes (participant only)                                               | yes, and for facilitation                   |
| C14 persistence without editor   | yes                             | yes                                           | yes                                                                  | yes, plus facilitator writes                |
| C26 hues and glyphs              | 3                               | 3                                             | 4                                                                    | 3 or 4, plus a capability mark              |
| Matches a familiar product       | Google Docs words               | Google ladder, livediagram words              | none directly                                                        | none directly                               |

### (1) Three roles: view, comment, edit (the worktree draft)

- **Migration.** Edit links stay edit. View links become **comment**, which in the draft also casts
  session marks and resolves comments: a widening (C22), acknowledged as worktree Open A1. Read-only
  tokens become view; full tokens edit. Whether edit tokens keep sharing and delete is left to worktree
  Open A2, so ownership is unnamed.
- **UI.** Three cards (Editor, Commenter, Viewer), three pill words; one new hue. The word
  "Commenter" undersells what the level does in a session: a retro participant does not think of a
  dot vote as a comment.
- **Server gates.** `gateComment` beside `gateRead`/`gateEdit`; `minimumRoleForOp` with `poll-answer`,
  `vote`, `response`, `idea` at comment; token classifier `requiredTokenRole`; migration 0067 rebuilds
  two tables. All specified in the worktree blueprint.
- **Risks.** The deploy window as drafted maps view to comment in the same deploy that introduces it,
  so the old `rowToShareLink` reads `comment` as edit (C24, worktree Open A7). C11 and C14 are not yet
  closed in the blueprint. Naming hides participation, the feature that motivates the change.

### (2) Viewer, Participant, Editor, with ownership separate (Webber's current direction)

- **Migration.** Same mapping as (1) under different names: view to participant (gains session marks;
  needs consent), edit to editor, read-only token to viewer, full token to editor **plus** "acts as
  owner" so `share_document` and token deletes keep working (C17). Ownership needs no data migration:
  it is already derived (`ownsDocument`, team membership).
- **UI.** Three cards; "Participant: comments, votes and answers. Can't change the drawing." states the
  purpose plainly. Ownership is not a card: it appears as the owner's name on the pill (already done:
  "Editing. Owned by Ada") and in who may open the Share dialog's management controls. Settings and
  the MCP consent screen offer three token levels and say separately whether the token acts as owner.
- **Server gates.** As (1), plus naming the owner capability set once (share family, password, delete,
  move, tab link, baton take-back) so gates ask "level at least X" and "holds ownership" as two
  questions. This is also the natural moment to fix C12's team-document owner bit.
- **Risks.** The same deploy-window and integrity work as (1). "Participant" collides with the
  existing `participants` table and `Participant·Created` telemetry (a participant record is any
  visitor's display identity); the domain language needs one canonical term to avoid a synonym clash
  ([Domain language](../../specs/003-system-architecture/domain-language.md)).

### (3) Four roles: viewer, commenter, participant, editor

- **Migration.** The only model with an exact, lossless and non-escalating home for today's view links,
  but only if **commenter is defined as V** (comments, polls, Q&A) and participant adds session
  marks. Defined the intuitive way (commenter = comments only) it loses polls and Q&A, violating C22.
  Tokens as in (1) or (2).
- **UI.** Four cards (likely a two-by-two grid, C27), four hues that must stay distinct without colour
  (C26), four pill words. The commenter/participant line ("you may answer a poll but not cast a dot")
  is hard to explain in one line (C28), because it follows an implementation boundary (REST and
  ephemeral writes versus room mutations), not a user intention.
- **Server gates.** Four-level lattice; the room splits `poll-answer` (commenter) from `vote` and
  participation deltas (participant). Token classifier gains a level.
- **Risks.** More surface for one migration nicety. A level justified mainly by migration tends to
  calcify. Agents would need to pick between commenter and participant tokens for no clear gain.

### (4) Roles plus a separate facilitator capability

- **Migration.** Nothing to migrate for facilitation (the baton is ephemeral, held in room storage);
  roles migrate as in the base model chosen.
- **UI.** A "can facilitate" switch on a link, or the baton offered to non-editors. The roster already
  shows "Facilitating"; the Share dialog would gain a second axis.
- **Server gates.** Facilitation governs timers, vote rounds, polls, quizzes and Q&A running. Only
  `poll-start` / `poll-end` are distinct op kinds; timers and vote rounds ride `tab` / `tab-meta`,
  which the room does not inspect (C12). A non-editor facilitator therefore needs payload-level
  classification of `tab-meta` (or new op kinds), plus REST Q&A running actions gated on the
  capability rather than `gateEdit`. Persistence of facilitator writes then joins C14.
- **Risks.** Large room change for a case the [Facilitator](../../specs/012-collaboration/facilitator.md)
  spec explicitly scoped out ("who is driving, not who is allowed"). Worth keeping as a later layer
  over (2), not a prerequisite.

## Recommendations

1. **Adopt model (2)**: Viewer, Participant, Editor as the content ladder, with **ownership as a
   separate, named grant** (owner, plus "acts as owner" for full tokens). It matches the code's existing
   shape (C4, C17), gives the motivating use case its own word, and keeps three cards and three hues.
2. **Define Participant as a superset of today's view link** (V plus session marks, plus resolving
   one's own comment threads if wanted), and migrate view links to it **only with Webber's recorded
   consent** to the widening (C22). If that widening is unacceptable, the fallback is model (3) with
   commenter = V, not a lossy mapping.
3. **Make Viewer genuinely look-only**, which means moving `poll-answer` out of the presence class and
   gating comments and Q&A participant actions at Participant (C10).
4. **Close C11 before shipping**: mint a server-bound collab key into the room ticket and have the room
   check `voter` / `participantId` against the sender's key for non-editors.
5. **Close C14 before shipping**: give participation its own durable write path, preferably the Q&A
   pattern (the room serialises and writes D1 with compare-and-swap), so answers never depend on an
   editor saving.
6. **Deploy expand-then-contract (C24)**: first ship readers that map unknown levels to Viewer in the
   api, room, ticket and editor; keep a legacy `role` column (`edit` or `view`) and `read_only` beside
   the new level so old code always reads a safe value; migrate and switch writers in a later deploy;
   drop legacy columns last. Bump nothing in `DOCUMENT_FORMAT`; instead use the stale-build signal or
   accept that old editors show wrong labels until reload.
7. **Fix the stub contrast now (C25)**, independent of levels: `brand-500` and `violet-500` stubs fail
   AA today. Give each level a glyph and word as well as a hue.
8. **Keep facilitation a baton among editors**, and record model (4) as a possible later layer.
9. **Keep MCP `share_document`'s default at the level that preserves today's behaviour** (Participant),
   not Viewer, unless Webber decides agents should share look-only links by default (C18).
10. **Record the telemetry cut-over (C21)**: new types for each level, and a dated note that `View`
    before the migration meant what is now Participant.

## Open questions for Webber

```question
Should former view links gain session marks (dots, estimates, Done check, quiz, ideas) when they become Participant links?
- **Widen** them to Participant; owners accept the change (R)
- **Exact** mapping: add a Commenter level equal to today's view link
- **Narrow** to Viewer and tell owners to re-share
- **Ask owners** with a one-time banner per document
```

```question
What may a full API token do as "acting as owner"?
- **Everything** an owner does except administration, as today (R)
- **Content only**: no sharing, no delete; MCP share_document retired
- **Separate flag** on each token for owner powers
- **Editor level** plus sharing, but no delete
```

```question
Who holds ownership powers on a team document?
- **Creator only**, as today, until they leave (R)
- **Every member** may share and manage links
- **Team admins** plus the creator
- **A named document owner**, transferable among members
```

```question
What may an embed of a Participant link do, given embeds have no identity screen?
- **Look only**: embeds cap at Viewer whatever the link says (R)
- **Participate** under a default guest name
- **Participate** after an in-frame name prompt
- **Owner chooses** per embed snippet
```

```question
Where do participants' answers persist when no editor is saving?
- **Room writes D1** itself, as the Q&A board does (R)
- **REST endpoints** per action, as comments do
- **Ledger flush** by the room on an alarm or when it empties
- **Accept loss** and document it
```

```question
How should the deploy window be closed?
- **Expand then contract** over two or three deploys (R)
- **Single deploy** at a quiet hour, staging first
- **Legacy column** only, one deploy, contract much later
- **Maintenance** pause on share links during deploy
```

```question
What should MCP share_document create when an agent names no level?
- **Participant**, preserving today's behaviour (R)
- **Viewer**, the safest look-only default
- **Editor**, matching the REST default
- **Required** field, no default
```

## Notes on method

- Code and specs read on `main` at `fc2d2d650`; draft spec, blueprint and agent specs read on the
  `docs/agent-cli` worktree.
- Contrast ratios computed with the WCAG relative-luminance formula from the hex values in
  [theme.css](../../../packages/tailwind-config/theme.css) and Tailwind's default palette.
- This note is not yet listed in [docs/research/README.md](../README.md); indexing it is left to the
  session that owns that index.
