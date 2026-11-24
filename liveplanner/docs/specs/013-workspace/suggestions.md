# Suggestions: Write It Up

The liveplanner side of [Suggestions](../../../../liveworkspace/docs/specs/016-notifications/suggestions.md) (Work Tracker 1371): one suggestion, offered in the editor's notice slot under
the platform's rules (one at a time, never mid-gesture, once an item, Don't Suggest This Again, one switch in Settings ›
Getting Started).

A card done with a decision in it, or a milestone reached, is worth a knowledgebase page; liveplanner offers to write
it up.

## Trigger

Only a card **this person** moves to a done column in this session wakes it (`lib/write-up-trigger.ts`,
`noteStatusWrite` on the plan's own writes, at most `WATCH_MAX` (20) noted). It is offered when that card is done and:

- its description holds a decision: a word "decided", "decision", "agreed", "chose", "chosen", "resolved" or
  "settled", or the words "going with", "go with", "we will" or "opted for", read by a tokenizer; or
- it is a **Milestone** card (card type `milestone`): reaching it is the milestone.

"Ship the new pricing is done with a decision in it. Write it up as a page in <knowledgebase>, so the team can find
it."

## One click

**Write Page** writes a page through the index's [Write It Up](../../../../liveworkspace/docs/specs/004-index/write-up.md)
door, in the plan's default knowledgebase (connected, else the team's newest, else the person's own), titled by the
card, its body the card's description and a line back to the card (no share code). A toast says where, with **Open
Page**. No knowledgebase the person can edit: no suggestion.

## Who

An Editor of the plan, signed in, not in an embed, Offline or a Community copy (`maySuggestTo`). Never a Participant or
a Viewer.

## Code

`components/plan/WriteUpSuggestion.tsx`, mounted in the editor; telemetry `UI·*·SuggestWriteUp`.
