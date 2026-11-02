# Comment Reactions

Anyone who may comment can react to a comment with one of six emoji, so agreeing, cheering or saying "I've seen
this" takes one press instead of a reply. Everyone in the document sees the reactions and who left them, live, and
they stay with the comment. One behaviour, one look and one component in all four products (livediagram,
liveplanner, livedocuments, livedesign). In livedocuments that is the canvas's comment popover, where reactions
are left, and the thread a presentation shows beside an element ([Presentation mode](presentation-mode.md)), which
shows them read-only as a quiet line under each bubble.

## The six

👍 Thumbs Up · 👎 Thumbs Down · 😄 Laugh · 🎉 Hooray · ❤️ Heart · 👀 Eyes

A fixed set, not a picker: the six cover agreeing, disagreeing, enjoying, celebrating, loving and "seen it", which
is what a comment reaction is for, and a closed set keeps every row the same height and every product drawing the
same glyphs. They are stored by id (`thumbs-up`, `thumbs-down`, `laugh`, `hooray`, `heart`, `eyes`), never as the
emoji text, and always shown in that order.

## Reacting

- **Add Reaction** (a smile with a plus) sits in a comment's row actions, beside Delete. It appears while the row
  is hovered or holds focus, and is always there on a touch screen, where nothing hovers.
- Pressing it opens the **tray** in place, under the comment's text where the reactions land: the six in a small
  pill, the ones you already left marked. It is not a popover; the choice happens where its result appears.
  Pressing an emoji toggles yours and closes the tray. **Left / Right** (and Home / End) move along it, **Escape**
  closes it and puts focus back on Add Reaction, and a press anywhere else closes it.
- **One of each per person.** You can leave several different emoji on one comment, but each only once.
- Each emoji in use shows as a **chip** under the comment: the emoji and how many left it. Yours are highlighted in
  the product's accent. Pressing a chip toggles yours: it adds yours when you haven't, and takes it back when you
  have. Nobody can take anyone else's away.
- **Who reacted:** hovering a chip, focusing it, or a **long press** on a touch screen shows a card naming the
  emoji and who left it, yours first as "You" ("You, Ana and Sam reacted"). Past eight names it counts the rest
  ("and 3 others").
- A comment in a **resolved** thread keeps its chips and their cards, but takes no new reactions until the thread
  is reopened, as it takes no deletes.

## Motion

A chip's emoji pops in (small, a little overshoot, settling) when the chip first appears and when you add yours;
the tray opens from a slightly narrower, faded pill. Both sit within the motion budget (long and short tokens,
docs/specs/004-interface-design/motion.md) and are off under Reduce Motion, the app's or the system's.

## Share roles

[Share roles](../013-workspace/share-roles.md): reacting is taking part, the same rule as commenting.

| Role        | Sees reactions and who | Adds / takes back their own              |
| ----------- | ---------------------- | ---------------------------------------- |
| Editor      | Yes                    | Yes                                      |
| Participant | Yes                    | Yes                                      |
| Viewer      | Yes                    | No: no Add Reaction, chips press nothing |

Outside an editor (an embed, an export) the chips are not drawn.

## How it is stored and travels

- A comment gains `reactions?: { emoji, by, name }[]`, in the order they were left. `by` is the reactor's public
  **collab key** (the per-browser key its hello publishes to the room, `ensureCollabKey`),
  never an owner id, which for a guest is a credential. `name` is the name they reacted under, so the card reads
  without the roster. Absent when there are none, so comments written before this read as they always did, and
  nothing needs migrating. At most 300 per comment.
- A change travels as one element delta, `comment-react` (`commentId`, `emoji`, `by`, `name`, `on`), applied by
  the sender and every receiver through `applyElementDelta`, like every comment change
  ([Collaboration race hardening](collab-race-hardening.md)). Two people reacting at once both land.
- The room stamps the delta's `name` and `by` from the sender's presence, as it stamps a posted comment's author,
  so nobody reacts in someone else's name. livedocuments' room relays element deltas from an Editor only, so a
  **Participant** reacts through the comment endpoints, as it comments:
  `POST /api/documents/<id>/tabs/<tabId>/comments/<commentId>/react` with `{ emoji, on, key }`. The api checks
  the caller may take part, takes the name from their profile, writes the change at the tab's revision and relays
  the same `comment-react` delta to the room. The editor applies it at once and takes it back if the endpoint
  refuses. A Viewer is refused (403) and offered nothing.
- The room's ledger keeps each person's latest on or off per comment and emoji, so an Editor's save made before a
  reaction arrived cannot erase it.
- A tab save keeps whatever reactions it carries, cleaned (malformed ones dropped); an Editor may already change
  anything on the canvas.
- Agents read reactions: the thread listing (`GET .../comments`, the CLI's `comment ls`) carries, per comment, one
  entry per emoji used with its glyph, name, count and who. Agents do not react.

## Shared code

- `@liveworkspace/model-core/comment-reactions`: the six, the stored shape, the one toggle (`withReaction`), the
  checks, the chip grouping, the "who reacted" line and the agents' summary.
- `@liveworkspace/workbench/components/comments/CommentReactions`: `AddReactionButton`, `CommentReactions` (chips
  and tray) and `useReactionTray`; `.../CommentReactionsContext` hands each comment row the session's key, name,
  role and how to send a change, so every surface draws the same thing with no props threaded through the canvas.
- Each product's comment row places the two parts; each product's delta, ledger and room carry `comment-react`.
- livedocuments: `useCommentReactionScope` (apps/editor/hooks/collab) supplies the scope, provided at the editor
  page beside the mention scope; `CommentBubbles` draws the read-only line.

## Telemetry

None yet. A `Comment·Reacted` pair needs a new action in every product's telemetry vocabulary and the platform's
dashboard catalogue; it is Later, and until then reactions are counted nowhere.
