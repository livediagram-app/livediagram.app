# Suggestions: Send to a Plan

> **Gone from livehuddle** (owner, 2026-11-27: [The Write category](../002-project-scope/not-in-livehuddle.md#the-write-category)): stickies left a Space, and Send to Plan's "call ended with stickies" suggestion went with them. livehuddle offers no suggestion and sends no `UI·*·SuggestSendToPlan`; what follows is a record.

The livehuddle side of [Suggestions](../../../../liveworkspace/docs/specs/016-notifications/suggestions.md) (Work Tracker 1371): one suggestion, offered in the editor's notice slot under
the platform's rules (one at a time, never mid-gesture, once an item, Don't Suggest This Again, one switch in Settings ›
Getting Started).

A meeting in a Space ends with actions on the wall; livehuddle offers to send them to a plan.

## Trigger

The person's own call in the Space goes from live to ended (leaving the room, Avatar mode or the tab: the call-self
store's phase), and the tab they were on when it was live has stickies with words.

"The call ended with 4 stickies on the wall. Send them to a liveplanner plan, one card each."

## One click

**Send to Plan** opens [Send to Plan](./send-to-plan.md)'s picker on every sticky on that tab (`sendAllStickies`), one
card each. The person picks the plan.

## Who

An Editor of the Space, signed in, not in an embed, Offline or a Community copy (`maySuggestTo`), whose session may send.
Never a Participant or a Viewer.

## Code

`SendToPlanSuggestion` in `components/calls/`, mounted in the editor (deleted with it); telemetry `UI·*·SuggestSendToPlan`.
