# Reactions on a Page

Owner, 2026-11-21: "I want people including viewers to be able to react to a page like clap, etc any emoji really.
They should appear to the left of the edit button or in that place left of zen for viewers, no notifications sent to
author please when reacting, its just a nice way to show appreciation or other emotions."

Status: **built** ([blueprint](blueprints/page-reactions.md)). Details marked "(decided)" were decided by the builder
and stand until the owner overturns them.

A reaction is the lightest response a page can get: a clap for a page that saved someone an hour, a heart, eyes for "I
have seen this". It says nothing a comment would say, asks nothing of the author and is never part of the page.
[Comments on a page](page-comments.md) stay the place for words.

## What a reaction is

- A reaction is **one person's emoji on one page**: any emoji, one of each per person, taken back by pressing it
  again. A person may put several different emoji on a page.
- **Any emoji:** a single emoji character as the platform draws it (a face, a hand with its skin tone, a flag, a
  keycap, a family). Text, two emoji at once, or anything else is refused (`invalid_emoji`, 400).
- **Quick picks** come first: Clap 👏, Heart ❤️, Thumbs Up 👍, Party 🎉 and Eyes 👀. The full emoji picker (the page
  icon's list, with its search) offers every other.
- **Bounds** (decided): a page holds at most 500 reactions and 20 different emoji (`reactions_full`, 409); a person
  puts at most 10 different emoji on one page (`too_many_reactions`, 409); a person makes at most 30 reaction changes
  a minute in a knowledgebase (`reacting_too_fast`, 429).
- **Who reacted** is shown by name: a person's profile name, or the name on their cursor when the account has no
  profile name to give. Every reaction is public to whoever reads the page.
- **Stored** in the knowledgebase's Durable Object, its own table `page_reactions` (one row a person a page an emoji,
  schema step after the automation wake step), never in the page's body and never in D1. A reaction is not an edit:
  it moves no revision, no Updated stamp, no version, no History entry and no Most Used day, so previews, Recent and
  the page tree never reorder on a clap. A deleted page takes its reactions with it; a closed account's reactions
  are removed.

## Where they show

- **Beside Edit, or beside Zen:** for an Editor and a Participant the capsule stands **left of Edit**, in the page's
  floating corner (the bottom right of the document's white area, where Edit floats while reading,
  [Reading and editing a page](editing.md#read-mode-the-default)). A Viewer, who has no Edit, has it **left of Zen**
  in the corner cluster at the bottom right, where Edit would otherwise stand beside it.
- **One quiet capsule** (decided), white like Cancel and the same 40 px height as Edit (44 px on a phone): a segment
  a used emoji, its emoji and count, in the order they were first used (so a press never moves a segment from under
  the pointer; decided); then the **Add
  Reaction** smile-plus at the end. Yours are tinted in the accent with an accent ring and `aria-pressed`; pressing
  one adds yours, pressing your own again takes it back.
- **Hovering a segment** (a long press on touch, focus from the keyboard) names who reacted: "👏 Clap" and "You, Priya
  and Sam reacted", up to eight names then "and 4 others".
- **Overflow:** a desktop shows up to five emoji, a phone or a window under 640 px up to two; the rest fold into a
  **+N** segment that opens the picker, whose top lists every emoji on the page.
- **The picker** (Add Reaction or +N): a popover over the corner on a desktop, a sheet on a phone. Its top lists
  **On This Page** (every emoji used, as the capsule's segments) when there are any, then the **Quick Picks** row, then
  the search field and every emoji, Recent first (the page icon picker's own grid). A pick toggles yours and closes it.
- **Nothing to show:** a page nobody has reacted to shows only the smile-plus, for whoever may react. Someone who may
  not react (a guest, see below) sees the capsule only when there are reactions, and cannot press them.
- **Hidden** while editing (the draft bar stands there), in Zen Mode, in Version History, in an embed, on Ask and AI
  Knowledge, and on a knowledgebase kept Offline.
- Light and dark, phone and desktop; every control has a tooltip or a hover card and the pointer cursor; reduced
  motion drops the pop.

## No notifications

Reacting tells nobody: no email, no inbox entry, no notification, no activity row, no automation trigger, no History
entry and no outbox message, for the author or anyone else. It is told only to the people on the page, live.

## Live

Each change is written by the api and told to the room as one `page-reaction` op (the emoji, who, and whether it was
added or taken back), from the system: everyone on the page sees the count change at once. Reactions are read once
when a page first opens in a session (`GET .../pages/<tab>/reactions`) and kept; the room's ops keep them current. A
press here shows at once and is put back, with a toast in words, if the api refuses it.

## Share roles

| Action                        | Editor | Participant | Viewer | Signed-in link visitor | Guest (no account) | Agent |
| ----------------------------- | ------ | ----------- | ------ | ---------------------- | ------------------ | ----- |
| See reactions and who reacted | yes    | yes         | yes    | yes                    | yes                | yes   |
| Add or take back one's own    | yes    | yes         | yes    | yes                    | no                 | no    |
| Take back someone else's      | no     | no          | no     | no                     | no                 | no    |

Reacting is every signed-in reader's, Viewers and visitors through a view link included: it is the one write a
Viewer makes on a page, and it reaches nothing else (the api's reaction route alone). A guest with no account and an
agent's token are refused (`reaction_needs_account`, 403; decided, against drive-by spam). Every gate is enforced in
the api with a test per role; the editor offers Add Reaction only where the api will take it.

## Agents

Agents do not read or write reactions (decided): they are people's appreciation, not knowledge.

## Performance

One `GET` a page a session, after the page has drawn; the capsule reads its own store slice, so a reaction never
renders the page's writing, and typing renders no reaction. A change sends one op of one reaction. The picker's emoji
list is its own chunk, fetched when the picker first opens.
