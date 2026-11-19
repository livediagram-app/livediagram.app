# Email to Board blueprint

Derived from [email-to-board.md](../email-to-board.md) (Work Tracker 874): the plan's addresses table and the code
directory, the managing routes, the Worker's `email()` door, the delivery inside the plan's room, the card it makes,
and the editor's Email to Board dialog. The message itself is read by the platform's reader
(`@liveworkspace/email/inbound`, [its blueprint](../../../../../liveworkspace/docs/specs/003-accounts/blueprints/inbound-email.md)).

## Domain and naming

| Spec term      | Identifier                                                                                                                                    |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| board address  | `EmailIntake` (api-schema) `{ boardId, address, senders, createdAt, made, refused, dropped, lastAt }`; row `IntakeRow`, table `email_intakes` |
| address code   | `code`, `INTAKE_CODE_PATTERN` `^[a-z2-7]{26}$`, made by `newIntakeCode()`; local part `board+<code>`                                          |
| Who Can Send   | `EmailIntakeSenders` `'members' \| 'anyone'`, `EMAIL_INTAKE_SENDERS`                                                                          |
| plan members   | `planMemberAddresses(env, ownerId, teamId)` → `Set<string>` \| `'unavailable'`                                                                |
| New Address    | `newIntakeAddress(env, planId, boardId, now)`                                                                                                 |
| Turn Off       | `turnOffIntake(env, planId, boardId)`                                                                                                         |
| the directory  | a `PLAN_ROOM` instance named `~mail:<code>`, its `intakeEntry` / `setIntakeEntry` RPCs                                                        |
| email card     | `emailCardCreate(input)` (pure); `FROM_EMAIL_FIELD` `'fromEmail'`, `readFromEmail(v)` (items)                                                 |
| who may manage | `intakeEditor(ctx, projectId)` (api), `emailIntakeScopeFor(input)` (editor)                                                                   |
| a delivery     | `IntakeDelivery` `{ code, sender, subject, text, attachments }`, `IntakeOutcome`                                                              |

## Files

- `packages/api-schema/src/email-intake.ts`: the wire types above, `EMAIL_INTAKE_ERRORS`, `emailIntakeAddress(code,
domain)`.
- `packages/items/src/from-email.ts`: `FROM_EMAIL_FIELD`, `fromEmailValue`, `readFromEmail`. `item-history.ts`'s
  `ItemHistoryTag` gains `'email'`.
- `apps/api/src/email-intake/intake-code.ts`: `newIntakeCode()`, `codeOfRecipient(to, domain)`.
- `apps/api/src/email-intake/intake-store.ts`: `EMAIL_INTAKES_SCHEMA`, `intakesOf`, `intakeOfBoard`, `intakeByCode`,
  `turnOnIntake`, `setIntakeSenders`, `replaceIntakeCode`, `turnOffIntake`, `countIntake`, `takeIntakeHour`.
- `apps/api/src/email-intake/intake-directory.ts`: `directoryRoom(env, code)`, `findIntake`, `fileIntake`,
  `unfileIntake`, and the room side `readDirectoryEntry` / `writeDirectoryEntry` (storage key `intake`).
- `apps/api/src/email-intake/intake-boards.ts`: `intakeBoardsOf(env, planId, types)` (each board with its first
  column and first add type), reusing `roadmap-boards.ts`'s walk.
- `apps/api/src/email-intake/intake-members.ts`: `planMemberAddresses`.
- `apps/api/src/email-intake/intake-card.ts` (pure): `emailCardCreate`, `droppedLine`, `cardTitleOf`.
- `apps/api/src/email-intake/intake-pictures.ts`: `attachPictures(env, planId, ownerId, attachments)` → `{ attached,
dropped }`.
- `apps/api/src/email-intake/intake-delivery.ts` (in the room): `deliverIntake(room, planId, delivery, now)`.
- `apps/api/src/email-intake/email-handler.ts` (the Worker): `handleIntakeEmail(message, env, ctx)`; `index.ts`'s
  default export gains `email`.
- `apps/api/src/routes/email-intake-routes.ts`: `handleEmailIntakeRoutes(ctx)`, dispatched from
  `project-subresource-routes.ts` after the roadmaps'.
- `plan-schema.ts`: V34, `EMAIL_INTAKES_SCHEMA`. `plan-room.ts`: `emailIntake`, `intakeEntry`, `setIntakeEntry`;
  `plan-client.ts` likewise.
- `apps/api/wrangler.toml`: `EMAIL_INTAKE_DOMAIN = "in.liveplanner.app"` in `[vars]` (unset on staging: off there).
- Editor `components/email-intake/`: `email-intake-gate.ts` (`emailIntakeScopeFor`), `email-intake-client.ts`,
  `EmailIntakeContext.tsx`, `EmailIntakeHost.tsx` (the dialog loads on first open), `EmailIntakeDialog.tsx`,
  `EmailIntakeSenders.tsx`, `EmailIntakeHeroArt.tsx`, `EmailIntakeMenuRow.tsx`. `ItemPanelLayout.tsx`'s `ItemMeta`
  gains the From email row; `activity-words.ts` the `email` tag's words.

## Data and persistence

```sql
CREATE TABLE IF NOT EXISTS email_intakes (
  plan_id     TEXT    NOT NULL REFERENCES plan (id) ON DELETE CASCADE,
  board_id    TEXT    NOT NULL,
  tab_id      TEXT    NOT NULL,
  code        TEXT    NOT NULL,           -- the address's code, kept plain (it is the address)
  senders     TEXT    NOT NULL,           -- 'members' | 'anyone'
  created_at  INTEGER NOT NULL,
  made        INTEGER NOT NULL DEFAULT 0,
  refused     INTEGER NOT NULL DEFAULT 0,
  dropped     INTEGER NOT NULL DEFAULT 0,
  last_at     INTEGER,                    -- the last card made
  hour_start  INTEGER NOT NULL DEFAULT 0,
  hour_count  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (plan_id, board_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS email_intakes_code ON email_intakes (code);
CREATE TABLE IF NOT EXISTS email_intake_senders (
  code        TEXT    NOT NULL,
  sender      TEXT    NOT NULL,           -- SHA-256 hex of the lower-cased address, never the address
  hour_start  INTEGER NOT NULL,
  hour_count  INTEGER NOT NULL,
  PRIMARY KEY (code, sender)
);
```

- Classification: configuration and counters; `email_intake_senders` holds hashes only, pruned of windows over an
  hour old on every write. The directory instance holds `{ planId, boardId }` under `intake`, nothing else. Not
  copied with the plan, not in exports or the Drive file; purge drops the plan's rows (a directory entry left behind
  names a plan with no row, which refuses). A plan schema step; no D1 migration.

## Behaviour and state

- `intakeEditor`: `requireOwner` (401); the plan (`getProject`, 404); no `token`, no `workbench`; `grantOn` with
  `role === 'edit'`, `tabScope === null`, not `community`. Else 403 `email_intake_needs_editor`, logged
  `[email-intake] refused { reason }` (`not_in_person`, `not_editor`).
- `GET`: `{ available, domain, intakes, boards }` (`available` false and `domain` null without
  `EMAIL_INTAKE_DOMAIN`); intakes of boards that still exist only.
- `PUT /:boardId` `{ senders }`: the board must be in `intakeBoardsOf` with a first column and a type (else 400
  `email_intake_invalid`). No row: a code, `fileIntake` (directory first), `turnOnIntake`, 201. A row:
  `setIntakeSenders`, 200. Both answer `{ intake }`.
- `POST /:boardId/new-address`: no row 404 `email_intake_not_found`; else a code, `fileIntake(new)`,
  `replaceIntakeCode` (counts kept, hour reset), `unfileIntake(old)`; 200 `{ intake }`.
- `DELETE /:boardId`: `turnOffIntake` then `unfileIntake`; 204 either way.
- Writes without `EMAIL_INTAKE_DOMAIN`: 503 `email_intake_unavailable`.
- `handleIntakeEmail(message, env, ctx)`, each refusal `message.setReject(text)` and a log:
  1. `codeOfRecipient(message.to, env.EMAIL_INTAKE_DOMAIN)`: domain equal (case-insensitive), local part `board+` and
     a code matching the pattern after lower-casing; else `no_address`.
  2. `message.rawSize > INTAKE_MESSAGE_MAX` → `too_big`.
  3. `FORM_RATE_LIMITER.limit({ key: 'mail:' + sha256(envelope sender) })` fails → `sender_rate`.
  4. `findIntake(env, code)` null → `no_address`.
  5. The raw stream read once into bytes (`new Response(message.raw).arrayBuffer()`), `readInboundMail` with
     `INTAKE_TRUSTED_AUTHSERV_IDS` and the envelope sender. `fail` → counted `dropped` in the room
     (`emailIntake(..., { dropped: true })`), logged with its reason, accepted (no reject).
  6. `planRoom(env, planId).emailIntake(delivery)`: the outcome `made` (accepted), `gone` (`no_address`),
     `refused_sender`, `busy`, `unavailable` → each its reject text.
- `deliverIntake`: `bindStoredPlan` false or `standing.putAway` → `gone`; `intakeByCode` null → `gone`; the board on
  its tab with a first column and type (`intakeBoardsOf`) else `gone`; `senders === 'members'`: the plan row's owner
  and team → `planMemberAddresses`; `'unavailable'` → `unavailable`; the sender not in it → `countIntake(refused)`,
  `refused_sender`; `takeIntakeHour(code, senderHash, now)` false → `busy`; then `attachPictures`, `emailCardCreate`,
  `createMany` (by the email person), `relay`, `appendItemHistory(..., 'email', { role: 'system', email: { from:
sender, board: board.id } })` (the one created event Card Created and Email Received both hear, automations
  blueprint "Email Received"), `noteWrite`,
  `countIntake(made, now)`, the server event, `made`.
- `takeIntakeHour`: one statement on the row (`INTAKE_CARDS_PER_HOUR`) and one on the sender row
  (`INTAKE_SENDER_PER_HOUR`), after `DELETE ... WHERE hour_start <= now - HOUR`; when the sender's is over, the
  row's count is given back.
- `emailCardCreate({ subject, text, sender, attached, dropped, type, status })`: title `cardTitleOf(subject, sender)`
  (collapsed, cut to `ITEM_TITLE_MAX` characters; empty → `Email from <sender>`); description the text trimmed, then
  `droppedLine(dropped)` after a blank line, cut to `ITEM_DESCRIPTION_MAX` (text cut first so the dropped line stays
  whole); `attachments` when any; `fromEmail` the sender. Read through `readItemCreate`.
- `attachPictures`: no media client → every picture dropped `not_saved`. Each attachment in order: type not one of
  `ATTACHMENT_TYPES` → `not_picture`; bytes over `INTAKE_PICTURE_MAX` → `too_big`; past `ITEM_ATTACHMENTS_MAX`
  attached → `too_many`; else `media.upload` as the plan owner (`mediaOwner`), claimed for the plan; a refusal →
  `not_saved`; success → `grantImage` (the room's `recordImageGrant`) and an attachment entry.
- The email person: `{ id: 'email:' + first 12 hex of sha256(sender), name: sender (cut to 80), color
EMAIL_PERSON_COLOR }`.

## Interfaces and contracts

- `GET /api/projects/:id/email-intake` 200 `EmailIntakesResponse` `{ available, domain, intakes: EmailIntake[],
boards: EmailIntakeBoard[] }`; `EmailIntakeBoard` `{ id, title, tabId, tabName, column: string | null }`
  (`column` null: no column for new cards).
- `PUT /api/projects/:id/email-intake/:boardId` body `{ senders }` → 201/200 `EmailIntakeResponse` `{ intake }`.
- `POST /api/projects/:id/email-intake/:boardId/new-address` → 200 `EmailIntakeResponse`.
- `DELETE /api/projects/:id/email-intake/:boardId` → 204.
- Refusals `{ error }` from `EMAIL_INTAKE_ERRORS`: `email_intake_needs_editor`, `email_intake_invalid`,
  `email_intake_not_found`, `email_intake_unavailable`. Another method 405; all `no-store`.
- Room RPC: `emailIntake(planId, delivery | { code, dropped: true })` → `IntakeOutcome`; directory RPCs
  `intakeEntry()` / `setIntakeEntry(entry | null)` on the `~mail:<code>` instance.

## Errors and edge cases

- Two messages racing on one address: each hour statement is one atomic update; the card writes use the item store's
  retry loop.
- A board turned into All Cards, deleted, or its tab deleted: `gone` until it is turned on again; the dialog lists it
  no more.
- A plan purged: the directory entry remains and names a plan with no row: `gone`.
- New Address while mail is in flight: the in-flight message carries the old code, which the room no longer holds:
  `gone`.
- A sender with no `From:` header: `fail none_passed`, dropped.
- Media off, the gallery full, a refused picture: listed as `not_saved` ("couldn't be saved").

## Security and trust

- The code is 128 random bits; guessing costs one directory miss per try and the sender limit caps the rate.
- Only the topmost Authentication-Results from Email Routing counts (the reader). Plan Members compares the
  DMARC-aligned header `From:` (or the envelope sender when they match) with addresses accounts has verified.
- Rejections never echo anything back to the sender; nothing is ever sent from the address.
- The card's text is plain text through the item store's checks; no HTML is kept. Pictures go through the media
  service's sniffing like any upload.
- The routes refuse Participants, Viewers, tab links, tokens, workbench sessions and Community grants.

## Performance and limits

- The Worker: one directory read, one parse (linear, bounded by `INTAKE_MESSAGE_MAX`; the reader's CPU test), one
  room call. The room: one plan read, the tab walk for the board, two accounts calls for Plan Members, up to 20 media
  uploads (pictures only), one item write.
- Worst case CPU: a 20 MB message of text is parsed in one pass; the reader's budget test covers 1 MB in 50 ms, so
  20 MB stays inside a Worker's 30 s CPU limit by two orders of magnitude.

## Observability

`[email-intake] refused { reason }` (routes), `[email-intake] manage { action }` (`on`, `senders`, `new_address`,
`off`), `[email-intake] mail { outcome, reason? }` (`no_address`, `too_big`, `sender_rate`, `dropped` with the
verdict's reason, `made`, `gone`, `refused_sender`, `busy`, `unavailable`), each with a redacted sender at most.

## Testing

- `packages/items` `from-email.test.ts`; the `email` tag's activity words in the editor.
- `apps/api` `email-intake/intake-parts.test.ts` (the code and recipient; the card: title, no subject, description
  cut with the dropped line whole, attachments; the directory entry; plan members: owner, joined members only,
  accounts down; pictures: each drop reason, the cap, grants), `email-handler.test.ts` (every refusal and the drop
  through a fake message, the hour cap for one sender, made cards end to end through the room),
  `routes/email-intake-routes.test.ts` (owner, team member, guest owner and Editor link manage; tab link, Participant,
  Viewer, tokens, workbench and link visitor refused with nothing changed; new address stops the old at once; turn
  off; unavailable; 405; invalid bodies; a board gone).
- Editor: `email-intake-client.test.ts` (the gate and the four calls), `EmailIntakeDialog.test.tsx` (with the host and
  the menu row; each state, copy, New Address and Turn Off confirms, Who Can Send saving and going back),
  `ItemPanel.navigation.test.tsx` (the From email row), `activity-words.test.ts` (the `email` tag).

## Constants and configuration

| Constant                      | Value                | Why                                                             |
| ----------------------------- | -------------------- | --------------------------------------------------------------- |
| `INTAKE_CODE_BYTES`           | 16                   | 128 bits, 26 base32 characters, case-proof in an address        |
| `INTAKE_MESSAGE_MAX`          | 20 MB                | Under Email Routing's 25 MiB; ten full-size pictures and text   |
| `INTAKE_PICTURE_MAX`          | 10 MB                | The media service's `MAX_IMAGE_BYTES`                           |
| `INTAKE_CARDS_PER_HOUR`       | 100                  | A busy shared inbox; a flood stops at once (safe range 20..500) |
| `INTAKE_SENDER_PER_HOUR`      | 20                   | One person forwarding a backlog (safe range 5..100)             |
| sender rate                   | 60/min               | `FORM_RATE_LIMITER`'s window, keyed `mail:<hash>`               |
| `INTAKE_TRUSTED_AUTHSERV_IDS` | `mx.cloudflare.net`  | Email Routing's authserv-id                                     |
| `EMAIL_INTAKE_DOMAIN`         | `in.liveplanner.app` | `[vars]`; unset turns the feature off (staging, forks)          |

## Presentation and UX

- Dialog: `Dialog` size `md`, `phoneSheet`, `HeroDialogHeader` with an envelope dropping into a card; a board
  `Select` when the tab holds several; Off: the explanation naming the first column, Who Can Send (two radio cards,
  `role="radiogroup"`), the warning note, footer Turn On. On: the address field (mono, read-only, selects on focus)
  with Copy Address (Copied for 1.8 s and a polite status), the counts line, Who Can Send (saves at once, optimistic,
  rolled back with "Couldn't save. Try again."), the note, footer New Address and Turn Off (`ConfirmPopover` each)
  and Done.
- Item panel footer: `MetaRow` with the mail glyph, "From email" and the address in `META_NAME`, the full address in
  its tooltip. The Edited by row is left out while the card's Last Edited By is its maker and its Last Edited At is its
  Created At (`ItemMeta`'s `unedited`).

## Accessibility

- The radio cards are a labelled `radiogroup` of `role="radio"` buttons with `aria-checked`, arrow keys moving the
  choice; the address field has an `aria-label`; the copy result is announced; confirms trap focus as every
  `ConfirmPopover` does.

## Defaults ledger

D131 to D135 in [DEFAULTS.md](DEFAULTS.md).
