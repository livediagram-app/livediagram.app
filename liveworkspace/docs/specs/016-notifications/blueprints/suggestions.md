# Suggestions blueprint

Derived from [Suggestions](../suggestions.md).

## Files

| File                                                                  | Holds                                                                                      |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `packages/workbench/src/components/suggest/suggestions.ts`            | `SuggestionId`, `SUGGESTIONS` (title, action, telemetry type), the constants               |
| `packages/workbench/src/components/suggest/useSuggestion.ts`          | The rules: idle checks, one at a time, the gesture and slot waits, take, dismiss, turn off |
| `packages/workbench/src/components/suggest/NextAppSuggestion.tsx`     | The hook and its stacked `ToastCard` in the toast stack (`SuggestionCallout`)              |
| `packages/workbench/src/components/suggest/suggest-activity.ts`       | `watchActivity`, `busyNow`: keys, pointers, the wheel and focused text                     |
| `packages/workbench/src/components/suggest/suggest-memory.ts`         | `maySuggest`, `decideSuggestion`, `turnOffSuggestion` over local storage                   |
| `packages/workbench/src/components/suggest/suggest-gate.ts`           | `maySuggestTo`: the role and session gate                                                  |
| `packages/workbench/src/components/suggest/write-up.ts`               | `writeUpTarget` (one read per item), `writeUpToKnowledgebase` (the page and its toast)     |
| `packages/ui/src/toast/notice-slot.ts`                                | The slot's holders: `holdNoticeSlot`, `noticeSlotHeld`, `onNoticeSlot`; the stack's row    |
| `packages/ui/src/toast/ToastNotice.tsx`                               | A notice drawn in the toast stack; `hold` false for a suggestion                           |
| `livediagram/apps/editor/lib/action-stickies.ts`                      | Make These a Plan's trigger                                                                |
| `liveplanner/apps/editor/lib/write-up-trigger.ts`                     | Write It Up's watch and trigger                                                            |
| `livedocuments/apps/editor/lib/process-article.ts`                    | Add to Knowledgebase's trigger                                                             |
| `liveknowledge/apps/editor/components/insights/BringInSuggestion.tsx` | Bring In Your Diagrams and Docs, trigger and action                                        |
| `livehuddle/apps/editor/components/calls/SendToPlanSuggestion.tsx`    | Send to a Plan, trigger and action                                                         |
| `liveworkspace/apps/site/app/telemetry/_shared/suggestion-metrics.ts` | Each suggestion's stack and sentences, the switch's sentences                              |

Each app's host component (`MakePlanSuggestion`, `WriteUpSuggestion`, `AddToKnowledgebaseSuggestion`,
`BringInSuggestion`, `SendToPlanSuggestion`) is mounted beside the editor's Send to Plan host, with
`allowed={maySuggestTo({...})}` built from the editor's `can.level`, read-only flag and session.

## Interface

```ts
type SuggestionFind = { line: string; run: () => void | Promise<unknown> };
type SuggestionCheck = () => SuggestionFind | null | Promise<SuggestionFind | null>;
<NextAppSuggestion id itemId allowed check wake? />
```

- `check` reads the editor's state from a ref (never a render's props) and is cheap until it finds something; only then
  may it return a promise (Write It Up's and Add to Knowledgebase's target read, Bring In's recent items).
- `wake` changes ask for a check `SUGGEST_IDLE_MS` later (a card noted done, a call ended).

## Behaviour and state

1. Nothing runs while `allowed` is false, `itemId` is null, or the suggestion is decided for the item.
2. A tick, `SUGGEST_IDLE_MS` after mount or `wake` and every `SUGGEST_CHECK_MS` after, returns at once when: a check
   is running, this one shows, another suggestion shows (the module's `showing`), the page is hidden, the notice slot
   is held, `busyNow()`, or the switch is off. When memory says it is decided, it stops.
3. A find shows when still free and not busy: `showing = id`, `UI·Opened·<type>` once.
4. Take: `UI·Used·<type>`, decided for the item, hidden, `run()` (its failure is the action's own toast). Dismiss (× or
   Escape): `UI·Closed·<type>`, decided. Don't Suggest This Again: `UI·Closed·<type>`, turned off, decided.
5. `allowed` turning false while shown hides it undecided; unmounting frees `showing`.

## Data and persistence

- Local storage `liveworkspace:suggestions`: `{off: SuggestionId[], decided: string[]}` (`<id>:<itemId>`, newest first,
  at most `SUGGEST_DECIDED_MAX` (300)). Malformed or blocked storage reads as empty and writes nothing.
- The switch is the shared preference `suggestNextApp` (`ALL_SETTING_KEYS`), a row in each app's Settings › Getting
  Started under the **Suggestions** section (`SECTION_ORDER`, after Show Me), event `UI·Toggled·SuggestionsOn|Off`.

## Security and trust

- No new data leaves the browser except through the existing doors (Send to Plan, Connect File, the index's write-up),
  each checking the person's own access. A link a page ends with is the item's own address, never a share code.
- Telemetry types are the suggestion's, never the item's words.

## Performance and limits

| Constant              | Value | Why                                                     |
| --------------------- | ----- | ------------------------------------------------------- |
| `SUGGEST_IDLE_MS`     | 1,500 | Quiet after a key or press before anything may appear   |
| `SUGGEST_CHECK_MS`    | 5,000 | A check at most this often, only while open and visible |
| `SUGGEST_DECIDED_MAX` | 300   | Decisions kept in this browser                          |
| `ACTION_STICKIES_MIN` | 3     | Make These a Plan                                       |
| `WATCH_MAX`           | 20    | Write It Up's noted cards                               |
| `PROCESS_STEPS_MIN`   | 3     | Add to Knowledgebase                                    |
| `NEW_KB_PAGES_MAX`    | 3     | Bring In's new knowledgebase                            |
| `BRING_IN_PER_APP`    | 3     | Bring In's items per app                                |

- The activity listeners store a number per event (10,000 keydowns under the `cpuBudgetMs(400)` jsdom budget, the
  dispatch itself the cost). No pointermove is heard.
- Triggers are linear and measured: 2,000 stickies under 5 ms a check, a 5,000 block article under 20 ms, a 90,000
  character description under 20 ms (each a CPU-time budget test). liveplanner's write path adds one O(1) note.
- Network: at most one target read per item a page load, one recent-items read a page load, only after a match.

## Accessibility

- `role="status"`, `aria-live="polite"`; focus never moves. The action, Don't Suggest This Again and the × are buttons in
  the tab order with the shared focus ring and touch targets. Escape inside dismisses.

## Testing

| What                                                                     | Where                                                                              |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Memory, activity, the slot's holders, the gate                           | `packages/workbench/src/components/suggest/suggest-parts.test.ts`                  |
| The rules end to end (shown once, take, dismiss, off, waits, switch)     | `packages/workbench/src/components/suggest/NextAppSuggestion.test.tsx`             |
| The write-up helper                                                      | `packages/workbench/src/components/suggest/write-up.test.ts`                       |
| Each trigger, with its budget                                            | each app's trigger test (`action-stickies`, `write-up-trigger`, `process-article`) |
| Each suggestion by role (Editor offered; Participant, Viewer, guest not) | each app's host component test                                                     |
| Charts for every event                                                   | each app's `metric-emitters.test.ts` on the site                                   |
