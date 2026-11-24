# Suggestions: Bring In Your Diagrams and Docs

The liveknowledge side of [Suggestions](../../../../liveworkspace/docs/specs/016-notifications/suggestions.md) (Work Tracker 1371): one suggestion, offered in the editor's notice slot under
the platform's rules (one at a time, never mid-gesture, once an item, Don't Suggest This Again, one switch in Settings ›
Getting Started).

A new knowledgebase is empty; Ask answers better with the team's diagrams and documents connected, so liveknowledge
offers to bring them in.

## Trigger

A **new** knowledgebase: no connected items yet and at most 3 pages (`NEW_KB_PAGES_MAX`), and the person has a recent
diagram or document (`listItems`, recent, 3 of each, read only once the first two hold).

"Connect your 3 latest diagrams and 2 latest documents, so Ask answers from them too."

## One click

**Connect Them** connects each through [Connect File](../../../../liveworkspace/docs/specs/004-index/connected-tabs.md), at View, one way (`both: false`), and a toast
says how many. Nothing is copied.

## Who

An Editor of the knowledgebase who may change its tree, signed in, not in an embed, Offline, a Community copy or a
workbench frame (`maySuggestTo` and the tree's own check). Never a Participant or a Viewer.

## Code

`components/insights/BringInSuggestion.tsx`, mounted in the editor; telemetry `UI·*·SuggestBringIn`.
