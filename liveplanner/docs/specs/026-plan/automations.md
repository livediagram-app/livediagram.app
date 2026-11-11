# Automations

**Automations** let a plan act on its own cards: a **rule** watches for something happening to a card (a **trigger**),
checks the card (its **conditions**) and then does the routine steps people would otherwise do by hand (its
**actions**): move it, assign it, label it, comment on it, tell someone. It is the planner's take on Jira's project
automation, sized to one plan. The engineering detail is [blueprints/automations.md](blueprints/automations.md).

This spec is **Phase 1** (Work Item #711): card triggers and actions, the Automations screen and its footer button.
Phase 2 (#712) adds scheduled and due-date triggers, related-card branches, Slack, Teams and webhook actions and the
Templates gallery; Phase 3 (#713) adds the incoming webhook trigger, AI actions and the agent and CLI rule tools.
Each is specified here when it is built. The design for every phase is the LivePlanner Automations canvas (the
owner's design artifact); Phase 1 follows its screens 1, 2, 3, 4, 5 and 7.

## Why

Most of a board's busywork is the same small step after the same event: a card reaches Done and someone stamps the
date and unassigns it; a bug comes in and someone labels it and hands it to whoever is on triage; a form response
lands and someone sets its priority from the answer. Each step is quick, easy to forget and never the point of the
work. A rule does it every time, at once, and says that it did.

## Domain language

| Term           | Means                                                                                         | Never called              |
| -------------- | --------------------------------------------------------------------------------------------- | ------------------------- |
| **rule**       | One automation: a name, on or off, a trigger, conditions and steps                            | automation (one), recipe  |
| **trigger**    | What starts a rule: something that happened to one card, or a person running it from the card | event (in copy), hook     |
| **condition**  | A check on the card or on who made the change; every condition must hold                      | filter (in copy), guard   |
| **step**       | An action, or an If / Else holding actions                                                    | node                      |
| **action**     | One change or message a rule makes                                                            | task, job                 |
| **run**        | One rule answering one trigger: matched (its actions ran), no match, skipped or failed        | execution                 |
| **Run Log**    | The plan's list of recent runs, newest first                                                  | audit log, history (here) |
| **value**      | A placeholder in a rule's text (`{{card.title}}`), filled in when the rule runs               | smart value, variable     |
| **Automation** | Who a rule's changes are by, on cards, comments and history, with the rule's name beside it   | bot, system               |

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
- A plan in **Browser Storage** has no Automations: it has no alarm to run them on (as [Repeating
  cards](items.md#repeating-cards)), so its footer shows no button. A plan's rules come back to life when the plan is
  saved to an account with them (Sync to cloud carries none in Phase 1: an offline plan holds no rules).
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

| Trigger             | Starts when                                                                                    | Narrowed by                       |
| ------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------- |
| **Card Created**    | a card is added, by anyone or anything (a person, Duplicate, an import, a Repeat, an agent)    | the column it lands in (optional) |
| **Form Response**   | a [Form](../030-forms/forms.md) response makes a card                                          | which Form tab (optional)         |
| **Card Moved**      | a card's status changes                                                                        | From columns, To columns          |
| **Field Changed**   | any of the chosen fields changes value (title, description, assignee, priority, labels, start, | one or more fields, required      |
|                     | due, estimate, checklist, flag or any custom field of the plan's card types)                   |                                   |
| **Comment Added**   | someone starts a thread on a card or replies on one (not Automation's own comments)            | none                              |
| **Run from a Card** | an Editor picks the rule under **Run Rule** in a card's ⋯ menu                                 | none                              |

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

| Action                          | Does                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------ |
| **Move to Column**              | sets the card's status to a column its type uses (as the Status picker offers)                   |
| **Set Field**                   | sets a field to a value: a literal, a value from the card, or a date (Today ± days)              |
| **Clear Field**                 | empties a field                                                                                  |
| **Assign**                      | assigns a chosen person, **whoever triggered the rule**, or nobody                               |
| **Add Label**, **Remove Label** | adds or takes off one label                                                                      |
| **Add Comment**                 | starts a new thread on the card with the comment, by Automation                                  |
| **Flag**, **Unflag**            | flags or unflags the card                                                                        |
| **Archive**                     | archives the card                                                                                |
| **Create Card**                 | adds a card of a chosen type, with a title (values allowed), to a column, optionally copying the |
|                                 | triggering card's assignee, labels and due date, and optionally linking it through a Card field  |
| **Send Email**                  | emails the assignee, whoever triggered it or a chosen person, with a subject and a short body    |
|                                 | (values allowed) and a link to the card; only people with an account get it, and the email       |
|                                 | [notification](../014-identity/profile-and-email-notifications.md) opt-out applies               |

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

- A value the rule cannot fill (no assignee) reads as nothing. A value the builder does not know is refused on save
  with its name (`automation_value_unknown`).
- Days and times are in the time zone of the person who last saved the rule (kept on the rule, as a Repeat keeps its
  setter's).
- Values are text: what a card holds is never run, and a value is never read as a value again.

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

- Two tabs: **Rules · n** and **Run Log** (Templates comes in Phase 2).
- A **Runs today** meter at the right of the tabs: "142 of 1,000" (No Match runs are not counted).
- **Rules**: a search box ("Find a rule"), **All Triggers** and **On and Off** filters, then one row per rule:
  its switch, its name, its sentence (When `Card Moved` to `Done` then `Set Completed On` `Remove Label blocked`),
  **Last Run** ("4 min ago", "Never") and **This Week** ("38 runs"), and a ⋯ menu (Edit, Duplicate, Run Log,
  Delete). A paused rule's row is amber, with **Paused**, the reason, and **Resume**. A rule needing attention
  says what is missing. Clicking a row opens the builder.
- **Empty**: the bolt glyph, **No Rules Yet**, "A rule watches this plan and does the routine steps for you:
  moving, assigning, labelling and telling people about cards. Build your first one.", **New Rule** and **How Rules
  Work** (the help article).
- **Run Log**: filters **All Rules**, **Any Result** and **Last 7 Days**, the line "Kept for 30 days or the last
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
  Condition** and **+ If / Else** (**+ For Related Cards** is Phase 2 and not drawn).
- Picking a card selects it (a violet ring) and opens it on the right in the **step panel**: its own fields (columns,
  fields, people and types picked from the plan's), and for text, **Insert a Value** chips that drop a value at the
  caret, shown as violet chips. An action's panel shows a **Preview** on a real card of the plan, filled in.
- A step's ⋯ menu: Move Up, Move Down, Duplicate, Delete.
- **Rule Details** (an accordion, closed): **Let this rule's changes trigger other rules** with "Off keeps rules
  from setting each other off. Chains stop after 5 rules.", and "Runs as Automation, with an Editor's access, for
  changes anyone with edit or participate access makes."
- **Test on a Card** picks a card (the card finder) and runs the rule as it stands in the builder, unsaved, without
  changing anything: the result shows as a Run Log row with its steps, each action saying what it would do.
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

- A **duplicated** plan keeps its rules, each as it was (on or off), its Run Log and counts empty. A plan made from
  a template has none.
- An **export** of a plan (its file) carries its rules; an import of that file brings them back off.
- A copy made through a share link, of one tab, or of a Community post takes no rules: the rules are an Editor's of the
  whole plan to see.
- A rule naming a card type, column, field or person the copy lacks needs attention there (above).
- **Deleting** a plan deletes its rules, queue and Run Log with it.

## Telemetry

`UI · Opened · Automations`; `Plan · Created · AutomationRule`; `Plan · Toggled · AutomationOn` /
`AutomationOff`; `Plan · Deleted · AutomationRule`; `Plan · Tested · AutomationRule`; `Plan · Ran · AutomationManual`.
The api logs `[automations] run` with the result and duration, never a card's text.

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
| Run Log                          | 2,000 runs and 500 No Matches, 30 days |
| Comment or email body            | 2,000 characters                       |
| Rule name                        | 60 characters                          |

## Not in Phase 1

Scheduled, Due In and Overdue triggers; For Related Cards; Slack, Teams and webhook actions; the Templates gallery
(Phase 2). The incoming webhook trigger, AI actions, agent and CLI tools (Phase 3). Rules across plans, sprints,
versions and SLAs are not planned.
