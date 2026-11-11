# Tab attendance blueprint

Derived from [Tab attendance](../tab-attendance.md). Work Tracker #691.

## Domain and naming

- **Visit** (`AttendanceVisit` on the wire, a `tab_attendance` row in storage): one person's stretch in one tab.
- **Person key** (`person_key`): the session's collab key (`SessionAttachment.presence.key`), never an id.
- **Open visit**: `left_at IS NULL`. **Closed visit**: `left_at` set.
- **Tabs of a session** (`attendanceTabsOf`): its presence's `tabId` and `besideTabId`, those the document has, and
  for a tab-scoped session only its scope.
- UI copy: "Attendance" (menu row, dialog title, help article); never "History" (the item's History dialog is
  another thing) and never "log".

## Data and persistence

`document-schema.ts` step V7, in the document's own SQLite:

```sql
CREATE TABLE IF NOT EXISTS tab_attendance (
  id         INTEGER PRIMARY KEY,
  tab_id     TEXT    NOT NULL,
  person_key TEXT    NOT NULL,
  name       TEXT    NOT NULL,
  color      TEXT    NOT NULL,
  picture    TEXT    NULL,
  guest      INTEGER NOT NULL,
  joined_at  INTEGER NOT NULL,
  left_at    INTEGER NULL,
  seen_at    INTEGER NOT NULL,
  closed_at  INTEGER NULL
);
CREATE INDEX IF NOT EXISTS tab_attendance_by_tab ON tab_attendance (tab_id, joined_at);
CREATE INDEX IF NOT EXISTS tab_attendance_by_person ON tab_attendance (person_key, tab_id);
CREATE INDEX IF NOT EXISTS tab_attendance_open ON tab_attendance (left_at) WHERE left_at IS NULL;
```

- `name` is the hello's name (already cut to 120), `color` its colour (64), `picture` kept only when the session is a
  verified account's (`helloPresence` already refuses others), `guest` = not `session.account`.
- `seen_at`: the last time the room saw the visit open (each attendance write refreshes every open visit's).
- `closed_at`: when the room closed it (the rejoin grace is measured from it); `left_at` is what is shown.
- Not in `document_tabs` cascades: `deleteTabRow` deletes a tab's visits in the same batch as its suggestions. A purge
  is `storage.deleteAll()`.
- Never pushed to the outbox, never in a tab read, a copy, an export or the file envelope.

## Behaviour and state

`apps/api/src/document-room/room-attendance.ts` (room side, sync `SqlStorage`), on the store in
`apps/api/src/db/tab-attendance.ts`:

- `noteAttendance(room, ws, before, after, now)`, called by:
  - the `hello` branch of `roomMessage` after the attachment is written (`before` = the old attachment),
  - the `tab-focus` branch after `moved` is written,
  - `dropSession` (`after` = null), on close and on error.
- It returns at once when the session has no key, when `before` and `after` show the same tabs, when the storage has
  no document schema (a document never started), or with no SQL (a unit test's fake state).
- For each tab in after's tabs and not before's: unless another live socket with the same key shows it, **join**.
- For each tab in before's tabs and not after's: unless another live socket with the same key shows it, **leave**.
- Then, when anything was written: `UPDATE tab_attendance SET seen_at = now WHERE left_at IS NULL`.
- **join(tab, key, who, now)**: the person's latest visit to the tab (`ORDER BY id DESC LIMIT 1`).
  - Open: refresh its name, colour and picture (a stale visit from before a restart that was never swept). Nothing
    else.
  - Closed with `now - closed_at <= ATTENDANCE_REJOIN_GRACE_MS`: reopen it (`left_at = NULL, closed_at = NULL`).
  - Otherwise insert a visit, then prune the tab: visits past `ATTENDANCE_TAB_MAX` (oldest first by id) and closed
    visits with `left_at < now - ATTENDANCE_RETENTION_MS`.
- **leave(tab, key, now)**: `UPDATE … SET left_at = now, closed_at = now, seen_at = now WHERE tab_id = ? AND
person_key = ? AND left_at IS NULL`.
- **Boot sweep** (`closeStaleVisits`), in the room's constructor (inside `blockConcurrencyWhile`), only when the
  runtime hands it no sockets: `UPDATE … SET left_at = seen_at, closed_at = now WHERE left_at IS NULL`. A hibernation
  wake has its sockets and skips it.
- **Upkeep**: `maintain` deletes closed visits past retention (`deleteOldVisits`). A join arms the upkeep as a content
  write does (`armUpkeep`), so a Space visited and never edited still sweeps.
- **Anonymise**: `anonymiseDocument` adds `UPDATE tab_attendance SET person_key = 'anonymised', name = 'Deleted
account', picture = NULL WHERE person_key = collabKeyFor(personId)`.

## Interfaces and contracts

- `GET /api/documents/:id/tabs/:tabId/attendance` (`routes/attendance-routes.ts`):
  - `requireOwner` (400 without an identity), `getDocument` (404), `gateParticipate` (403, or 404 for a link scoped to
    another tab), the tab exists (404).
  - 200 `TabAttendanceResponse` (`@livehuddle/api-schema` `tab-attendance.ts`):
    `{ visits: AttendanceVisit[]; retentionDays: number; perTabMax: number }`, `AttendanceVisit =
{ id: number; name: string; color: string; picture?: string; guest: boolean; self: boolean; joinedAt: number;
leftAt: number | null }`. Newest first by `joined_at`, then id; at most `ATTENDANCE_TAB_MAX`; closed visits past
    retention left out.
  - `picture` only when the caller is a signed-in account (`ctx.accountUserId`), as the roster sends pictures.
  - `self`: the visit's key is `collabKeyFor(caller)`.
  - Any other method: 405.
- Editor: `apiListAttendance(ownerId, documentId, tabId, shareCode)` (`apps/editor/lib/api/attendance.ts`).

## Errors and edge cases

- Hostile `tab-focus` naming tabs the document does not have: not recorded (`attendanceTabsOf` checks
  `document_tabs`), so a flood of made-up ids writes nothing.
- Fast tab flapping (A, B, A, B): each return is inside the grace, so it reopens the same visit; no new rows.
- A session's second `hello` with the same tab: no change, nothing written.
- `dropSession` twice for one socket (error then close): the second finds no open visit to close.
- A store failure (SQL throws): caught, logged `[attendance] not recorded`, never breaks the frame or the close.

## Security and trust

- Only the server's own facts are stored: the key comes from the attachment (pinned at the upgrade), the name and
  picture from the hello the room already clamps. A client cannot write a visit for another key.
- Read gate is `gateParticipate`; a Viewer, a Community pass and a stranger are refused. A tab-scoped link reads only
  its tab.
- No id, email or IP is stored or returned; the key is never returned.
- Logs carry counts only, never names.

## Performance and limits

- Each recorded change: one pass over the room's sockets (at most `ROOM_MAX_CONNECTIONS`, 100), already the cost of the
  roster broadcast beside it; one indexed lookup per tab gained; one indexed update per tab lost; one update of the open
  visits (at most 100 people × 2 tabs). Nothing on a cursor, a select or any other frame.
- Storage per tab: at most 500 rows of under 500 bytes, so under 250 kB a tab.
- The read: one indexed range of at most 500 rows.

## Presentation and UX

- `TabPortalMenu`: an **Attendance** row (clock-with-arrow glyph, `lucideHistory`) in its own group after "Add to
  Another Space"; in a connected tab's menu above Remove Tab. With `attendanceOnly` (a Participant, or a tab-scoped
  Editor whose tab structure is read only) the menu is that one row.
- `TabPill` shows the ⋯ and the right-click menu when `!readOnly || onOpenAttendance`.
- `TabAttendanceDialog` (`components/dialogs/TabAttendanceDialog.tsx`), size `md`, its list scrolls under a fixed
  header:
  - Header: "Attendance", subtitle "<tab name> · Last 90 days", help link (`tabAttendance`), close.
  - Day groups (`groupVisitsByDay`, `lib/tab-attendance.ts`): "Today", "Yesterday", else "Mon 9 Nov" (weekday, day,
    month; the year too when not this year).
  - Row: `ParticipantAvatar` (28px), name, badges ("You", "Guest", "Here Now" in brand), detail "Joined 14:02 · Left
    14:47" or "Joined 14:02" with "Here Now"; the duration right-aligned in tabular figures (`formatVisitLength`).
  - Loading: three placeholder rows (`aria-busy`). Error: message and **Try Again**. Empty: "Nobody has been in this
    tab yet." and "Visits show here for 90 days."
  - A refresh each time it opens; a "Here Now" visit's duration ticks with `useRelativeNow`.

## Accessibility

- The dialog is the shared `Dialog` (focus trap, Escape, labelled by its title).
- Each day group is a `section` labelled by its heading; rows are a list.
- The duration carries an `aria-label` in words ("45 minutes").
- Colours from the slate and brand ramps the Collaborators dialog uses, in both appearances.

## Observability

- `[attendance] joined` / `[attendance] left` are not logged (one per person per tab is too chatty); a failure logs
  `[attendance] not recorded` with the error string.
- `[attendance] swept` with the count from the boot sweep and the upkeep, when non-zero.
- `[attendance] listed` with `{ documentId, tabId, count }`; refusals through `logRefusal('[attendance] refused')`.
- `[attendance] anonymised` is part of the document's anonymise count.

## Testing

- `db/tab-attendance.test.ts`: join, leave, reopen inside the grace and not after, cap, retention on join and on the
  sweep, boot sweep, anonymise.
- `document-room/room-attendance.test.ts`: two clients through a real room (hello, tab-focus, close): one visit per
  person over two devices, a reconnect inside the grace is one visit, a made-up tab writes nothing, a tab-scoped
  session records only its scope.
- `routes/attendance-routes.test.ts`: Editor and Participant 200, Viewer 403, another tab's scoped link 404, picture
  only for an account caller, `self`, retention filter.
- Editor: `editor-capabilities.test.ts` (`seeAttendance` true for Editor and Participant, false for Viewer),
  `tab-attendance.test.ts` (day groups with a pinned clock, lengths), `TabAttendanceDialog.test.tsx` (rows, empty,
  error), `TabPortalMenu` attendance-only menu.

## Constants and configuration

| Constant                     | Value     | Why                                                                  |
| ---------------------------- | --------- | -------------------------------------------------------------------- |
| `ATTENDANCE_RETENTION_MS`    | 90 days   | The spec; the card's example                                         |
| `ATTENDANCE_TAB_MAX`         | 500       | A month of daily meetings of 15 people; bounds a tab to under 250 kB |
| `ATTENDANCE_REJOIN_GRACE_MS` | 2 minutes | Longer than a reload or a network blip, shorter than a coffee break  |

In `@livehuddle/api-schema` `tab-attendance.ts`, read by the api and the editor (the dialog's subtitle and empty
line).

## Defaults ledger

See [DEFAULTS.md](DEFAULTS.md) rows TA1 to TA4.
