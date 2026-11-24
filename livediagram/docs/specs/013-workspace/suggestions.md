# Suggestions: Make These a Plan

The livediagram side of [Suggestions](../../../../liveworkspace/docs/specs/016-notifications/suggestions.md) (Work Tracker 1371): one suggestion, offered in the editor's notice slot under
the platform's rules (one at a time, never mid-gesture, once an item, Don't Suggest This Again, one switch in Settings ›
Getting Started).

A retro or a brainstorm ends with actions on stickies; livediagram offers to make them a plan.

## Trigger

Checked on the open tab when idle (`lib/action-stickies.ts`, `actionStickies`): the stickies with words that are
**actions**, either

- an open [assigned action](../012-collaboration/assigned-actions.md) (assigned, not done), or
- inside an **Actions lane**: the smallest container (a frame, a lane, a box) that holds a heading reading "Actions",
  "Action Items", "Next Steps", "To Do" or "Todo" (case and a trailing colon aside), the sticky's centre in it.

At least 3 (`ACTION_STICKIES_MIN`) make the suggestion: "4 action stickies here could be cards in a liveplanner plan,
one each." A retro or brainstorm template is not remembered on a tab, so the actions are what it reads.

## One click

**Send to Plan** opens [Send to Plan](./send-to-plan.md)'s picker on exactly those stickies, one card each, as the
selection's entry does (`sendElements`). The person picks the plan.

## Who

An Editor of the diagram, signed in, not in an embed, Offline or a Community copy (`maySuggestTo`), whose session may
send (`canSendHere`). Never a Participant or a Viewer.

## Code

`components/canvas/MakePlanSuggestion.tsx`, mounted in the editor; telemetry `UI·*·SuggestMakePlan`.
