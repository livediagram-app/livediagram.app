# Access levels: how other products do it

Research for the access-levels design ([draft spec](../../../../livediagram-agent-cli/docs/specs/013-workspace/share-roles.md),
worktree `livediagram-agent-cli`). It surveys how collaborative, whiteboarding and facilitation products name and
bound their access levels, and what that means for livediagram's proposed four: **Viewer**, **Participant**,
**Editor**, with **ownership** held apart.

## Method and confidence

- Vendor help centres and developer docs, retrieved in October 2026. Every claim links its source.
- Some help centres would not render for retrieval (Mural's is behind a login, Canva's, Whimsical's and Microsoft's
  are client-rendered). Claims about those products are marked **(unverified)**: they reflect documented behaviour as
  generally known, but were not re-read for this note and should be confirmed before they carry a decision.
- Plans and tiers change often; where a capability is plan-gated, the note says so rather than listing prices.

## Product by product

### Google Docs, Sheets and Slides

- **Levels:** Viewer, Commenter, Editor, Owner ([Share files from Google Drive](https://support.google.com/docs/answer/2494822)).
  The Drive API names them `reader`, `commenter`, `writer`, `owner`, and shared drives add `fileOrganizer` and
  `organizer` above `writer` ([Drive API roles](https://developers.google.com/workspace/drive/api/guides/ref-roles)).
- **What each does:** Viewer views; Commenter views and comments; Editor views, comments, edits and, by default,
  shares and changes permissions, "but an editor can't change the owner". Viewers and commenters may download, print
  and copy by default; the owner can switch that off, and can stop editors from sharing ([same page](https://support.google.com/docs/answer/2494822)).
- **Ownership:** a single owner with "full control". Ownership is transferred only to someone the file is already
  shared with, and on work accounts only inside the organisation; an admin can transfer in bulk when someone leaves
  ([Transfer ownership](https://support.google.com/drive/answer/2494892)).
- **Links vs invited:** both use the same three roles. Expiry exists on eligible work and school accounts only.
- **Tokens:** OAuth scopes are coarse (`drive.readonly`) or per-file (`drive.file`, "per-file and narrow access"),
  and Google steers apps to the narrow one ([Choose Drive API scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)).
  A token never exceeds the user's own role on a file.
- **Session tools:** none in Docs; not a facilitation product.

### Figma and FigJam

- **Levels:** `can view`, `can edit`, and Owner ([Guide to sharing and permissions](https://help.figma.com/hc/en-us/articles/1500007609322-Guide-to-sharing-and-permissions)).
  There is no separate commenter: `can view` "can only perform certain read only actions, like inspecting
  properties, following, and commenting" ([same](https://help.figma.com/hc/en-us/articles/1500007609322-Guide-to-sharing-and-permissions);
  [File and folder permissions](https://help.figma.com/hc/en-us/articles/35361119554711-File-and-project-permissions)).
- **Session participation rides on edit.** In FigJam, "anyone with can edit access can participate in a voting
  session", including Open-session visitors ([Run voting sessions](https://help.figma.com/hc/en-us/articles/9359912208663-Run-voting-sessions-in-FigJam));
  "anyone with can edit access can set a timer" ([Timer](https://help.figma.com/hc/en-us/articles/4402269549591-Stay-on-track-with-the-timer-in-FigJam)).
  A viewer can comment but cannot vote.
- **Anonymous participants:** an **Open session** temporarily gives anyone with the link `can edit` for 24 hours,
  without an account, optionally behind a password; visitors cannot comment ([Invite visitors to an open session](https://help.figma.com/hc/en-us/articles/4410786053911-Invite-visitors-to-an-open-session)).
  Admins can disable public links and open sessions organisation-wide ([Manage public link sharing](https://help.figma.com/hc/en-us/articles/5726756336791-Manage-public-link-sharing-and-open-sessions)).
- **Ownership:** the creator. Only the owner can transfer, it cannot be undone, and transfer neither moves the file
  nor changes the old owner's access. Figma itself says "anyone with can edit access on a file can do almost
  everything the owner can" ([Transfer ownership](https://help.figma.com/hc/en-us/articles/360038512093-Transfer-ownership-of-files-or-folders)).
- **Links vs invited:** link audience (anyone, organisation, workspace, invited only) plus a view or edit level;
  password and link expiry are add-ons ([Share files and prototypes](https://help.figma.com/hc/en-us/articles/360040531773-Share-files-and-prototypes)).
  **Seats are separate from permissions**: editing needs both.
- **Tokens:** granular scopes (`file_content:read`, `file_comments:write`, `webhooks:write`, ...), and "scopes do not
  supersede the permissions granted to you": a token is the user's access narrowed, never widened
  ([REST API scopes](https://developers.figma.com/docs/rest-api/scopes/)). Comments have their own write scope;
  the REST API has no general content write at all.

### Miro

- **Levels:** Owner, Co-owner, Editor, Commenter, Viewer on a board; the same family on Spaces
  ([Roles in Miro](https://help.miro.com/hc/en-us/articles/360017571194-Roles-in-Miro);
  [Board access rights](https://help.miro.com/hc/en-us/articles/360017572194-Board-access-rights)).
- **Session participation rides on view.** "Registered viewers can join voting sessions and see the running timer"
  ([Board access rights](https://help.miro.com/hc/en-us/articles/360017572194-Board-access-rights)); for voting,
  "all users can participate", including non-registered users, while only "team members with editing rights can set
  up voting" and guests or editing visitors cannot ([Voting](https://help.miro.com/hc/articles/360017572274)).
  Running a session is a different permission from taking part in it.
- **Who someone is** is a second axis beside the board role: **Visitors** (public link, no account), **Guests**
  (invited by email, not in the team) and **Members** ([Visitors, guests and members](https://help.miro.com/hc/en-us/articles/7045408248594-Visitors-guests-and-members)).
  Visitors may view, comment or edit per the link, but even editing visitors cannot rename the board, change
  sharing, start a vote or video, lock objects or see the activity list ([Collaboration with Visitors](https://help.miro.com/hc/articles/360012524559)).
- **Ownership:** one owner per board, who alone moves the board, deletes it, transfers ownership (to team members
  only, irreversibly) and decides who may share ([Roles in Miro](https://help.miro.com/hc/en-us/articles/360017571194-Roles-in-Miro);
  [Transfer ownership](https://help.miro.com/hc/articles/7534591807122)). **Co-owners** carry "nearly all owner-level
  actions" except deletion and transfer, so a facilitator can prepare and run a board for someone else
  ([Co-owners](https://help.miro.com/hc/articles/360021580759)).
- **Team admins** "don't receive any special level of access to other users' content"
  ([Roles in Miro](https://help.miro.com/hc/en-us/articles/360017571194-Roles-in-Miro)).
- **Links vs invited:** the same three levels for both; public links can carry a password and, on Enterprise,
  expire ([Collaboration with Visitors](https://help.miro.com/hc/articles/360012524559)).
- **Tokens:** `boards:read` and `boards:write`, plus team and organisation scopes ([Miro scopes](https://developers.miro.com/docs/scopes)).
  No comment-only scope.

### Mural (unverified unless linked)

- **Levels on a mural:** edit and view for collaborators; **Facilitator** is a role on the mural that unlocks the
  facilitation toolkit (timer, summon, private mode, voting sessions, laser, outline). **(unverified)**
- **Who someone is:** workspace Members, Guests (invited, limited to what is shared), and **Visitors** (anonymous,
  by link, no account); the API exposes exactly this split, letting an app read "whether they have member, guest, or
  visitor permissions" ([Mural API scopes](https://developers.mural.co/public/docs/scopes)).
- **Session participation:** facilitators start voting sessions; anyone in the mural, visitors included, casts
  votes. Private mode hides authors while people write. **(unverified)**
- **Ownership:** the creator owns, can transfer, and room and workspace admins sit above. **(unverified)**
- **Tokens:** read and write scopes per resource (`murals:read`, `murals:write`, `rooms:write`, ...), where
  `murals:write` covers widgets ([Mural API scopes](https://developers.mural.co/public/docs/scopes)).

### Lucid (Lucidchart and Lucidspark)

- **Levels:** **Can view**, **Can comment**, **Can edit**, **Can edit and share**, plus the owner, who can transfer
  to an existing collaborator ([Share with collaborators](https://help.lucid.co/hc/en-us/articles/4642423138196-Share-with-collaborators-in-Lucid)).
  Sharing is its own level above edit.
- **Facilitation is gated on edit and share.** To "make yourself a facilitator" you need Edit and Share permissions;
  the facilitator can then restrict starting the timer, voting and private mode to facilitators only
  ([Facilitator tools](https://help.lucid.co/hc/en-us/articles/14700933540116-Use-Facilitator-Tools-in-Lucid)).
- **Participation:** "all registered users can participate in a Voting session", and private voting is an option
  ([Voting sessions](https://help.lucid.co/hc/en-us/articles/14995416237460-Use-Voting-sessions-to-collaborate-in-Lucidspark)).
- **Anonymous participants:** **Guest Collaborators** join from a link with Edit, Comment or View, without an
  account; their toolset is listed separately from registered users' ([Guest Collaborators](https://help.lucid.co/hc/en-us/articles/13592910415380-Guest-Collaborators-in-Lucid)).
- **Links vs invited:** link users are not listed individually but as a single "Share link" collaborator, managed as
  a group ([Share with collaborators](https://help.lucid.co/hc/en-us/articles/4642423138196-Share-with-collaborators-in-Lucid)).

### Notion

- **Levels:** **Can view**, **Can comment**, **Can edit**, **Full access** (edit and share), plus database-only
  **Can edit content** ([Sharing and permissions](https://www.notion.com/help/sharing-and-permissions)).
- **Ownership:** pages have no single owner; "Full access" is the sharing tier, and workspace roles (Workspace owner,
  Membership admin, Member) and Guests sit above pages ([Members, admins and guests](https://www.notion.com/help/add-members-admins-guests-and-groups)).
  The broadest grant wins.
- **Anonymous:** "Anyone on the web with link" can view without an account, but must sign in to comment or edit;
  the link can expire ([Sharing and permissions](https://www.notion.com/help/sharing-and-permissions)).
- **Tokens:** connections carry **capabilities**: read, update and insert content, and separately read and insert
  comments, in any combination ([Connection capabilities](https://developers.notion.com/reference/capabilities)).
  A comment-only integration is a first-class idea.

### Confluence

- **Model:** open by default; space permissions (view, add pages, add comments, delete, admin) and then
  page-level **restrictions** of view or edit, set by anyone who can edit the page and manage restrictions in the
  space ([Manage permissions at the content level](https://support.atlassian.com/confluence-cloud/docs/manage-permissions-on-the-page-level/)).
  Commenting is a space permission, not a page level. Restrictions are unavailable on the Free plan (same page).
- **Anonymous:** opt-in per site and space. **(unverified detail)**

### Microsoft Whiteboard and Loop (unverified)

- Both ride on OneDrive and SharePoint sharing links: "can edit" or "can view", scoped to anyone, the organisation
  or specific people, with tenant admins able to forbid anonymous links. There is no commenter level of their own,
  and Whiteboard's reactions and timer follow edit. **(unverified)**

### Excalidraw, Excalidraw+ and tldraw

- **Excalidraw (free):** a live-collaboration room link lets anyone with it edit; there is no view-only live room.
  Read-only sharing is a static export link. **(unverified)**
- **Excalidraw+ tokens:** API keys are workspace-scoped and **read-only, full-access or route-restricted**; the MCP
  server maps every tool to an API route, so "read-only keys expose read-only tools" and "MCP does not bypass API
  permissions" ([MCP auth and permissions](https://plus.excalidraw.com/docs/mcp/auth-and-permissions)).
- **tldraw:** the SDK leaves access control to the host; the demo sync server's rooms "are publicly accessible", and
  production needs a self-hosted sync server where the integrator enforces permissions
  ([Collaboration](https://tldraw.dev/docs/collaboration)). The commenting package is separate from editing.

### Whimsical and Canva (unverified)

- **Whimsical:** workspace roles (admin, member, guest) and file sharing with view, comment and edit, where free
  viewers may comment; it now ships an MCP connector. **(unverified)**
- **Canva:** **Can view**, **Can comment**, **Can edit** on designs, by link or invite; the owner deletes and
  transfers; a separate "template link" gives people a copy rather than access. **(unverified)**

### Facilitation-first tools

- **Mentimeter:** two separate worlds. **Collaborators** on a presentation hold Edit, Comment or View, and editing or
  presenting additionally needs a paid licence ([Collaborate on Mentis](https://help.mentimeter.com/en/articles/5422663-collaborate-on-mentis-and-folders-with-colleagues)).
  The **audience** joins by code or link with no access to the presentation at all and votes anonymously by default
  ([Is voting anonymous?](https://help.mentimeter.com/en/articles/410476-is-voting-anonymous), **(unverified detail)**).
  Only one person presents at a time.
- **Slido:** the same split: a host and invited co-hosts or moderators manage the event; participants join by code,
  ask, upvote and answer polls, anonymously unless the host asks for names. **(unverified)**
- **Parabol** (open source, AGPL): team members all participate; one person holds the **facilitator** role, which
  passes freely, and reflections are anonymous "by design" ([Parabol on GitHub](https://github.com/ParabolInc/parabol)).
- **EasyRetro, Retrium, Spreo (formerly Metro Retro):** a board owner or facilitator, and participants who join by
  link, write cards, vote with a capped number of votes and see results when the facilitator reveals them
  ([EasyRetro features](https://easyretro.io/features/); [Retrium features](https://www.retrium.com/features);
  [Spreo](https://metroretro.io/)). Participation is the baseline, not a level; there is no "look but don't vote"
  tier. **(levels unverified)**

## Comparison

| Product                                                                                                         | Levels                                                 | Voting, polls, timer ride on                                                                              | Anonymous people                                                       | Owner vs editor                                             | Links vs invited                                                             | Tokens                                                                                                                 |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| [Google Docs](https://support.google.com/docs/answer/2494822)                                                   | Viewer, Commenter, Editor, Owner                       | No session tools                                                                                          | Link viewers anonymous; comment and edit need an account               | Owner transfers; editors share by default, owner can forbid | Same roles both ways                                                         | User role ∩ scope; [`drive.file` per file](https://developers.google.com/workspace/drive/api/guides/api-specific-auth) |
| [Figma / FigJam](https://help.figma.com/hc/en-us/articles/1500007609322-Guide-to-sharing-and-permissions)       | can view (incl. comment), can edit, Owner              | **Edit** ([voting](https://help.figma.com/hc/en-us/articles/9359912208663-Run-voting-sessions-in-FigJam)) | 24 h Open session, edit, no comments                                   | Editors do "almost everything"; owner transfers             | Link audience + level, password, expiry                                      | [Granular scopes](https://developers.figma.com/docs/rest-api/scopes/), never above user                                |
| [Miro](https://help.miro.com/hc/en-us/articles/360017571194-Roles-in-Miro)                                      | Viewer, Commenter, Editor, Co-owner, Owner             | **View** to take part; team editor to run ([voting](https://help.miro.com/hc/articles/360017572274))      | Visitors by public link, reduced tools                                 | Owner deletes, transfers, controls sharing; co-owner runs   | Same levels; visitor/guest/member axis                                       | [`boards:read/write`](https://developers.miro.com/docs/scopes)                                                         |
| Mural                                                                                                           | View, Edit, Facilitator role                           | Any participant votes; facilitator runs (unverified)                                                      | Visitors by link (unverified)                                          | Owner + admins (unverified)                                 | Member/guest/visitor ([API](https://developers.mural.co/public/docs/scopes)) | [`murals:read/write`](https://developers.mural.co/public/docs/scopes)                                                  |
| [Lucid](https://help.lucid.co/hc/en-us/articles/4642423138196-Share-with-collaborators-in-Lucid)                | View, Comment, Edit, Edit and share, Owner             | All registered users vote; facilitator needs edit and share                                               | Guest Collaborators by link                                            | Share is its own tier; owner transfers                      | Link is one "Share link" collaborator                                        | n/a here                                                                                                               |
| [Notion](https://www.notion.com/help/sharing-and-permissions)                                                   | Can view, Can comment, Can edit, Full access           | No session tools                                                                                          | Public link view-only without login                                    | No single owner; Full access shares                         | Same levels; link can expire                                                 | [Capabilities incl. comments](https://developers.notion.com/reference/capabilities)                                    |
| [Confluence](https://support.atlassian.com/confluence-cloud/docs/manage-permissions-on-the-page-level/)         | Space perms; page view/edit restrictions               | No session tools                                                                                          | Opt-in per space                                                       | Space admins                                                | People, groups                                                               | n/a here                                                                                                               |
| MS Whiteboard / Loop                                                                                            | can view, can edit (unverified)                        | Edit (unverified)                                                                                         | Tenant policy                                                          | OneDrive owner                                              | Sharing links                                                                | Graph scopes                                                                                                           |
| [Excalidraw+](https://plus.excalidraw.com/docs/mcp/auth-and-permissions) / tldraw                               | Edit room link; host-defined                           | n/a                                                                                                       | Anyone with link                                                       | n/a                                                         | Link only                                                                    | Read-only, full, route-restricted keys                                                                                 |
| Whimsical / Canva                                                                                               | view, comment, edit (unverified)                       | n/a                                                                                                       | Link viewers                                                           | Owner transfers (unverified)                                | Both                                                                         | MCP / Connect APIs                                                                                                     |
| [Mentimeter](https://help.mentimeter.com/en/articles/5422663-collaborate-on-mentis-and-folders-with-colleagues) | Collaborators: View, Comment, Edit; **audience** apart | **Audience**, no document access                                                                          | Audience anonymous by default                                          | Owner manages collaborators                                 | Invite for collaborators; code for audience                                  | n/a here                                                                                                               |
| Slido, Parabol, retro tools                                                                                     | Host/facilitator + participants                        | **Participation is the baseline**                                                                         | Anonymous by design ([Parabol](https://github.com/ParabolInc/parabol)) | Facilitator role passes                                     | Join link or code                                                            | n/a here                                                                                                               |

## Recurring patterns

1. **View, comment, edit is the lingua franca.** Google, Miro, Lucid, Notion, Mentimeter and (unverified) Canva
   and Whimsical all offer those three words. People arrive already knowing them.
2. **Ownership is never an edit level.** Every product keeps a single owner (or, in Notion, a sharing tier) apart
   from editing. What it holds is consistent: **delete**, **transfer**, **control who may share**, and the
   protective settings (password, download, copy). Figma and Miro both say plainly that editors can do almost
   everything else.
3. **Sharing is the contested capability.** Google lets editors share by default with an owner switch; Lucid and
   Notion make it a tier (**Edit and share**, **Full access**); Miro gives it to co-owners and lets the owner decide.
4. **Running a session is separate from taking part.** Miro (team editor to start, anyone to vote), Lucid (edit and
   share to facilitate), Mural, Parabol and Mentimeter all split the person who drives from the people who answer.
   Facilitation is a **role in the session**, not an access level, and it passes between people.
5. **Where taking part sits is where products differ most** (below), but facilitation-first tools agree: for an
   audience, answering is the baseline and needs no right to change the artefact.
6. **Anonymous participants get a reduced, explicit toolset**, separate from the level. Miro's visitors, FigJam's
   open-session visitors and Lucid's guest collaborators each have their own capability table.
7. **A token is the user's access narrowed, never widened.** Figma says so outright; Excalidraw maps MCP tools to the
   same permitted routes; Google prefers per-file scopes. Notion is the one that lets an integration hold comment
   rights without write rights.
8. **Links and invites share one vocabulary.** Where both exist, a link carries the same levels as a person, plus
   link-only guards: audience, password, expiry.

## Where they differ

- **Session participation:** rides on **edit** in FigJam and (unverified) Microsoft Whiteboard; on **view** in Miro
  (registered viewers vote and see the timer); on a separate **audience** axis in Mentimeter and Slido; and is
  simply **everyone** in retro tools. No surveyed product names a level "Participant", but Mentimeter's audience is
  that idea with its own entry point.
- **Comment:** a level of its own (Google, Miro, Lucid, Notion, Mentimeter) or folded into view (Figma) or into
  space permissions (Confluence).
- **Anonymous access:** Notion and Google demand sign-in to comment or edit; Miro, Lucid, FigJam and the facilitation
  tools welcome anonymous people into the session.
- **Co-ownership:** Miro has co-owners; Google and Figma have exactly one owner; Notion has none per page.
- **Token granularity:** coarse read and write (Miro, Mural, Excalidraw), per-resource (Google `drive.file`), or
  capability sets with comments apart (Notion, Figma).

## How it applies to livediagram

### What exists today

- Two link roles, `view` and `edit` ([API app](../../specs/015-api/api.md)); owners and joined team members always
  edit; team `admin` and `member` govern the team, not documents ([Teams](../../specs/013-workspace/teams.md)).
- The realtime room relays **presence** ops from anyone and **mutation** ops from `edit` only
  ([API app, op classes](../../specs/015-api/api.md)).
- A `view` link can therefore already: read, comment and delete its own comment, add and upvote on the Q&A board,
  answer a live poll, follow and be followed, bring focus, and roll the picker locally
  ([Q&A board](../../specs/012-collaboration/qa-board.md); [Live poll](../../specs/012-collaboration/live-poll.md);
  [Follow-me viewport](../../specs/012-collaboration/follow-me-viewport.md)).
- A `view` link **cannot** cast dot votes, estimates, temperature checks or quiz answers, or drop a card in the idea
  box, because those travel as element mutations ([Session tools](../../specs/012-collaboration/session-tools.md);
  [Participant responses](../../specs/012-collaboration/participant-responses.md);
  [Quiz](../../specs/012-collaboration/quiz.md); [Idea box](../../specs/012-collaboration/idea-box.md)).
- So today's `view` is neither "Viewer" nor "Participant": it is half of each, split by transport rather than by
  intent. That is the root the four-level model addresses.
- The facilitator baton is edit-only and already behaves like the market's "role in the session"
  ([Facilitator](../../specs/012-collaboration/facilitator.md)).
- Tokens are full or read-only and act as their owner, through the same gates
  ([Public API and tokens](../../specs/015-api/public-api-and-tokens.md)).

### What the prior art implies

- **Viewer, Participant, Editor** maps cleanly onto the market's view, comment, edit, and the four-level framing with
  **ownership apart** is exactly pattern 2. livediagram is not inventing a model, only naming its middle tier for
  what it is used for.
- **"Participant" over "Commenter"** fits a facilitation product: Miro, Mentimeter and the retro tools all treat
  answering as the audience's baseline, and livediagram's polls and Q&A are already open to view links for that
  reason. Commenting and answering are both "saying something without changing the drawing", as the draft puts it.
- **Facilitating stays a session role**, held by an Editor through the baton, as Lucid and Miro do. It should not
  become a fifth access level.
- **Ownership carries the familiar bundle**: delete, transfer, share-link management, password and expiry. For team
  documents the owner is effectively the team, which Miro and Notion model with admins and broad grants; the open
  question is who in a team holds those powers.
- **Tokens should take the same vocabulary**, narrowed from the user, never widened (Figma, Excalidraw). A
  Participant token has a precedent in Notion's comment capabilities and gives an agent a safe way to comment or
  answer without editing.
- **Guests stay first-class.** Unlike Notion and Google, livediagram's acquisition strategy is no sign-in wall
  ([Auth and guest access](../../specs/014-identity/auth-and-guest-access.md)); Miro, Lucid and FigJam prove
  anonymous participation works at scale. Who someone is (guest, signed in, member) remains a separate axis from
  what their pass allows.
- **Links remain the only per-person-free grant.** Every surveyed product also offers per-person invites; livediagram
  offers links and teams only. That is a scope choice, not a gap the levels must fill now.

## Recommendations

1. Adopt **Viewer, Participant, Editor** as the access levels for share links, embeds and tokens, with the wire names
   `view`, `participate` and `edit` (or keep `comment` on the wire if the rename cost outweighs clarity; see below).
2. Define **Participant** by intent, not transport: every act that says something without changing the drawing,
   namely comments, Q&A, polls, dot votes, estimates, temperature checks, quiz answers, idea-box cards and Done
   checks. Move the response family off the edit-only mutation gate onto a participant gate, as the comment and Q&A
   endpoints already do.
3. Keep **ownership a relationship, not a level**: the owner (or, for team documents, the team's admins) holds
   delete, transfer, share-link management, password and expiry. Editors never manage sharing, matching the draft.
4. Keep **facilitation a session role** held by an Editor via the baton; Participants take part, never run.
5. Give **tokens the same three levels**, documented as the minting user's access narrowed, and never above it.
6. Keep **guests equal** across all three levels; any reduced guest toolset should be a spec'd exception, not a
   side effect.
7. Migrate existing `view` links to **Participant** so nobody loses what they had; call out that they gain voting and
   responses, and track it in telemetry.

## Open questions for Webber

1. **What is the middle level called?**
   - **Participant**, matching the facilitation framing (recommended)
   - **Commenter**, matching Google, Miro, Lucid and Notion
   - **Contributor**, neutral between commenting and answering
   - Keep **comment** on the wire, **Participant** in the UI

2. **Which session acts does a Participant get?**
   - **Every response**: comments, Q&A, polls, dot votes, estimates, temperature, quiz, idea box, Done check (recommended)
   - **Only ephemeral ones**: comments, Q&A, polls (today's view link), votes stay with editors
   - **Per tool**, set by the facilitator when starting it
   - **Per document**, an owner switch "participants may vote"

3. **What do existing `view` links become?**
   - **Participant**, keeping comments and gaining votes (recommended)
   - **Viewer**, losing comments, Q&A and polls
   - **Participant without the new responses** until the owner opts in
   - Ask each owner once, in the Share dialog

4. **Who may manage sharing (create, revoke, password, expiry)?**
   - **Owner and team admins only** (recommended, matches the draft)
   - **Any Editor**, like Google's default
   - Editors **by default with an owner switch**, like Google
   - A distinct **Editor and sharer** tier, like Lucid and Notion

5. **Does ownership transfer exist?**
   - **Yes, to someone who already has access**, irreversible, like Figma and Miro
   - **Only by moving into a team** library, the team then owns it
   - **Not yet**; specify it later
   - **Co-owners** instead of transfer, like Miro

6. **Which levels can a token hold?**
   - **Viewer, Participant, Editor**, one vocabulary with links (recommended)
   - **Viewer and Editor** only, as today
   - **Capabilities** (read, comment, respond, write) composed freely, like Notion
   - Per-document tokens, like Google's `drive.file`

7. **Should an agent with a Participant token answer votes and polls?**
   - **Comments only**; responses are for people
   - **Yes, labelled as an agent** in results
   - **Only when the facilitator allows agents**
   - **No Participant tokens** at all

8. **Do anonymous guests get the full Participant toolset?**
   - **Yes, identical to signed-in people** (recommended, matches the no-wall principle)
   - **Yes, but they must enter a name** first
   - **Comments need sign-in**, responses do not, like Notion
   - **Owner switch per link**
