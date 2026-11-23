# Required Reading

Owner, 2026-11-21, picked from the lead's suggestions (Work Tracker 1341): policy pages (security, the code of
conduct, expenses) often need everyone to confirm they read them. [Verification](verification.md) and
[Approval](approval.md) say whether a page is right, never whether people have read it.

Status: **built, not yet verified on a deployed Worker** ([blueprint](blueprints/required-reading.md)). Details marked
"(decided)" were decided by the builder and stand until the owner overturns them.

## What it is

- An Editor marks a page **Required Reading** for **Everyone** or for **Chosen People**. Each person asked sees a
  banner on the page with **I've Read This** until they confirm.
- **Everyone** is every joined member of the knowledgebase's team and its owner. A knowledgebase with no team counts
  its owner and anyone else who opened the page and confirmed (decided: the index can't list everyone a personal
  knowledgebase is shared with, so they count once they confirm). Anyone signed in who reads the page is asked,
  member or not.
- **Chosen People** are accounts the Editor picks from the people the editor knows (the team, as for a page's owner),
  at most 200 (decided).
- A **confirmation** records who and when. One a person a page; pressing again changes nothing.
- **Asking again** (a significant change): saving the page with **Ask Everyone to Read Again** ticked clears every
  confirmation, so everyone asked is asked again. A save without it (a typo, a link) keeps them.
- Stored in the knowledgebase's Durable Object, its own tables `page_required_reading` and `page_read_confirmations`
  (schema step V42), never in the page's body and never in D1. Marking, confirming and asking again are no edit: no
  revision, no Updated stamp, no History entry. A page deleted for good takes its requirement and confirmations with
  it; a closed account's confirmations are removed, and it leaves every chosen list. A copy of the page or the
  knowledgebase starts with none.

## Where it shows

- **The banner**, above the meta row, for a signed-in person who is asked and has not confirmed, while they read the
  page (not while they edit it): a book glyph, **Required Reading**, one line ("Please read this page, then confirm
  you have." or, after a change, "This page changed on 14 Nov. Please read it again, then confirm."), and **I've Read
  This** (primary, small). A press shows at once: the banner goes and a toast says "Thanks. You've confirmed you read
  <page>.". A refusal puts it back with a toast in words. Calm brand tint, never amber or red: it asks, it does not
  warn.
- **The page's menu** (the tree row's menu, right-click or its More button): **Require Reading** (the book glyph),
  for an Editor, while the page is not Required Reading (owner 2026-11-23: "require reading should be in the page
  context menu until enabled, not always shown"). It opens the page and the setup panel in a centred modal (a sheet
  on a phone), as the menu's Request Approval does. Once the page is Required Reading the row goes from the menu and
  the page shows it (below); Stop Requiring puts the row back. A page whose state this browser has not read yet
  offers the row too, and its modal shows the page as it stands (Save and Stop Requiring when it turns out to be
  required already, decided).
- **Page Info**: a **Required Reading** section under Page Health, drawn only while the page is Required Reading
  (never on a page that is not: setting it up starts in the page's menu, above):
  - Required, for everyone who reads the page: who is asked ("Everyone" or "4 People"), a progress bar and "7 of 12
    have read it" (a count, never who), and their own state: "You read it 3 Nov" with a tick, or "You haven't
    confirmed yet" with **I've Read This**.
  - Required, for an Editor and for the page's owner: the people too, in two groups, **Not Yet** first, then **Read**,
    each a disc, a name and, for Read, the date; and **Remind** (below). An Editor also sees **Change**, which opens
    the setup panel.
- **The setup panel** (a popover under its button, a sheet on a phone): **Required Reading** with "Who should read
  this page?", two choices, **Everyone** ("Every member of the team") and **Chosen People** (a checklist of the
  people the editor knows, the person here first), then **Cancel** and **Require Reading** (or **Save** when it is
  already required). Opened from the page's menu, it is a centred modal with the same body. When required, **Stop Requiring** at its foot (destructive, no question: setting it again is one
  press, decided) clears it and its confirmations. Chosen People with nobody ticked can't be saved.
- **Ask Everyone to Read Again**, while an Editor edits a Required Reading page: a small toggle in the draft bar, left
  of Cancel, off by default and off again after each Save or Cancel. Saving with it on asks everyone again; the
  save's toast says so: "Expenses Saved. Everyone is asked to read it again.".
- **AI Knowledge**: a **Required Reading** card in the right column under Knowledge Health: each Required Reading
  page with its bar and "7 of 12", the least read first, each row opening its page; empty, "No Required Reading" and
  "An Editor marks a page Required Reading from its menu in the page tree.". Counts only, for everyone who sees AI Knowledge.
- Hidden in an embed, a published site and a knowledgebase kept Offline (no room).

## Remind

- **Remind** sends each person who has not confirmed one email, **Please Read <page>**: who asked (the Editor or
  owner who pressed), the page as a link, and the knowledgebase's link. A person is reminded of a page at most once a
  week (decided: a person, a page); a press inside that week skips them, so pressing again the next day reaches only
  people not yet reminded.
- It goes through the platform's notifier to the account's verified address, only while their **Knowledgebase
  Reviews** setting is on (the switch the review emails use, [Verification](verification.md#reminders)), and only to
  someone who can still open the knowledgebase. It shares those emails' ceiling of 50 a knowledgebase a day. A guest
  has no address. A deployment that sends no email shows no Remind.
- The button says what happened in a toast: "Reminded 5 people.", "Everyone not yet read was reminded this week.",
  "Nobody is left to remind.", "The day's emails for this knowledgebase are used up. Try tomorrow."; and under it,
  "Last reminded 2 days ago" once one went.

## Share roles

| Action                                      | Editor | Page's owner | Participant | Viewer | Signed-in link visitor | Guest (no account) | Agent |
| ------------------------------------------- | ------ | ------------ | ----------- | ------ | ---------------------- | ------------------ | ----- |
| See that a page is Required Reading, counts | yes    | yes          | yes         | yes    | yes                    | yes                | yes   |
| Be asked, see the banner, confirm           | yes    | yes          | yes         | yes    | yes                    | no                 | no    |
| See who has and hasn't read it              | yes    | yes          | no          | no     | no                     | no                 | no    |
| Remind                                      | yes    | yes          | no          | no     | no                     | no                 | no    |
| Require, change, stop, ask again            | yes    | if an Editor | no          | no     | no                     | no                 | no    |

- Who has read what is private to Editors and the page's owner (the card's risk): every other reader sees counts
  and their own state, and the api never sends them names or ids.
- Confirming is a person's: a guest and an agent's token are refused (`reading_needs_account`, 403), and someone not
  asked (`not_asked`, 409). Requiring and asking again need an Editor in person (`forbidden`, 403); a token never
  does. Remind needs an Editor or the page's owner, in person.
- Every gate is enforced in the api with a test per role.

## Bounds (decided)

At most 200 Required Reading pages a knowledgebase (`reading_pages_full`, 409); at most 200 chosen people a page
(`too_many_people`, 400); at most 30 confirmations or changes a minute a person (`reading_too_fast`, 429); a page's
lists name at most 500 people.

## Telemetry

`UI·Used`, typed `RequiredReadingSet`, `RequiredReadingStopped`, `ReadConfirmed`, `ReadingReminded`,
`ReadingAskedAgain`; the reminder's sends count as the `ReadingReminder` email kind.

## Offline

A knowledgebase kept Offline has no room and nobody else reads it: Required Reading is not offered.
