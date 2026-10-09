# Plan for agents blueprint

Derived from [Plan for agents](../plan-agents.md). Implementation contract for reading the plan, resolving names,
changing card types and adding boards, for the MCP tools and the CLI verbs.

## Domain and naming

| Spec term        | Identifier                                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| the plan         | `PlanOutline` (`packages/items/src/plan-outline.ts`), on the wire `PlanResponse`                                                     |
| board (outline)  | `PlanBoardOutline { tabId, tabName, elementId, title, kind, types, columns }`                                                        |
| column name      | `PlanColumnOutline.name`; a document's statuses `PlanStatusName { status, name }`                                                    |
| naming           | `resolveStatus`, `resolveType`, `resolveItem`, `fieldKeyOf`, `resolveFields`, `personNamed` (`plan-names.ts`)                        |
| card type change | `CardTypeChange`, `applyCardTypeChanges` (`packages/items/src/type-changes.ts`)                                                      |
| board request    | `BoardRequest`, `placeBoard` (`packages/items/src/board-place.ts`)                                                                   |
| the Plan engine  | `packages/agent-verbs/src/plan/` (`readPlanState`, `planListing`, `applyItemChanges`, `changeCardTypes`, `addBoard`, `apiRefusalOf`) |

## Behaviour and state

- `planOutline(tabs, catalogue)`: boards in tab order then canvas order; damaged set-ups skipped
  (`normaliseBoardSetup` null); statuses from `statusColumnsOfSetups` (first board's name wins; All Cards and
  Archive name none); types `typesOf(catalogue)`. The editor's `usePlanStatusNames` imports the same
  `statusColumnsOfSetups`.
- Names resolve in this order: exact id, then `statusKey` match on the name (case, spacing, punctuation aside).
- `resolveFields` keys: built-in id, `statusKey` of an id, alias (`duedate`, `startdate`, `colour`, `label`,
  `assignedto`, `owner`), custom field id or name on the item's type. Values: `status` by column name, `assignee`
  string by `personNamed`, Card fields (Parent among them) by item ref, `priority` lowercased when it is one of
  `PRIORITIES`, `labels` string split on commas, Choice by option name; others as given (the api validates).
- `applyItemChanges`: one plan read per call; changes in order, each seeing earlier ones' items; first refusal
  stops; answers `applied` lines naming the column (`in To Do`, or `(on no board)`).
- `applyCardTypeChanges`: changes in order on a working list; `add` starts from `NEW_ITEM_TYPE` (shared with the
  type editor); `delete` names the type for its cards to go to the Trash; `add_default_types` (and its
  older name `restore_built_ins`) appends `defaultTypesToAdd(types)`, and a document whose card types were not
  chosen, given nothing but those, stays null. The whole result goes through `validateItemTypeCatalogue`.
- `bringBoardCardTypes(api, documentId, elements, known?)`: nothing read or written when no Plan board is among the
  elements; else `catalogueWithBoardTypes(stored, elements, hasCards)` from the document's `itemTypes` and whether it
  has any item (`known` when the caller has read them, as `addBoard` has), PUT only when it changes.
- `changeCardTypes`: PUT the catalogue, then `set { status: trash, trashedFrom }` on each live card of a deleted
  type, as the editor's `trashItems`.
- `placeBoard`: preset through `freshBoardSetup`; columns by name reuse a status `statusNamed` finds (each status
  once), else `<slug>~<4 chars>`; a preset's `doneColumnId` is dropped with its columns; placed right of the tab's
  elements' bounding box by `PLACED_BOARD_GAP`, tops aligned, origin on an empty tab.
- `addBoard`: tab = given, else first tab with a board, else lowest `orderIndex`; one changeset
  `{ operations: [{ op: 'add', element }], base: { rev, elements: {} } }` with the client header (`mcp` or `cli`).

## Interfaces and contracts

- `GET /api/documents/:id/plan` → `PlanResponse { boards, statuses, types }`; read gate as the item list
  (`itemCaller(ctx, id, 'read')`); a tab-scoped grant passes `tabId` and gets that tab's boards; 405 for other
  methods. In the OpenAPI manifest (tag Items) and `gen-openapi-schemas.mjs` roots.
- MCP (`packages/agent-verbs/src/mcp/plan-schema.ts`): `list_items { documentId, type?, status? }`,
  `change_items { documentId, changes[1..50] }`, `add_board { documentId, tabId?, preset?, title?, columns?[1..12],
types? }`, `change_card_types { documentId, changes[1..32] }`; outputs `listItemsOutput`, `changeItemsOutput`,
  `addBoardOutput`, `changeCardTypesOutput`, every field described.
- CLI: `item ls|add|set|move|rm` (unchanged arguments; `ls` prints a line per board), `board add <doc> [--tab]
[--preset] [--title] [--columns a,b] [--types a,b]`, `type ls <doc>`, `type apply <doc> -f <file|->` (a JSON array
  of `cardTypeChangeSchema`).

## Errors and edge cases

| Case                                                                       | Handling                                                                 |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| column name no board has                                                   | `status_unknown`, lists the columns                                      |
| no board at all                                                            | `status_unknown`, says to use `add_board` or leave status out            |
| card type unknown                                                          | `type_unknown`, lists `Name (id)` for each type                          |
| field the type lacks                                                       | `field_unknown`, lists the type's fields                                 |
| Choice option not offered                                                  | `choice_unknown`, lists the options                                      |
| item ref none or several                                                   | `item_unknown`, names the candidates when several                        |
| card type change breaks a rule                                             | `type_change_invalid`, names the rule; nothing saved                     |
| board preset unknown, columns 0 or > 12, two columns one name, title empty | `board_invalid`                                                          |
| tab unknown / no tabs                                                      | `tab_unknown`, lists the tabs                                            |
| api 4xx                                                                    | `apiRefusalOf`: by code (`status_excluded`...) or status (403, 404, 410) |
| api 5xx or network                                                         | thrown (the MCP's error path and `Error·Api` telemetry)                  |
| a change after an earlier one applied fails                                | the answer lists what applied before it                                  |

## Security and trust

- No new authority: every read and write is an existing route under the caller's token; the plan route uses the
  item list's gate, so a tab-scoped link never sees another tab's boards; the catalogue PUT keeps its
  whole-document edit gate.
- Names and titles from people are data: listings say so in the tool descriptions.

## Performance and limits

- `change_items`: 2 reads per call (items, plan; parallel) + 1 write per change (≤ 50).
- Plan route: only tabs whose body holds `"plan-board"` are read (`tabBodiesWithBoards`, an `instr` filter in
  D1, as `tabIdsWithComments`), `PLAN_TAB_BATCH` (20) at a time, reduced to board set-ups; the response holds no
  elements. `planOutline` over 50 tabs of 2,000 elements and 200 boards: 11.7 ms cold, 1.5 ms warm (measured
  2026-10-08), guarded at 250 ms by `plan-outline.test.ts`.
- Measured locally end to end: `list_items` and `change_items` (one change) about 170 ms a call including
  process start; a 3-tab kanban with 6 cards lists in 5.5 KB.
- Bundles against origin/main (measured 2026-10-08): the MCP worker +54.7 KB raw, +12.9 KB gzip (646 KB gzip in
  all); the api worker +5.9 KB raw, +0.9 KB gzip.
- `change_card_types`: 2 reads + 1 PUT (catalogue ≤ `ITEM_TYPES_BYTES`, 32 KB) + 1 write per trashed card.

## Observability

- `[plan] read { boards, scoped }` on each plan route answer.
- Item and catalogue writes keep their routes' logs (`[items] created`, `[item-types] item-types.saved`).
- MCP calls count as `Mcp·Used·<Tool>` (`AddBoard`, `ChangeCardTypes` added to the dashboard); CLI verbs as
  `Cli·Used·<Verb>` (`BoardAdd`, `TypeLs`, `TypeApply`).

## Testing

| Rule                                   | Test                                                                         |
| -------------------------------------- | ---------------------------------------------------------------------------- |
| outline order, statuses once, types    | `packages/items/src/plan-outline.test.ts`                                    |
| naming and refusals                    | `packages/items/src/plan-names.test.ts`                                      |
| card type changes                      | `packages/items/src/type-changes.test.ts`                                    |
| board placement                        | `packages/items/src/board-place.test.ts`                                     |
| plan route gate, scope, batching       | `apps/api/src/routes/plan-route.test.ts`                                     |
| engine: listing, changes, types, board | `packages/agent-verbs/src/plan/plan-engine.test.ts`                          |
| CLI verbs                              | `packages/agent-verbs/src/verbs/item.test.ts`, `plan-verbs.test.ts`          |
| MCP tools, outputs, annotations        | `apps/mcp/src/output-schema.test.ts`, `tools.test.ts`, `verb-parity.test.ts` |

## Constants and configuration

| Constant                                             | Value    | Where                               | Why                  |
| ---------------------------------------------------- | -------- | ----------------------------------- | -------------------- |
| `PLAN_TAB_BATCH`                                     | 20       | `apps/api/src/routes/plan-route.ts` | the overview's batch |
| `PLACED_BOARD_WIDTH`                                 | 1120     | `board-place.ts`                    | D5                   |
| `PLAN_BOARD_HEIGHT_PX`, `PLAN_BOARD_EMPTY_HEIGHT_PX` | 640, 880 | `board.ts` (`planBoardHeightFor`)   | D5                   |
| `PLACED_BOARD_GAP`                                   | 80       | `board-place.ts`                    | D31                  |

## Defaults ledger

D31 to D34 in [DEFAULTS.md](DEFAULTS.md).
