# Offline changes

**Status: built.**

The offline banner ([Load recovery: Offline](load-recovery.md#offline)) promises that changes save when the
connection comes back. Board cards and Sheet cells are not saved by the tab autosave: each change is its own write
to the item store ([Items](../026-plan/items.md)) or the sheet store ([Sheet store](../029-sheets/sheet-store.md)).
Those writes are kept while the connection is down and sent when it returns, so the banner tells the truth for them
too.

## What waits

A **waiting change** is a card or sheet write this browser made that the server has not answered yet because there
was no connection. It waits in the plan's **queue**:

- **Cards:** every item write made from the editor: adding a card (Add card, a card type chip, a copy), changing its
  fields (title, description, status, assignee, dates, checklists, custom fields, flag, archive), moving it (one or a
  group), the Trash and delete, time entries, and undo and redo of any of these. Card comment threads are their own
  store and do not wait (below).
- **Sheets:** every sheet write: cell values and formats, rows and columns (insert, delete, move, resize, hide,
  freeze, merge, filter, sort), validation and format rules, the title, a new sheet (placing a Sheet, a copy, a CSV)
  and deleting a sheet with its element.

A write waits when the browser says it is offline as it is made, when sending it fails with no answer from the server
(the network dropped, the server's gateway did not reach it: no response, 408, 429, 502, 503 or 504), or when the
queue already holds a change of the same store (so nothing overtakes what waits). Anything else stays as it was: a
refusal is shown and taken back at once.

An **Offline Mode** project ([Offline mode](../006-project/offline-mode.md)) never queues: its writes go to this
browser's own store, which needs no connection.

## What the person sees

- A waiting change shows at once, as an online one does: the card moves, the cell holds its value. It stays shown
  through a reload of the board or the sheet from the server: what waits is laid back over what the server has.
- **The banner counts them.** Offline with changes waiting: "You’re offline. 3 changes wait in this browser and save
  when you reconnect." ("1 change waits" for one). Online while waiting changes are being sent, or waiting on a
  connection the browser thinks it has: "Saving 3 changes made without a connection." The count is the queue's
  length: a write that went in parts (a large paste) counts each part.
- Undo and redo work offline as online: an undo of a waiting change is itself a change that waits behind it.
- Leaving the page never asks because changes wait: they are kept in this browser. The browser's "Leave site?" prompt
  still asks for unsaved tab changes ([Load recovery: Offline](load-recovery.md#offline)).

## Kept across a reload

The queue is stored in this browser (its `localStorage`, one key per plan), written as each change joins it, so a
reload, a closed tab or a crash while offline keeps every waiting change. Opening the plan again (once the connection
is back) shows them laid over the server's copy and sends them. Changes to the canvas and to tabs (a new tab, a board's
columns, a Dashboard's layout) are the tab autosave's and are still held in the tab only.

- The queue belongs to the person who made it: it is sent only by the same identity (guest or account) that made
  it. Another person opening the plan in this browser neither sees nor sends it.
- Repair This Browser keeps it ([Load recovery: Repairing a browser](load-recovery.md#repairing-a-browser)): it is
  work that exists nowhere else.

## Sending them

- **When.** As soon as the browser says it is back online, as soon as the room's connection opens again, and every
  few seconds while changes wait and the browser says it is online (a dropped connection the browser did not notice).
  For cards the wait between those tries doubles from 2 seconds up to a minute; a sheet's write keeps its own wait
  ([Sheet store](../029-sheets/sheet-store.md#changing-a-sheet): half a second doubling to 30 seconds, and 30 seconds
  while offline). Coming back online cuts either short.
- **Order.** Each store's waiting changes are sent in the order they were made, one request at a time. Cards and
  sheets are separate stores and do not wait on each other; within the sheet store each sheet keeps its own order.
- **Batched.** A run of field changes to cards goes as one request of up to 200 changes (the item store's many-patch
  write), so a long offline session replays in a few requests. Every other write goes on its own.
- **Then a refresh.** Once the card queue is empty the board's cards are read again from the server, and on coming
  back online every open sheet is too, so a room connection that survived the outage cannot leave the screen behind.

## When the server says no

The server is the authority. A waiting change it refuses on replay (someone deleted the card meanwhile, a field
became required, the plan filled up, the person lost edit rights) shows the toast it would have shown online and takes
back that one change: the card or sheet is read again from the server. The changes behind it are still sent.

- A batch that is refused is sent again one change at a time, so only the change the server refuses is taken back.
- A card the server already has (a create whose answer was lost: `item_exists`) and a delete of a card that is
  already gone (`item_not_found`) count as landed, not refused.

## Bounds

- A plan's queue holds at most **500 changes** and **1 MB** of written changes (counted as the stored JSON).
- **Past either bound**, or when the browser's storage is full, a new change that would wait is refused at once, like
  any refused change: the toast says "Too many changes are waiting to save. Reconnect, then try again.", and the change
  is taken back. Changes already waiting are never dropped to make room.

## Roles

| Role        | What waits                                                                                                                                                                                                                                                               |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Editor      | Every card and sheet write above                                                                                                                                                                                                                                         |
| Participant | Only what it may write ([Share roles](../013-workspace/share-roles.md)): adding, editing and moving cards, time entries, and Sheet cell values. Never a delete or a sheet's shape; a field change it may not make (the Trash, a repeat) is refused on replay, as online. |
| Viewer      | Nothing: a Viewer makes no writes                                                                                                                                                                                                                                        |

A write the role may not make is never queued: offline it fails as it would online, and the server refuses it anyway.

## Not in this

- **Card comment threads** (and their replies, resolves and reactions) are written to their own store and still fail
  at once offline with their own toast.
- Card types, board settings and tab changes are not item or sheet writes: they are the tab autosave's or the type
  catalogue's own saves, which already retry.
