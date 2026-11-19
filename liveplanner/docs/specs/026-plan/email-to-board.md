# Email to Board

**Email to Board** gives a Plan board its own secret email address: forward a request, a bug report or a to-do to it
and it lands as a card in the board's first column, the subject as the title and the message as the description.
People moving from Trello (an address per board), Asana (an address per project) or Linear (intake addresses) expect
it; until now the only ways in were retyping a message or sharing a Form link (Work Tracker 874).

Mail comes in through the platform's inbound email ([inbound-email.md](../../../../liveworkspace/docs/specs/003-accounts/inbound-email.md)):
Email Routing on `in.liveplanner.app` (one rule for `board@`, with subaddressing on) hands every message to the api Worker's `email()` handler, the platform's reader
parses it and checks the sender's SPF, DKIM and DMARC, and liveplanner's door turns it into a card. The owner chose
this subdomain on the card (2026-11-15, option (a)).

## Domain language

| Term              | Meaning                                                                                | Not                    |
| ----------------- | -------------------------------------------------------------------------------------- | ---------------------- |
| **board address** | A board's secret address, `board+<code>@in.liveplanner.app`                            | inbox, alias, mailbox  |
| **address code**  | The random part of the address: 26 characters of lower-case base32 (128 bits)          | token, key, password   |
| **Who Can Send**  | The board's setting: **Plan Members** (the default) or **Anyone with the Address**     | allowlist, permissions |
| **plan members**  | The plan's owner and the people in its team, by the address their account has verified | collaborators, sharers |
| **New Address**   | A fresh code for the same board; the old address stops taking mail at once             | rotate, regenerate     |
| **Turn Off**      | Ends the address; turning on again makes a new one                                     | delete, disable        |
| **email card**    | A card an email made: its title, description, pictures and the sender it came from     | ticket, message card   |

## Who may manage an address

- **An Editor of the whole plan, signed in** (owner, 2026-11-16): its owner, the members of its team, and anyone
  holding it through an Editor share link, in person with an account. A guest is refused (403
  `email_intake_needs_editor`) and sees the row badged **Sign In**, whose gate signs in and comes back with it open
  (`?email=1`). Turning an address on lets mail add cards, which is an Editor's change to
  the board, so it is never a Participant's or a Viewer's: they see no row and the routes refuse them.
- **Not** through an API token or a workbench session (a delegated caller never mints a lasting secret), nor a
  link confined to one tab, nor a Community link. Refused with 403 `email_intake_needs_editor`.
- **A plan in This Browser** has no server to take its mail, so it offers no row; nor does an embed or a workbench
  frame.

| Role                              | See the address, copy it, New Address, Turn Off, Who Can Send |
| --------------------------------- | ------------------------------------------------------------- |
| Owner, team member, Editor (link) | yes                                                           |
| Participant (link)                | no row; the routes answer 403                                 |
| Viewer (link)                     | no row; the routes answer 403                                 |

## Email to Board…

### Where it lives

**Email to Board** in the footer's **Tools** menu, in its Automate group under Automations
([Footer Tools menu](../../../../liveworkspace/docs/specs/004-index/footer-tools-menu.md); moved out of the tab menu, owner
2026-11-16), on a tab holding at least one Plan board, for someone who may manage an address. Signed out, it is still
there, badged **Sign In**; on a plan in This Browser, badged **Sync Plan**; a press opens that gate first, then the
dialog. It opens the Email to
Board dialog on the tab's first board (a board picker at the top when the tab holds several).

### The dialog

A centred dialog (a bottom sheet on a phone) titled **Email to Board**, subtitled "Forward mail. Get cards.", in two
states:

- **Off**: "Forward an email to this board's own address and it becomes a card in **<first column>**: the subject as
  its title, the message as its description, pictures attached." Then **Who Can Send** and **Turn On**.
- **On**: the address in a read-only field with **Copy Address**, then a quiet line of what it has done: "3 cards
  made · 1 refused · Last card 2 hours ago" (or "No mail yet."), then **Who Can Send**, which saves as it changes
  (the address kept). The footer holds **New Address** and **Turn Off**, each behind a confirm, and **Done**:
  - New Address: "Make a new address? The old one stops taking mail at once."
  - Turn Off: "Turn off this address? Mail sent to it is refused from now on."

**Who Can Send** is two choices: **Plan Members** ("Only the plan's owner and team, from the address their account
uses") and **Anyone with the Address** ("Anyone who knows it, so keep it private"). Under them, in the dialog's
warning tone: "Anyone who can send from an allowed address can add cards to this board. If the address leaks, press
New Address." While it reads, a quiet loading row; a failed read says "Couldn't load this board's address." with
**Try Again**; a failed write leaves the dialog as it was and says "Couldn't save. Try again."

A board with no column to put cards in (an All Cards board, an archive board) says "This board has no column for new
cards." A server with no intake domain (a fork, a local run without one) says "Email to Board isn't set up on this
server." and offers nothing else.

### Telemetry

Counts only, never a plan, a board, an address or a sender: the dialog opened (UI·Opened·EmailIntake), an address
turned on (Plan·Created·EmailIntake), a new address (Plan·Changed·EmailIntakeAddress), Who Can Send changed
(Plan·Changed·EmailIntakeSenders), the address copied (Plan·Copied·EmailIntake), turned off (Plan·Ended·EmailIntake),
and, from the api, a card made from an email (Plan·Created·EmailCard).

## What a message makes

One **card on the board, in its first column**, of the first card type the board adds (as the board's own + would),
made by no person:

- **Title**: the subject, whitespace collapsed, cut to the title's limit; with no subject, "Email from <address>".
- **Description**: the message's text (its plain text part, or its HTML as text), with the **quoted reply removed**
  (the earlier message a reply carries, `On … wrote:` and what follows, a signature) as the platform's reader does it.
  Cut to the description's limit.
- **Attachments**: pictures (PNG, JPEG, WebP, GIF) of up to **10 MB** each join the card's Attachments, at most
  the card's 20, stored with the plan's owner's uploads at the media service and granted to the plan. Everything
  else (another type, a bigger file, one past the twentieth, any the media service refuses) is **listed and
  dropped**: a line at the end of the description, "Not attached: report.pdf (2.1 MB, not a picture), photo.png
  (14 MB, over 10 MB)."
- **From email**: the card keeps the sender's address in its `fromEmail` field, and its panel's footer says
  **From email alice@example.com** with a mail glyph, beside Created by (which names the same address). Its history
  starts "Created this card from an email in <column>". The footer has no Edited by row while the card is as it was
  made (its Last Edited By is the sender and its Last Edited At is when it was made, which a picture attached as the
  card is made does not change): only Created by, until someone really edits it.
- **Rules**: the card starts the plan's [Automations](automations.md) once, as any new card does: **Card Created**
  rules hear it, and so do **[Email Received](automations.md#email-received)** rules, which hear only email cards,
  narrowed by the board and by the sender (an address or a domain), and can write the sender as `{{from}}`.
- Nothing else of the message is kept: no other header, no recipients, no message id, no HTML.

## Which mail is taken

In order; the first that fails decides:

1. **The address** must be one: `board+<code>@` the intake domain, the code the right shape. Else refused, "No such
   address."
2. **Size**: at most **20 MB**, as declared. Else refused, "This message is too big for Email to Board."
3. **The sender's rate**: at most 60 messages a minute from one envelope sender across every board. Else refused,
   "Too many messages. Try again later."
4. **The address is on**: its code names a board now. Else refused, "No such address."
5. **Authentication**: the reader's SPF/DKIM/DMARC verdict from the topmost `Authentication-Results` Email Routing
   wrote. A message that fails is **dropped**: taken and thrown away, counted as dropped, with nothing sent anywhere.
6. **The plan and the board**: the plan not archived and not in the Trash, the board still on a tab with a first
   column. Else refused, "No such address."
7. **Who Can Send**: with **Plan Members**, the sender's address (the header `From:`, which DMARC vouches for) must
   be the verified address of the plan's owner or of a joined member of its team, asked of accounts on every
   message. Else **refused and counted**: "This board only takes mail from its plan's members." When accounts cannot
   say, refused: "Couldn't check the sender. Send it again later."
8. **The address's rates**: at most **100 cards an hour** to one address, and **20 an hour from one sender** to one
   address. Else refused, "Too many messages to this address. Try again later."

A refusal is the receiving server's answer during delivery, so the sender's own mail server tells them; liveplanner
sends nothing back, so a forged sender is never mailed.

## How it is kept

- Each board with an address has one row in the plan's own storage: the board, its tab, the code, Who Can Send, when
  it was made, its counts (made, refused, dropped), when it last made a card, and its hour's counts. The code is kept
  as it is: it is the address, shown again each time the dialog opens. A small directory names the plan and board
  each code belongs to, so a message finds its plan without waking any other.
- New Address replaces the code (the old one's directory entry goes at once); Turn Off deletes the row and the
  entry. A plan's purge drops its rows with the rest; a copy of the plan, a Drive file and an export carry none.
- An address of a board that has since gone (deleted, or its tab deleted) refuses mail until the board's address is
  turned on again; the dialog no longer lists it.

## Managing an address (signed-in routes)

`/api/projects/:id/email-intake`, answered inside the plan's room, for an Editor of the whole plan in person:

- `GET`: whether the server takes mail (and its domain), every board's address with its settings and counts, and the
  boards that may have one, each with its first column's name.
- `PUT /:boardId` with `{ senders }`: turn the board's address on (201, a new code) or change Who Can Send, keeping
  the address (200).
- `POST /:boardId/new-address`: a new code (200); 404 when the board has none.
- `DELETE /:boardId`: Turn Off; 204 whether or not it was on.

A body names Who Can Send as `members` or `anyone`; the board must be one that may have an address. Anything else is
`400 email_intake_invalid`; a server with no intake domain answers `503 email_intake_unavailable` to every write.
Every answer is `no-store`.

## Privacy

The sender's address is kept on the card (it is who asked), and the message's text and pictures are what they chose
to send. Headers, the quoted earlier messages and every other recipient are never kept. Logs carry counts, verdicts
and redacted addresses only. A card made from an email shows in a plan's Community post as a form's response does:
its title and description, never its sender.

## Not yet

- Replies by email, comments by email, and sending a card back out.
- Choosing the column or the card type per address (the first column and the board's first type for now).
- An address for a whole plan rather than a board.
