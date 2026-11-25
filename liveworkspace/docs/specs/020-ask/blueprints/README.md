# Ask AI blueprint

Implements [ask.md](../ask.md).

## Files

`packages/ask` (`@liveworkspace/ask`):

| File                          | Holds                                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------ |
| `src/limits.ts`               | every bound, with its value                                                                      |
| `src/passages.ts`             | `AskPassage`, `contentWords`, `choosePassages` (the editor), `readPassages` (the server)         |
| `src/request.ts`              | `askSystem`, `askRequest`, `readTurns`                                                           |
| `src/answer.ts`               | `askAnswerStream`, `parseAskAnswer`: the reply's reader, shared with liveknowledge's Ask         |
| `src/answer-parts.ts`         | `answerParts`, `answerWithoutMarkers`, `markedParts`, shared with liveknowledge's Ask            |
| `src/events.ts`               | `readEvents`: a server-sent-events body, shared with liveknowledge's Ask                         |
| `src/wire.ts`                 | `AskRequestBody`, `AskEvent`, `AskSource`, the refusal codes                                     |
| `src/server/serve-ask.ts`     | `serveAsk(door)`: the whole route                                                                |
| `src/server/daily-count.ts`   | `spendAskIn` (the room's side), `spendAsk` (the worker's side), `askCountName`                   |
| `src/server/ask-credits.ts`   | `askCreditsOf` (the app's door, null with Pro off), `askPayer`, `chargeAsk`                      |
| `src/ui/AskCreditsNotice.tsx` | a question the month's AI credits refused: the kit's `LimitNotice` with Ask Again                |
| `src/ui/ask-tools-item.tsx`   | `useAskToolsItem(host)`: the Tools row, the tool behind `lazy` (`@liveworkspace/ask/tools-item`) |
| `src/ui/AskTool.tsx`          | the tool: thread, field, Sources                                                                 |
| `src/ui/AskComposer.tsx`      | the question box: field, count, AI pill slot, New Chat, Send and Stop; no app's words or context |
| `src/ui/AnswerWith.tsx`       | the AI pill and its menu (`builtIn: false` drops the built-in row; `builtInDetail` its words)    |
| `src/ui/composer.ts`          | `@liveworkspace/ask/composer`: the box, the pill and `askAiView`, for liveknowledge's Ask        |
| `src/ui/AskSources.tsx`       | the Sources popover's content                                                                    |
| `src/ui/conversation.ts`      | `AskConversation`, one per item (`conversationOf`), the six most recent kept                     |
| `src/ui/tab-passages.ts`      | `tabPassages(tabs, options)`: the walk every editor shares                                       |
| `src/ui/ask-client.ts`        | `askSender(accountId)`: the POST and its stream, through the workbench's api binding             |
| `src/ui/ask-ai-choice.ts`     | the person's choice, in `localStorage`                                                           |
| `src/ui/answer-lite.ts`       | the light Markdown a finished answer is drawn from                                               |

Sending an answer on (ask.md "Sending an answer on") is the workbench's, so liveknowledge's Ask uses the same row:
`components/send-to-plan/AnswerSendActions.tsx` (the two buttons, shown only while the host lets this session send),
`components/send-to-plan/answer-items.ts` (`answerItems`, the list items read left to right, a CPU-time test on a
huge input), Send to Plan's `sendFromHere('text', 'answer', …)` with no tab or element, and Send to Knowledge Base's
`sendWordsToKnowledge`. `AskTool` hands the row the answer without its markers and the question.

## Constants

| Constant                                              | Value   |
| ----------------------------------------------------- | ------- |
| `ASK_MAX_QUESTION_CHARS`                              | 1000    |
| `ASK_MAX_PASSAGES`                                    | 200     |
| `ASK_MAX_PASSAGE_CHARS`                               | 24,000  |
| `ASK_MAX_ONE_PASSAGE_CHARS`                           | 2000    |
| `ASK_MAX_LABEL_CHARS`                                 | 200     |
| `ASK_MAX_ID_CHARS`                                    | 200     |
| `ASK_MAX_TURNS`                                       | 10      |
| `ASK_MAX_TURN_ANSWER_CHARS`                           | 8000    |
| `ASK_MAX_BODY_CHARS`                                  | 262,144 |
| `ASK_BUILT_IN_PER_PERSON_PER_DAY`                     | 30      |
| `ASK_OWNER_CREDITS_BY_OTHERS_PER_DAY`                 | 20      |
| `AI_CREDIT_COSTS.ask` (`@liveworkspace/subscription`) | 1       |
| `ASK_MAX_TOKENS`                                      | 8000    |
| `ASK_MAX_RANK_WORDS`                                  | 24      |

## Each app's door

- **The route**: `case 'ask'` in the api's `index.ts`, calling `routes/ask.ts`, which hands `serveAsk` the request,
  `ctx.verifiedUserId` (null for an API token's or a workbench's caller is not needed: both are accounts and run on
  built-in AI, since `personAiKey` answers null for them), the app's item word, `personAiKey(accountCredentials(env),
ctx, teamId)`, `env.AI`, `spendAsk(env.<ROOM>, …)`, the app's CORS headers and `askCreditsOf({ env, app, rooms,
teams: ctx.teams, grant })`, whose `grant` is the app's own `resolve…Grant(ctx, itemId)`. With Pro off it answers
  null, and the route reads no grant and asks no subscription service.
- **The count**: the room class has `spendAsk(day, cap)`, answering `spendAskIn(this.state.storage, day, cap)`. The
  by-others count of AI credits uses the same method on the instance `~ask-ai-others:<item>`.
- **The row**: the editor's `ChromeControls` adds `useAskToolsItem(host)` to Tools' items, after Search. The host
  comes from the editor (`useAskHost`), which loads every tab before it reads the passages.
- **Styles**: the editor's `globals.css` has `@source` for `packages/ask/src`.

## Tests

- `packages/ask`: the pure part, the route and the tool's logic at 100% lines and branches (`vitest.config.ts`); the
  route against stand-in providers and a planted key that must appear in no answer, event or log line; the tool's
  views for what they do (ask, stream, stop, sources lit, Answer With, signed out).
- Each app: its route's door (signed out refused, a question answered on built-in AI, the count spent), and that the
  Tools row loads none of the tool on first load. AI credits: with Pro off no grant is read and the subscription
  service is not asked; with Pro on an Editor and a Participant spend the owner's credit, a Viewer their own, and a
  used month refuses before the model is called.
