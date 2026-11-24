# Suggestions

## What

A **suggestion** offers to carry what someone is working on into another app, at the moment it would help, in one
click (Work Tracker 1371). People mostly find one app and never learn that another would help with the very thing in
front of them; they cross over most easily with their content in hand. A suggestion is triggered by something concrete
in the item, says what it would do in a line, and does it when taken: the retro's actions become plan cards, the
decision becomes a knowledgebase page.

A suggestion is a floating [callout](./callouts.md) in the editor's notice slot, the place the paste notice takes: bottom
centre, just above the dock or where a dock would sit. It is not a toast (nothing just happened), not a banner and not a
new surface.

## The suggestions

Each app's spec says its trigger in full (`<app>/docs/specs/013-workspace/suggestions.md`); in short:

| Suggestion                          | App           | Trigger                                                                                                 | One click (its button)                                                                               |
| ----------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Make These a Plan**               | livediagram   | 3 or more stickies with words on the tab are actions: an open assigned action, or in an Actions lane    | **Send to Plan**: [Send to Plan](../004-index/send-to-plan.md)'s picker on every one of them         |
| **Write It Up**                     | liveplanner   | A card the person moves to a done column has a decision in its description, or a Milestone card is done | **Write Page**: a page in the team's knowledgebase, the card's title and description and a line back |
| **Add to Knowledgebase**            | livedocuments | The article on show explains a process (numbered steps, Step headings, or a How To title with steps)    | **Add Page**: a page in the team's knowledgebase, the article as Markdown and a line back            |
| **Bring In Your Diagrams and Docs** | liveknowledge | A new knowledgebase: nothing connected yet and at most 3 pages                                          | **Connect Them**: connects the person's 3 most recent diagrams and 3 most recent documents, for Ask  |
| **Send to a Plan**                  | livehuddle    | The person's call in the Space ends and the tab they met on has stickies with words                     | **Send to Plan**: Send to Plan's picker on every sticky on that tab                                  |

**Left out: a livedesign brand board offering to style decks.** There is no brand kit decks can use (livedocuments
retired custom themes), so there is nothing one click could do. It comes when a deck can take a brand.

## Rules

- **One at a time.** At most one suggestion shows on a page, and none while the notice slot holds something else (a
  paste notice).
- **Never mid-gesture.** None appears while the person types (a field or the canvas text has the focus, or a key went
  down in the last 1.5 s), holds a pointer down (a drag, a draw, a resize), or in the 1.5 s after either. One already
  showing stays; it covers nothing the person is working on.
- **Once an item.** A suggestion dismissed or taken for an item never comes back for that item. Its × dismisses it for
  this item; **Don't Suggest This Again** turns that suggestion off for every item.
- **One switch for all.** Settings › Getting Started › Suggestions › **Suggest Other Apps**, on by default, shared by
  every app (the `all` scope, `suggestNextApp`), livedesign's Settings too though it suggests nothing yet. Off, no app
  suggests anything; on again, the ones turned off one by one stay off.
- **Only what the person can do.** A suggestion shows to an **Editor** of the item, signed in to an account, in a session
  that may do its action: never to a Participant, a Viewer, a guest, an embed, Offline or a Community copy
  (`maySuggestTo`). Its action's own checks still run (the plan's Edit, the knowledgebase's Edit).
- **Cheap.** Nothing runs on a keystroke, a drag or a save. The trigger is checked when the page is idle, at most every
  5 s while the item is open and visible, and stops once the suggestion was shown, taken or dismissed for the item. A
  check reads what the editor already holds (no request) and costs under a millisecond on a 2,000 element tab.
- **Deterministic.** A trigger is a plain rule over the item's words and shape, read by a left-to-right tokenizer; never
  AI and never a request, so the same item suggests the same thing every time.

## What it looks like

An info callout, floating, medium:

- **Title**: what it would do ("Make These a Plan").
- **Line**: why now, with the count where there is one ("4 action stickies here could be cards in a liveplanner plan,
  one each.").
- **Action**: the one click ("Send to Plan", "Write Page", "Add Page", "Connect Them").
- **Don't Suggest This Again**: a quiet text button under the line.
- **×**: dismisses it for this item.

It fades in (none under reduced motion), never takes the focus and is announced politely (`role="status"`); Escape
inside it dismisses it. At most 400 px wide; on a phone it spans the width less 16 px a side.

## What taking one does

- Sends and pickers are the existing features' (Send to Plan's picker opens on the places; the person still picks the
  plan), so nothing is made without the person seeing where it goes.
- A write-up goes through the index's **write-up** door ([Write It Up](../004-index/write-up.md)): the default knowledgebase is one connected to the item, else
  the newest of the item's team, or for an item of the person's own their newest, always one they can edit; none means
  the suggestion is not shown. The page is written as the
  person, never verified, and ends "From <title> (<app>): <link>". A toast says "Written up in <knowledgebase>" with
  **Open Page**; a refusal says why.
- Connecting goes through Connect File, one connection per item, at View.

## Telemetry

Each suggestion counts, under its app's name, in the UI category, typed by the suggestion and never by the item or its
words: `UI·Opened·<Type>` (shown), `UI·Used·<Type>` (taken), `UI·Closed·<Type>` (dismissed, either way). The types are
`SuggestMakePlan`, `SuggestWriteUp`, `SuggestAddToKnowledgebase`, `SuggestBringIn` and `SuggestSendToPlan`. The switch
sends `UI·Toggled·SuggestionsOn` and `UI·Toggled·SuggestionsOff`. Each app's telemetry page charts its suggestion as a
stack (shown, taken, dismissed), so a weak one can be cut.

## Out of scope

- AI-picked suggestions, and suggestions by email or in the Inbox.
- Suggestions on the Explorer, the site or Settings.
- A suggestion's history across devices: what was dismissed is kept in this browser.
