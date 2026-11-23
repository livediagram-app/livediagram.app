# Automations

Status: being built (local branch `automations-everywhere`, owner's direction 2026-11-20)

## What

**Automations** are rules an item runs on its own: _when_ something happens, _if_ some conditions hold, _then_ do
these steps. Every app has them: a plan, a livediagram document, a livedocuments document, a design and a Space.
liveplanner had them first ([its spec](../../../../liveplanner/docs/specs/026-plan/automations.md)); this spec is what
every app shares, and each app's own spec lists the triggers, conditions, actions and templates only it has.

Automations replace **Webhooks** as a tool of their own. Nobody had set one up (production held none, 2026-11-20),
and a rule says everything a webhook's event checkboxes did, with conditions and its own words. What is left of a
webhook is a **connection**: an address a rule's step sends through ([Connections](#connections)).

There is **no platform service** for Automations: no Worker, no shared database. Rules live and run inside each
item's own Durable Object, beside its content. What the apps share is code: one engine package, one builder package,
and the index's connections.

## Naming

| Term            | Means                                                                              | Never             |
| --------------- | ---------------------------------------------------------------------------------- | ----------------- |
| **rule**        | One automation: a name, on or off, a trigger, conditions and steps                 | recipe, workflow  |
| **trigger**     | What starts a rule                                                                 | event (in copy)   |
| **condition**   | A check that must hold for the steps to run; every condition must hold             | filter (in copy)  |
| **step**        | An action, an If / Else, a Wait, an AI step or a message through a connection      | node, task        |
| **run**         | One rule answering one trigger: Done, No Match, Skipped, Failed or Waiting         | execution         |
| **Audit Trail** | The item's list of recent runs, newest first                                       | log, history      |
| **value**       | A placeholder in a rule's text (`{{tab.name}}`), filled in when the rule runs      | variable          |
| **connection**  | An address messages go to: a Slack or Teams channel, or the team's own service     | webhook (in copy) |
| **subject**     | What a run is about: a card in a plan, a tab elsewhere, or nothing (the item only) | target            |
| **Automation**  | Who a rule's changes are by, with the rule's name beside it                        | bot, system       |
| **author**      | The person who last saved a rule: its steps in other apps act with their rights    | owner (of a rule) |
| **grant**       | The short-lived pass the index signs for the author on one target item             | token, key        |
| **chain**       | The runs one change set off across apps, with its hops                             | cascade           |
| **target**      | The plan, knowledgebase, Space or document a step in another app acts on           | destination       |

In copy the tool is **Automations**, a rule is a **rule**, and the item is called what its app calls it (plan,
document, design, Space, knowledgebase).

**A tab is called what its app calls it too.** liveknowledge's interface never says "tab": a knowledgebase holds
**pages** (owner, 2026-11-21: "the interface never says tab"). Every shared trigger, condition, step, value and line
of the screen that names a tab reads "page" there ("Page Added", "Any Page", "Add a Page from a Template", "Page
Name"), from the item's word alone (`knowledgebase`), and every other app keeps "tab". The words change, never the
rule: the JSON a rule is saved as, and the `tab` field an agent writes, are the same in every app.

## Where rules live and run

- **In the item's own Durable Object SQLite**: its rules, the triggers waiting to run, each time rule's next moment,
  runs held by a Wait, Incoming Webhook secrets (their hash) and the Audit Trail. No table holds an item id: each
  item's storage is its own. Rules go with the item: a copy copies them (turned off, as liveplanner's), the item's
  export file carries them, deleting the item deletes them.
- **On the room's alarm, never in a person's request.** A write that a rule hears queues its trigger in the same
  transaction as the write; the room's one alarm runs what waits. A time rule wakes the room by itself, with nobody
  in the item. A room with no rule that is on arms nothing for Automations and costs nothing.
- **An item in the Trash or archived runs nothing**, as liveplanner's put-away plans: its triggers are not queued,
  its time rules do not wake it, and an Incoming Webhook call is answered `202 {queued: 0}`.
- **An item kept Offline has no Automations**: it has no Durable Object. The tool offers **Sync** first, as every
  online tool does.

## Who may do what

Share roles as every app applies them.

| Who                                                                                     | Automations                                                                          |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| An **Editor** of the whole item, signed in: its owner, its team, a whole-item edit link | Everything: rules, Run Rule, Test Rule, the Audit Trail, Templates, Connections      |
| An Editor through a link **confined to one tab**                                        | Nothing (403 `automations_need_editor`)                                              |
| A **Participant** or a **Viewer**                                                       | What a rule did (by "Automation · <rule>" wherever its change shows), and a rule's   |
|                                                                                         | summary: its name and what it does, never an address or a connection                 |
| A **guest** (not signed in), an Editor link's included                                  | The tool opens to **Sign In**: a rule sends email and messages in a person's name    |
| An **API token** of an Editor (agents, MCP, CLI)                                        | Lists, adds, changes, tests and runs rules; never makes or reads an Incoming Webhook |
|                                                                                         | secret, never picks a connection, never saves a rule holding **Revert to Snapshot**  |

- **A token never picks a connection.** A token's add, change or duplicate of a rule whose message step names a
  connection it did not already name is refused (403 `automation_connection_needs_a_person`): a token may keep the
  connections a rule already has, unchanged, or drop them. Duplicating a rule that names a connection is a person's,
  as the copy would pick it anew.

What a rule does, it does as **Automation**, with the rights of an Editor of the whole item, whoever started it: a
Viewer's comment can start a rule that takes a snapshot.

## A rule

A name (1 to 60 characters, unique in the item, any case), on or off, one trigger, up to 10 conditions, up to 20
steps, the saver's time zone, and whether its changes may start other rules. An item holds up to **50** rules.

### Triggers every app has

| Trigger                | Starts when                                                                              | Picks                                       |
| ---------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------- |
| **Scheduled**          | a time comes round: every day, every weekday, weekly on chosen days, or monthly on a day | the days and the time (on the quarter hour) |
| **Run by Hand**        | an Editor picks **Run Rule** on the rule                                                 | none                                        |
| **Incoming Webhook**   | another tool sends the rule's own address a signed JSON call                             | none (the call's fields are values)         |
| **Tab Added**          | a tab is added to the item                                                               | none                                        |
| **Tab Removed**        | a tab is removed                                                                         | none                                        |
| **Edited, Then Quiet** | the item's content changed and then nothing changed for a while (5 minutes to 24 hours)  | how long; a tab (optional)                  |
| **Not Edited For**     | nothing in the item has changed for a number of days (1 to 365), checked daily at a time | the days and the time                       |
| **Snapshot Taken**     | someone takes a snapshot by hand                                                         | none                                        |
| **Someone Joined**     | a person opens the item through a share link for the first time                          | none                                        |
| **Access Requested**   | someone asks for access to the item                                                      | none                                        |

- **Edited, Then Quiet** is the trigger for "tell me when this changed": it fires once after a burst of edits
  settles, never per keystroke, and not again until a later edit. A rule's own changes are never edits, even when
  the rule lets its changes start other rules ([below](#runs-limits-and-loops)).
- **Scheduled** reads its time as a clock ("at 9:00", "at 17:30"), and its two named times as words: "at
  Midnight" for 0:00 and "at Noon" for 12:00.
- **Not Edited For** fires once each time the item goes that long untouched, not daily while it stays untouched.
- **Incoming Webhook** calls prove the rule's secret one of two ways ([the call](#an-incoming-webhook-call)).
- **Scheduled**, **Not Edited For** and **Incoming Webhook** have nobody of the item behind them: Who Did It reads
  nothing, and the builder leaves it out.
- liveplanner keeps its own time triggers (Due In, Overdue, Card Stuck) and does not offer Tab Added, Tab Removed,
  Edited, Then Quiet, Not Edited For, Someone Joined or Access Requested yet: its rules are about cards.

Apps with comment threads (livediagram, livedocuments, livedesign; liveplanner has its own on cards) add:

| Trigger                  | Starts when                               | Picks            |
| ------------------------ | ----------------------------------------- | ---------------- |
| **Comment Added**        | someone starts a thread or replies on one | a tab (optional) |
| **Thread Resolved**      | a thread is resolved                      | a tab (optional) |
| **All Threads Resolved** | the last open thread on a tab is resolved | a tab (optional) |
| **Action Assigned**      | an action gets a new assignee             | none             |
| **Action Done**          | an action is turned done                  | none             |

A rule's own comments start no rule.

### An Incoming Webhook call

A call is a JSON `POST` (at most 16 KB) to the rule's own address, proving it holds the rule's secret by a header,
never in the address:

- `Authorization: Bearer lwh_…`, or
- a signature: `X-Liveworkspace-Timestamp: <unix seconds>` and `X-Liveworkspace-Signature: sha256=<hex>`, the
  HMAC-SHA256 of `<timestamp>.<body>` (the timestamp, a full stop, then the exact bytes sent), keyed with the
  secret. liveplanner reads the signature from `X-Liveplanner-Signature`, the header it shipped with; its timestamp
  header is the same. The timestamp and the signature name are the outgoing deliveries' own
  ([webhooks.md](../004-index/webhooks.md)).

A signed call is refused when its timestamp is more than **5 minutes** off the room's clock, either way, or when the
same signature was already taken by that rule in the last **10 minutes** (a replay; a call answered 400, 429 or
`202 {queued: 0}` for an item put away is not taken, so the same call may be sent again). Every refusal before the proof (no
signature, a wrong one, a stale or missing timestamp, a replay, a wrong or old secret, a rule off, deleted, of another
trigger or never given a secret) is the same **401** `webhook_unauthorized`, after the same work, so a caller learns
nothing of what exists. The item remembers the signatures it took for 10 minutes, at most 600 a rule (the rule's 60 a
minute), and nothing else of a call.

### Conditions every app has

| Condition       | Holds when                                                                                    |
| --------------- | --------------------------------------------------------------------------------------------- |
| **Tab**         | the run's tab is (or is not) one of the chosen tabs                                           |
| **Who Did It**  | whoever started the rule is (or is not) a chosen person, an Editor, a Participant or an agent |
| **Day of Week** | today, in the rule's time zone, is one of the chosen days                                     |
| **Text**        | a value (the comment, a webhook field) contains, or does not contain, some text; any case     |

### Steps every app has

| Step                        | Does                                                                                                        |
| --------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Take Snapshot**           | takes a snapshot of the whole item, named by the rule (values allowed)                                      |
| **Revert to Snapshot**      | puts the whole item back to a chosen snapshot, for everyone ([below](#revert-to-snapshot))                  |
| **Send Email**              | emails the item's owner, whoever started the rule, a chosen person, or typed-in addresses                   |
|                             | (one that could not be sent to is named on the step's line and the rest still go; none sent fails the step) |
| **Post to Slack**           | posts the message through one of the item's Slack connections                                               |
| **Post to Microsoft Teams** | the same, as a card in a Teams channel                                                                      |
| **Send to Webhook**         | sends a signed JSON event to one of the item's own-service connections                                      |
| **Summarise with AI**       | reads the item's text (or one tab's) and keeps a summary as `{{summary}}` for the steps after               |
| **Wait**                    | holds the rest of the rule for 1 hour to 30 days                                                            |
| **If / Else**               | runs one list of actions when its conditions hold, another when they do not                                 |

- liveplanner's card rules have their own set of steps (its card actions, For Related Cards, its AI steps): of the
  steps above it has Send Email, the three messages, Wait, If / Else, **Take Snapshot** and **Revert to Snapshot**
  (the shared definitions, panels and runners, at the rule's top level, run after the card's writes; liveplanner's
  automations.md "Snapshot steps"). **Summarise with AI** is not in liveplanner yet (its Summarise Card summarises one
  card), so its Add Action offers none and its templates name none.

A failed step stops the run; the steps before it stay done. Ten failed runs in a row turn the rule off ("Paused"),
with the reason on the rule and **Resume** beside it.

### Revert to Snapshot

The step names one of the item's [snapshots](../014-snapshots/snapshots.md). It is what "put the workshop back every
night" needs, so:

- **A snapshot a rule names is kept.** It does not count toward the latest five and is never removed to make room,
  while any rule (on or off) names it. History marks it **Kept by a Rule** and offers no Delete; deleting the rule,
  or picking another snapshot, lets it go back among the five. At most **5** snapshots are kept this way in an item
  (409 `automation_snapshots_full`).
- **The revert is the ordinary one**: the safety snapshot first (never skipped), the content replaced, every open
  editor reloaded. The safety snapshots are ordinary ones and fall off the five as ever.
- **It is the last step.** Nothing follows a revert in the same rule: the content it would act on is gone. The
  builder offers it only at the end, never inside an If / Else with steps after it.
- **A rule that reverts starts no rule**, whatever its chain setting, and its revert is not an edit.
- **Only a person saves it.** An API token's save of a rule holding this step is refused (403
  `automation_needs_a_person`), as snapshots refuse tokens.
- A snapshot that is gone when the rule runs fails the run ("The snapshot is gone"), and the rule's row says so.

### Values

Text in a step may hold values, filled in when the rule runs, picked with **Insert a Value**:

| Value                                     | Reads                                                       |
| ----------------------------------------- | ----------------------------------------------------------- |
| `{{item.name}}`                           | the item's name                                             |
| `{{item.url}}`                            | a link that opens the item                                  |
| `{{tab.name}}`                            | the run's tab, when the trigger is about one                |
| `{{tab.url}}`                             | a link that opens that tab                                  |
| `{{person}}`                              | Who Did It                                                  |
| `{{comment}}`                             | a comment trigger's text, its opening 500 characters        |
| `{{rule}}`                                | the rule's name                                             |
| `{{now}}`, `{{now.date}}`, `{{now ± Nd}}` | the moment, the day, a day shifted, in the rule's time zone |
| `{{webhook.<path>}}`                      | a field of an Incoming Webhook call's body, by its dot path |
| `{{summary}}`                             | the text a **Summarise with AI** step before this one made  |

The chip names follow the app: `{{item.name}}` shows as **Plan Name**, **Document Name**, **Design Name** or **Space
Name**. An unknown value is refused on save (`automation_value_unknown`). Each app adds its own
(`{{card.title}}`, `{{poll.question}}`, `{{room.name}}`).

## Runs, limits and loops

As liveplanner's, the same numbers everywhere:

| Limit                                       | Value                                                          |
| ------------------------------------------- | -------------------------------------------------------------- |
| Rules per item                              | 50                                                             |
| Conditions, steps per rule                  | 10, 20                                                         |
| Runs per item a day (UTC; No Match is free) | 1,000 (past it, one Skipped line a rule a day says so)         |
| Triggers waiting                            | 500 (a burst past it is dropped, said once on the Audit Trail) |
| Rules one change may chain through          | 5                                                              |
| Failures in a row before a rule pauses      | 10                                                             |
| Failed wakes in a row before they give up   | 12 (tried again after 1, 2, 4 … minutes, an hour at most)      |
| Audit Trail                                 | 2,000 runs and 500 No Matches, 30 days                         |
| Messages through connections per rule       | 5                                                              |
| AI asks per item a day                      | 100                                                            |
| Emails to typed-in addresses per item a day | 50                                                             |
| Waits per rule; runs held waiting           | 3; 500                                                         |
| Incoming Webhook: body, calls per rule      | 16 KB; 60 a minute                                             |
| Kept snapshots (named by rules)             | 5                                                              |

- A run's id is a hash of its trigger and its rule, claimed before anything is done, so a retry never runs a rule
  twice for one trigger.
- A rule never hears its own change. A rule's change starts other rules only when the rule says so (**Let this
  rule's changes start other rules**, off by default), five rules deep at most.
- **A rule's own changes are never edits**, whatever its chain setting: **Edited, Then Quiet** and **Not Edited
  For** never hear them, so a rule that edits on a quiet stretch never wakes itself, or another such rule, in a loop.
  Its other changes (a tab added, a snapshot taken) start rules as the chain setting says.
- Past the day's 1,000, nothing runs and the Audit Trail says so once a rule a day ("Daily limit reached: rules run
  again tomorrow", Skipped), never once per trigger.
- A missed time (the room could not wake) runs late when it is under 24 hours late, once; older is skipped and said
  on the Audit Trail.
- **A wake that keeps failing backs off, then gives up.** When the item's wake fails as a whole (not one run: a
  bug, or stored data it cannot read), it tries again after 1 minute, then 2, 4, 8 … minutes, an hour at most. The
  count and the next try are kept in the item's own storage, so a restart neither counts afresh nor tries at once,
  and nothing runs before the next try. A wake that does its work clears the count. The **12th failure in a row
  gives up**: the triggers waiting are dropped, runs a Wait held whose time is up and settles that came due are let
  go (a held run is **Skipped** with the same reason), each time rule moves on to its next moment, and one Skipped
  line on the Audit Trail says "Automations stopped after repeated errors; they start again on the next change". The
  rules stay on: the next change or the next time moment starts afresh, with the count at nothing.

## Test Rule and Run Rule

- **Test Rule** runs the rule now and changes nothing: it shows each condition and step as it would go ("Would post
  to Launch Channel", "Would revert to “Clean board”"). Where the trigger is about a tab it asks which.
- **Run Rule** runs a **Run by Hand** rule for real, from the rule's row and its menu. liveplanner also offers it on
  a card. Past the day's runs it is refused (429 `automation_budget_spent`, `Retry-After` until UTC midnight); a run
  the room could not start or record is 500 `automation_run_failed`, and Run Rule may be tried again.

## AI

- **Summarise with AI** (above) and **Describe a Rule**: type what you want ("every Friday at 5, snapshot this and
  email me") and the builder opens on a drafted rule, nothing saved until **Save Rule**. The model sees the item's
  tab names and the app's trigger and step kinds, never its content, people or connections.
- Workers AI, the same model and timeouts as liveplanner's, through the app's own `AI` binding. Without the binding
  both answer "AI isn't set up here" and nothing else changes.
- Summarise sends the item's text views (outline; pages and articles as Markdown), cut to the model's window, and
  nothing else. Its answer is text only: links it invents are dropped, as liveplanner's.
- liveplanner keeps its three card AI steps (Summarise Card, Suggest Card Type, Triage).
- **Which AI** ([ai-keys.md "In the apps"](../003-accounts/ai-keys.md#in-the-apps)). Describe a Rule runs on the
  person's own key, or the item's team's, when one applies (a signed-in person in person; an API token gets built-in
  AI), else on built-in AI. On a key it counts toward neither the item's AI asks a day nor its drafts a day. A rule's
  AI steps always run on built-in AI: a run has no person's request behind it, so no key is fetched for it, even
  for Run Rule. Describe a Rule's dialog and each AI step's panel show the source line (`AiSource`); an AI step's
  reads "Built-in AI" with "Rules run on built-in AI, with this item's daily AI steps" and no action.

## Connections

A **connection** is what a webhook was, less its events: a name, a kind (**Slack**, **Microsoft Teams**, **Your Own
Service**), an address and, for your own service, a signing secret shown once. It belongs to one item. It sends only
what a rule's step tells it to.

- **Managed inside Automations**: a **Connections** tab after Rules, Audit Trail and Templates lists them (Send
  Test, Pause or Resume, Delete, Recent Deliveries) with **Add Connection** at its foot; a message step's panel
  picks one by name and offers **Add a Connection…**. There is no Webhooks row in Tools, no Webhooks item in the
  Explorer's ⋯ menu and no Webhooks dialog.
- **No event subscriptions.** "What Should It Send?" and "Who Did It" (Anyone, Only Me) are gone, with every event
  a webhook could hear by itself (`renamed`, `moved`, `trashed`, `shared`, `commented`, `action_assigned`,
  `action_done`, `card_moved`, `form_response`). The two left are `automation` (a rule's message) and `ping` (Send
  Test).
- **Everything else is as it was**, built once in the index ([webhooks.md](../004-index/webhooks.md)): the address
  rules (HTTPS, public, no redirects), sealing at rest, signing, retries with backoff, pausing, Recent Deliveries,
  10 per item, and the access rule (a signed-in Editor of the whole item).
- **Every app's rules send through them.** The index takes a rule's sends from any app
  (`POST /app/items/:id/automation-sends`), each naming its rule, its message and, when the run has one, its
  subject (a card or a tab: a reference, a title and a link).

## What each app adds

Each app's spec holds its own tables; in short:

| App           | Triggers of its own                                 | Steps of its own                                                             |
| ------------- | --------------------------------------------------- | ---------------------------------------------------------------------------- |
| liveplanner   | its card, form, email, time and GitHub triggers     | its card actions, For Related Cards, its AI steps (no Summarise with AI yet) |
| livediagram   | Poll Ended, Question Asked, Agent Made Changes      | Add a Tab from a Template                                                    |
| livedocuments | Version Named, Version Restored, Agent Made Changes | Name This Version, Restore a Version, Add a Tab from a Template              |
| livedesign    | Component Changed, Agent Made Changes               | Add a Tab from a Template                                                    |
| livehuddle    | Someone Arrived, Everyone Left, Suggestion Dropped  | Clear the Suggestion Box, Add a Tab from a Template                          |

Each app also ships its own **Templates** (ready-made rules, opened in the builder to finish and save) and the
pictures on its trigger and step tiles.

## Steps in other apps

A rule's steps above act on its own item, yet the rules people want cross apps: a card Done writes the release note
into the knowledgebase, a session that ended is summarised into a page, a page due for review becomes a card for its
Owner. Every app's rule builder offers the same five steps that act **elsewhere**, run by the platform **as the
rule's author** ([blueprint](blueprints/cross-app.md)):

| Step                                | Kind           | Does                                                                     | Needs on the target |
| ----------------------------------- | -------------- | ------------------------------------------------------------------------ | ------------------- |
| **Create a Card in a Plan**         | `plan_card`    | a card on a chosen board, in a chosen column: title, description, an     | Editor              |
|                                     |                | assignee, due N days after it fires, linked back to the item that fired; |                     |
|                                     |                | optionally skipped while an open card already links to that item         |                     |
| **Write a Page in a Knowledgebase** | `kb_page`      | a page under a chosen parent: title and body (Markdown, values allowed), | Editor              |
|                                     |                | Never Verified, its Owner the author, **Written by Automation**          |                     |
| **Post in a Space**                 | `space_post`   | a note on a chosen tab of a livehuddle Space, signed by the rule         | Editor              |
| **Add a Tab to a Document**         | `doc_tab`      | a tab from a chosen template in a livedocuments or livediagram document  | Editor              |
| **Notify**                          | `inbox_notice` | an Inbox notice to chosen people of the item, in every app               | (the item's people) |

- **The same JSON in every app.** A step names its target as `{ "app", "item", "title" }` (the title as picked, for
  the sentence; the item is read again on every run) and its own fields; the values are the source app's
  (`{{card.title}}` in a plan, `{{tab.name}}` in a document, `{{summary}}` after a Summarise with AI step). In the
  builder every text box takes them as chips (**Insert a Field**, grouped From the Card or From the Page and From
  Earlier Steps, each with a sample value), with a **live preview** filled from sample values.
- **Picked with the Connect picker**: Recent across apps, filtered to the step's kind, and Shared with Me. A view-only
  item shows disabled with a lock and **View Only**; then a plan asks a board and a column, a knowledgebase a parent
  page, a document a template, a Space a tab. "Only places you can edit can be picked."; the item itself never is.
- **Grouped in Add a Step**: the item's own steps, **In Other Apps** (marked New), AI, Send Out. The footer says
  "Every step acts as you, and only on items you can edit." A step's card in the builder shows its target app's icon
  and colour under the eyebrow "Then · <app>".
- **livehuddle has no chat**: Post in a Space posts a note on a tab (the design's Notes). Chat comes with a Space's
  chat, which is not built.

### Who a step acts as

- **The rule's author**: the signed-in person who last saved it (its `edited.by`). An agent's save is its person's.
  A step acts with **exactly their rights, no more**: never the item owner's, never a privileged path. The rule's
  side panel says so: **Runs As** (the author, "Each step acts with their rights, no more") and **Reaches** (each
  target, with Can Edit).
- **Through the target app's own door, with a short-lived grant.** The source item's room asks the index
  (`POST /app/items/:id/automation-steps`, with the app's key). The index checks the author's access to the target as
  it checks anyone's (owner, team, share link, the Trash), signs a **grant** for the author at that level (the
  ordinary ES256 item grant, ten minutes), and calls the target app's internal door with it. The target app checks
  the grant itself (audience, item, subject, level, tab) before it writes, and writes as the person, marked
  Automation with the rule's name.
- **Lost access stops the rule.** When the author can no longer edit a target (left the team, the link revoked, the
  item gone, in the Trash or archived), the step fails with "Stopped: no access to <target>", the run is Failed and
  the rule **pauses at once** with that reason. Its banner offers **Take Over Rule**: anyone who can edit the item
  may take it over, and saving it makes them the author.
- **A guest never authors one**: Automations already ask for a signed-in Editor.

### Loops across apps

A step elsewhere may start a rule there, which may act back. Every run carries a **chain**: an id, its hops across
apps so far, and each rule that ran in it (`<app>:<item>:<rule>`).

- **One chain never fires the same rule twice.** A step whose chain already holds its own rule is not sent:
  "Skipped: would loop back to this rule" (the run is Skipped, the rule is not paused).
- **A chain stops after 3 hops across apps**: the fourth is refused the same way ("Stopped after 3 hops across
  apps"). The Audit Trail says "One chain may not fire the same rule twice, and stops after 3 hops across apps."
- The target's write carries the chain into the events it queues, so a rule there passes it on. A write by a step
  elsewhere is never an edit (as a rule's own), so Edited, Then Quiet and Not Edited For never hear it.
- The two caps below bound anything a chain could miss.

### Limits

| Limit                                                       | Value | Past it                                 |
| ----------------------------------------------------------- | ----- | --------------------------------------- |
| Runs of one rule with a step in other apps a day (UTC)      | 100   | the step is skipped and the run Skipped |
| Steps in other apps one author's rules run a day, every app | 500   | the same, counted at the index          |
| Hops across apps in one chain                               | 3     | Skipped                                 |
| Steps in other apps per rule                                | 5     | refused on save (`automation_invalid`)  |
| People one Notify reaches                                   | 10    | refused on save                         |

- **AI steps follow the shared key and credit rules**: a Summarise with AI step before a Write a Page is one of the
  item's AI asks a day (100), on the item's own key where it has one. At the cap **only the AI steps wait until
  tomorrow**: the rest of the rule runs (`{{summary}}` reads empty) and the run is Skipped.
- The side panel's **Limits** shows the rule's runs today against 100, and the account's against 500.

### Where it shows

- **On the target**: the author's change, marked Automation with the rule's name and its item. A knowledgebase page
  says "Written by the rule <rule> in <item>. Never verified." with **Mark Verified**. A card links back to the item
  that fired, in its description.
- **On the Audit Trail** of the source item: Done ("Created a card in Release Plan"), Stopped: no access, Skipped:
  would loop back to this rule, and the limit lines above.

### Starters

| App           | Starter                                         | Does                                                                  |
| ------------- | ----------------------------------------------- | --------------------------------------------------------------------- |
| liveplanner   | **Card Done, Write Release Note**               | Card Moved to Done, then Write a Page from the card's title and notes |
| liveknowledge | **Review Due, Add a Card for the Owner**        | Review Due, then Create a Card in a Plan assigned to the Page Owner   |
| livediagram   | **Session Ended, Summarise into Knowledgebase** | Edited, Then Quiet, Summarise with AI, Write a Page (WI-1347)         |
| livehuddle    | **Meeting Ended, Send Actions to Plan**         | Everyone Left, Summarise with AI, Create a Card in a Plan             |

livediagram has no Everyone Left of its own (Spaces left it, Work Tracker 650): a session that ended is the board
going quiet, Edited, Then Quiet after 30 minutes.

### Telemetry

Under the app's item category, action `Ran`: `CrossAppDone`, `CrossAppNoAccess`, `CrossAppLoop`, `CrossAppCapped`
and `CrossAppFailed`. Never a name, an id or a text. Take Over Rule sends `Toggled` `AutomationTakenOver` from the
screen. The telemetry dashboard charts both on liveplanner, whose run emits are scanned; the item apps' room runs (their
`AutomationDone` and the rest included) are not yet scanned, so they have no chart there.

## Agents

Each app with an MCP server and a CLI (all but livehuddle) has `list_rules` and `change_rules` tools and a `rule`
verb, as liveplanner: list rules and recent runs, add, change, turn on and off, duplicate, delete, test and run. A
rule's body is the same JSON the builder saves; the tool's description spells out that app's kinds. livediagram,
livedocuments and livedesign share one set, built once over the item engine's routes
([blueprint](blueprints/item-engine.md#agents)); liveplanner keeps its card rules' own.

- **`list_rules`** (read) `{ <item>Id, rule?, runs?, limit? }`: every rule in order, each with its id, name, on or
  off, why it paused, what it needs (`needsAttention`: a tab, a person or a version that is gone, or still to pick),
  its trigger's kind, its sentence as the Rules list reads it, last run, runs this week, a time trigger's next run
  and an Incoming Webhook rule's address with whether its secret is made (never the secret). Beside them the item's
  tabs (id and name) and people (by name), and the day's runs and limit. `rule` (an id or exact name) adds that rule
  whole, in the body `change_rules` writes; `runs: true` the Audit Trail, newest first, that rule's alone when
  `rule` is given, each run with its tab, result, reason and step lines, 20 by default and at most 50.
- **`change_rules`** (destructive, as it deletes) `{ <item>Id, changes }`: up to 20 changes in order, each seeing
  the ones before it: `add {rule}`, `set {rule, name?, trigger?, conditions?, steps?, chain?, timeZone?}` (each
  part given replaces the saved one), `on`, `off`, `duplicate` and `delete {rule}`, `test {rule, tab?}` (Test Rule:
  a saved rule or a whole body, nothing changed or logged) and `run {rule, tab?}` (Run Rule). A rule is named by
  its id or exact name; a tab and a person in a body, and `tab`, by id or name. An added rule names no time zone:
  UTC. A body read back from `list_rules` writes back (its id, on and stamps are ignored). Every rule a token saves
  is stamped as an agent's.
- **`rule`** in the CLI: `ls`, `get`, `add` and `set` (a JSON file, or stdin), `on`, `off`, `rm`, `duplicate`,
  `test` and `run` (`--tab`), and `log` (`--rule`, `--limit`), over the same run. `guide rules` says how.
- **Refusals**, each in words with the next call to make, and what was applied before it: a token whose person is
  not an Editor of the whole item (`automations_need_editor`), a read-only token on any change, test or run
  (`read_only_token`), a rule holding Revert to Snapshot (`automation_needs_a_person`), a rule that does not read
  (`automation_invalid`, `automation_value_unknown`, `automation_condition_unsupported`,
  `automation_step_unsupported`, with the engine's path and reason), a name taken, 50 rules, more snapshots than
  rules keep, a rule gone, Run Rule on a rule that is not Run by Hand and on, the day's runs spent, a tab gone; and,
  before any call, a rule or a tab it cannot name (`rule_unknown`, `tab_unknown`, with those there are). An
  Incoming Webhook's secret is never made or read through a token, and a connection is added in the editor.

## Built once

- `@liveworkspace/automations` (packages/automations): the rule shapes, the checks, values, the schedule maths, the
  tables, the store, the queue, the Audit Trail, Waits, Incoming Webhook secrets, sends, AI asks, the run loop for
  an item's rules and the routes. An app hands it a **kit**: its triggers, conditions, steps and values, and how to
  read and change its content.
- `@liveworkspace/automations-ui` (packages/automations-ui): the screen (Rules, Templates, Audit Trail,
  Connections), the builder, the pickers, Insert a Value, Describe a Rule, Test Rule. An app hands it the same
  kinds as panels, pictures and words.
- liveplanner's card rules keep their own run loop (cards, branches, derived triggers) on the shared store, tables,
  Audit Trail, Waits, secrets, sends and screen.

## Telemetry

As liveplanner's scheme, under the app's item category (`Plan` in liveplanner, `Document` in the other four): the screen
opened, a rule made, toggled, deleted, tested or run by hand, a template opened, a draft asked for; and from the
room, one batch a wake: each run's result and trigger kind, pauses, a full queue, missed times, a failed wake
(`AutomationWakeFailed`) and one that gave up (`AutomationWakeGaveUp`), Incoming Webhook answers and AI asks. Never a name, an id, a message or an address.

## Not in scope

- A step acting on another design (livedesign is a source of steps in other apps, never a target yet): later.
- A list of rules across items.
- Exporting a tab as a PNG or PDF from a rule: those exports run only in a browser today.
- livehuddle agent tools: it has no MCP server or CLI.
