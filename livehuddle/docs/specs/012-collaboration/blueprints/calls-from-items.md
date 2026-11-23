# Calls from other apps: blueprint

Derived from [calls-from-items.md](../calls-from-items.md) and the platform's
[item-calls blueprint](../../../../../liveworkspace/docs/specs/004-index/blueprints/item-calls.md).

## The api (apps/api)

- `routes/internal-items.ts`: the `call` handler of the index's internal door (`POST /api/internal/items/:id/call
  {callId}`, `@liveworkspace/index-app`) calls the Space's room `markItemCall(callId)`.
- `document-room/room-item-call.ts`:
  - `markItemCall(room, callId)`: `ctx.storage.put('item-call', callId)`, kept on the room as `itemCallId`, then a
    count (`noteItemCall`) so a call joined before the mark still reports.
  - `loadItemCall(room)`: read once per room start (`blockConcurrencyWhile`, beside the room's other loads).
  - `noteItemCall(room)`: with no `itemCallId`, nothing. Otherwise counts the distinct `presence.key`s among the room's
    sockets with a presence, their names (`verifiedName`, else the presence's name) in join order, and arms one
    `setTimeout(ITEM_CALL_SETTLE_MS)` when none is armed. When it fires: the same reading again; pushed through
    `indexAppClient(env).callPeople(documentId, {people, names})` only when it differs from the last pushed. A failed
    push is logged (`[item-call] push failed`) and forgotten.
  - Called from `room-message.ts` after `noteAttendance` (a hello, a tab-focus) and from the close handler.

## The editor (apps/editor)

- `components/item-call/useSpaceCall.ts`: once the Space is open and in the cloud (not Offline, an embed or the
  Community), `indexClient.spaceCall(documentId, share)`; `null` (not a call) ends it. Aborted on unmount. The first
  answer that is a call shows the toast "This call is about <item>. It isn't recorded." once a session (session
  storage, per Space).
- `components/item-call/CallItemCard.tsx`: the `leadAction` of the corner card: Open Item (the item's logo
  `AppLogo` from `@liveworkspace/brand` at 16 px and its name), Invite (accounts), Wrap Up (the host).
- `components/item-call/open-item.ts`: `focusOrOpen(url, itemTabName(id))` from the workbench's `item-call-tabs.ts`.
- `components/item-call/InvitePopover.tsx`: `indexClient.approvalPeople(itemId)` once opened; check rows; **Send
  Invites** → `indexClient.inviteToCall(spaceId, {people})`.
- `components/item-call/WrapUpDialog.tsx` (lazy, `next/dynamic`): the facts and notes (`wrap-up-notes.ts`, pure: the
  floors' stickies and texts in reading order, their first lines, at most 200 lines), Write With AI
  (`askSender(accountId)` from `@liveworkspace/ask/ui`, the passages from `tabPassages`), the knowledgebase picker
  (`indexClient.listItems({app: 'liveknowledge', sort: 'recent'})`), Send Summary
  (`indexClient.sendCallSummary`), Send Actions to Plan (`sendAllStickies(tab.id, tab.elements)`).

## Tests

- room-item-call: a Space that is no call pushes nothing; a burst of joins pushes once after the settle; an unchanged
  count pushes nothing; names in join order, capped; the mark from the door counts at once.
- wrap-up-notes: reading order, first lines, the cap, the facts' words.
- CallItemCard: each role's controls; Open Item focuses the named tab or opens the item.
- WrapUpDialog: Send Summary's call and its Open Page; Write With AI fills the summary and a failure leaves it.
