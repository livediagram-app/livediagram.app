# Linked boards blueprint

Derived from [Linked boards](../linked-boards.md).

## Domain and naming

| Spec term       | Identifier                                                                                         |
| --------------- | -------------------------------------------------------------------------------------------------- |
| linked board    | `PlanBoardSetup.collects?: LinkedRecordKind` (`LINKED_RECORD_KINDS = ['actions']`, packages/items) |
| Actions board   | `actionsBoardIn(tabs)` (apps/live), `collectingBoard(boards, 'actions')` (packages/items)          |
| linked card     | an item whose `fields.linked` parses (`cardLink`); id `linkedCardId('actions', actionId)`          |
| link            | `fields.linked = 'actions/<tabId>/<elementId>/<actionId>'` (`LINKED_FIELD`, `linkString`)          |
| baseline        | `fields.linkedAt` (the action's `updatedAt`) and `fields.linkedRev` (the card's `rev`)             |
| trashed by link | `fields.linkedGone = true` on a card in the Trash (`LINKED_GONE_FIELD`), from before an action's   |
|                 | going left its card; still restored by the heal, never written now                                 |
| Won't Do        | `ElementAction.status = 'wont-do'` (`ElementActionStatus`); `isClosedAction`                       |
| record          | `LinkedRecord` (structural: the items package never imports the document model)                    |
| heal            | `healLinkedCards` (pure), run by `useLinkedActionCards`                                            |

## Files

```
packages/document/src/element-action.ts       ElementActionStatus ('open' | 'done' | 'wont-do'), isClosedAction,
                                              ACTION_STATUS_LABELS
packages/document/src/plan-board-patch.ts      'collects' among SETUP_KEYS
packages/document/src/svg-render-panel-faces.ts the export's Won't Do row (slashed ring, muted, "Won’t Do · name")
packages/items/src/board.ts                   PlanBoardSetup.collects, LINKED_RECORD_KINDS; normaliseBoardSetup keeps it
packages/items/src/presets.ts                 freshSetup (freshBoardSetup's column naming, for any set-up)
packages/items/src/linked-cards.ts            ids, links, status mapping, linkedCardCreate, healLinkedCards,
                                              linkedCardLeftPatch, linkedCardsTrashedBy, unlinkedFields (pure)
packages/templates/src/linked-board-start.ts  actionsBoardSetup, actionsBoardTab, ACTIONS_BOARD_TITLE
packages/document/src/collab-index-rows.ts    a Won't Do action indexes as 'done' (closed)
apps/api/src/db/plan-board-index.ts           CARDS_CTES: `json_extract(i.fields, '$.linked') IS NULL`
apps/live/hooks/plan/linked-actions.ts        placedActions, actionsBoardIn, unloadedTabIds, applyActionChanges,
                                              removeAction, restoreAction, goneActionIds (pure)
apps/live/hooks/plan/useLinkedActionCards.ts  the editor wiring (below)
apps/live/hooks/plan/usePlanItems.ts          writeQuiet(write, { silent }); onOwnWrite(write, before)
apps/live/hooks/collab/useEditorActions.ts    wontDoAction; onCreated
apps/live/app/document/[id]/useCollabDeepLink.ts  returns arrive(link): an Inbox-style landing asked in the editor
apps/live/components/plan/LinkedActionBanner.tsx  the item panel's banner
apps/live/components/plan/ItemPanel.tsx       linkedActions prop: banner, read-only Assignee ("Set on the action")
apps/live/components/plan/duplicate-item.ts   unlinkedFields on Duplicate
apps/live/components/canvas/ActionPanelFace.tsx  Board chip (BoardChip), closed counts via isClosedAction
apps/live/components/canvas/collab/action/ActionRow.tsx  the Won't Do row (SlashGlyph)
apps/live/components/panels/ActionPopover.tsx  Won't Do, View on Board
apps/live/components/dialogs/AssignActionDialog.tsx  the Status row when editing (SegmentedRadio over ACTION_STATUSES);
                                              SaveActionInput.status, sent only when changed
```

## Behaviour and state

- **Status mapping** (`recordStatusOf`, `cardStatusFor`): with `d` the done column's index, a column before `d` is
  `open`, `d` is `done`, after `d` is `wont-do`; a status no column holds, or a board with no done column, reads
  `null` and changes nothing. Open to a card: its current status if that reads open, else the first column's. Won't Do
  to a card: column `d + 1`, else `d`. `statusAgrees` treats Won't Do in Done as agreeing when nothing follows Done.
- **Create** (`linkedCardCreate`): id fixed by the action id; fields title (clipped to `ITEM_TITLE_MAX`, `'Action'`
  when empty), description when non-empty, status, assignee when known, `linked`, `linkedAt = action.updatedAt`,
  `linkedRev = 1` (a new item's rev).
- **Heal** (`healLinkedCards`), per record, nothing on a board with no columns:
  - no card: create;
  - a trashed card: restore it (status `trashedFrom`, else the first column; clear `trashedFrom`, `linkedGone`) when
    `linkedGone`, else leave it;
  - otherwise compare title, description, status. `recordMoved = linkedAt !== action.updatedAt`,
    `cardMoved = linkedRev !== card.rev`. The card wins when it moved and (the record did not, or
    `card.updatedAt > action.updatedAt`) and something differs; then the record change carries the card's values (never
    an empty title) and `updatedAt = now`. Otherwise the record's values go onto the card.
  - assignee and link always follow the record;
  - any card write sets the new baseline: `linkedAt` = the record's stamp after the heal, `linkedRev = card.rev + 1`.
- **useLinkedActionCards** (canHeal = hydrated Editor, not workbench; canMakeBoard = canHeal and may reshape):
  - `placed = placedActions(tabs, loadedTabIds)`; assignees hashed with `itemPersonId(userId ?? 'member:'+memberId)`,
    named as at assign time, coloured `colorForKey`; a heal waits for every hash.
  - A document with actions and no board found reads its unloaded tabs once (`unloadedTabIds`), when it has at most
    `PLAN_SWEEP_MAX_TABS` tabs.
  - Heal effect: when canHeal, a board and items `ready`, `LINKED_HEAL_DEBOUNCE_MS` after the last change of tabs,
    items, placed or people: creates in batches of `ITEM_BULK_MAX`, patches likewise, both `writeQuiet(…, { silent })`;
    record changes through `tickTabs(applyActionChanges)` (not undoable, as action writes are).
  - Gone effect: actions in the last render's set and in no loaded tab now (and not taken off by a card trash) get
    `linkedCardLeftPatch`: `clear` the card's `linked`, `linkedAt`, `linkedRev` (and an old `linkedGone`), no status
    change; nothing for a card in the Trash or one with no link. The record's return relinks it through the heal
    (same id, `healOne` writes the link and a fresh baseline).
  - `noteActionAdded(tabId)` (from `useEditorActions.onCreated`), one at a time (`making` ref): with no board, reads
    every unloaded tab, re-reads the newest tabs, and if still none commits `actionsBoardTab` after the last tab
    (`commitTabs`, the updater re-checking), `markTabLoaded`, `bringCardTypes`, telemetry, the notice. Decided outside
    the updater: React applies it later.
  - `noteOwnWrite(write, before)` (from `usePlanItems.write`, people's undoable writes only): each linked card the
    write trashes takes its action off (`removeAction`), remembered in `removed`; the heal puts one back
    (`restoreAction`) once its card is out of the Trash, and forgets one whose card is gone.
  - `openOnBoard(actionId?)`, `showOnCanvas(item)` call `arrive`; `placeOf(item)` names the action's tab, memoised on
    a key of action-to-tab and tab names so a canvas edit leaves the Plan context as it was.
- `usePlanNeeded` takes `actionsBoard !== null` as Plan in play, so a document with a board reads its items on any tab.
- `useCollabDeepLink.arrive(link)` keeps its own asked link (never writes the captured one), clears `consumed`, and
  bumps a counter in the landing effect's deps; the caller switches tab first.

## Interfaces and contracts

- `fields.linked`, `linkedAt`, `linkedRev`, `linkedGone` are unknown fields to the store: scalars within
  `ITEM_UNKNOWN_STRING_MAX`, validated as any unknown field. A link that does not parse is not a link.
- `PlanBoardSetup.collects`: kept only when it is one of `LINKED_RECORD_KINDS`; patchable like any set-up key.
- `ElementAction.status`: every reader that counts closed uses `isClosedAction`; the collab index keeps two values.

## Data and persistence

- Card fields: `linked`, `linkedAt`, `linkedRev`, `linkedGone` are stored with the item, travel with it (copies keep
  ids, so a copied document's links still hold) and are left out by Duplicate. No migration: a card without them is
  an ordinary card.
- `collects` is stored in the board's set-up in its tab; no migration (absent is none).
- `'wont-do'` is a new stored action status: older editors read it as not done and not open (they compare `=== 'open'`
  for open), and the collab index stores it as `'done'`. No D1 change.
- Nothing is snapshotted apart: undo restores cards through the item undo, actions stay outside undo as ever.

## Errors and edge cases

| Case                                                             | Handling                                                                    |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Two editors create the same card                                 | Second create refused `item_exists`, silent; the next heal sees the card    |
| An action on a tab not loaded                                    | Not a record; nothing deleted; healed once its tab loads                    |
| A card's action is on an unloaded tab when moved                 | The record change finds no loaded action; healed once the tab loads         |
| A card in a status the board does not show                       | `recordStatusOf` null: no record change, card not moved                     |
| A board with no done column                                      | Status never synced (null); titles and descriptions still are               |
| The Action type deleted from the catalogue                       | Cards draw as the fallback type; the board shows every type (boardAddTypes) |
| A restored card whose action was taken off in an earlier session | A card of its own; the heal has no record for it                            |
| A copy of a board tab with its cards in another document         | Links name tabs that are not there: no banner, never healed                 |

## Security and trust

No new trust boundary: cards are written through the item store's existing gates (a Participant's card writes as
ever), actions through the editor's tab writes (an Editor's). Healing runs only in an Editor's editor. The Inbox clause
narrows a read; it widens nothing.

## Performance and limits

- Per tabs change: `placedActions` and `actionsBoardIn` read each tab once and keep the result by its elements array
  (a `WeakMap`), so a change re-reads only the tabs it touched. Measured at 41 tabs of 500 elements with 2,000 actions:
  7.6 ms for the first read, 0.14 ms per change touching one tab. `placeOf`'s key: 0.16 ms. Locked by the budget test
  in linked-actions.test.ts (16 ms for the whole read).
- Heal: O(actions) map lookups after a 600 ms debounce (1.3 ms for 2,000 actions); writes only on disagreement, batched by `ITEM_BULK_MAX`.
- Tab reads: at most once a session, bounded by `PLAN_SWEEP_MAX_TABS` when automatic; `noteActionAdded` reads every
  unloaded tab once, only while no board is found.
- Inbox: one `json_extract` on rows already narrowed by the `items_assignee` index.

## Observability

`[linked] heal {creates, patches, records}`, `[linked] board.made {tabId}`, `[linked] action.gone.card.unlinked
{count}`, `[linked] card.trashed.action.removed {actionId}` (debug scope `linked`).

## Constants and configuration

| Constant                  | Value                                         | Provenance                                                            | Safe range  |
| ------------------------- | --------------------------------------------- | --------------------------------------------------------------------- | ----------- |
| `LINKED_HEAL_DEBOUNCE_MS` | 600                                           | longer than a room op's round trip, shorter than a person's next look | 250 to 2000 |
| `ACTIONS_BOARD_TITLE`     | Actions                                       | the spec                                                              | -           |
| card id                   | `a` + action id's id-safe characters, 6 to 32 | `ITEM_ID_PATTERN`                                                     | -           |

## Testing

| Spec rule                                       | Test                                                                                             |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Fixed card id, links                            | packages/items/src/linked-cards.test.ts "linkedCardId", "links"                                  |
| Status mapping                                  | linked-cards.test.ts "status mapping"                                                            |
| Heal: create, agree, either side wins, baseline | linked-cards.test.ts "healLinkedCards"                                                           |
| Trash both ways                                 | linked-cards.test.ts "linkedCardGonePatch", "linkedCardsTrashedBy"; useLinkedActionCards.test.ts |
| Duplicate carries no link                       | linked-cards.test.ts "unlinkedFields"                                                            |
| Board made once, after a lazy commit            | apps/live/hooks/plan/useLinkedActionCards.test.ts                                                |
| Unopened tabs read first                        | useLinkedActionCards.test.ts                                                                     |
| Only an Editor heals or makes the board         | useLinkedActionCards.test.ts "never makes…", "heals nothing…"                                    |
| Canvas writes                                   | apps/live/hooks/plan/linked-actions.test.ts                                                      |
| Won't Do on the panel, the Board chip           | apps/live/components/canvas/ActionPanelFace.test.tsx                                             |
| Won't Do indexed closed                         | packages/document/src/collab-index-rows.test.ts                                                  |
| Linked cards off the Inbox                      | apps/api/src/db/activity-cards.test.ts                                                           |

## Defaults ledger

D50 to D52 in [DEFAULTS.md](DEFAULTS.md).
