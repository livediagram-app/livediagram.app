# Automations

**Automations** let a plan act on its own cards: a **rule** watches for something happening to a card (a **trigger**),
checks the card (its **conditions**) and then does the routine steps people would otherwise do by hand (its
**actions**): move it, assign it, label it, comment on it, tell someone. It is the planner's take on Jira's project
automation, sized to one plan. The engineering detail is [blueprints/automations.md](blueprints/automations.md).

This spec covers **Phase 1** (Work Item #711: card triggers and actions, the Automations screen and its footer
button) and **Phase 2** (#712: the Scheduled, Due In and Overdue triggers, For Related Cards, Assign in Turn, the
Send to Webhook, Post to Slack and Post to Teams actions, and the Templates gallery) and, of **Phase 3** (#713), the
agent and CLI rule tools ("Agents and the CLI", below), the **AI actions** (Summarise Card, Suggest Card Type,
Triage) and the **Incoming Webhook** trigger (below). The
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
- **AI actions** are an Editor's like any action: whoever may write the rule may add one. They act as Automation with
  an Editor's access, as every action does, and a Participant's change can start one. Each costs the plan one of its
  **100 AI steps a day**, shared by every rule.
- An **Incoming Webhook** rule's secret is an Editor's of the whole plan, signed in, to make, see once and
  regenerate ([Incoming Webhook](#incoming-webhook)); whoever holds it can start that one rule and nothing else, and
  its runs are Automation's, an Editor's writes as any rule's.
- An **API token** (the MCP server, the CLI, a script) reaches rules as its account does: when that account is an
  Editor of the whole plan, the token may do everything above ("Agents and the CLI"). A **read-only** token lists
  the rules and the Audit Trail and nothing else (403 `read_only_token` on every other route, Test on a Card too).
  A token whose account is a Participant, a Viewer or a tab-scoped Editor is refused as that person is
  (`automations_need_editor`), so a token never picks an outgoing action's webhook that its account could not.
  A **workbench session** and a **share-link visitor** with no account are always refused. Card writes by a token
  trigger rules like anyone's.

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

| Trigger                  | Starts when                                                                                    | Narrowed by                       |
| ------------------------ | ---------------------------------------------------------------------------------------------- | --------------------------------- |
| **Card Created**         | a card is added, by anyone or anything (a person, Duplicate, an import, a Repeat, an agent)    | the column it lands in (optional) |
| **Form Response**        | a [Form](../030-forms/forms.md) response makes a card                                          | which Form tab (optional)         |
| **Card Moved**           | a card's status changes                                                                        | From columns, To columns          |
| **Field Changed**        | any of the chosen fields changes value (title, description, assignee, priority, labels, start, | one or more fields, required      |
|                          | due, estimate, checklist, flag or any custom field of the plan's card types)                   |                                   |
| **Comment Added**        | someone starts a thread on a card or replies on one (not Automation's own comments)            | none                              |
| **Run from a Card**      | an Editor picks the rule under **Run Rule** in a card's ⋯ menu                                 | none                              |
| **Scheduled**            | a time comes round: every day, every weekday (Monday to Friday), weekly on chosen days, or     | the rule's conditions pick the    |
|                          | monthly on a day (1 to 31), at a time (on the quarter hour)                                    | cards, as a filter                |
| **Due In**               | a card's due date is a chosen number of days away (1 to 30), at a time on that day             | the rule's conditions             |
| **Overdue**              | a card's due date has passed and it is not in a done column, at a time on the day after        | the rule's conditions             |
| **Incoming Webhook**     | another tool sends the rule's own address a JSON call, proving it holds the rule's secret      | the cards the call names, then    |
|                          | ([Incoming Webhook](#incoming-webhook))                                                        | the rule's conditions             |
| **Card Archived**        | a card is archived                                                                             | none                              |
| **Card Restored**        | an archived card is brought back                                                               | none                              |
| **Checklist Completed**  | the last unticked item on a card's checklist is ticked (a checklist of at least one item)      | none                              |
| **All Threads Resolved** | the last open comment thread on a card is resolved                                             | none                              |
| **Someone Mentioned**    | a comment on a card @mentions someone (not Automation's own comments)                          | the people mentioned (optional)   |
| **Card Unblocked**       | the last open card blocking a card reaches a done column or is archived (the unblocked card    | none                              |
|                          | runs the rule)                                                                                 |                                   |
| **Related Cards Done**   | the last of a card's children, or of the cards its Card fields point at, reaches a done column | children or linked cards          |
|                          | (the card they belong to runs the rule; it must have at least one)                             |                                   |
| **Column Over Limit**    | a card goes into a column that then holds more cards than the limit (1 to 500): once each      | the column and its limit,         |
|                          | time the column goes over, the card that tipped it running the rule                            | required                          |
| **Card Stuck**           | a card has not changed for a number of days (1 to 90), checked daily at a time; done columns   | the columns (optional), then the  |
|                          | and archived cards never match                                                                 | rule's conditions                 |
| **Pull Request Opened**  | a linked GitHub pull request opens ready for review, reopens, or leaves draft                  | the rule's conditions             |
|                          | ([GitHub triggers](#github-triggers))                                                          |                                   |
| **Pull Request Merged**  | a linked pull request merges                                                                   | the rule's conditions             |
| **Pull Request Closed**  | a linked pull request closes without merging                                                   | the rule's conditions             |
| **Checks Finished**      | a linked pull request's checks turn Failing, or Passing (picked; Failing first)                | Failing or Passing, required      |

- **Card Stuck** is a time trigger (below). It fires once for each stretch a card sits unchanged: the run id holds
  when the card last changed, so any change re-arms it.
- **Card Unblocked, Related Cards Done and Column Over Limit** are worked out when the rule runs, from the plan's cards
  as they are then: a move or archive that sets one off may be another card's (the blocker, the last child), and the
  rule runs on the card it concerns, with Who Did It the person who made that move. Archiving or restoring a card
  starts only Card Archived and Card Restored. Changes that reach one moment before the rule runs (the last two
  blockers or children done in a group move, or one after the other; two cards dropped into a column together) run
  it once: on the card they concern, and on one card for a column.

### Time triggers

- **Scheduled, Due In, Overdue and Card Stuck** are **time triggers**: at their moment, the rule looks over the plan's cards and
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

### GitHub triggers

A plan [connected to GitHub](github-pull-requests.md#the-github-connection) hears its linked pull requests: the
GitHub group of Pick a Trigger (**Pull Request Opened**, **Pull Request Merged**, **Pull Request Closed**, **Checks
Finished**). Their engineering and their guarantees (once per delivery, never backwards) are
[GitHub pull requests](github-pull-requests.md#github-triggers); here is what they are in a rule.

- **Which card.** The rule runs once on each card the pull request links (a Pull Request field, a Link field holding
  its address, or its title or body naming the card as "{plan name} #N"), up to 50.
- **Nobody behind it.** Its writes are by **GitHub** in card History, with the rule's name ("GitHub · Move on
  Merge"), its comments are Automation's as any rule's, the Audit Trail's first line reads "GitHub: acme/web#42
  merged" (opened, closed, checks failing, checks passing), and `{{person}}` reads "GitHub". Who Did It conditions and
  "whoever triggered" are refused, as for a time rule.
- **Test on a Card** runs it on the chosen card as if one of its pull requests had just done so.
- **Off when GitHub is.** The group, and everything below, show only where the deployment has liveplanner's GitHub
  App (`githubEnabled`). A plan not yet connected may pick and save a GitHub trigger; its panel shows **Connect
  GitHub** in place, and the rule hears nothing until the plan connects.
- **Drafted too.** The GitHub triggers are in the one rule format (`rule-format.ts`) that an agent's change_rules
  and [Describe a Rule](#describe-a-rule) are given, so "when its pull request merges, move it to Done" drafts a
  Pull Request Merged rule, open in the builder as any draft is (with Connect GitHub in its panel while the plan is
  not connected).

#### The GitHub view

The Automations screen's way to the plan's GitHub connection, inside the dialog (never the plan's settings):

- **Reached** from a **GitHub** button in the screen's header (GitHub's mark and "GitHub", icon-only on a phone, with
  its tooltip and name "GitHub Connection"), from a GitHub trigger's panel (its **Manage** or **Pick Repositories**
  while connected, or its compact **Connect GitHub First** card, which connects in place, while not), and so from
  Pick a Trigger's GitHub group, whose heading is noted **Not Connected** while the plan is not. It is drawn as the builder
  is: a breadcrumb back to **Automations**, then the view.
- **Not connected**: GitHub's mark, **Connect GitHub**, "Link pull requests to cards: a card shows its pull request's
  state, and rules run when one opens, merges, closes or its checks finish.", three short lines on what it asks
  ("Read-only: pull requests, checks and metadata.", "No personal GitHub token is kept.", "Pick which repositories
  this plan hears."), **Connect GitHub** (the api's install page, a full-page visit to GitHub) and **How It Works**
  (the help article).
- **Connected**: the installation's account (as GitHub names it) and who connected it and when, then **Repositories**:
  each the installation lists, with a **Private** lock tag for a private one, and a switch for each one the plan
  hears, **Undo Changes** and **Save Repositories** while the picks differ from what is saved (up to 20; "Pick up to
  20" past it); **Change on GitHub** beside the account, and **Disconnect** at the foot. With more than 20 listed and
  none picked, a line says so: "Pick up to 20 repositories for this plan to hear." While a private repository is
  picked, a note says what that shares: "Anyone who can see this plan's cards, share links included, sees these pull
  requests' titles and states." **Change on GitHub** starts a connect again, so GitHub's own page adds or removes the
  installation's repositories.
- The connection is read each time the view opens (what was read before shows meanwhile), so a change made in
  another tab or by another Editor shows. A Save Repositories refused because the list changed on GitHub (a
  repository gone from the installation) says so and reads the list again; a pick no longer listed is dropped.
- **Disconnect** asks first, in the app (never a browser dialog): **Disconnect GitHub?**, "Cards stop showing pull
  request states, and GitHub rules stop running until you connect again. Your rules and fields stay.",
  **Disconnect** and **Cancel**.
- **Coming back from GitHub**: the page reads `#github=connected`, `#github=failed` or `#github=requested` once,
  opens Automations on the GitHub view with a line in the view ("GitHub is connected. The repositories this plan
  hears are below." / "GitHub didn't connect. Try again, or check the App is installed on that account." / "An owner of that
  organisation must approve the install on GitHub. Connect again once they have."), and drops the hash. Someone who
  left from a GitHub trigger's panel comes back to that rule, unsaved as they left it (kept in this tab's session
  storage for the round trip), told in a toast ("GitHub is connected. Finish the rule and save it.", or the failure's
  line). The hash is dropped for anyone who opens it; only an Editor's scope opens the screen.
- **Who**: the screen is an Editor's already; connecting, choosing and disconnecting are a signed-in Editor's of the
  whole plan (the api refuses anyone else `github_needs_editor`, shown as "Only an Editor signed in can connect
  GitHub"). A guest reaches the screen only through sign-in.
- On a phone the view fills the sheet and its buttons stack.

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
with what is missing. So does a **Link Cards** step whose chosen card has since been deleted.

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
| **Change Card Type**            | sets the card's type to one of the plan's card types (its column must suit the new type)          |
| **Set Colour**                  | sets the card's Colour to one of the standard colours, or none                                    |
| **Restore From Archive**        | brings an archived card back                                                                      |
| **Copy Card**                   | adds a copy of the card (its type, title and fields), in its column or a chosen one               |
| **Add a Checklist**             | adds 1 to 20 unticked items (values allowed) to the card's checklist; an item already on it, by   |
|                                 | its text, is not added twice                                                                      |
| **Link Cards**                  | points one of the card's Card fields (a Blocked By field too) at a chosen card, or, in a branch,  |
|                                 | at the card that started the rule; a field of several cards gains it, a single one is replaced    |
| **Mention Someone**             | starts a thread on the card that @mentions the assignee, whoever triggered it or a chosen person, |
|                                 | with a short message (values allowed); it reaches their Inbox and their mention email             |
| **Resolve Threads**             | resolves every open comment thread on the card                                                    |
| **Wait**                        | holds the rest of the rule for 1 hour to 30 days (below)                                          |
| **For Related Cards**           | a branch: runs its own conditions and actions on each related card (below)                        |
| **Summarise Card** (AI)         | writes a short plain-text summary of the card to a comment, or to a text field (below)            |
| **Suggest Card Type** (AI)      | picks one of the plan's card types from the card's text, and sets it or comments the suggestion   |
| **Triage** (AI)                 | sets the priority and adds up to 3 of the plan's labels, from the card's text                     |

### Wait

**Wait** holds the rest of the rule: the steps before it act now, the steps after it act when the time is up. It is a
step of the rule's top level only (never inside an If / Else or a branch), at most 3 a rule, and holds for **1 hour to
30 days**, in days and hours ("Wait 2 days", "Wait 1 day 4 hours").

- **When the time is up** the rule reads the card again and checks its conditions again: if they no longer hold
  (the card moved on, someone took it), it stops there, a **No Match** run "Its conditions no longer hold after the
  wait". Otherwise the steps after the Wait run, as a run of their own in the Audit Trail ("After waiting 2 days"),
  counting toward the plan's 1,000 a day.
- **What stops a waiting run**: the rule turned off (or paused), deleted or saved with changes, at once (Skipped, "The
  rule changed while this run waited"; turning it on again does not bring the run back), the card deleted or trashed (Skipped, "The card is gone"). Archiving the card does not. A run
  whose time comes once the plan's 1,000 runs for the day are spent goes no further either (Skipped, "Daily limit
  reached: rules run again tomorrow"), so it never shows Waiting past its time.
- **At most 500 runs wait** in a plan at once: past that, a Wait fails its run, "Too many runs are waiting in this
  plan".
- A waiting run shows in the Audit Trail as **Waiting** (a pill of its own) with when it goes on ("Goes on Mon 14
  Nov, 9:00"), until it does. A time is the rule's time zone; it goes on at the first wake after its time, never
  early.
- **Test on a Card** does not wait: it shows "Would wait 2 days, then:" and the steps after.
- The engine holds each waiting run in the plan room's storage (the rule, the card, the step it waits at, the
  rule's version, when it goes on), and the room's alarm wakes for the earliest, as it does for time triggers.

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
- An action the card refuses (a column its type leaves out, a required field missing, a field gone from the plan,
  the plan full) fails that step: the run stops there and is **Failed** with the reason; the steps before it stay done.
- Every change a run makes lands as **one write per card** where it can (the step's changes to the triggering card
  are batched into one patch, in step order), so the card's history reads as one entry and the board moves once.

## AI actions

**Summarise Card**, **Suggest Card Type** and **Triage** are the rule's **AI actions**: each asks a language model one
question about the card and writes what it answers, constrained, as Automation. They sit in Add Action under their
own heading, **AI** ("100 a day per plan"), with a sparkle, and each panel says "Uses AI: counts toward this plan's
100 AI steps a day" (the step's card in the rule: "Uses AI: counts toward 100 a day").

### What each does

- **Summarise Card** writes a summary of at most **600 characters**, plain text, of the card's title, description,
  checklist, latest comments and its own text fields. It is in English unless the card's own text is plainly written
  in one other language, which it then uses; a short or mixed card is summarised in English, never in a language the card
  doesn't use. **Where It Goes**: **A Comment** (the default: a new thread by Automation) or one of
  the plan's custom Text and Long Text fields, by name (the field is set; a card whose type lacks it fails the
  step "A Bug card has no Notes").
- **Suggest Card Type** picks one of the plan's card types. **With the Suggestion**: **Set the Card Type** (the
  default; a type the card already has is "Already so") or **Comment the Suggestion** ("Suggested card type: Bug"). The
  model chooses only from the list it is given: anything else fails the step, "The AI picked a card type the plan
  doesn't have".
- **Triage** sets the **priority** (Urgent, High, Medium, Low) and adds **labels**, at most **3**, chosen only from the
  labels the plan's cards already use. Its panel's **What It Sets** has **Priority** and **Up to 3 Labels**, both on to
  start, at least one on. A label the model makes up is dropped, never added; a priority outside the four fails the step. A card
  whose type has no Priority (or no Labels) fails the step for that part, "A Note card has no Priority".

### How a step runs

- An AI action stands at the rule's **top level**: never inside an If / Else or a branch (`automation_step_unsupported`),
  since a branch would cost one call per related card. A rule holds at most **3** AI actions; each counts as one of
  the rule's 20 actions.
- It runs **after the run's card writes**, in step order, each one call, and reads the card as those writes left it;
  the run's outgoing messages go after. Its own writes are one more write each, by Automation.
- Its outcome is the step's line in the Audit Trail with the sparkle: "Summarised the card into a comment", "Set the
  card type to Bug", "Set priority High, added labels billing, urgent". A step that fails fails the run with its
  reason, as any action does, after the steps before it landed:
  - no model here (a self-hosted copy with no `AI` binding): "AI isn't set up here". Local `wrangler dev` reaches the
    real Workers AI through the developer's wrangler sign-in (the binding is always remote), so local runs spend that
    account's Neurons within the same 100 a day; signed out, they fail "The AI couldn't answer";
  - the model errs or is out of its limit: "The AI couldn't answer: try again later";
  - no answer within **15 seconds**: "The AI took too long to answer";
  - a reply that is not the JSON asked for: "The AI's reply couldn't be read"; one that breaks a constraint, its own
    reason (above).
- **Test on a Card** calls nothing and costs nothing: its line says what the step would do, "Would summarise the card
  into a comment", "Would suggest a card type from Bug, Task or Story and set it", "Would set priority and add labels
  from billing, urgent and 3 more".
- **Time triggers** may use AI actions; each card's step counts toward the day's 100 like any other.

### The daily cap

- A plan makes at most **100 AI calls a day** (UTC), whichever rules make them (`AUTOMATION_AI_PER_DAY`). Every call
  counts, whatever it answered; Test on a Card and a step that never called (no model, the cap) count nothing.
- Past it, the step is **skipped**: its line says "This plan has used its 100 AI steps today", nothing is asked, and
  the run is **Skipped** with that reason when nothing else failed. A skipped run never counts toward pausing.
- The day's count is read from the Audit Trail (each called step's line is marked), once per wake.

### The model and what it is sent

- The model is Cloudflare **Workers AI**, `@cf/google/gemma-4-26b-a4b-it`, through the api Worker's `AI` binding: no
  API key, no secret, no other service. Its thinking mode is off, its temperature 0, and its reply is JSON to a
  schema (JSON mode). Workers AI keeps no prompts or replies (the model is listed with zero data retention).
- It is sent, as data in one JSON object: the card's **title** (up to 200 characters), **description** (up to 2,000),
  **card type** and **column** names, **checklist** (up to 20 rows of 120 characters, each with its tick), and its
  **latest 5 comments** (up to 400 characters each, text only) on threads this plan holds, and up to 5 of its card
  type's filled **Text, Long Text, Choice and Multiple Choice** fields by name (up to 400 characters each; never a
  Link, Email, Phone or Person field); for Suggest Card Type the
  plan's card type names, for Triage the four priorities and up to 50 of the labels its cards use, the most used first.
- It is never sent a person's name, email or id, another card, the plan's name, a link, or anything about the plan
  beyond those lists.

### Card text is data, never instructions

- The instructions are the system message, fixed in code; the card is the user message, one JSON object, and the
  instructions say to treat everything inside it as data and never follow it. A card that says "ignore your
  instructions" is just text to summarise.
- Every answer is constrained before it is written, so a reply steered by a card can do nothing a rule could not:
  a card type from the list, a priority from the four, labels from the plan's own, a summary cut to 600 characters, as
  plain text (markup stripped, any link the card didn't hold removed). The model never names a field, a person, a
  column or another card, and its text is never read as a value.

### How it is marked

- A comment an AI action writes is by **Automation** with the rule's name, and carries **Generated by AI** under it,
  as an agent's comment does.
- Its card changes read in History by Automation with the sparkle ("Edited by AI"), history tag `automation_ai`, and a
  field it set shows **Set by Automation**.

### Cost

Workers AI bills in Neurons ([pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/), Oct 2026): the
account has **10,000 Neurons a day free**; past that, on the Workers Paid plan, **$0.011 per 1,000 Neurons**. The model
costs **9,091 Neurons per million input tokens** and **27,273 per million output tokens** ($0.10 and $0.30 per million).
The prompt sizes are measured (`ai-steps.test.ts`, "measures the prompt sizes": the messages and the JSON schema, a
card at every cap with 50 card types, 50 labels and five filled text fields, and a typical card), tokens taken as four characters each:

| Step              | Input, worst card        | Output cap | Neurons, worst | Cost, worst | Input, typical | Neurons, typical |
| ----------------- | ------------------------ | ---------- | -------------- | ----------- | -------------- | ---------------- |
| Summarise Card    | 10,537 chars, 2,634 tok. | 300 tokens | 32.1           | $0.00035    | 285 tokens     | about 5          |
| Suggest Card Type | 11,701 chars, 2,925 tok. | 40 tokens  | 27.7           | $0.00030    | 628 tokens     | about 6          |
| Triage            | 12,092 chars, 3,023 tok. | 80 tokens  | 29.7           | $0.00033    | 726 tokens     | about 7          |

- **One plan at its cap**: 100 steps of the dearest kind, about **3,210 Neurons a day**, a third of the free
  allowance; all paid, $0.035 a day.
- **N plans at their caps**: N × 3,210 Neurons a day, so about **3 plans** fit in the free allowance; past it,
  (N × 3,210 − 10,000) × $0.011 / 1,000 a day: 10 plans **$0.24**, 100 plans **$3.42** (about $103 a month), 1,000
  plans **$35.20** (about $1,056 a month). Typical cards cost about a quarter of that.
- **The account-wide ceiling** is the owner's: paid usage is their decision. An optional `AI_GATEWAY` variable sends
  every call through that [AI Gateway](https://developers.cloudflare.com/ai-gateway/features/spend-limits/), whose
  **spend limit** (say $1 a day for the whole gateway) blocks calls past it with a 429, which a step reads as "The AI
  couldn't answer: try again later". The hosted app sets it to `liveplanner`, a gateway with log collection off (card
  text stays out of its logs), no cache or retries, and a fixed one-day spend limit. On the Workers Free plan, calls
  stop on their own past the 10,000 free Neurons.

## Describe a Rule

An Editor can say what a rule should do in their own words ("When a bug moves to Done, comment Fixed and flag it")
and get the rule drafted for them, open in the builder, unsaved and off, to check, test and save (Work Item 759). It is
the same model as the AI actions, asked a different question: never a rule that saves or runs itself.

### Where it starts

- **New Rule**'s menu gains a third row, **Describe a Rule**, with the sparkle, after Start From a Template. The
  Rules list's empty state gains **Describe a Rule** beside New Rule. With the plan at its 50 rules both are disabled,
  as New Rule is.
- It opens the **Describe a Rule** dialog (a sheet on a phone): the line "Say when the rule should run and what it
  should do. You check it before anything is saved.", a text box ("When a card moves to Done, set Completed On to
  today and remove the blocked label"), its count ("120 / 500"), three example chips that fill the box (**Stamp Done
  Cards**, **Welcome Form Responses**, **Nudge Overdue Cards**), the line "Uses AI: counts toward this plan's 100 AI
  steps a day", then **Cancel** and **Draft Rule** (also Ctrl or ⌘ Enter). Draft Rule is disabled while the box is empty.
- While it drafts, the button reads **Drafting…** with a spinner and the box is read-only; Cancel stops waiting
  (the call still counts). It takes a few seconds.
- A draft opens the **builder**, filled in, unsaved and off, as a template does, with a violet note under its header:
  the sparkle, **Drafted by AI** and "Check each step, then Test on a Card. Nothing is saved or turned on until you
  save it." What the rule names that the plan lacks is marked as any rule's is, and an outgoing step is left to **Pick
  a webhook** (the model never sees the plan's webhooks). Leaving it unsaved asks Discard Changes? as any draft does.
- What can't be drafted is said in the dialog, under the box, the text kept so it can be changed:
  - a request that is not a rule for this plan (a question, a story, anything off the subject): "That doesn't read as
    a rule for this plan. Say when it should run and what it should do, like the examples.";
  - a rule the model could not make readable, even on a second try: "Couldn't draft a rule from that. Try saying it
    another way, or start from a template.";
  - the day's AI steps spent: "This plan has used its 100 AI steps today. Try again tomorrow, or build the rule
    yourself.", or the day's drafts spent: "This plan has drafted 20 rules today. Try again tomorrow, or build the
    rule yourself.";
  - no model, or one that errs or is slow: "AI isn't set up here" or "The AI couldn't answer just now. Try again in a moment."
    The model's own words are never shown: every message is one of these, fixed in code.

### Who may

Only an **Editor of the whole plan, signed in** (in person or through their API token, not a read-only one), as for
every Automations route; anyone else is answered 403 `automations_need_editor`. Participants and Viewers never see
it. A guest sees the sign-in gate the Automations screen already shows.

### What the model is sent

- The fixed instructions (the system message), then one JSON object of data (the user message): the **request** (up
  to **500 characters**), the plan's **column** names, its **card type** names with each type's **custom field** names
  and kinds, the built-in field names, up to **30 labels** its cards use (the most used first), and the trigger,
  condition and action kinds a rule may hold with their fields and limits.
- Never a person's name, email or id, a card's title or text, a comment, a webhook, a link, the plan's name or any
  other plan. A person the request names ("assign Ana") is written as said and matched to the plan's people by name
  after the reply, as an agent's rule is ("Agents and the CLI"); one that matches nobody needs attention.

### The request is data, never instructions

- The instructions say what a rule is and that the request is a description of one, to be treated as data: never
  followed when it asks for anything else, never allowed to change the task, the format or these rules.
- The reply is JSON to a schema: either **a rule** or **not a rule** (a request off the subject, or one asking the
  model to do anything but describe a rule). Nothing else is read.
- **A rule** is then held to everything a person's rule is: `readRuleBody`'s checks and limits, names put back to the
  plan's ids, **chain off**, the saver's time zone, the name made unique. Its text (a comment, an email, a mention, a
  message, a checklist item, a card title, a label, the rule's name) is cut to its limits, control characters removed, and
  any link the request didn't hold removed, so a draft can never carry a link the person didn't write.
- A reply that does not read gets **one** second ask, with the refusal's words; a second reply that does not read is
  "Couldn't draft a rule from that". Each ask is one AI call.
- Whatever the model answers, the most it can do is put an unsaved, off rule in front of the person who asked, made
  only of parts the builder offers. The route itself writes nothing but its count.

### Limits and cost

- Each ask counts as **one of the plan's 100 AI steps a day** (above), and a plan drafts at most **20 rules a day**
  (UTC) whatever their asks, so drafting can never spend the day's AI steps on its own.
- An ask has **15 seconds** and answers at most **1,500 tokens**. The ask's size is measured (`ai-draft.test.ts`,
  "measures the ask"): about **9,100 characters** (2,300 tokens) for a typical plan, **19,600** (4,900 tokens) for a
  plan past every cap, so a draft costs about **29 Neurons** typically and **86** at worst (twice that with its second
  ask). One plan drafting its 20 a day, every one asked twice at the worst, is about **3,400 Neurons** a day, a third
  of the account's free 10,000; past the free allowance that is about $0.04 a day.
- Telemetry: `UI · Opened · AutomationDescribe` (the dialog), `Plan · Created · AutomationDraft` (a draft opened in
  the builder), and from the api `Plan · Ran · AutomationAiDraft` for each ask and `Plan · Ran · AutomationAiOffTopic`
  for a request that was not a rule. The api logs `[automations] draft` with the answer (drafted, off topic,
  unreadable, capped, failed), the asks and how long they took, never the request or the reply.

## Values

Text a rule writes (a comment, a title, a field value, an email) can hold values, picked from **Insert a Value** in
the builder and shown there as chips. **Insert a Value** is a button inside the field itself, at its top right (a
`{ }` mark with the hover card "Insert a Value", a pointer, a 44 px target on a touch screen), never a list dumped
under it. It opens a popover beside the field (on a phone, a sheet over the step's drawer, titled **Insert a
Value**) holding a search ("Find a value") and the values in groups: **This Card** (the fixed values), **The
Triggering Card** (inside a For Related Cards branch), **Card Fields** (each field of the card by name, the old Any
Field…) and, in an Incoming Webhook rule, **Webhook Field…**, which turns the popover to a line for the path with
Insert and Back. Up and Down walk the values from the search, Enter inserts the one marked, Escape closes; typing
narrows every group, and nothing matching says so. Choosing one puts the value at the caret (over a selection) and
hands focus back to the field, the caret after the value:

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
  **No Match** is logged and costs nothing, and so do the Audit Trail's own lines, which are no rule's run (a burst's
  "Too many changes at once", a time trigger's "Ran on 100 of 340 matching cards"). Past it, triggers are dropped until the next day, the Automations screen's meter reads full, a line says "Daily limit reached: rules run again
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
about cards for you." It is drawn only for an Editor on a plan saved to an account. A badge beside it counts the
rules that are on (none on, no badge), and its name says so ("Automations, 3 on"). A rule that paused itself turns
the badge amber, or with no badge puts a small amber dot on the icon, until it is resumed or turned off. It opens the Automations screen and sends
`UI · Opened · Automations`.

### The Automations screen

A large dialog over the editor (a full-screen sheet on a phone), titled **Automations** with the line "Rules that act
on this plan's cards for you when something happens.", a **New Rule** button and Close.

Its header is the dialog hero header ([The dialog hero
header](../../../../liveworkspace/docs/specs/004-index/dialog-hero-header.md)), the start screens' band drawn for
rules: 100px tall from `sm`, a bolt as the title mark, then the title and its line, in the app's brand colours light
or dark (a themed tab's accent where the tab retints them, as for the rest of the dialog). Behind them, hidden from
screen readers and the pointer, a faint dot grid fading out toward the title, a cog rising from the bottom left and a
looping arrow from the bottom right (both at every size), and, once the header is 56rem wide only, between the line
(which stops short of it) and the header's buttons, a rule as a flow: a trigger's bolt, a condition's diamond and an
action's check joined by a line, a dashed arrow looping back over them. The bolt's ring spreads twice, motion
allowing. On a phone the header keeps its desktop look (100px, the mark, the title and its line).

- Three tabs: **Rules · n**, **Audit Trail** and **Templates**. On a phone the bar is 48 px tall, each tab a 44 px
  target with its label centred in it, the active tab's underline along the bar's foot.
- A **Runs today** meter at the right of the tabs: "142 of 1,000" (No Match runs are not counted).
- **Rules**: a search box ("Find a rule"), **All Triggers** and **On and Off** filters, then one row per rule:
  its switch, its name, its sentence (When `Card Moved` to `Done` then `Set Completed On` `Remove Label blocked`),
  **Last Run** ("4 min ago", "Never") and **This Week** ("38 runs"), counting the runs the meter counts (a No Match
  aside), and a ⋯ menu (Edit, Duplicate, Audit Trail,
  Delete). A paused rule's row is amber, with **Paused**, the reason, and **Resume**. A rule needing attention
  says what is missing. Clicking a row opens the builder.
  On a phone the filters are laid out for a thumb: the search across the full width (40 px tall, 14 px text), then
  one row of the **All Triggers** select (taking the room) and an **All / On / Off** segmented control, both 40 px
  tall, the same radius, border and brand focus ring as the search, 8 px apart.
- **Empty**: the bolt glyph, **No Rules Yet**, "A rule watches this plan and does the routine steps for you:
  moving, assigning, labelling and telling people about cards. Start from one below or build your own.", **New
  Rule** and **How Rules Work** (the help article), then **Start From a Template** with the gallery below.
- **Templates** (the tab, and under the empty state): category chips **All**, **Status**, **Assigning**, **Due
  Dates**, **Forms**, **Telling People** and **AI**, then a tile per template: a small picture of the rule at work on a
  board, in the template's colour, then its name, its sentence and its category. The picture shows the moment before
  the rule acts (a card in Review, an empty assignee); hovering or focusing the tile plays it (the card slides into
  Done and is stamped with the date, an avatar drops onto the card), and leaving it plays back. It is decoration,
  hidden from screen readers. With reduced motion, or on a touch screen, it shows the moment after, still. The tile
  lifts a little on hover:

  | Template                       | Does                                                                                        | Category       |
  | ------------------------------ | ------------------------------------------------------------------------------------------- | -------------- |
  | Stamp the Finish Date          | When a card moves to a done column, set Completed On to today and clear its flag.           | Status         |
  | Assign on Start                | When a card moves to In Progress with no assignee, assign whoever moved it.                 | Assigning      |
  | Overdue Nudge                  | Every weekday at 9:00, flag overdue cards and email their assignee.                         | Due Dates      |
  | Share Out Form Responses       | When a form response lands, assign people in turn and thank the sender in a comment.        | Forms          |
  | Post Shipped Work to Slack     | When a card with a chosen label moves to Done, post its title and link to a channel.        | Telling People |
  | Triage New Bugs                | When a Bug card is added, label it triage and assign the people on triage in turn.          | Assigning      |
  | Unblock the Next Card          | When a card is done, comment on every card it was blocking that it can start.               | Status         |
  | Due Soon Reminder              | Two days before a card is due, email its assignee with a link to the card.                  | Due Dates      |
  | Clean Up Done                  | Every Monday at 9:00, archive cards that have been done for more than 14 days.              | Status         |
  | Escalate Urgent Work           | When a card's priority becomes Urgent, flag it, email its assignee and post to Slack.       | Telling People |
  | Reopen on New Comment          | When someone comments on a done card, move it back to In Progress and flag it.              | Status         |
  | Route Reviews                  | When a card moves to Review, assign reviewers in turn and say it is ready for them.         | Assigning      |
  | Give It a Due Date             | When a card moves to In Progress with no due date, set it due a week from today.            | Due Dates      |
  | Flag Blocked Cards             | When a card gets the blocked label, flag it and ask in a comment what it waits on.          | Status         |
  | Verify the Fix                 | When a Bug card is done, add a Verify Fix card to its first column to check it.             | Status         |
  | Back to the Backlog            | When a card moves back to a to-do column, unassign it and clear its due date.               | Assigning      |
  | Sort Incoming Cards            | When a card is added, AI suggests its card type and sets its priority and labels.           | AI             |
  | Summarise Form Requests        | When a form response lands, AI summarises it in a comment and sets its priority and labels. | AI             |
  | Close the Parent               | When the last of a card’s children is done, move the card to Done too.                      | Status         |
  | Tell Them It’s Unblocked       | When the last card blocking a card is done, mention its assignee so they can start.         | Telling People |
  | Nudge Stuck Cards              | Each morning, flag cards that have not changed for 5 days and ask for an update.            | Telling People |
  | Done When Feedback Is Resolved | When the last comment thread on a card in Review is resolved, move it to Done.              | Status         |

  Picking one opens the builder filled in, unsaved and off, named after it (made unique). What the plan has is
  filled in by its role (its done columns, its In Progress column, a column named like Review, a date field named like
  Completed On, a Bug type, its first to-do column); what it lacks or the template leaves to you (a label, the people in turn, a Slack webhook) is left empty,
  its step marked "Pick a field" (or a label, people, a webhook) until picked. Nothing is saved until **Save Rule**.
  **New Rule** is a menu: **Blank Rule** (the builder, empty), **Start From a Template** (the Templates tab) and
  **Describe a Rule** ([Describe a Rule](#describe-a-rule)). With
  the plan at its 50 rules the tiles show but don't open.

- **Audit Trail**: filters **All Rules**, **Any Result** and **Last 7 Days**, the line "Kept for 30 days or the last
  2,000 runs, and the last 500 No Matches" (No Matches are kept apart, so they never push a run out), and one row per run: When, Rule, Card (`#48` and title), Result (**Done**, **No Match**, **Skipped**,
  **Failed** pills), Took. A row opens to its steps, one line each with a tick or a cross: who did what (the
  trigger), each condition with what it found, each action, and **Open Card**. A failed or skipped row shows its
  reason under it.
- On a phone the rows stack (name, sentence, last run and week on one line, the switch at the right) and the
  dialog fills the screen.

#### Motion

Nothing on the screen jumps: every change of view moves, within the motion budget
([motion.md](../004-interface-design/motion.md): 250ms at most, cascades included), and with reduced motion it simply
appears.

- **Tabs**: the active tab's underline slides to the one picked (`short`), and the new tab's content fades in.
- **Rules list, Audit Trail and Templates**: rows and tiles cascade in (the shared row cascade) when the tab opens or
  a filter or chip changes; a template tile lifts on hover (`micro`, the hover ceiling). The picture on a template
  tile or a picker's tile (Add an Action, Pick a Trigger) is a content illustration, not chrome: its durations live
  in `automation-scenes.css`, at its own pace ([motion.md](../004-interface-design/motion.md) "Where durations live").
- **List to builder and back**: the builder slides in from the right, and the list comes back from the left, as a
  drill-in view does.
- **In the builder**: a new step rises into place where it lands; the step panel slides in when a step is picked,
  and its contents fade across when another step is picked.
- **Add an Action**: the picker opens as every dialog does, its tiles cascade in, and the search narrows them in
  place.

### The rule builder

Opening a rule (or New Rule) swaps the screen to its builder: a breadcrumb back to **Automations**, the rule's name
(editable in place), its On / Off chip, "Edited by … · when", **Test on a Card** and **Save Rule**.

- The rule reads top to bottom as cards joined by a line: **When** (the trigger), **If all of these** (the
  conditions), then one **Then** card per action, each with its icon. Under them: **+ Add Action**, **+ Add
  Condition**, **+ If / Else** and **+ For Related Cards**. A branch is a card ("For each **Blocked By Card**") with
  its own conditions and actions inset beneath it.
- **+ Add Action** opens the **Add an Action** picker, a dialog (a sheet on a phone) rather than a long menu: the
  dialog hero header (a card with a plus as its mark; a tag, a flag and, on a wide header, a hand of action tiles
  fanned out, the one in front lifted with the accent's plus), then a search box ("Find an action"), then the actions in groups, each a tile drawn as the template tiles are: a small
  picture of the action at work on a card, in its group's colour (a label dropping onto the card, the card sliding to
  the next column, a message landing in a Slack channel), which plays on hover or focus as a template's does, then
  the step's own icon, its name and a line on what it does:

  | Group           | Actions                                                              |
  | --------------- | -------------------------------------------------------------------- |
  | **Cards**       | Move to Column, Set Field, Clear Field, Change Card Type, Set Colour |
  | **New Cards**   | Create Card, Copy Card                                               |
  | **Archive**     | Archive, Restore From Archive                                        |
  | **Labels**      | Add Label, Remove Label                                              |
  | **Flags**       | Flag, Unflag                                                         |
  | **Checklists**  | Add a Checklist                                                      |
  | **Links**       | Link Cards                                                           |
  | **People**      | Assign, Mention Someone, Send Email                                  |
  | **Comments**    | Add Comment, Resolve Threads                                         |
  | **Timing**      | Wait                                                                 |
  | **Other Tools** | Send to Webhook, Post to Slack, Post to Microsoft Teams              |
  | **AI**          | Summarise Card, Suggest Card Type, Triage ("100 a day per plan")     |

  Each group is one thing, named in a word or two, never two things joined by "and".

  From `sm` the groups are also a rail at the left (**All** first) that scrolls to its group; on a phone they are
  chips above the tiles. Timing, Other Tools and AI show at the rule's top level only, and in a branch Create Card and Copy Card are
  left out. A group the rule has filled (5 outgoing actions, 3 AI actions, 3 Waits) stays, its tiles dimmed with
  why ("A rule holds up to 5 outgoing actions"). Typing narrows the tiles across every group by name and line ("No
  actions match", with **Clear Search**); the arrow keys move between tiles and Enter adds the one in focus. Picking a
  tile closes the picker and adds the step, selected, as the menu did.

- The **When** panel opens on its **Trigger** field: the trigger's icon, name and what it hears, and **Change**,
  which opens the **Pick a Trigger** picker, drawn as the Add an Action picker is (the dialog hero header with the
  Automations screen's art and bolt, search "Find a trigger", the rail or chips, tiles with a picture that plays on hover), in three
  groups, each one thing: **Cards** (Card Created, Form Response, Card Moved, Field Changed, Card Archived, Card
  Restored, Checklist Completed, Column Over Limit, Run from a Card), **Comments** (Comment Added, All Threads
  Resolved, Someone Mentioned), **Links** (Card Unblocked, Related Cards Done), **Times** (Scheduled, Due In,
  Overdue, Card Stuck), **GitHub** (Pull Request Opened, Pull Request Merged, Pull Request Closed, Checks Finished;
  only where GitHub is set up, or for a rule already on one, its heading noted "Not Connected" while the plan is not) and **Other
  Tools** (Incoming Webhook).
  The current trigger is marked **Current**; picking another starts that trigger afresh.
- An action's step panel opens on its **Action** field: the action's icon and name and **Change**, which opens the same
  picker, titled **Change the Action**, offering what the step can become (the plain actions: every group but Timing, Other Tools and AI), the
  current one marked **Current**. Picking another starts that kind afresh, as before; picking the current one changes
  nothing.
  An outgoing step's **Change** opens the picker on **Other Tools** alone (Webhook, Slack, Teams), keeping its
  message.
- Picking a card selects it (a violet ring) and opens it on the right in the **step panel**: its own fields (columns,
  fields, people and types picked from the plan's), and for text, the **Insert a Value** button in the field that drops a value at the
  caret, shown as violet chips. An action's panel shows a **Preview** on a real card of the plan, filled in. A pick
  the plan no longer has (a deleted column, Form tab, field, card type or person) stays shown, as "A column no longer
  here" (or "Someone No Longer Here" for a person), picked, so the panel never hides what the rule holds or shows
  another choice in its place, and it can be unpicked.
- A step's ⋯ menu: Move Up, Move Down, Duplicate, Delete.
- **Rule Details** (an accordion, closed): **Let this rule's changes trigger other rules** with "Off keeps rules
  from setting each other off. Chains stop after 5 rules.", and "Runs as Automation, with an Editor's access, for
  changes anyone with edit or participate access makes."
- **Test on a Card** picks a card (the card finder) and runs the rule as it stands in the builder, unsaved, without
  changing anything: the result shows as an Audit Trail row with its steps, each action saying what it would do.
- Leaving with unsaved changes asks **Discard Changes?**. A save the api refuses keeps the builder open and marks
  the step at fault.
- A rule opened by its link (an Automation comment's) that the plan no longer has opens no builder: the screen says
  **This Rule Was Deleted**, "It's no longer in this plan. Its runs stay in the Audit Trail until they age out.", with
  **Back to Rules**.

#### The rule builder on a phone

Below 640 px (a phone, and a window that narrow) the builder is drawers, not a swapped screen; from 640 px it is as
above, unchanged.

- **The rule drawer.** New Rule, a template, Describe a Rule's draft and opening a rule raise the builder as a sheet
  over the Automations screen (which stays behind it, dimmed), as tall as a sheet goes, with the grab handle, the
  safe area at its foot, its middle scrolling between a fixed top and foot. Swiping it down, tapping the dim behind
  it or Escape goes back to the rules; with unsaved changes each asks **Discard Changes?** first, and the drawer
  springs back while it asks, so no edit is lost silently.
- **Its header.** A top row of a back chevron ("Automations", a 44 px target, back to the rules) and the rule's
  state at the right: the On / Off switch with its word beside it ("On", "Off"), or an **Off** pill ("Not Saved")
  for a rule not saved yet. Under it the rule's name as an editable title on its own line, 18 px semibold, wrapping
  to as many lines as it needs (Enter does not break it), then "Edited by … · when" in small type.
- **Its foot**, pinned to the bottom over the safe area: **Rule Details** as a closed bar (its accordion, opening
  upward over the steps, its body scrolling when tall), then **Test on a Card** and **Save Rule** side by side, equal
  width, 44 px tall. A saved rule with nothing changed reads **Saved** with a tick, so the button says why it
  does nothing, instead of a faded Save Rule.
- **The step drawer.** Picking a step (the When trigger, an If condition, an action, a branch, a Wait, every kind)
  or adding one (a Duplicate too) opens its fields in a second sheet stacked over the rule drawer, not under the steps
  (Move Up and Move Down leave it closed, the steps in sight): its own grab
  handle, the step's tile and name as its title, a close and a **Done** at its foot, its fields scrolling inside.
  Swipe it down, tap the dim behind it, press Escape, close or Done to go back to the steps; the step stays
  selected. It sits above the on-screen keyboard rather than jumping under it. A save the api refuses opens the
  step at fault in it, the refusal's words at the top of its fields (the step's card, which says them, is behind it).
- Every drawer slides out to the bottom as it closes ([editor-app.md](../007-editor/editor-app.md) "Menus are
  bottom sheets on a phone").

### On cards

- A change Automation made reads in the card's **History** with the bolt glyph: "**Automation** set Completed On to
  11 Nov 2026 · Done Means Wrapped Up · 10:42" ([History](items.md#history)), and a field whose latest change in
  the history read was a rule's shows a small **Set by Automation** chip beside its value in the item panel.
- A comment Automation added shows the bolt avatar, **Automation** and the rule's name (a link to the rule for an
  Editor), on a violet-tinted card. It is not Generated by AI, unless an AI action wrote it ("AI actions").
- The card's ⋯ menu offers **Run Rule** (an Editor's, when at least one Run from a Card rule is on), a submenu headed
  "Rules You Can Run Here" listing them, then **Manage Automations**. Running one says "Ran Escalate to Leads" or the
  failure, as a toast.

## Agents and the CLI

An agent (an MCP client, the `liveplanner` CLI, a script with an API token) reads and works a plan's rules through
the same routes the Automations screen uses, as the token's person and within what that person may do ("Who may do
what"). The two front doors are one engine (`@liveplanner/agent-verbs`), so they answer the same and refuse in the
same words.

### The MCP tools

- **`list_rules`** (read) takes a `projectId` and answers every rule in the plan's order: its id, name, whether it
  is on, **paused** (with the reason) and **needs attention** (what it names that the plan lacks), its trigger kind,
  its **sentence** (the Rules list's, in words: "When Card Moved to Done then Add Label shipped"), **last run**,
  **runs this week** and, for a time trigger, its **next run** (ISO times), then the day's runs and the day's limit.
  An optional `rule` (an id or the exact name) also answers that rule's whole body, in the format `change_rules`
  writes; `runs: true` also answers the recent Audit Trail, newest first (that rule's alone when `rule` is given;
  `limit` 1 to 50, 20 by default), each run with its card (`#12 Title`), when, its result, its reason and its step
  lines as the Audit Trail shows them.
- **`change_rules`** (destructive, as it deletes rules) applies up to 20 changes in order, each seeing the ones
  before it, a refused change stopping the rest and saying what was applied before it (as `change_items`):
  - `add {rule}`: a new rule from a whole body. It starts off until it has a trigger and an action, then on, as
    the builder's first save.
  - `set {rule, name?, trigger?, conditions?, steps?, chain?, timeZone?}`: the rule `rule` names, each part given
    replacing the saved one whole, the rest kept. A save that leaves no action turns it off.
  - `on {rule}`, `off {rule}`: turn it on (which resumes a paused rule) or off.
  - `duplicate {rule}`: a copy, "<name> copy", off.
  - `delete {rule}`: deletes it; its runs stay in the Audit Trail until they age out.
  - `test {rule, card}`: runs the saved rule (or a whole body given in place of its name) on the card as Test on a
    Card does, changing nothing and logging nothing, and answers the run with each action saying what it would do.
  - `run {rule, card}`: runs a **Run from a Card** rule that is on, on the card, now, as Run Rule does, and answers
    the run (the day's limit applies).
- A rule is named by its **id** or its **exact name** (case aside); a name matching none is refused with the rules
  there are. A card is named as `list_items` names it (`#12`).
- **The rule body** is the api's (`AutomationRuleBody`), described in full in the tool's input, so the tools are the
  whole reference: `name`, `trigger`, `conditions`, `steps`, `chain` and `timeZone`, with each trigger, condition and
  action kind and its fields, the values a text may hold, and the limits. Where a body names something of the plan,
  the agent may write it as the board shows it and the engine puts in the id before it saves: a **column** by name
  ("Done") for a status, a **card type** by name ("Bug"), a **field** by its name ("Completed On", "Due"), a
  **person** by name ("Ana Costa") and a **Form tab** by its name. An id is kept as it is, and a name the plan lacks
  is kept as written, so the rule saves and its list line says it needs attention, as a rule naming something gone
  does.
- **Whose time it is**: an agent has no clock of its own, so `timeZone` (an IANA zone) is the agent's to give. Left
  out, an added rule takes `UTC` and a changed one keeps its own.
- **Refusals** answer with the api's code and, for a rule that does not read, the part at fault as the api names it
  (`steps.2.status`, `rule.trigger.at` for a test's body), with the words an agent acts on: what was wrong and the next
  call to make ("Run Rule takes only a Run from a Card rule that is on: test it with test instead"). A refusal is a
  tool error, never a protocol error.
- **Who it was**: a rule an agent adds or changes is stamped with the token's person as **Made by** or **Edited by**,
  marked as an agent's (`ai`), and the builder reads "Edited by Ana Costa (Agent)". A Run Rule by an agent is
  triggered by the token's person as an **agent** (Who Did It's **an agent** holds), and the run's changes are
  Automation's as every rule's are. Rules' own comments stay Automation's, never Generated by AI.

### The CLI commands

The same reach, one command a change, named as the CLI's other resources are (`liveplanner rule …`, every command
taking `<project>` first, a rule by id or exact name, a card by number):

| Command                                            | Does                                                                      |
| -------------------------------------------------- | ------------------------------------------------------------------------- |
| `rule ls <project>`                                | A line a rule: id, on, off or paused, attention, last run, week, sentence |
| `rule get <project> <rule>`                        | One rule: its line, then its whole body as JSON                           |
| `rule add <project> <file>`                        | A rule from a JSON body in a file, or `-` for stdin                       |
| `rule set <project> <rule> <file>`                 | Change a rule from a JSON file (or stdin) of the parts to replace         |
| `rule on\|off\|rm\|duplicate <project> <rule>`     | Turn it on or off, delete it, copy it                                     |
| `rule test <project> <rule> <card>`                | Test on a Card: the run's lines, nothing changed                          |
| `rule run <project> <rule> <card>`                 | Run Rule: a Run from a Card rule, now                                     |
| `rule log <project> [--rule <rule>] [--limit <n>]` | The Audit Trail, newest first, a run a line with its steps beneath        |

Each prints compact lines by default and its output object with `--json`, and refuses as the tools do (the code, the
part at fault, the words, and the command to run next).

### Limits and cost

- `list_rules` and `rule ls` make two api reads (the rules and the plan, in parallel), and one more for the Audit
  Trail when asked: never a read per rule. Its sentences are worked out once per call; 50 rules list well inside a
  few milliseconds of CPU (blueprint "Agents and the CLI").
- `change_rules` makes those two reads once a call, the cards once more when a test or run names one, then one write
  a change.
- The rule limits are the plan's (Limits below): 50 rules, 20 actions, 5 outgoing actions, and so on, refused by the
  api with their codes.

## Copies, exports and deletes

- A **duplicated** plan keeps its rules, each as it was (on or off), its Audit Trail and counts empty. A plan made from
  a template has none.
- An **export** of a plan (its file) carries its rules; an import of that file brings them back off.
- A copy's tabs, and a file's once imported, take new ids, and the rules follow them: a Form Response narrowed to a
  Form tab, and a saved filter (a condition or a branch's cards), name that tab's copy.
- A copy made through a share link, of one tab, or of a Community post takes no rules: the rules are an Editor's of the
  whole plan to see.
- A rule naming a card type, column, field or person the copy lacks needs attention there (above).
- **Deleting** a plan deletes its rules, queue and Audit Trail with it.
- A **closed account** leaves the plan's rules as it leaves its cards: a rule it made or last edited reads **Made by**
  or **Edited by** Deleted account, an Audit Trail run its change started names Deleted account where it named them,
  and its triggers still queued or held by a Wait run as Deleted account's.

## Telemetry

`UI · Opened · Automations`; `Plan · Created · AutomationRule`; `Plan · Toggled · AutomationOn` /
`AutomationOff`; `Plan · Deleted · AutomationRule`; `Plan · Tested · AutomationRule`; `Plan · Ran · AutomationManual`;
`UI · Opened · AutomationTemplate.<id>`, the template's id after the dot (an event carries no value, so the id
rides in its type, from the fixed list above); `UI · Opened · AutomationsOffline` (the Browser Storage panel);
`Plan · Created · AutomationSecret` (Make Secret), `Plan · Changed · AutomationSecret` (Regenerate) and
`Plan · Copied · AutomationSecret` (Copy on the once-shown secret); `Plan · Created · AutomationRuleGithub` beside
`AutomationRule` for a new rule with a GitHub trigger, and the GitHub view's own events
([GitHub pull requests](github-pull-requests.md#telemetry)).
Agents count as every tool and command does: `Mcp · Used · ListRules` / `ChangeRules`, and `Cli · Used · RuleLs`,
`RuleGet`, `RuleAdd`, `RuleSet`, `RuleOn`, `RuleOff`, `RuleRm`, `RuleDuplicate`, `RuleTest`, `RuleRun` and `RuleLog`.
The api logs `[automations] run` with the result, the trigger's kind and the duration, never a card's text, and
`[automations] hook` with the call's answer (accepted, refused and why, rate limited) and how many runs it queued,
never the secret, a signature or the body. Each AI call sends
`Plan · Ran · AutomationAiSummarise`, `AutomationAiCardType` or `AutomationAiTriage` from the api; an AI step that
failed after it was asked also sends `Plan · Ran · AutomationAiFailed`, and one the cap skipped
`Plan · Ran · AutomationAiCapped` (the existing action, typed, so the vocabulary needs nothing new); the api logs
`[automations] ai` with the task, whether it answered and how long it took, never the card's text or the reply.

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
| Changes in one `change_rules`    | 20                                     |
| Runs `list_rules` returns        | 20 by default, up to 50                |
| AI actions per rule              | 3, at the top level                    |
| AI steps per plan per day        | 100                                    |
| An AI summary                    | 600 characters                         |
| Labels Triage adds               | 3                                      |
| An AI call                       | 15 seconds                             |
| Incoming Webhook call body       | 16 KB, JSON                            |
| Incoming Webhook calls per rule  | 60 a minute                            |
| Cards one call names             | 10                                     |
| A webhook value                  | 5 names deep, 500 characters           |

## Not yet

Rules across plans, sprints, versions and SLAs are not planned.
