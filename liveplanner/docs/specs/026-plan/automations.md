# Automations

**Automations** let a plan act on its own cards: a **rule** watches for something happening to a card (a **trigger**),
checks the card (its **conditions**) and then does the routine steps people would otherwise do by hand (its
**actions**): move it, assign it, label it, comment on it, tell someone. It is the planner's take on Jira's project
automation, sized to one plan. The engineering detail is [blueprints/automations.md](blueprints/automations.md).

This spec covers **Phase 1** (Work Item #711: card triggers and actions, the Automations screen and its footer
button) and **Phase 2** (#712: the Scheduled, Due In and Overdue triggers, For Related Cards, Assign in Turn, the
Send to Webhook, Post to Slack and Post to Teams actions, and the Templates gallery). Phase 3 (#713) adds the
**Incoming Webhook** trigger (below, built), AI actions and the agent and CLI rule tools, each specified here as it
is built. The
design for every phase is the LivePlanner Automations canvas (the owner's design artifact): Phase 1 follows its
screens 1, 2, 3, 4, 5 and 7; Phase 2 adds screen 6 (Empty State and Templates), the Overdue Nudge and paused Slack
rows of screen 2, and **+ For Related Cards** on screen 3.

## Why

Most of a board's busywork is the same small step after the same event: a card reaches Done and someone stamps the
date and unassigns it; a bug comes in and someone labels it and hands it to whoever is on triage; a form response
lands and someone sets its priority from the answer. Each step is quick, easy to forget and never the point of the
work. A rule does it every time, at once, and says that it did.

## Domain language

| Term            | Means                                                                                       | Never called              |
| --------------- | ------------------------------------------------------------------------------------------- | ------------------------- |
| **rule**        | One automation: a name, on or off, a trigger, conditions and steps                          | automation (one), recipe  |
| **trigger**     | What starts a rule: something that happened to one card, a person running it from the card, | event (in copy), hook     |
|                 | or a time (a schedule, a due date coming or passed)                                         |                           |
| **branch**      | A step that runs its own actions on each of the card's related cards (For Related Cards)    | loop, for-each (in copy)  |
| **template**    | A ready-made rule from the Templates gallery, opened in the builder to finish and save      | recipe, preset            |
| **condition**   | A check on the card or on who made the change; every condition must hold                    | filter (in copy), guard   |
| **step**        | An action, or an If / Else holding actions                                                  | node                      |
| **action**      | One change or message a rule makes                                                          | task, job                 |
| **run**         | One rule answering one trigger: matched (its actions ran), no match, skipped or failed      | execution                 |
| **Audit Trail** | The plan's list of recent runs, newest first                                                | audit log, history (here) |
| **value**       | A placeholder in a rule's text (`{{card.title}}`), filled in when the rule runs             | smart value, variable     |
| **Automation**  | Who a rule's changes are by, on cards, comments and history, with the rule's name beside it | bot, system               |

## Who may do what

- **Editors** (the owner, the plan's team, anyone with a whole-plan Editor link) see the footer's **Automations**
  button, open the Automations screen, and add, change, turn on and off, test, run and delete rules, whoever made
  them. The api refuses everyone else with 403 `automations_need_editor`; a tab-scoped Editor link is refused too,
  since a rule acts on the whole plan.
- **Participants** and **Viewers** see no button and no Run Rule. Their changes still **trigger** rules: a
  Participant who moves a card to Done gets the Done rule's stamp like anyone.
- A rule's actions are **Editor writes made by Automation**: a Participant's move can start a rule that sets a field
  only an Editor may set, because an Editor wrote that rule. That is the point of a rule, and only Editors write them.
- **Run Rule** (a manual trigger) is an Editor's, from the card's ⋯ menu.
- **Outgoing actions** (Send to Webhook, Post to Slack, Post to Teams) name one of the plan's
  [webhooks](../../../../liveworkspace/docs/specs/004-index/webhooks.md), so only someone who can list them (a
  signed-in Editor of the whole plan) can pick one. The webhook must exist first, made in the plan's **Webhooks**
  dialog; a rule never holds an address. An Editor through a share link can already make a webhook of the plan, so
  a rule that posts to one shows them nothing new.
- A plan in **Browser Storage** has no Automations: rules run on the plan's server-side alarm (as [Repeating
  cards](items.md#repeating-cards)), even while nobody has the plan open, and a Browser Storage plan has none. Its
  footer still shows **Automations** to whoever can edit it, and it opens the same gate the Share dialog does for a
  plan in This Browser: titled **Automations**, saying **Rules Run on Our Servers**, "Rules, schedules and due-date
  reminders run even when nobody has this plan open, so they need it saved to your account.", with **Sync Plan**
  (Share's own sync, in place, with no reload), **Cancel** and the help link (How Rules Work). Once synced, the same
  opening goes on to the Automations screen, as Share goes on to sharing. Sync to cloud carries no rules: an offline
  plan holds none.
- A **guest** (no account) who can edit a plan on the server sees the button too, but rules are an account's work
  (the api's gate needs a signed-in Editor and answers a guest `automations_need_editor`), so it opens the same gate
  asking them to sign in, under a person glyph (This Browser's gate keeps its cloud-off): **Rules Run on Our
  Servers**, "Rules act for an Editor of this plan, even when nobody has it
  open, so they need you signed in. You come back here with Automations open.", with **Sign In** (back to this page,
  `?automations=1` opening the screen) and **Cancel**. After signing in the screen opens on the
  rules. **Only an Editor Can See Rules** is for a signed-in reader the api refuses, never a guest. Run Rule waits for
  sign-in too.
- An **Incoming Webhook** rule's secret is an Editor's of the whole plan, signed in, to make, see once and
  regenerate ([Incoming Webhook](#incoming-webhook)); whoever holds it can start that one rule and nothing else, and
  its runs are Automation's, an Editor's writes as any rule's.
- An **API token**, the MCP server and the CLI read and write no rules in Phase 1 (403 `automations_need_editor`):
  agent tools for rules are Phase 3. Their card writes do trigger rules.

## A rule

- **Name**: 1 to 60 characters, unique in the plan (case-insensitive). New rules start as "New Rule", then "New
  Rule 2" and on.
- **On or off**. A new rule starts **off** until its first save with a trigger and at least one action, which turns
  it on. Off, it never runs and never appears under Run Rule.
- **Trigger**: exactly one (below).
- **Conditions**: up to 10, all of which must hold (no OR at the top level; If / Else covers the rest).
- **Steps**: 1 to 20 actions in order, counting the actions inside an If / Else; an If / Else holds conditions, a
  Then list and an Else list, and does not nest.
- **Let this rule's changes trigger other rules**: off by default. Off, the cards this rule changes start no other
  rule. On, they may, up to a chain of 5 rules (below).
- **Made by** and **Edited by**, a person and a moment each, shown on the builder ("Edited by Ana Costa · 3 days ago").
- A plan holds up to **50 rules**.

## Triggers

| Trigger              | Starts when                                                                                    | Narrowed by                       |
| -------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------- |
| **Card Created**     | a card is added, by anyone or anything (a person, Duplicate, an import, a Repeat, an agent)    | the column it lands in (optional) |
| **Form Response**    | a [Form](../030-forms/forms.md) response makes a card                                          | which Form tab (optional)         |
| **Card Moved**       | a card's status changes                                                                        | From columns, To columns          |
| **Field Changed**    | any of the chosen fields changes value (title, description, assignee, priority, labels, start, | one or more fields, required      |
|                      | due, estimate, checklist, flag or any custom field of the plan's card types)                   |                                   |
| **Comment Added**    | someone starts a thread on a card or replies on one (not Automation's own comments)            | none                              |
| **Run from a Card**  | an Editor picks the rule under **Run Rule** in a card's ⋯ menu                                 | none                              |
| **Scheduled**        | a time comes round: every day, every weekday (Monday to Friday), weekly on chosen days, or     | the rule's conditions pick the    |
|                      | monthly on a day (1 to 31), at a time (on the quarter hour)                                    | cards, as a filter                |
| **Due In**           | a card's due date is a chosen number of days away (1 to 30), at a time on that day             | the rule's conditions             |
| **Overdue**          | a card's due date has passed and it is not in a done column, at a time on the day after        | the rule's conditions             |
| **Incoming Webhook** | another tool sends the rule's own address a JSON call, proving it holds the rule's secret      | the cards the call names, then    |
|                      | ([Incoming Webhook](#incoming-webhook))                                                        | the rule's conditions             |

### Time triggers

- **Scheduled, Due In and Overdue** are **time triggers**: at their moment, the rule looks over the plan's cards and
  runs once **for each card** its conditions match, as a card trigger runs for one card. Its conditions are the
  card filter ("Every Weekday at 9:00 for cards Overdue, not Done"); a time trigger with no conditions matches
  every card, which the builder warns about ("Runs on every card in the plan").
- **At most 100 cards** a moment: past that, the 100 whose due dates come first (then the oldest) run and the Run
  Log says "Ran on 100 of 340 matching cards: the rest wait for the next time". Each card's run counts toward the
  plan's 1,000 a day.
- **Whose time it is**: the time zone of whoever last saved the rule, as a Repeat's setter's
  ([Repeating cards](items.md#repeating-cards)). A monthly day past the month's end is its last day (the 31st is 30
  April's 30th). A time a clock change skips runs at the first minute after it; a time a clock change repeats runs
  once, at the first.
- **Once per moment, late never a burst**: a moment runs exactly once (its run ids come from the rule, the card and
  the local day). A plan that missed moments (its server busy, a long outage) runs only the latest one it missed,
  once, when it next wakes, and never every one between; a moment more than a day late is dropped.
- **Due In and Overdue fire once per card per due date**: the run id holds the due date, so a card is reminded once
  for each due date it has. Moving the due date re-arms them: a new date can fire again; moving it back to one that
  already fired does not. A card with no due date, or Done for Overdue, never matches.
- A time trigger has no person behind it: **Who Did It** conditions are refused on one
  (`automation_condition_unsupported`), **Assign whoever triggered** and **Send Email to whoever triggered** too,
  and `{{person}}` reads "Automation". Its runs show "Automation · Every Weekday at 9:00" as their trigger line.
  The builder leaves those choices out on a time rule, and an Assign added to one starts on the plan's first person.
- **Test on a Card** runs a time trigger's rule on the chosen card as if its moment had come.
- A rule whose trigger is a time is listed with its next moment ("Next: Mon 9:00") under **Last Run**.

### Incoming Webhook

Another tool (a build server, a form service, a script, Zapier) starts a rule by sending it a call. It is how
something outside a plan writes into it, so it is built to give that tool as little as possible: one rule, never the
plan.

- **The secret.** Each Incoming Webhook rule has its own secret, `lwh_` and 86 more characters (64 random bytes,
  base64url). It can only start that one rule: it is not an account or API token and reads or writes nothing else.
  The plan keeps only its SHA-256 hash, never the secret. **Make Secret** shows it **once**, with Copy and "You won't
  see it again. Keep it where the other tool keeps its passwords."; afterwards the panel shows only its last 4
  characters ("Ends in …Xf3k"), when it was made and when it was last used ("Last used 3 min ago", "Never used").
  **Regenerate** (with a confirm: "Make a new secret? The old one stops working at once.") makes a new one and the
  old stops at once. Turning the rule off (or its pausing), deleting it, or changing its trigger to another stops
  the secret too: a rule off or gone answers every call as a wrong secret would. Changing the trigger away drops the
  secret, and coming back needs a new one. A duplicate, a copy of the plan and the plan's file carry no secret: the
  copy's rule needs Make Secret.
- **The address** names the plan and the rule only, never the secret:
  `POST https://www.liveplanner.app/api/hooks/automations/<plan id>/<rule id>`, the app's own address. The panel
  shows it with Copy whether a secret is made or not (it says nothing without the secret).
- **Proving it holds the secret**, by a header, never in the address:
  - `Authorization: Bearer lwh_…`, or
  - a signature of the raw body: `X-Liveplanner-Signature: sha256=<hex>`, the HMAC-SHA256 of the exact bytes sent,
    keyed with the secret (as GitHub signs its webhooks). The secret itself never travels.
    Both are checked in constant time. A call with neither, a wrong secret, a bad signature, a signature over other
    bytes, an old secret after Regenerate, or for a rule that is off, deleted, not an Incoming Webhook rule or never
    given a secret is answered **401** `webhook_unauthorized` with nothing more, the same answer every time, so a
    caller can't tell whether the rule exists.
- **The call** is JSON (`Content-Type: application/json`, any other is **415** `webhook_json_only`), at most
  **16 KB** (**413** past it). Its body is an object. It may name cards by number: `{"cards": [12, 14]}`, up to
  **10**, each a whole number from 1; a `cards` that isn't such a list is **400** `webhook_body_invalid`, as is a body
  that isn't a JSON object. Everything else in the body is the payload the rule's values read (below).
- **What it runs on.** With cards named, the rule runs once **for each named card the plan holds** (out of the
  Trash) that its conditions match, as a card trigger runs for one card. A number the plan has no card for, or a
  card in the Trash, is passed over: card numbers are the plan's own, so a call can only reach this plan's cards.
  With **no cards named**, the rule runs **once with no card**, and only if its steps need none: no conditions, and
  only **Create Card** (without copying from or linking to the triggering card) and the outgoing actions. A rule
  whose steps need a card, called with none, logs one **Skipped** run, "No cards named: this rule's steps need a
  card". The builder says which a rule is under its address: "Name cards in the call to run on them; with none, it
  runs once with no card." or "Its steps change a card, so the call must name cards." In a run with no card,
  `{{card.…}}` values read nothing and the Audit Trail's Card is empty.
- **The answer** is **202** `{"queued": n}` once accepted: `n` runs wait on the plan's queue (one per named card the
  plan holds, or 1 with none named) and run within a second or two on the room's alarm, as other triggers do; what
  they did is in the Audit Trail. 401, 413, 415 and 429 as above and below; **404** only for an address that isn't
  one (a missing or malformed plan or rule id); **405** for a method other than POST.
- **Limits.** At most **60 calls a minute** per rule (verified calls; the 61st and on are **429**
  `webhook_rate_limited` with `Retry-After` in seconds until the minute ends). Every run counts toward the plan's
  1,000 a day; with the day's budget spent a call is **429** `automation_budget_spent`, `Retry-After` until UTC
  midnight. The queue's cap holds as for other triggers: a burst past it drops the newest and logs one Skipped line,
  and `queued` says how many went in. Calls from one network are also bound by the api's write limit, before the
  plan is asked anything.
- **No person behind it.** Its runs are by **Automation** (the card's History and comments as for any rule), the
  Audit Trail's first line reads "Webhook received: 2 cards" ("1 card", "no card"), and `{{person}}` (Who Did It)
  reads "Incoming webhook". **Who Did It** conditions, **Assign whoever triggered** and **Send Email to whoever
  triggered** are refused on one (`automation_condition_unsupported`), as for a time rule, and the builder leaves them
  out.
- **Test on a Card** runs an Incoming Webhook rule on the chosen card as if a call had named it, with an empty
  payload: `{{webhook.…}}` values read nothing.
- **Who may.** Only an Editor of the whole plan, signed in (the Automations gate), makes, sees (once) or
  regenerates the secret, never through an API token or a link to one tab. The Rules list shows an Incoming Webhook
  rule's last 4 characters and last use, never the secret or its hash; no answer after Make Secret's, no Audit Trail
  row and no log line holds either.

- A Form Response also counts as Card Created: a rule on Card Created hears form cards too, a Form Response rule
  hears only them.
- A card leaving the Trash is not Card Created; a card moved into or out of the Trash is not Card Moved; archiving is
  not Card Moved. Undo of a person's own change triggers like the change it puts back.
- One write that changes several cards (a group move, a bulk edit) starts one run per card per rule.
- Changes **Automation** made trigger other rules only when the changing rule lets them (above), and never the same
  rule again.

## Conditions

Each condition is one line in the builder, a chip sentence:

- **Card Type** is / is not one of the plan's card types.
- **Column** is / is not one of the plan's columns (by status).
- **Field** compared: _is_, _is not_, _is empty_, _is not empty_, _contains_ (text, labels, a several-values field),
  _does not contain_, and for dates _before_, _after_, _on or before_, _on or after_ a day or **Today**, ± days. A
  number compares _is_, _less than_, _more than_.
- **Who Did It** is / is not one of: a chosen person, **an Editor**, **a Participant**, **an agent**. A Run from a
  Card's person is whoever ran it.
- **Matches a Saved Filter** of one of the plan's boards ([Saved filters](board-widgets.md)), applied as the
  person who made the change would see it (Only Mine is their cards).

A condition on a field the card's type lacks does not hold (it never errors). A condition naming a type, column,
field, person or saved filter that is gone since does not hold, and the Rules list marks the rule **Needs Attention**
with what is missing.

## Actions

| Action                          | Does                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------- |
| **Move to Column**              | sets the card's status to a column its type uses (as the Status picker offers)                    |
| **Set Field**                   | sets a field to a value: a literal, a value from the card, or a date (Today ± days)               |
| **Clear Field**                 | empties a field                                                                                   |
| **Assign**                      | assigns a chosen person, **whoever triggered the rule**, nobody, or **people in turn**: each run  |
|                                 | the next of 2 to 10 chosen people, in order, round and round                                      |
| **Add Label**, **Remove Label** | adds or takes off one label                                                                       |
| **Add Comment**                 | starts a new thread on the card with the comment, by Automation                                   |
| **Flag**, **Unflag**            | flags or unflags the card                                                                         |
| **Archive**                     | archives the card                                                                                 |
| **Create Card**                 | adds a card of a chosen type, with a title (values allowed), to a column, optionally copying the  |
|                                 | triggering card's assignee, labels and due date, and optionally linking it through a Card field   |
| **Send Email**                  | emails the assignee, whoever triggered it or a chosen person, with a subject and a short body     |
|                                 | (values allowed) and a link to the card; only people with an account get it, and the email        |
|                                 | [notification](../014-identity/profile-and-email-notifications.md) opt-out applies                |
| **Send to Webhook**             | sends a signed JSON event to one of the plan's own-service webhooks: the rule, the card and a     |
|                                 | message (values allowed)                                                                          |
| **Post to Slack**               | posts the message, with an **Open in liveplanner** link, through one of the plan's Slack webhooks |
| **Post to Microsoft Teams**     | the same, as a card in a Teams channel through one of the plan's Teams webhooks                   |
| **For Related Cards**           | a branch: runs its own conditions and actions on each related card (below)                        |

### Assign in turn

**People in turn** keeps its place per rule: the first run assigns the first person, the next the second, and after
the last back to the first. A person who has left the plan is passed over, their turn with them (and the rule needs
attention). A branch assigning in turn gives each related card the next person. A run that
fails or matches nothing doesn't move the turn, and Test on a Card shows whose turn it is without taking it.

### Outgoing actions

- They post through the plan's [webhooks](../../../../liveworkspace/docs/specs/004-index/webhooks.md#automation-sends),
  built once on the platform: the webhook keeps the address, the secret, the retries, the pausing and Recent
  Deliveries. The action's panel picks one of the plan's webhooks of its kind (Your Own Service, Slack, Teams) by
  name, with **Add a Webhook…** opening the plan's Webhooks dialog. A message is 1 to 2,000 characters with values.
- The step is **done** when the platform has queued the message, and the Audit Trail says "Queued for Launch Channel".
  It fails when the platform refuses it: the webhook is paused ("Launch Channel is paused: the address said it’s
  gone"), deleted, or the platform can't be reached. Ten such failures pause the rule like any other, and a rule
  paused on a webhook shows **Fix Webhook** (the Webhooks dialog) beside **Resume**.
- The webhooks are an account's: a guest's panel says only someone signed in can pick one, with **Sign In**, and
  asks the index nothing. A paused webhook is listed "(Paused)"; one the rule names that is gone, "(No Longer Here)".
- A rule holds at most **5** outgoing actions, at its top level (never inside a branch or an If / Else), so one run
  posts at most 5 messages.
- **Test on a Card** sends nothing and says "Would post to Launch Channel: …" with the message filled in.
- A message whose values all came out empty (`{{card.assignee}}` on a card with none) is never sent: that step fails
  with "The message came out empty".

### For Related Cards

A branch (**+ For Related Cards** under the steps) runs its own steps on each of the triggering card's related
cards, picked one of these ways:

- **Linked Cards**: the cards a Card field of the card points at (one chosen field, or any).
- **Blocked By Cards**: the cards this card is blocked by; **Cards It Blocks**: the cards blocked by this card.
- **Child Cards**: the cards whose parent is this card.
- **Cards Matching a Saved Filter** of one of the plan's boards.

Each branch has its own conditions (up to 10, on the related card) and 1 to 10 actions, which count toward the
rule's 20. In a branch, `{{card.…}}` is the related card and `{{trigger.title}}`, `{{trigger.key}}` and
`{{trigger.url}}` the card that started the rule. A branch takes no If / Else, no other branch, no Create Card and
no outgoing action. It runs on at most **100 related cards** (the first by their number), each as one write by
Automation, and the run's line says "For each Child Card: on 3 related cards" (each card's own lines beneath it,
headed by its number). A related card that refuses an action fails that card's
steps only; the run is **Failed** if any did, naming them.

- An action that would change nothing (a label already there, a card already in the column) is not a change: the
  run says "Already so" for that step and carries on.
- An action the card refuses (a column its type leaves out, a required field missing, the plan full) fails that
  step: the run stops there and is **Failed** with the reason; the steps before it stay done.
- Every change a run makes lands as **one write per card** where it can (the step's changes to the triggering card
  are batched into one patch, in step order), so the card's history reads as one entry and the board moves once.

## Values

Text a rule writes (a comment, a title, a field value, an email) can hold values, picked from **Insert a Value** in
the builder and shown there as chips:

| Value                          | Is                                                     |
| ------------------------------ | ------------------------------------------------------ |
| `{{card.title}}`               | the card's title                                       |
| `{{card.key}}`                 | its number, `#48`                                      |
| `{{card.url}}`                 | a link that opens the card                             |
| `{{card.assignee}}`            | the assignee's name, or nothing                        |
| `{{card.column}}`              | the column it is in, by name                           |
| `{{card.due}}`                 | its due day, as "11 Nov 2026"                          |
| `{{card.field.<Field Name>}}`  | any field of the card's type, by its name (Any Field…) |
| `{{person}}`                   | who triggered the rule                                 |
| `{{rule}}`                     | the rule's name                                        |
| `{{now}}`, `{{now.date}}`      | the moment the rule runs; as a day                     |
| `{{now + 3d}}`, `{{now - 1d}}` | a day from today, for a date field                     |
| `{{webhook.<path>}}`           | a value of an Incoming Webhook call's body, by its dot |
|                                | path (`{{webhook.build.status}}`, Webhook Field…)      |

- A value the rule cannot fill (no assignee) reads as nothing. A value the builder does not know is refused on save
  with its name (`automation_value_unknown`).
- Days and times are in the time zone of the person who last saved the rule (kept on the rule, as a Repeat keeps its
  setter's).
- Values are text: what a card holds is never run, and a value is never read as a value again.
- `{{webhook.<path>}}` is known only in an Incoming Webhook rule's text (elsewhere `automation_value_unknown`), and
  **Insert a Value** offers **Webhook Field…** (a path typed in, as `order.id`) only there. A path is 1 to 5 names
  joined by dots, each 1 to 64 letters, digits, `_` or `-` (a list's place is its number: `items.0.name`). It reads the
  call's body: a string, a number or a boolean (as `true` or `false`), the string cut at **500** characters; an object,
  a list, `null` or a missing path reads as nothing. What it reads is filled in as plain text, once: a payload
  holding `{{card.title}}` or `<b>` stays those characters, never a value and never markup. Only the values the
  rule's text names are kept with the waiting run; the rest of the body is never stored.

## Runs, limits and loops

- A rule runs **after** the change that triggered it has landed, within a second or two, from the plan's own alarm
  (as Repeats and the outbox do). Saving a card never waits for a rule, and a plan without a rule that is on does no
  rule work on any save.
- **Never twice**: a run's id comes from the trigger and the rule, so a retry or a second wake never runs a rule
  twice for one trigger.
- **Chains**: a change made by a rule that lets its changes trigger others can start other rules, which can start
  others, up to **5 rules** in a chain; the sixth is **Skipped** ("Chain stopped after 5 rules"). A rule never answers
  its own changes. A change by a rule that does not let its changes trigger others starts nothing; a rule whose
  trigger and conditions it would have met logs a **Skipped** run ("Started by another rule's change").
- **Per run**: at most **20 actions** and **1 created card**.
- **Per plan per day** (UTC): at most **1,000 runs**. Only runs that did something, failed or were skipped count; a
  **No Match** is logged and costs nothing. Past it, triggers are dropped until the next day, the Automations screen's meter reads full, a line says "Daily limit reached: rules run again
  tomorrow", and Run Rule answers that it cannot run now.
- **Waiting**: at most **500 triggers** wait at once; a burst past that drops the newest and logs one Skipped line
  ("Too many changes at once").
- **Pausing**: a rule that fails **10 runs in a row** turns itself off and is marked **Paused** with the last
  failure's reason; **Resume** turns it on again and clears the count. Any matched run resets the count.

## Where it shows

### The footer button

**Automations** sits in the editor's footer cluster between **Search** and **Settings**
([Editor app](../007-editor/editor-app.md)), with a lightning-bolt icon, labelled from `sm` up like its neighbours,
icon-only on a phone (a 40 px target). Its hover card reads **Automations**: "Rules that move, assign and tell people
about cards for you." It is drawn only for an Editor on a plan saved to an account. A rule that paused itself puts
a small amber dot on the icon until it is resumed or turned off. It opens the Automations screen and sends
`UI · Opened · Automations`.

### The Automations screen

A large dialog over the editor (a full-screen sheet on a phone), titled **Automations** with the line "Rules that act
on this plan's cards for you when something happens.", a **New Rule** button and Close.

Its header is the start screens' header band (start-panel.md "The header band"), drawn for rules: 100px tall from
`sm`, a bolt as the title mark, then the title and its line, in the app's light or dark colours. Behind them, hidden
from screen readers and the pointer, a faint dot grid fading out toward the title, a cog rising from the bottom left
and a looping arrow from the bottom right (both at every size), and, from `lg` only, between the line (which wraps
short of it) and the header's buttons, a rule as a flow: a trigger's bolt, a condition's diamond and an action's
check joined by a line, a dashed arrow looping back over them. The bolt's ring spreads twice, motion allowing. On a
phone the header stays compact: the mark and title, no line.

- Three tabs: **Rules · n**, **Audit Trail** and **Templates**.
- A **Runs today** meter at the right of the tabs: "142 of 1,000" (No Match runs are not counted).
- **Rules**: a search box ("Find a rule"), **All Triggers** and **On and Off** filters, then one row per rule:
  its switch, its name, its sentence (When `Card Moved` to `Done` then `Set Completed On` `Remove Label blocked`),
  **Last Run** ("4 min ago", "Never") and **This Week** ("38 runs"), and a ⋯ menu (Edit, Duplicate, Audit Trail,
  Delete). A paused rule's row is amber, with **Paused**, the reason, and **Resume**. A rule needing attention
  says what is missing. Clicking a row opens the builder.
- **Empty**: the bolt glyph, **No Rules Yet**, "A rule watches this plan and does the routine steps for you:
  moving, assigning, labelling and telling people about cards. Start from one below or build your own.", **New
  Rule** and **How Rules Work** (the help article), then **Start From a Template** with the gallery below.
- **Templates** (the tab, and under the empty state): category chips **All**, **Status**, **Assigning**, **Due
  Dates**, **Forms** and **Telling People**, then a tile per template, its name, its sentence and its category:

  | Template                   | Does                                                                                 | Category       |
  | -------------------------- | ------------------------------------------------------------------------------------ | -------------- |
  | Stamp the Finish Date      | When a card moves to a done column, set Completed On to today and clear its flag.    | Status         |
  | Assign on Start            | When a card moves to In Progress with no assignee, assign whoever moved it.          | Assigning      |
  | Overdue Nudge              | Every weekday at 9:00, flag overdue cards and email their assignee.                  | Due Dates      |
  | Share Out Form Responses   | When a form response lands, assign people in turn and thank the sender in a comment. | Forms          |
  | Post Shipped Work to Slack | When a card with a chosen label moves to Done, post its title and link to a channel. | Telling People |
  | Triage New Bugs            | When a Bug card is added, label it triage and assign the people on triage in turn.   | Assigning      |
  | Unblock the Next Card      | When a card is done, comment on every card it was blocking that it can start.        | Status         |
  | Due Soon Reminder          | Two days before a card is due, email its assignee with a link to the card.           | Due Dates      |

  Picking one opens the builder filled in, unsaved and off, named after it (made unique). What the plan has is
  filled in by its role (its done columns, its In Progress column, a date field named like Completed On, a Bug
  type); what it lacks or the template leaves to you (a label, the people in turn, a Slack webhook) is left empty,
  its step marked "Pick a field" (or a label, people, a webhook) until picked. Nothing is saved until **Save Rule**.
  **New Rule** is a menu: **Blank Rule** (the builder, empty) and **Start From a Template** (the Templates tab). With
  the plan at its 50 rules the tiles show but don't open.

- **Audit Trail**: filters **All Rules**, **Any Result** and **Last 7 Days**, the line "Kept for 30 days or the last
  2,000 runs, and the last 500 No Matches" (No Matches are kept apart, so they never push a run out), and one row per run: When, Rule, Card (`#48` and title), Result (**Done**, **No Match**, **Skipped**,
  **Failed** pills), Took. A row opens to its steps, one line each with a tick or a cross: who did what (the
  trigger), each condition with what it found, each action, and **Open Card**. A failed or skipped row shows its
  reason under it.
- On a phone the rows stack (name, sentence, last run and week on one line, the switch at the right) and the
  dialog fills the screen.

### The rule builder

Opening a rule (or New Rule) swaps the screen to its builder: a breadcrumb back to **Automations**, the rule's name
(editable in place), its On / Off chip, "Edited by … · when", **Test on a Card** and **Save Rule**.

- The rule reads top to bottom as cards joined by a line: **When** (the trigger), **If all of these** (the
  conditions), then one **Then** card per action, each with its icon. Under them: **+ Add Action**, **+ Add
  Condition**, **+ If / Else** and **+ For Related Cards**. A branch is a card ("For each **Blocked By Card**") with
  its own conditions and actions inset beneath it.
- Picking a card selects it (a violet ring) and opens it on the right in the **step panel**: its own fields (columns,
  fields, people and types picked from the plan's), and for text, **Insert a Value** chips that drop a value at the
  caret, shown as violet chips. An action's panel shows a **Preview** on a real card of the plan, filled in.
- A step's ⋯ menu: Move Up, Move Down, Duplicate, Delete.
- **Rule Details** (an accordion, closed): **Let this rule's changes trigger other rules** with "Off keeps rules
  from setting each other off. Chains stop after 5 rules.", and "Runs as Automation, with an Editor's access, for
  changes anyone with edit or participate access makes."
- **Test on a Card** picks a card (the card finder) and runs the rule as it stands in the builder, unsaved, without
  changing anything: the result shows as an Audit Trail row with its steps, each action saying what it would do.
- Leaving with unsaved changes asks **Discard Changes?**. A save the api refuses keeps the builder open and marks
  the step at fault.

### On cards

- A change Automation made reads in the card's **History** with the bolt glyph: "**Automation** set Completed On to
  11 Nov 2026 · Done Means Wrapped Up · 10:42" ([History](items.md#history)), and a field whose latest change in
  the history read was a rule's shows a small **Set by Automation** chip beside its value in the item panel.
- A comment Automation added shows the bolt avatar, **Automation** and the rule's name (a link to the rule for an
  Editor), on a violet-tinted card. It is not Generated by AI.
- The card's ⋯ menu offers **Run Rule** (an Editor's, when at least one Run from a Card rule is on), a submenu headed
  "Rules You Can Run Here" listing them, then **Manage Automations**. Running one says "Ran Escalate to Leads" or the
  failure, as a toast.

## Copies, exports and deletes

- A **duplicated** plan keeps its rules, each as it was (on or off), its Audit Trail and counts empty. A plan made from
  a template has none.
- An **export** of a plan (its file) carries its rules; an import of that file brings them back off.
- A copy made through a share link, of one tab, or of a Community post takes no rules: the rules are an Editor's of the
  whole plan to see.
- A rule naming a card type, column, field or person the copy lacks needs attention there (above).
- **Deleting** a plan deletes its rules, queue and Audit Trail with it.

## Telemetry

`UI · Opened · Automations`; `Plan · Created · AutomationRule`; `Plan · Toggled · AutomationOn` /
`AutomationOff`; `Plan · Deleted · AutomationRule`; `Plan · Tested · AutomationRule`; `Plan · Ran · AutomationManual`;
`UI · Opened · AutomationTemplate.<id>`, the template's id after the dot (an event carries no value, so the id
rides in its type, from the fixed list above); `UI · Opened · AutomationsOffline` (the Browser Storage panel);
`Plan · Created · AutomationSecret` (Make Secret), `Plan · Changed · AutomationSecret` (Regenerate) and
`Plan · Copied · AutomationSecret` (Copy on the once-shown secret).
The api logs `[automations] run` with the result, the trigger's kind and the duration, never a card's text, and
`[automations] hook` with the call's answer (accepted, refused and why, rate limited) and how many runs it queued,
never the secret, a signature or the body.

## Limits

| Limit                            | Value                                  |
| -------------------------------- | -------------------------------------- |
| Rules per plan                   | 50                                     |
| Conditions per rule (and per If) | 10                                     |
| Actions per rule                 | 20                                     |
| Chain of rules                   | 5                                      |
| Runs per plan per day            | 1,000                                  |
| Triggers waiting                 | 500                                    |
| Failures in a row before pausing | 10                                     |
| Audit Trail                      | 2,000 runs and 500 No Matches, 30 days |
| Comment or email body            | 2,000 characters                       |
| Rule name                        | 60 characters                          |
| Cards a time trigger runs on     | 100 a moment                           |
| Related cards a branch runs on   | 100                                    |
| Actions in a branch              | 10 (of the rule's 20)                  |
| Outgoing actions per rule        | 5                                      |
| People in turn                   | 2 to 10                                |
| Incoming Webhook call body       | 16 KB, JSON                            |
| Incoming Webhook calls per rule  | 60 a minute                            |
| Cards one call names             | 10                                     |
| A webhook value                  | 5 names deep, 500 characters           |

## Not yet

AI actions, agent and CLI tools for rules (Phase 3). Rules across plans, sprints,
versions and SLAs are not planned.
