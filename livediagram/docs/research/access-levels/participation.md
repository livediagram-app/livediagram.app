# Participation: what taking part in a session means, and who may

Research note for the access-levels design. Read-only research: nothing here changes a spec. It answers one angle:
how live-facilitation products separate **running** a session from **taking part** in it, how they treat anonymous
and link visitors, what abuse they defend against, how commenting relates to participating, and what that means
for livediagram's own session tools.

Sources were read on 2026-10-03. Every external claim links to the page it came from. Where a vendor's help centre
could not be retrieved, this note says so and makes no claim about that product.

## In one paragraph

Every product studied treats **running a session** as a separate axis from the access level: a hat somebody puts
on (Lucid's facilitator, Parabol's facilitator, Miro's "who can start collaboration tools"), not a rung on the
ladder. **Taking part** is where they diverge. Canvas tools either demand edit access to vote (FigJam, Miro's
estimation app) or let every board user vote, viewers included (Miro voting). Audience tools (Mentimeter, Slido,
Kahoot, Miro Engage) let anyone holding a code take part with no document access at all, and put their abuse
controls on the **session** (passcode, sign-in, one response per device, a rotating join pattern) rather than on a
role. livediagram today sits awkwardly between the two: a view link can answer a poll, post and upvote on the Q&A
board, comment and react, but cannot place a dot, estimate, take a temperature, drop an idea, mark itself done or
answer a quiz. Webber's four positions (Viewer, Participant, Editor, and Owner as something apart) fit the evidence
well, with one recommendation: make **Participant** the single level that may say something (comment and answer),
keep **facilitating** a hat that editors wear, and harden the room so a participant can only ever write **their
own** answer, which today nothing enforces.

## 1. How other products do it

### What each product lets whom do

| Product                      | Who may **run** a session                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Who may **take part**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Commenting vs taking part                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Miro** (voting)            | Only team members with editing rights can set up voting; a guest or a "visitor who can edit" cannot ([Voting](https://help.miro.com/hc/en-us/articles/360017572274-Voting)). The board owner chooses who may start the timer, voting, video chat and attention management: all editors except link visitors, or owners and co-owners only ([Collaboration tools](https://help.miro.com/hc/en-us/articles/4402396215698-Collaboration-tools)).                                               | "All users on the board", registered or not; votes are anonymous ([Voting](https://help.miro.com/hc/en-us/articles/360017572274-Voting)). "Though only selected users can start these collaboration tools, other board participants can use them" ([Collaboration tools](https://help.miro.com/hc/en-us/articles/4402396215698-Collaboration-tools)).                                                                                                                                                                                   | Separate roles: a Commenter "can view the board content and leave comments", a Viewer "can only view the board" ([Roles in Miro](https://help.miro.com/hc/en-us/articles/360017571194-Roles-in-Miro)). Yet both may vote, so voting sits **below** commenting in Miro.                                                                                     |
| **Miro** (estimation app)    | Set up by team members with editing rights; the facilitator chooses final estimates and ends the session ([Estimation app](https://help.miro.com/hc/en-us/articles/5651786248210-Estimation-app)).                                                                                                                                                                                                                                                                                          | "Everyone participating must have board edit access"; estimates are anonymous ([Estimation app](https://help.miro.com/hc/en-us/articles/5651786248210-Estimation-app)).                                                                                                                                                                                                                                                                                                                                                                 | Not related.                                                                                                                                                                                                                                                                                                                                               |
| **Miro Engage** (activities) | "(Manage) Board editors, (Use) All users" ([Engage activities](https://help.miro.com/hc/en-us/articles/31128769674130-Engage-activities)).                                                                                                                                                                                                                                                                                                                                                  | "Anyone can join an activity from their mobile device or browser" by QR code or a 6-digit code; per-activity options include anonymous votes, a per-person limit and hidden incoming answers ([Engage activities](https://help.miro.com/hc/en-us/articles/31128769674130-Engage-activities)).                                                                                                                                                                                                                                           | Not related: the audience joins the activity, not the board.                                                                                                                                                                                                                                                                                               |
| **FigJam**                   | Anyone on a paid team can start a vote; "anyone in the file can end the session" ([Run voting sessions](https://help.figma.com/hc/en-us/articles/9359912208663-Run-voting-sessions-in-FigJam)). Anyone with edit access can set the timer; anyone in the file can start, pause, add time and stop it ([Timer](https://help.figma.com/hc/en-us/articles/4402269549591-Stay-on-track-with-the-timer-in-FigJam)).                                                                              | "Anyone with can edit access can participate in a voting session. This includes visitors in an Open session" ([Run voting sessions](https://help.figma.com/hc/en-us/articles/9359912208663-Run-voting-sessions-in-FigJam)).                                                                                                                                                                                                                                                                                                             | An **open session** lends anyone, viewers and account-less visitors included, edit access for 24 hours, optionally behind a password, but "open sessions don't currently support ... comments with visitors" ([Open sessions](https://help.figma.com/hc/en-us/articles/4410786053911-Invite-visitors-to-an-open-session)). Taking part without commenting. |
| **Lucidspark**               | Team and Enterprise users create and facilitate a vote ([Voting sessions](https://help.lucid.co/hc/en-us/articles/14995416237460-Use-Voting-sessions-to-collaborate-in-Lucidspark)). Becoming facilitator needs Edit **and** Share permission; the facilitator can restrict the timer, starting votes, private mode, showing authors, locking and hiding to facilitators only ([Facilitator tools](https://help.lucid.co/hc/en-us/articles/14700933540116-Use-Facilitator-Tools-in-Lucid)). | "All registered users can participate"; private voting hides voters ([Voting sessions](https://help.lucid.co/hc/en-us/articles/14995416237460-Use-Voting-sessions-to-collaborate-in-Lucidspark)).                                                                                                                                                                                                                                                                                                                                       | Not stated.                                                                                                                                                                                                                                                                                                                                                |
| **Parabol**                  | Any team Member can "start and facilitate a meeting" ([Roles on Parabol](https://www.parabol.co/support/roles-on-parabol/)); "anyone can press the Start Meeting button and take the facilitator role", and rotating it is recommended ([Sprint poker meetings](https://www.parabol.co/resources/sprint-poker-meetings/)).                                                                                                                                                                  | Team members.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Not related.                                                                                                                                                                                                                                                                                                                                               |
| **Google Drive**             | No sessions.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | No sessions.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | The reference ladder: Viewer, Commenter, Editor, and **Owner** as a separate row (only the owner changes permissions unconditionally) ([Share files from Google Drive](https://support.google.com/docs/answer/2494822?hl=en-GB)).                                                                                                                          |
| **Mentimeter**               | Presenters and editors.                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | The audience, by code. "Anonymous by default, identified by choice"; "by default, your participants can only respond once per device" ([Identity settings](https://help.mentimeter.com/en/articles/10774022-choosing-participant-identity-settings-for-your-use-case), [Once per device](https://help.mentimeter.com/en/articles/465597-can-i-let-the-audience-respond-several-times-per-device)). Required login "prevents double-voting" while keeping names hidden.                                                                  | Not related.                                                                                                                                                                                                                                                                                                                                               |
| **Slido**                    | Hosts, co-hosts and moderators.                                                                                                                                                                                                                                                                                                                                                                                                                                                             | The audience, by code. Optional passcode, required name or email, Google or SAML sign-in ([Secure your slido](https://community.slido.com/setting-up-a-slido-82/secure-your-slido-491), [Participant SSO](https://community.slido.com/authentication-identity-management-241/how-to-set-up-participant-sso-6356)); anonymous or named by default, set by the host ([Participant privacy](https://community.slido.com/setting-up-a-slido-event-82/participant-privacy-set-anonymous-or-named-questions-and-poll-votes-by-default-1609)). | Q&A **is** the participation; there is no document to comment on.                                                                                                                                                                                                                                                                                          |
| **Kahoot**                   | The host.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Anyone with the game PIN. Against a leaked PIN the host can enable **2-Step Join**, a pattern that changes every few seconds on the host's screen; the host can remove a player; a nickname generator and a filter curb abusive names ([Inappropriate nicknames](https://support.kahoot.com/hc/en-us/articles/115002201267-How-to-handle-inappropriate-nicknames)).                                                                                                                                                                     | Not related.                                                                                                                                                                                                                                                                                                                                               |

Not verified, and so not claimed: **Mural** (its help centre renders client-side and could not be retrieved, nor
found in the Wayback Machine), **Retrium**, **Metro Retro** (now Spreo; its home page only advertises "quick,
anonymous polls", [metroretro.io](https://metroretro.io/)), **EasyRetro** (its feature page confirms a "max number of
votes per person", [Features](https://easyretro.io/features/)) and the standalone planning-poker sites. A follow-up
with a browser could fill these in; nothing below depends on them.

### Five patterns

1. **Running is a hat, not a rank.** Lucid makes it a self-assigned role gated on edit and share; Parabol lets any
   member take it; Miro lets the owner narrow who may start tools, while everyone may use them. Nobody models the
   facilitator as a fourth access level. livediagram's baton
   ([Facilitator](../../specs/012-collaboration/facilitator.md)) is already this pattern.
2. **Two families answer "who takes part" differently.** Canvas tools tie it to the document role, and when they
   want an audience they **widen the role temporarily** (FigJam's open session). Audience tools detach it from the
   document altogether: a code gets you into the activity, not the board (Mentimeter, Slido, Kahoot, Miro Engage).
3. **Viewers voting is normal; viewers commenting is not.** Miro lets viewers vote but not comment; FigJam lets
   open-session visitors vote but not comment. So the industry does **not** treat voting as a kind of commenting;
   it treats a vote as the lighter act, a bounded answer to a question someone else asked, whereas a comment is an
   open-ended, attributed, persistent remark.
4. **Abuse is controlled on the session, not the role.** Passcodes, required sign-in, one response per device,
   rotating join patterns, removing a participant, anonymous-or-named switches. Every one is a property of **this
   session**, set by the host.
5. **One answer per person needs an identity.** Where products promise no double-voting they lean on a device
   (Mentimeter's default) or a login (Mentimeter verified participants, Slido SSO). Without either, "one per person"
   is a courtesy.

## 2. What livediagram has today

Two roles reach the room, `edit` and `view`, fixed at the upgrade as `X-Verified-Role`
([API app, Realtime model](../../specs/015-api/api.md#realtime-model)). Three doors decide what a view-role visitor may
write, and they disagree in effect though each is coherent on its own:

- **Presence-class ops** relay from any role (`PRESENCE_OP_KINDS`, `packages/api-schema/src/room-messages.ts`).
  `poll-answer` was placed there on purpose, because "audiences are usually on view links"
  ([Live poll](../../specs/012-collaboration/live-poll.md#roles)).
- **Mutation-class ops** relay only from `edit` (`apps/api/src/document-room.ts:663`). A dot (`vote`) and every
  `el-delta` (estimate, temperature, Done check, quiz pick, idea) are mutations, so a viewer cannot cast them
  ([Session tools](../../specs/012-collaboration/session-tools.md#roles),
  [Per-participant responses](../../specs/012-collaboration/participant-responses.md)).
- **REST doors on `gateRead`** admit a viewer: adding and deleting your own comment, comment pictures, and the Q&A
  board's `add` and `vote` (`apps/api/src/routes/qa-board-routes.ts:63`).

| Action                                                                     | Today's gate                                       | Door                                   |
| -------------------------------------------------------------------------- | -------------------------------------------------- | -------------------------------------- |
| Cursor, laser, follow, tab focus, avatar, reaction pad burst, Bring Focus  | any role                                           | presence op                            |
| Answer a live poll                                                         | **any role**                                       | presence op `poll-answer`              |
| Add a Q&A note, upvote                                                     | **any role**                                       | REST `gateRead`, room writes D1        |
| Add a comment, delete your own, attach a picture                           | **any role**                                       | REST `gateRead`, relayed as `el-delta` |
| Roll the picker for yourself                                               | any role (not written back)                        | local                                  |
| Run a slide deck                                                           | any role                                           | local                                  |
| Place or withdraw a dot                                                    | **edit**                                           | mutation `vote`                        |
| Estimate, temperature, Done check, quiz pick                               | **edit**                                           | mutation `el-delta` `response`         |
| Drop an idea in the idea box                                               | **edit**                                           | mutation `el-delta` `idea`             |
| Tick a checklist item                                                      | edit                                               | mutation `el-delta` `check`            |
| Start, end, reveal or clear any tool; the timer; Q&A discuss, done, remove | edit, and the baton holder when held               | mutation or REST `gateEdit`            |
| Hold the facilitator baton                                                 | edit (`canHold`, `apps/api/src/facilitator.ts:48`) | room                                   |

So a view link already **participates in two tools and not in seven**, for reasons of wire plumbing rather than
product intent. The draft share-roles spec in the agent-cli worktree
(`docs/specs/013-workspace/share-roles.md`) notices this and folds every session answer into a new **comment**
role; its blueprint names the op sets that would move (`PARTICIPATION_DELTA_KINDS = ['response', 'idea']`,
`vote` and `poll-answer` at comment).

## 3. Five verbs, one rule each

Every action in the session tools falls into exactly one of five verbs. The test for each is about **what it
changes and for whom**, which is the only thing a server gate can check.

| Verb              | The rule                                                                                                                                               | Persistent? | Bounded per person? |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- | ------------------- |
| **Viewing**       | Changes nothing anyone else will find later. Ephemeral signals (pointing, following, reacting) count as viewing: they say "I am here, looking there".  | no          | n/a                 |
| **Participating** | Adds or withdraws **your own** answer inside a structure somebody else opened. It cannot change the question, the structure, or anybody else's answer. | yes         | yes, one answer     |
| **Commenting**    | Adds a free-form, attributed remark attached to content, open-ended and outside any session.                                                           | yes         | no                  |
| **Facilitating**  | Changes the session's state for everyone: start, stop, pace, reveal, clear, pick, lift a cover for the room.                                           | sometimes   | n/a                 |
| **Editing**       | Changes the drawing, including the configuration of the tools themselves (a poll's question, a session button's script, a quiz's answer).              | yes         | no                  |

Applied to every tool:

| Tool                             | Viewing                          | Participating                              | Facilitating                                       | Editing                            |
| -------------------------------- | -------------------------------- | ------------------------------------------ | -------------------------------------------------- | ---------------------------------- |
| Dot vote                         | see live counts (unless private) | place / withdraw your dots                 | start, end, reveal, clear, step the walkthrough    | (none beyond the board)            |
| Live poll                        | see the question                 | answer, skip                               | start, end                                         | author a poll on a button          |
| Q&A board                        | read the list                    | add a note, upvote your choice             | discuss, done, reopen, remove, empty               | place / resize the board           |
| Estimate card                    | see the card                     | pick your card                             | reveal, clear the round                            | choose the scale                   |
| Temperature check                | see the gauge                    | register your 1 to 5                       | clear                                              | (configure)                        |
| Idea box                         | see the sealed count             | drop an idea                               | open, clear, scatter to the canvas                 | (configure)                        |
| Done check                       | see the rosters                  | mark yourself done                         | reset everyone                                     | (configure)                        |
| Quiz                             | see the round and reveal         | pick your answer                           | start, lock, reveal, run again                     | edit the question and answer       |
| Picker                           | roll for yourself, locally       | (none)                                     | the roll everyone watches                          | edit the candidates                |
| Timer, agenda, session button    | see the clock                    | (none)                                     | start, pause, reset, press an agenda item / button | configure the button or agenda     |
| Roll call                        | be counted (presence)            | (none)                                     | take the roll                                      | (none)                             |
| Reveal zone                      | lift your own cover              | (none)                                     | lift for the room (with a baton)                   | place the zone                     |
| Reaction pad, laser, Bring Focus | press it                         | (none)                                     | Bring Focus while a baton is held                  | (none)                             |
| Checklist                        | read                             | (none: a tick is shared state, not "mine") | (none)                                             | tick                               |
| Comments, assigned actions       | read                             | (none)                                     | (none)                                             | (none): commenting is its own verb |

Three cases worth stating, because they test the rule:

- **A Q&A note is participation, not a comment.** It answers the board's question, is bounded by the board, is
  run by the facilitator, and can be anonymous ([Q&A board](../../specs/012-collaboration/qa-board.md)). A comment
  is none of those.
- **A checklist tick is editing.** It is one shared value anybody can flip, not one person's answer; it already
  rides an edit-only delta and the share-roles blueprint keeps it there.
- **The reaction pad and Bring Focus are viewing.** They persist nothing. Bring Focus becomes facilitation only
  while a baton is held ([Facilitator](../../specs/012-collaboration/facilitator.md#two-elements-this-changes)).

## 4. Abuse cases, measured against today's code

Widening participation to a level beneath Editor changes who can reach each of these. Each is stated with what
holds today and what a Participant level would expose.

1. **A participant writes somebody else's answer.** The `response` delta carries a client-supplied `participantId`
   (`packages/document/src/element-deltas.ts:45`), and the `vote` op a client-supplied `voter`. Collab keys are
   published on the roster on purpose ([Per-participant responses](../../specs/012-collaboration/participant-responses.md)).
   Today only editors can send either, and an editor can rewrite the whole element anyway, so nothing is lost. A
   Participant cannot rewrite the element, so for them the claimed id **is** the boundary: without a check they
   could withdraw a colleague's estimate or move their dots. This is the one hole a Participant level opens, and
   it has to close in the same change.
2. **Ballot stuffing on a poll.** The room keys a poll answer on the `key` inside the op, falling back to the
   presence id (`apps/api/src/room-live-poll.ts:72`), up to `POLL_ANSWERS_MAX = 1000`. One scripted socket on a
   view link can therefore cast a thousand answers today. The same claimed-key weakness applies to dots and
   responses once participants may send them.
3. **Identity rotation on the Q&A board.** The Q&A voter id is a hash of the caller's owner id
   ([Q&A board](../../specs/012-collaboration/qa-board.md)). A guest can obtain a fresh id from `POST /api/guest-id`, so
   upvotes are one per browser identity, not one per person, and the per-owner write limiter keys on that same id
   ([API app, Rate limiting](../../specs/015-api/api.md#rate-limiting)). That is the honest limit every per-browser
   product has (pattern 5 above); it is worth bounding, not pretending away.
4. **A leaked link.** Today a leaked **view** link can already answer polls, post and upvote Q&A notes, comment and
   upload comment pictures. A share link is revocable, can expire and can carry a password
   ([Share link expiry](../../specs/013-workspace/share-link-expiry.md),
   [Share password](../../specs/013-workspace/share-password.md)), and revoking closes its sockets. What is missing,
   compared with Kahoot or Slido, is **removing one participant** without revoking everybody's link. A true Viewer
   level (looks only) shrinks the blast radius of a leaked look-only link to nothing writable.
5. **Anonymity is against the room, not the wire.** Polls say "not shown against names", never "anonymous", because
   the relay carries the sender's presence id ([Live poll](../../specs/012-collaboration/live-poll.md#anonymity--what-is-and-isnt-guaranteed));
   the idea box's `el` op carries `from` ([Idea box](../../specs/012-collaboration/idea-box.md#the-limit-stated-plainly)).
   Slido, by contrast, states its anonymous mode is "truly anonymous"
   ([Participant privacy](https://community.slido.com/setting-up-a-slido-event-82/participant-privacy-set-anonymous-or-named-questions-and-poll-votes-by-default-1609)).
   Nothing about levels changes this; it should not be promised more strongly when participation widens.
6. **Agents stuffing a session.** An API token holds no socket ("The agent holds no socket", in the agent-cli worktree's
   `docs/specs/024-agents/agent-presence.md`), so it cannot send `poll-answer`, `vote` or deltas.
   It **can** call REST, so a comment-or-above token could post and upvote Q&A notes. The agent-presence draft
   already says an agent "never counts in a session's head count, the Done check or a roll call".

### Two constraints that shape the design

- **The room does not know who anybody is**, deliberately
  ([Facilitator](../../specs/012-collaboration/facilitator.md#the-constraint-that-shapes-this)). "One answer per
  person" can only ever mean one per browser key. The cheapest real guard is to **pin the collab key to the socket**
  at `hello` and refuse any `vote`, `response` delta or `poll-answer` whose key differs. One socket then speaks for
  one key, so stuffing needs one admitted socket per ballot, each through a share code, a ticket and the rate caps.
- **Participant writes need a home in D1.** Answers travel as `el-delta` and `vote` ops and reach D1 only through
  the room's ledger and the next **editor** save that carries a cursor; a participant never saves a tab. A room of
  participants with no editor present holds their answers in Durable Object storage only (the share-roles
  blueprint's Open A5). The Q&A board already has the robust shape: the room itself writes D1 for a participant
  action (`writeQaAction`, [API app](../../specs/015-api/api.md#what-the-room-writes-to-d1)).

## 5. Options for where participation lives

| Option                                                                                      | What it means                                                                                      | For                                                                                                                                                                                   | Against                                                                                                                                                  |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Participant includes commenting** (Webber's model; the draft's "comment" role renamed) | Viewer < Participant < Editor; Owner apart. Participant comments **and** answers.                  | One middle rung, one server rule ("may say something, may not change the drawing"). Matches today's view link exactly, plus the seven missing tools. Easy to explain on a share card. | Bundles two acts that Miro and FigJam keep apart; a presenter who wants answers but no comments has no level for it.                                     |
| **B. Separate Participant and Commenter levels**                                            | Viewer < Participant < Commenter < Editor (or the two side by side).                               | Mirrors Miro's "viewers vote, commenters comment" precisely.                                                                                                                          | Five positions with the owner; the two middle rungs are not ordered (a commenter who cannot vote?). Every gate grows a branch. No user has asked for it. |
| **C. Viewer and Editor only, plus a session switch "let viewers take part"**                | Levels stay two; the facilitator opens a session to viewers, like FigJam's open session.           | Mirrors the audience tools: control lives on the session.                                                                                                                             | A Viewer would sometimes write, so "Viewer" stops meaning "looks only". Two permission systems to reason about. Comments still need a home.              |
| **D. A with a facilitator narrowing switch**                                                | As A; the facilitator may close a tool to participants (for example "editors only" for this vote). | Keeps one ladder; adds session control only where a facilitator asks for it, the direction products take (pattern 4).                                                                 | Another control to build and explain; nothing asks for it yet.                                                                                           |

**Recommended: A now, with D held in reserve.** The level is the ceiling; a session may later narrow it, never widen
it. A Viewer then means exactly what the word says, which is the one thing the current model cannot offer.

## 6. Recommendations

1. **Adopt four positions: Viewer, Participant, Editor, and Owner apart.** Owner is not a rung: it manages sharing,
   deletion and the baton's last word, as Google Drive's separate Owner row does
   ([Share files from Google Drive](https://support.google.com/docs/answer/2494822?hl=en-GB)). Team members stay
   editors.
2. **Call the middle level Participant, not Commenter.** In a live document the dominant act is answering; a
   comment is one way of saying something. The share card copy can read "Comments, votes and takes part. Can't change
   the drawing."
3. **Viewer looks only.** Presence, pointing, following, reactions, local picker rolls and presenting stay open;
   every persistent write, poll answers included, needs Participant.
4. **Participant gets every participation verb in section 3**, through one server rule: `poll-answer`, `vote`, the
   `response` and `idea` deltas, Q&A `add` and `vote`, and comments. Checklist ticks, configuration and anything
   facilitating stay Editor.
5. **Facilitating stays a hat that only editors wear.** The baton keeps `canHold = edit`; Participant never runs a
   session. This matches Miro, Lucid and Parabol.
6. **Close the claimed-identity hole in the same change.** Pin the collab key per socket at `hello`; refuse a
   `vote`, `response` delta or `poll-answer` naming another key from a non-editor. Without this, a Participant can
   rewrite a colleague's answer.
7. **Give participant answers a D1 path that needs no editor**, following the Q&A board: the room writes the delta
   itself, or the room's ledger is flushed on an alarm. Otherwise answers on a participant-only document live only
   in the Durable Object.
8. **Keep agents out of sessions.** A token's middle level grants comments and presence, never session answers; the
   Q&A participant actions refuse token callers. An agent that votes is ballot stuffing with good manners.
9. **Migrate every existing view link to Participant** (nobody loses a capability) and read-only tokens to Viewer,
   as the draft already proposes; then a newly minted Viewer link is the first truly look-only pass.
10. **Keep the honest anonymity wording.** Widening participation must not upgrade "not shown against names" to
    "anonymous" until the room strips sender ids.

## 7. Open questions for Webber

1. **What is the middle level called on the share card?**
   - **Participant**, as proposed here (R)
   - **Commenter**, the Google Docs word
   - **Contributor**, neutral between the two acts
2. **May a Viewer still answer a live poll?** Today a view link can, and the poll spec calls an audience on view links "the main use".
   - **No**: Viewer looks only; presenters share a Participant link (R)
   - **Yes**: poll answers stay open to Viewers as the one exception
   - **Per poll**: the host chooses when starting it
3. **Are commenting and taking part one level or two?**
   - **One level**, Participant does both (R)
   - **Two levels**, Participant answers, Commenter also comments
   - **One level plus a facilitator switch** that closes a tool to participants
4. **May a Participant hold the facilitator baton?**
   - **Never**: facilitating stays an editor's hat (R)
   - **When the owner allows it**, a per-document setting
   - **Always**: anyone in the session may run it, as in Parabol
5. **How hard should "one answer per person" be?**
   - **Pin the collab key per socket** and refuse mismatches (R)
   - **Accept per-browser limits** and document them
   - **Optional sign-in per session**, as Mentimeter and Slido offer
6. **What may an API token at the middle level do in a session?**
   - **Comments only**, never answers (R)
   - **Everything a Participant may**
   - **Nothing beyond Viewer**: tokens are Viewer or Editor only
7. **Where do participant answers reach D1 when no editor is present?**
   - **The room writes them**, as it does for the Q&A board (R)
   - **A ledger flush on a Durable Object alarm**
   - **Accept** that they wait for the next editor save
