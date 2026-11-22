# Blueprint: Reactions on a Page

How [Reactions on a Page](../page-reactions.md) are built. They follow [Comments on a Page](approval-and-comments.md)
step for step (a table of the room's own, a route under the page, a system op, one store in the editor), with one
difference: a Viewer may write here, and nowhere else.

## Domain and naming

- **Reaction** (`PageReaction`): `{ emoji, by, name }`, one person's emoji on one page. `by` is the person's collab
  key (`collabKeyFor`), never an account id. Not a comment reaction (`@liveworkspace/model-core/comment-reactions`,
  six fixed ids on a comment): a page's takes any emoji and is stored by the emoji itself.
- **Quick picks** (`QUICK_PAGE_REACTIONS`, editor `lib/page-reactions/quick-reactions.ts`): 👏 Clap, ❤️ Heart,
  👍 Thumbs Up, 🎉 Party, 👀 Eyes.
- **Capsule** (`PageReactionsCapsule`), its **segments** (one an emoji used), **Add Reaction** (the smile-plus) and
  the **picker** (`PageReactionPicker`).

## Interfaces and contracts

- `@liveknowledge/api-schema` `page-reactions.ts`: the types above, `PageReactionsResponse { reactions }` (oldest
  first), `PageReactionChange { emoji, on }`, `PageReactionChangeResponse { reaction, on, changed }`, `PageReactionOp
{ kind: 'page-reaction', tabId, reaction, on }`, the bounds and `isReactionEmoji`.
- `GET /api/documents/<id>/pages/<tab>/reactions`: every reaction on the page, oldest first. Every grant that reads
  the page (a link confined to another page reads it as missing).
- `POST /api/documents/<id>/pages/<tab>/reactions` `{ emoji, on }`: adds or takes back the caller's own. 200 with
  `changed: false` when it already stood so (idempotent). Refusals: `invalid_change` 400, `invalid_emoji` 400,
  `reaction_needs_account` 403, `reactions_full` 409, `too_many_reactions` 409, `reacting_too_fast` 429.
- `page-reaction` joins `SYSTEM_OP_KINDS` (room-messages.ts) and the worker's mutation kinds (room-internal.ts):
  relayed through `/mutation` with `relayPages`, refused from a client socket, shape-checked in the editor's
  `room-op-shape.ts`.

## Behaviour and state

- The route (`routes/knowledge-reaction-routes.ts`) runs after the knowledge router's grant (`gateGrant`) and page
  lookup (`handlePageRoutes`), so its read is every role's. A change needs a person with an account:
  `pageCreatorOf(ctx)` (a signed-in account, or a workbench session's person) and `readerOf(ctx).kind === 'person'`;
  no token, no guest, no link visitor without an account. The role is never read: a Viewer passes.
- The rate limit (`reactionRate`, same file): a sliding minute a person a knowledgebase, in the room's memory, at
  most `PAGE_REACTIONS_PER_MINUTE` (30) changes; the map holds at most 1,000 people and drops its oldest past that.
  Every change asked counts, refused or not. A room restart forgets it, which is fine for a courtesy limit.
- The store (`knowledge/page-reactions.ts`): `togglePageReaction(env, tab, change, person)` reads the page's rows,
  checks the bounds in `reactionRefusal` (pure), inserts (`INSERT OR IGNORE`) or deletes, and answers whether a row
  changed. Reads are ordered by `at`, then the order rows were written in (`rowid`).
- Live: a change that moved a row relays one op, awaited (as page threads do), so the writer's own client hears it
  before the answer. A change that moved nothing relays nothing.

## Data and persistence

- `page_reactions (tab TEXT, emoji TEXT, person TEXT, by_key TEXT, name TEXT, at INTEGER, PRIMARY KEY (tab, emoji,
person))` with an index on `(tab, at)` and a trigger deleting a page's rows when its tab is deleted. Schema step
  V37 (`pageReactionsSchemaStep`), appended after V36, additive and IF NOT EXISTS.
- Written through `knowledgeDb(env)` (`KNOWLEDGE_DB`, the database that notes nothing): no `room.writes`, so no History
  entry, no Most Used day, no outbox, no revision, no Updated stamp, no version.
- A closed account (`document-anonymise.ts`): `DELETE FROM page_reactions WHERE person` is any of their ids.
- `name` is the person's profile name at the time, kept so the list of who reacted reads without the roster.

## Errors and edge cases

- An emoji is valid when it has no space round it, is at most 32 UTF-16 units, one grapheme (`Intl.Segmenter`), and holds
  an `Extended_Pictographic` or regional indicator code point, or is a keycap (`[0-9#*]️?⃣`).
- Taking back a reaction that is not there, or adding one already there, answers `changed: false`.
- A race of two adds of the same emoji by one person: the primary key keeps one row; the second answers unchanged.

## Security and trust

- The only Viewer write on a page. It reaches one table and nothing in the page; the grant's role is never widened.
- No notification of any kind: the route calls no email, inbox, outbox, automation `queueEvent` or `noteWrite`; a
  test proves a reaction leaves `notify_claims`, `item_events` and the room's write counter where they were.

## Performance and limits

- Bounds: 500 reactions a page (about 60 KB at most for a page's read), 20 emoji a page, 10 a person a page, 30
  changes a minute a person.
- Editor: one `GET` a page a session, scheduled after the page draws; the capsule subscribes to
  `pageReactionsStore` alone and the bar's other slices stay as they were, so a reaction renders the capsule only
  and never the writing. The groups are worked out once per store change (`reactionGroupsOf`), not per render.

## Presentation and UX

- `components/page-reactions/`: `usePageReactions` (the store slice, the caller's key, `canReact`, `toggle` with a
  toast on refusal), `PageReactionsCapsule` (the capsule, its segments, +N and Add Reaction), `PageReactionPicker`
  (the popover: On This Page, Quick Picks, then the page icon picker's search and grid via `EmojiReactionGrid`).
- In `PageEditBarView` the reading corner becomes a row (`data-page-read-corner`): the capsule (its `reactions`
  slot), then Edit. While editing the draft bar replaces the row. `PageEditBar` fills the slot outside Zen Mode and
  an embed.
- Someone who may not edit: `PageReactionsBesideZen`, in `CanvasChrome`'s bottom-right cluster just before
  `ZenControl` (shown there for a read-only session), renders the capsule when `pageEditing.mayEdit` is false, outside
  Zen Mode, an embed, Version History, Ask and AI Knowledge.
- The capsule: `h-10 phone:h-11`, white with a slate ring and `shadow-lg` like Cancel; segments, +N and Add Reaction
  44 px tall and at least 44 px wide on a phone. A segment of yours: brand tint, brand text, `aria-pressed`. Each segment's hover card says "👏 Clap" and "You
  and Priya reacted" (`reactorsLine`, shared with comment reactions). Up to 5 segments (2 under 640 px), then +N.
- The picker: `ResponsivePopover` anchored on the pressed control, 356 px wide, a sheet on a phone.

## Accessibility

- The capsule is a `group` named "Reactions"; each segment's name is "Clap, 3" and its pressed state is yours.
  Add Reaction is named and has `aria-expanded`. The picker's quick picks are buttons named by their emoji's name.

## Testing

- api-schema `page-reactions.test.ts` (the emoji check); api `knowledge-reaction-routes.test.ts` (every role: Editor,
  Participant, Viewer, signed-in view link visitor, guest, page link, agent; bounds, rate limit, the op, no write
  note and no notification, the anonymise and the page delete); editor `page-reactions-store.test.ts`,
  `page-reactions-roles.test.tsx` (Editor, Participant, Viewer, guest) and `PageEditBar.test.tsx` (where the capsule
  stands).

## Constants and configuration

`PAGE_REACTIONS_MAX` 500, `PAGE_REACTION_EMOJI_MAX` 20, `PERSON_PAGE_REACTIONS_MAX` 10, `PAGE_REACTIONS_PER_MINUTE`
30, `REACTION_EMOJI_MAX_LENGTH` 32, capsule segments 5 (2 on a narrow window).
