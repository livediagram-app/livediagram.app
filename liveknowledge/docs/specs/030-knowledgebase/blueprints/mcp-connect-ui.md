# Connect UI blueprint

Derived from [Connect](../mcp-connect.md). The fourth view, on the frame and the tabs the
[Ask UI blueprint](ask-ui.md) "The views" describes, over the overview read the
[Insights UI blueprint](insights-ui.md) describes. Paths are under `apps/editor/`.

| Piece                                   | File                                                          |
| --------------------------------------- | ------------------------------------------------------------- |
| the view, its gates and its layout      | `components/connect/ConnectView.tsx`                          |
| a numbered step's card                  | `components/connect/ConnectStep.tsx`                          |
| 1, Pick Your AI App                     | `components/connect/AppPicker.tsx`                            |
| 2, the app's own steps                  | `components/connect/AppSteps.tsx`                             |
| 3, Approve and Choose Access            | `components/connect/AccessStep.tsx`                           |
| 4, Check It Worked                      | `components/connect/StatusStep.tsx`                           |
| Already Connected, Other Ways In        | `components/connect/ConnectAside.tsx`                         |
| the signed-out words (view and gate)    | `components/connect/ConnectSignedOut.tsx`                     |
| the checks                              | `components/connect/useConnectStatus.ts`                      |
| the apps, the kept choice               | `lib/knowledge-connect/connect-apps.ts`                       |
| the status rule, the timings, the words | `lib/knowledge-connect/connect-status.ts`, `connect-words.ts` |

## The tab

- `KnowledgeView` gains `'connect'` (`knowledgeViewOf` reads `?view=connect`), last in `KNOWLEDGE_VIEWS`: label and
  short "Connect", `ConnectViewIcon` (Lucide `plug`, vendored into `@liveworkspace/icons`). The hover card's title
  is the tab's `hoverTitle`, "Connect an AI App".
- `trackView('connect')` is `track('UI', 'Opened', 'ConnectView')`.
- **Signed out:** a press opens the shared gate (`askGate`, `components/ask/AskGate.tsx`) at `'connect-signed-out'`,
  whose dialog draws `ConnectSignedOut bare`. No read is made: `rights.askOff` says it.
- **Offline:** `offlineOff` already turns off every view but Pages; `OFFLINE_VIEW_WHY` names Connect.
- `KnowledgeViewHost` loads `ConnectView` with `next/dynamic` (`ssr: false`), as the other two, and names its
  region "Connect".

## The view

- `ConnectView` reads `useAskSession()`. Offline: one `EmptyState` (plug icon, "No Connections to an Offline
  Knowledgebase"). Signed out: `ConnectSignedOut` in the view. Otherwise the layout: a scroll column, `max-w-6xl`,
  a grid `lg:grid-cols-[minmax(0,1fr)_20rem]`: the four steps in the first column, the aside in the second (after
  the steps below `lg`).
- **The MCP address** is `mcpEndpoint(MCP_ORIGIN)` (`lib/mcp-config.ts`), so a build with `NEXT_PUBLIC_MCP_ORIGIN`
  (staging, local) shows its own.
- **`ConnectStep`**: an `INSIGHTS_CARD` `section` named by its heading, a brand circle with the step's number (hidden from
  a screen reader: the `ol` it sits in counts), the heading, one line and the body.
- **The apps** (`connectApps(mcpUrl)`): `aiClients({ name: 'liveknowledge', mcpUrl })` from
  `@liveworkspace/marketing-site/lib/ai-clients` (pure data, no imports), narrowed to `claude`, `claude-code`,
  `chatgpt`, `cursor`, `vscode`, `other`, in that order, the last named "Other App". `CONNECT_APP_KEY`
  (`liveknowledge:connect-app`) keeps the pick in `localStorage`, read and written in `try`; an unknown or missing
  value is Claude.
- **`AppPicker`** is a `radiogroup` named "AI App" of `role="radio"` buttons (`aria-checked`), roving `tabIndex`,
  the arrow keys, Home and End moving and picking. Three across from `sm`, two on a phone. Each 44 px at least.
  The icon is its group's Lucide glyph (chat, code, window, link), never a logo, and is left out on a phone so the
  name and its two-line blurb fit.
- **`AppSteps`** draws the app's `steps` as an `ol`: `StepText` for the sentence, an action as a `buttonClassName`
  link (`target="_blank"` for an external one, with "(opens in a new tab)" for a screen reader), and `CodeSnippet`
  for the code, both from `@liveworkspace/marketing-site/components/ai`. Its copy calls `onCopied`, which is
  `track('UI', 'Copied', 'McpSetup')`. The app's `note` closes it. The editor's CSS sources
  `packages/marketing-site/src/components/ai` so their classes are generated.
- **`AccessStep`**: the consent line, then the three rows of `accessRows(role)` (`connect-words.ts`), each an icon,
  its name, what it means and a chip of what this person's connection gets: `editor` (`rights.grantAgents`),
  `participant` (`rights.makePages`) or `viewer`. An Editor gets **Open Connected Agents**
  (`showKnowledgeView('insights')`); then `reachLine(name)`.
- **`StatusStep`**: the status of `useConnectStatus`, then the prompt (`firstPrompt(name)`) in a `CodeSnippet`
  labelled "Prompt", whose copy is `track('UI', 'Copied', 'ConnectPrompt')`.
  - `loading`: "Checking…", a `role="status"`.
  - `waiting`: a pulsing dot (`motion-safe:animate-pulse`), "Waiting for Your App", its line, "Checking every 10
    seconds." and **Check Now**.
  - `stopped`: "Stopped Checking", "Nothing arrived in 5 minutes." and **Check Again**.
  - `connected`: an emerald check, "Connected: <name>", `lastSeenText` and `readsText` (`overview-words.ts`), and
    **Manage in Insights**.
  - `failed`: a `Callout` "Could Not Check" with **Try Again**.
    The status line is a polite live region, so the flip is announced.
- **`ConnectAside`**: Already Connected is the latest agents, at most `ASIDE_AGENTS` (5), each a row with
  `agentDoor`'s icon and words and `agentScopeChips`; **Manage in Insights** under them; none is a
  `CompactEmptyState`. Other Ways In: a `CodeSnippet` of the three commands and **Open API Tokens**
  (`openSettingsOn('tokens')`).
- **Insights' Connect an Agent** (the header's button and Connected Agents') is
  `showKnowledgeView('connect')` after its `track('UI', 'Opened', 'ConnectAgent')`. `ConnectAgentDialog` is gone.

## The checks

`useConnectStatus(who, documentId, enabled)` reads `apiKnowledgeOverview` and keeps only `agents`.

- `CHECK_EVERY_MS` 10,000 and `CHECK_FOR_MS` 300,000 (`connect-status.ts`). A read on opening, then a
  `setTimeout` chain: each turn reads unless `document.visibilityState` is `hidden` (the turn is skipped, not
  queued), until the window's end, then `stopped`. A `visibilitychange` back to visible inside the window reads at
  once. So at most 1 + 30 reads in a window, none hidden.
- The first good read is the **baseline** (`agentMarks`: id to reads this week and last seen). `newConnection`
  answers the first agent of a later read that is not in it, or whose reads or last seen rose; then `connected`,
  and the chain ends.
- **Check Now** and **Check Again** read at once and start a new 5-minute window; the baseline stays.
- A read that fails: `failed`, the chain ends; Try Again is Check Now. An unmount aborts the read in flight and
  clears the timer.
- **Measured**: see "Cost" below.

## Cost

`GET .../knowledge` is the one read Insights makes, 13 queries against the room's own SQLite in one
`Promise.all`. Measured on the local stack (wrangler dev, 2026-11-21, a knowledgebase of 13 pages and 1 agent, 16
reads through the router from the view): median 51 ms, slowest 62 ms, 493 bytes of body. Bounded by the window: 31
reads at most per 5 minutes per open view (about 15 KB), none while hidden, none once connected.

## Tests

`lib/knowledge-connect/connect-status.test.ts` (the baseline, a new agent, one reading again, none),
`connect-apps.test.ts` (the six apps, their order, the address in every step, the kept pick),
`connect-words.test.ts` (the rows per role, the prompt), `components/connect/useConnectStatus.test.ts` (the window:
31 reads at most, none hidden, stop on connected, Check Now restarts, a failure stops),
`components/connect/ConnectView.test.tsx` (every app's steps, copy and its telemetry, the roles, signed out,
Offline, the aside), and the tabs' and the host's tests for the fourth view.
