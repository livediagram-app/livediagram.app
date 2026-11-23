# Email to Board

**Email to Board** gives a Plan board its own secret email address: forward a request, a bug report or a to-do to it
and it becomes a card, the subject as the title and the message as the description. The address is the board's to
manage; what it **makes** is a card of a type in a column ([Card targets](items.md#card-targets)), the board's first
of each unless chosen, which shows on every board that takes it.
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
- **A plan kept Offline** has no server to take its mail, so it offers no row; nor does an embed or a workbench
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
there, badged **Sign In**; on a plan kept Offline, badged **Sync Plan**; a press opens that gate first, then the
dialog. It opens the Email to
Board dialog on the tab's first board (a board picker at the top when the tab holds several).

### The dialog

A centred dialog (a bottom sheet on a phone) titled **Email to Board**, subtitled "Forward mail. Get cards.", in two
states:

- **Off**: "Forward an email to this board's own address and it becomes a card in **<first column>**: the subject as
  its title, the message as its description, pictures and PDFs attached." Then **Who Can Send** and **Turn On**.
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
(Plan·Changed·EmailIntakeSenders), what each email becomes changed (Plan·Changed·EmailIntakeTarget), the address copied (Plan·Copied·EmailIntake), turned off (Plan·Ended·EmailIntake),
and, from the api, a card made from an email (Plan·Created·EmailCard).

## What a message makes

One **card**, of the address's **card type** in its **column**, made by no person. An address names a card, never a
board ([Card targets](items.md#card-targets); owner, 2026-11-20): the card shows on every board that takes its type
and has its column.

- **Each Email Becomes**, in the dialog above Who Can Send, Off and On alike: **Card Type** (the card types some
  board shows) and **Column** (the columns that type can be seen in, across the boards that take it, less those the
  type does not use), then "Shows on **Support** and **Triage**", the boards that show such a card, worked out from
  every board of the plan and never chosen. Picking a type keeps the column while the type has it, else takes the
  type's first. Off, a choice waits for Turn On; On, it saves at once (the address kept) and goes back with
  "Couldn't save. Try again." when the save fails. The lines above read it back: "Forward an email to this board's
  own address and it becomes a Bug card in New." and "Mail to this address becomes a Bug card in New."
- **Left alone**, a new address makes the board's first card type in its first column (as the board's own + would),
  and **keeps** that: reordering the board's columns later never moves where its mail lands.
- **An address from before** this (no card of its own) follows its board's first card type and first column as it
  always did, until a card is chosen for it.
- **Never made unseen**: a card type and column no board shows any more (the type deleted or off every board, the
  column gone) is refused as an address turned off is, never turned into a card nobody sees. The dialog says "No
  board shows its cards now, so its mail is refused. Choose what each email becomes." and the pickers are there to
  fix it. A card no board shows is never accepted as a choice (`400 email_intake_invalid`).

The card itself:

- **Title**: the subject, whitespace collapsed, cut to the title's limit; with no subject, "Email from <address>".
- **Description**: the message's text (its plain text part, or its HTML as text), with the **quoted reply removed**
  (the earlier message a reply carries, `On … wrote:` and what follows, a signature) as the platform's reader does it.
  Cut to the description's limit.
- **Attachments**: pictures (PNG, JPEG, WebP, GIF) and **PDFs** of up to **10 MB** each join the card's Attachments,
  at most the card's 20, stored with the plan's owner's uploads at the media service and granted to the plan. What a
  file is comes from its bytes alone, never its name or the type the email claims: a picture by its format's first
  bytes, a PDF by its `%PDF-` start. A file is never opened or run here; the card serves a PDF as a download,
  sandboxed (blueprint "Security and trust"). Everything else (another type, a bigger file, one
  past the twentieth, any the media service refuses) is **listed and dropped**: a line at the end of the
  description, "Not attached: notes.docx (2.1 MB, not a picture or PDF), photo.png (14 MB, over 10 MB)." The
  coordinator's answer (2026-11-19) set this: PDFs only beside pictures, capped as pictures are, through the storage
  already paid for; the owner may widen it later.
- **From email**: the card keeps the sender's address in its `fromEmail` field, and its panel's footer says
  **From email alice@example.com** with a mail glyph, beside Created by (which names the same address). Its history
  starts "Created this card from an email in <column>". Like any card as made, it has no Edited by row until someone really
  edits it ([Created and Last Edited](items.md#created-and-last-edited)).
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

9. **The owner's month** (only with Pro on, [Tiers](#tiers)): one of the owner's emails to boards for the UTC month,
   over every plan they own, spent once the address's rates let the message through. Else refused, "This board is not
   taking email right now. Try again next month." A plan that already found the month used refuses this way before
   the address's rates, asking the subscription service nothing.

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

- `GET`: whether the server takes mail (and its domain), every board's address with its settings, counts and what it
  makes (`target`: the card type and column by id and name, and the boards that show it; null when none does), the
  boards that may have one, each with its first column's name and the card it would make, and the card types some
  board shows with their columns (`types`).
- `PUT /:boardId` with `{ senders }`, and optionally `{ typeId, status }` (both or neither): turn the board's address
  on (201, a new code) or change Who Can Send or what it makes, keeping the address (200). Left out, what it makes
  stays as it is.
- `POST /:boardId/new-address`: a new code (200); 404 when the board has none.
- `DELETE /:boardId`: Turn Off; 204 whether or not it was on.

A body names Who Can Send as `members` or `anyone`; the board must be one that may have an address; a card named
must be one some board shows. Anything else is
`400 email_intake_invalid`; a server with no intake domain answers `503 email_intake_unavailable` to every write.
Every answer is `no-store`.

## Tiers

With Pro off nothing here applies: nothing is counted and the hourly rates above are the only limits. With
[Pro on](../../../../liveworkspace/docs/specs/019-subscription/subscription.md) each email made into a card spends one
of the plan's **owner's** Email to Board for the UTC month (Free 500, Pro 10,000, Pro for Teams 5,000 a member,
pooled), over every plan the owner has (owner, 2026-11-22): a team's for a plan in a team's library, never the
sender's or the person who turned the address on.

- The spend is made after the address's rates and before the card is made: a refused or dropped message, or one the
  rates turn away, spends nothing. A card that then could not be made keeps its spend: the service has no refund,
  and such a failure is rare.
- The per-plan day count that stood before (owner, 2026-11-22) is gone: the hourly rates (100 cards an hour to an
  address, 20 from one sender) are the fixed bound on every tier.
- A guest's plan and a plan that is nobody's yet spend nothing: the hourly rates are all they have.
- **Out of reach is not refused:** with the service out of reach the mail is taken, uncounted. When it refuses the
  request (it cannot be checked) the mail is refused as "Couldn't check the sender. Send it again later.", so the
  sender's server tries again.
- Past the owner's month a message is refused as the receiving server's answer (step 9), in plain words that name no
  tier. Nothing is counted against the address as refused. The plan remembers the month it was refused in and the
  limit met (its `plan_meters` row), so later mail and the dialog read it as used with no call to the service. Mail
  is taken again on the first of the next month (UTC), or as soon as the owner's tier allows more: a message the
  plan's mark would refuse asks for the owner's limits once more first, so mail is taken straight after an upgrade.
- The dialog's `GET` carries `month` (`limit` and `full`) and `owner` (the owner's scope). What the owner used is
  theirs alone (019 "What a collaborator is told"): the dialog reads it from the owner's own subscription.

### What the dialog shows

Only with Pro on, once any address of the plan is on: to the owner or a member of the owning team, a meter, **Emails
to boards this month**, of the owner's month over every plan they own ("12 of 500"). Once the `GET` says the month is
used, or the meter's own count reaches the limit (so the owner never sees a full meter with no word of the mail that
follows), a notice says "This month's 500 emails to your boards have become cards. More are turned away until 1
December, and the sender is told." (a team reads "this team's boards"). The plan's owner (or an admin of the owning
team) also reads "Pro takes 10,000 a month." with **Upgrade to Pro**; another member of the team is pointed at an
admin with **Ask an Admin**; anyone else reads "This plan's owner has used this month's emails to boards. More are
turned away until 1 December, and the sender is told." with no number. **See All Limits**, a quiet link under the
notice for the owner and the owning team, opens Settings at Subscription. While any address is on, the dialog reads
again every 30 seconds and when the window regains focus, so a month found used shows without reopening.

## Privacy

The sender's address is kept on the card (it is who asked), and the message's text and pictures are what they chose
to send. Headers, the quoted earlier messages and every other recipient are never kept. Logs carry counts, verdicts
and redacted addresses only. A card made from an email shows in a plan's Community post as a form's response does:
its title and description, never its sender.

## Not yet

- Replies by email, comments by email, and sending a card back out.
- An address of the plan's own, kept apart from any board: an address is still turned on from a board and goes with
  it (the board is where it is managed), though what it makes is a card and shows on every board that takes it.
- An address for a whole plan rather than a board.
