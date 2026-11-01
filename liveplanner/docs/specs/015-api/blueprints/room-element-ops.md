# Room element ops

The implementation of [Realtime conflict resolution](../../012-collaboration/realtime-conflict-resolution.md#an-invalid-element)
"An invalid element": the room judges every element an Editor's op carries before relaying it.

## Files

| File                                          | Holds                                                                                     |
| --------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `../packages/api-kit/src/room-element-ops.ts` | `judgeRoomElementOp`, `createRefusalLog`, `createRoomElementGate`, the log's constants    |
| `../packages/api-schema/src/room-refusal.ts`  | `OpRefusedMessage`, `ROOM_OP_REFUSAL_REASONS`, `OP_REFUSED_ID_MAX`                        |
| `apps/api/src/room-element-rules.ts`          | `ROOM_ELEMENT_RULES`: this product's validator and migrations, bound for the judge        |
| `apps/api/src/plan-room/plan-room.ts`         | The room's `elementGate`, called after the role gate and before an op is sequenced        |
| `packages/api-schema/src/room-messages.ts`    | `OpRefusedMessage` in `ServerMessage` and `RoomIncoming`                                  |
| `apps/editor/lib/api/room.ts`                 | The connector's `op-refused` branch: the waiting `ref` settles false, `[room] op refused` |

## Domain and naming

| Term          | Identifier                                       | Meaning                                                                              |
| ------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Element op    | an op of kind `tab`, or `el` add / update        | An op that carries whole elements                                                    |
| Element rules | `RoomElementRules`                               | What the judge needs of a product: known types, migrations, the issue, the tab bound |
| Refusal       | `RoomOpRefusal` `{ reason, elementId?, field? }` | Why an element op is dropped                                                         |
| Refused frame | `OpRefusedMessage` (`kind: 'op-refused'`)        | The answer to the sender alone                                                       |
| Refusal log   | `createRefusalLog`                               | The room's bounded `[room] element op refused` lines                                 |

## Behaviour and state

`judgeRoomElementOp(op, rules)`, pure, first refusal wins:

1. `el` whose inner op is `add` or `update`: the element is judged (below). Any other inner kind: `null`.
2. `tab` whose `tab.elements` is an array: more than `rules.maxElements` elements is `too-many-elements`. Else the tab
   is migrated (`rules.migrateTab`); the migrated elements (the sent ones when migration hands back no array) are
   judged in order, and an id seen before is `duplicate-element` with that id.
3. Anything else (another kind, a tab with no element list): `null`. The envelope is the receivers' (`room-op-shape.ts`).

Judging one element:

1. Not an object: `invalid-element`, field `element`.
2. `id` not a non-empty string: `invalid-element`, field `id`. `type` not a string: `invalid-element`, field `type`.
3. `rules.knowsType(type)` false: passes.
4. Otherwise the element is migrated (`rules.migrateElement`) and `rules.issue` judges it; an issue is
   `invalid-element` with the element's id and the issue's field.

`createRoomElementGate(rules)` returns `(op, ref) => OpRefusedMessage | null`. A refusal writes one refusal-log line
and builds the frame: `op` the op's kind, `reason`, `tabId`, `elementId` and `field` when present (ids clamped to
`OP_REFUSED_ID_MAX`), `ref` when it is a positive safe integer.

The room calls the gate only for an op the role gate relays (`{ kind: 'relay' }`) and that is not presence, before
`tab-focus`, comment stamping and sequencing. On a refusal it sends the frame to the sender's socket and returns:
no relay, no `seq`, no catch-up slot, no `cursor` frame. A Participant's `el` op (`participant-content`) never
reaches the gate.

The refusal log is one fixed window per room instance: `windowStart`, `logged`, `suppressed`, in memory. A line at
`now - windowStart >= REFUSAL_LOG_WINDOW_MS` opens a new window and carries the previous window's `suppressed`
count when it is above zero. Within a window the first `REFUSAL_LOG_LIMIT` lines are written and the rest counted.
Hibernation resets it, which only re-opens a window.

## Interfaces and contracts

- `RoomElementRules`: `knowsType(type: string): boolean`, `migrateElement(element: Record<string, unknown>): unknown`,
  `migrateTab(tab: unknown): unknown`, `issue(element: unknown): { field: string; rule: string } | null`,
  `maxElements: number`.
- `OpRefusedMessage`: `{ kind: 'op-refused'; op: string; reason: 'invalid-element' | 'duplicate-element' |
'too-many-elements'; tabId?: string; elementId?: string; field?: string; ref?: number }`.
- `ROOM_ELEMENT_RULES` binds `ELEMENT_TYPES.has`, `migrateIncomingElements([el])[0]`, `migrateIncomingTab`,
  `elementValidationIssue` and `MAX_ELEMENTS_PER_TAB` from this product's model package.

## Errors and edge cases

- A migration that throws hands the element back as sent (`readableOr` in `stored-tab.ts`); the judge then judges it.
- A migrated element that drops out (`migrateIncomingElements` filters non-objects) is judged as sent.
- An element of an unknown type inside a tab still counts toward the bound and the duplicate check.
- An older client's former element shape is migrated before judging, so it is never refused for a shape the
  migrations upgrade.
- An unknown op kind, `tab-meta`, `el-delta`, `remove`, `reorder` and a room-made `patch` pass unjudged.

## Security and trust

- Trust boundary: the sender's socket. The room is the one party that sees every op before peers do, and it runs
  the newest build, so it refuses only what this build's own tab save refuses.
- Abuse: an Editor (or a buggy build) sending invalid elements in a loop gets each refused on its own socket; the
  frame rate cap (240 a second) bounds the frames and the refusal log bounds the lines.
- The refused frame goes to the sender alone and names only what the sender sent; the log never holds an element.
- Share roles are unchanged: the gate runs after `gateClientOp`, so Viewer and Participant ops follow their
  existing rules.

## Performance and limits

- One judge per relayed element op: a migration and a validator pass over the element, both linear in its size, and
  for a `tab` op the migrations of the whole tab. The frame cap (256 KiB, `MAX_MESSAGE_CHARS`) bounds the work, as
  it bounds the `JSON.parse` before it. Measured as CPU time on a dev machine, across the four products: a typical
  `el` add 4 to 5 µs; a 200 by 50 table (93 KB) 0.05 ms; a sticky of 100,000 characters (257 KB) 0.5 ms; a `tab` op of 1,500
  shapes (149 KB) 1.8 to 3.2 ms, about half migration and half validation, against 0.45 ms to parse the same frame.
  `room-element-rules.test.ts` holds CPU budgets (`cpuBudgetMs`) on a typical element and on frame-sized ops.
- No allocation survives the call; the log's state is three numbers per room.

## Observability

- `[room] element op refused` `{ op, reason, field?, suppressed? }`, bounded as above.
- Editor: `[room] op refused` `{ op, reason, field }` (console warning) when the frame arrives.

## Testing

- `../packages/api-kit/src/room-element-ops.test.ts` (100% held): valid ops pass; each refusal reason; unknown kind
  passes; unknown field passes; migration runs before judging; non-element ops pass; the gate's frame and `ref`;
  the log's limit, window and `suppressed` count.
- `apps/api/src/room-element-rules.test.ts`: this product's real validator: a valid element and tab relay, an
  invalid known kind refuses, an unknown kind and an unknown field (deploy skew) relay, the worst-case CPU budget.
- The room's test: an invalid `el` op is not relayed, not sequenced, answered `op-refused` with its `ref`, and
  logged; a valid one relays as before.
- `apps/editor/lib/api/room.test.ts`: `op-refused` settles the waiting `sequence` with false at once.

## Constants and configuration

| Constant                | Value  | Provenance                                                                  |
| ----------------------- | ------ | --------------------------------------------------------------------------- |
| `REFUSAL_LOG_LIMIT`     | 10     | Lines per window per room: enough to see a burst's shape, far below a flood |
| `REFUSAL_LOG_WINDOW_MS` | 60 000 | One minute: a looping client writes at most 10 lines a minute per room      |
| `OP_REFUSED_ID_MAX`     | 64     | The room's other id bound; a UUID is 36                                     |

## Defaults ledger

See `DEFAULTS.md` rows REO1 to REO4.
