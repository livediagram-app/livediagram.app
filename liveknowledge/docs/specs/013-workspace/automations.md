# Automations

Rules a knowledgebase runs on its own: when something happens, if some conditions hold, then do these steps. The
feature is the platform's, built once and the same in every app:
[Automations](../../../../liveworkspace/docs/specs/018-automations/automations.md) holds what a rule is, where rules
live and run, the limits, who may do what, the shared triggers, conditions, steps and values, Connections, Test Rule
and Run Rule. This spec holds only what this app adds: triggers and steps over what a knowledgebase knows of its pages
(who owns them, whether they are verified, what agents and Ask could not answer).

Owner, 2026-11-21: "Automations in the same way as the other apps, with polished knowledgebase-specific triggers,
steps and templates." The details below were decided by the builder and stand until the owner overturns them.

## Words

The interface never says "tab": the platform's words follow the item's ("Page Added", "Any Page", "Add a Page from a
Template", "Page Name"), from the item word `knowledgebase`
([Naming](../../../../liveworkspace/docs/specs/018-automations/automations.md#naming)). A rule's JSON, and what an
agent writes, still name a page's id in `tab`, as in every app.

## Where it is

**Automations** in the footer's **Tools** menu, where Webhooks was. The addresses a rule posts to are
**Connections**, a tab of the Automations screen
([Connections](../../../../liveworkspace/docs/specs/018-automations/automations.md#connections)).

## Share roles

| Role                                             | Automations                                                                                   |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| **Editor** of the whole knowledgebase, signed in | Everything: rules, Run Rule, Test Rule, the Audit Trail, Connections                          |
| **Participant**                                  | No Automations row (a Participant is an Editor minus Settings, Style and Automations); the    |
|                                                  | routes answer 403 `automations_need_editor`; a rule's changes read "Automation · <rule>"      |
| **Viewer**, a link visitor                       | No Automations row; the routes answer 403; a rule's changes read "Automation · <rule>"        |
| Editor through a link to one page                | No Automations row; the routes answer 403 `automations_need_editor`                           |
| A guest (an Editor link, signed out)             | The row opens to **Sign In**                                                                  |
| An agent (an API token) of an Editor             | With the **write** scope: lists, adds, changes, tests and runs rules; no secrets, connections |
|                                                  | or Revert to Snapshot. With read and suggest (the default): lists rules and the Audit Trail;  |
|                                                  | a change answers 403 `scope_needed` naming `write`                                            |

A knowledgebase kept **Offline** offers **Sync Knowledgebase** first: it has no rules until it is stored.

## Triggers of its own

Beside the shared ones (Scheduled, Run by Hand, Incoming Webhook, Page Added, Page Removed, Edited, Then Quiet, Not
Edited For, Snapshot Taken, Someone Joined, Access Requested, and the comment and action triggers):

The comment triggers hear the notes in a page's margin. The comments at a page's foot are not heard yet: Comment Added
starts for neither those nor their replies.

| Trigger                      | Group        | Starts when                                                                               | Picks             |
| ---------------------------- | ------------ | ----------------------------------------------------------------------------------------- | ----------------- |
| **Page Verified**            | Trust        | someone verifies a page ([Verification](../030-knowledgebase/verification.md))            | a page (optional) |
| **Review Due**               | Trust        | a verified page's review comes due (verified + the Review Period); once per review        | a page (optional) |
| **Page Owner Changed**       | Trust        | someone gives a page a new owner, or takes its owner away                                 | a page (optional) |
| **Unanswered Question**      | AI Knowledge | a question nobody's pages answer is asked for the first time (Ask, an agent's search      | nothing           |
|                              |              | that found nothing, `report_gap`); like questions are one                                 |                   |
| **Pages Disagree**           | AI Knowledge | the conflict check finds a new pair of pages stating opposite facts                       | a page (optional) |
| **Agent Suggested a Change** | AI Knowledge | an agent with the suggest scope suggests an edit to a page                                | a page (optional) |
| **Agent Made Changes**       | AI Knowledge | an agent (an API token) writes a page: `create_page`, `write_page`, a changeset           | a page (optional) |
| **Version Named**            | Versions     | someone names a version of a page ([Version history](../006-document/version-history.md)) | a page (optional) |
| **Version Restored**         | Versions     | someone restores a page to an earlier version                                             | a page (optional) |

- **Review Due** has nobody behind it. The room checks with the review emails' check (the alarm that wakes when the
  next review comes due) whether the Knowledgebase Reviews emails are on or not, and only while a rule that is on
  hears it. A page is told of once for each verification (`knowledge_email_marks` kind `rule-review`, keyed by the
  page, holding its `verifiedAt`); the first check after this shipped, or after the first such rule, marks every page
  already due without starting a rule, so a new rule never fires for a backlog.
- **Page Owner Changed** is heard from Page Health's owner change and from Verify when it gives an ownerless page its
  verifier as owner. A page's first owner set by the save that makes it is Page Added's, not this.
- **Pages Disagree** runs once per pair (a pair known before is never new). Its page is the one whose save or verify
  started the check; `{{other.name}}` is the other.
- **Unanswered Question** runs once per group of like questions, when the group is first logged; a group dismissed
  and asked again is new.
- **Agent Suggested a Change**'s `{{person}}` is the agent's name and `{{suggestion.reason}}` its reason.
- A verify, an owner change or an Always in Context change is never an edit: it starts no Edited, Then Quiet rule.

## Steps of its own

| Step                                          | Group        | Does                                                                                     |
| --------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------- |
| **Set the Page Owner**                        | Trust        | makes a person, or whoever started the rule, the owner of a page (the run's or a chosen) |
| **Clear Verification**                        | Trust        | takes a page's verification away, so it reads Not Verified until someone verifies it     |
| **Email the Page Owner**                      | Trust        | emails the run's page's owner, values allowed                                            |
| **Add to Always in Context** / **Remove ...** | AI Knowledge | puts a page in, or takes it out of, the pages every agent is handed                      |
| **Name This Version**                         | Versions     | names the current content of a page (the run's, or a chosen one), values allowed         |
| **Restore a Version**                         | Versions     | puts a chosen page back to one of its named versions, as Restore does                    |
| **Add a Page from a Template**                | Pages        | the shared step: adds a page made from a chosen template, named by the rule              |

- **Set the Page Owner** with **Whoever Started the Rule** takes the event's person: for an agent, its token's
  person. It fails "Nobody started this rule who can own a page" for a time, a call or a rule's own change, and
  "<name> can't open this knowledgebase" for someone who can no longer open it (the check Page Health makes).
- **Clear Verification** keeps the owner. It fails nothing on a page never verified ("Was not verified").
- **Email the Page Owner** goes through the platform's mailer to the owner's verified address, under the same switch
  as every rule email. A page with no owner fails the run "This page has no owner", so a rule can say so.
- **Add to Always in Context** refuses what passes the 8,000 token budget, as the row menu does ("This page is 2,400
  tokens and 7,000 of 8,000 are in use").
- Each writes the page's knowledge fields as Page Health does (one write at the revision it read, every open editor
  told), authored by the rule: it is no edit of the page's writing.
- **Verify** is not a step (decided): verifying says a person vouches for the page, and a rule cannot.

## Values of its own

| Value                   | Reads                                                                | In                                  |
| ----------------------- | -------------------------------------------------------------------- | ----------------------------------- |
| `{{page.owner}}`        | the run's page's owner, by name ("Nobody" when it has none)          | any trigger about a page            |
| `{{question}}`          | the question nobody's pages answer, or the one two pages disagree on | Unanswered Question, Pages Disagree |
| `{{other.name}}`        | the other page of a pair that disagrees                              | Pages Disagree                      |
| `{{suggestion.reason}}` | the agent's reason for its suggested edit                            | Agent Suggested a Change            |
| `{{version.name}}`      | the version's name                                                   | Version Named, Version Restored     |

**Summarise with AI** reads pages as Markdown, the run's page alone when the trigger is about one.

## Templates

| Template                                   | Rule                                                                                           |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| **Review Due to Slack**                    | Review Due → Post to Slack "{{tab.name}} is due for review ({{page.owner}} owns it)"           |
| **Ask the Owner to Check an Agent's Edit** | Agent Made Changes → Email the Page Owner "{{person}} changed {{tab.name}}"                    |
| **Agents' New Pages Get an Owner**         | Page Added, Who is An Agent → Set the Page Owner to Whoever Started the Rule                   |
| **A Restored Page Needs Verifying Again**  | Version Restored → Clear Verification                                                          |
| **Name a Version When Verified**           | Page Verified → Name This Version "Verified {{now.date}}"                                      |
| **Unanswered Questions to Slack**          | Unanswered Question → Post to Slack "Nobody's pages answer “{{question}}”"                     |
| **Pages That Disagree to Slack**           | Pages Disagree → Post to Slack "{{tab.name}} and {{other.name}} disagree: {{question}}"        |
| **Tell the Owner About a Suggested Edit**  | Agent Suggested a Change → Email the Page Owner "{{person}} suggested an edit to {{tab.name}}" |
| **Announce Verified Pages**                | Page Verified → Post to Slack "{{person}} verified {{tab.name}}"                               |
| **Comments to Slack**                      | Comment Added → Post to Slack "{{person}}: {{comment}}"                                        |
| **Access Requests to Slack**               | Access Requested → Post to Slack                                                               |
| **Weekly Summary by Email**                | Weekly on Friday at 16:00 → Summarise with AI → Send Email with `{{summary}}`                  |
| **Snapshot Every Month**                   | Monthly on day 1 at 09:00 → Take Snapshot "{{now.date}}"                                       |

The gallery's sections: **Keep Pages Trusted**, **AI Knowledge**, **Stay in the Loop** and **Keep It Safe**.

Considered and left out (decided): a Set the Review Period step (one setting for the whole knowledgebase, changed
rarely, and only an Editor's to change), Page Answered a Question (every Ask would start it), and "remind the owner
when a review is due" (the Pages Due for Review email already does).

## Steps in other apps

Every step of the platform's [Steps in other apps](../../../../liveworkspace/docs/specs/018-automations/automations.md#steps-in-other-apps) is in this knowledgebase's Add a Step, under **In Other Apps**:
Create a Card in a Plan, Write a Page in a Knowledgebase, Post in a Space, Add a Tab to a Document and Notify. Each
acts as the rule's author, with their rights alone, through the target app's own door; lost access pauses the rule,
and a chain stops after 3 hops or on a rule it already ran. Their values are this knowledgebase's own, as every step's.

**As a target**, a knowledgebase takes **Write a Page in a Knowledgebase**: a page under a chosen parent (or at the top), its title and Markdown body the rule's, its Owner the author, Never Verified, marked **Written by a Rule** (its hover card: the rule and its item, as the author). The page's banner says "Written by the rule <rule> in <item>. Never verified." with **Mark Verified**.

**Starter: Review Due, Add a Card for the Owner**: Review Due, then Create a Card in a Plan titled `Review {{tab.name}}`, assigned to the Page Owner, due in 7 days, linked back to the page, skipped while an open card already links to it.

## Agents

`list_rules` and `change_rules` in the MCP server and `rule` in the CLI, as the platform spec says
([Agents](../../../../liveworkspace/docs/specs/018-automations/automations.md#agents)); the tools' contract is
[MCP server](../015-api/mcp-server.md). This app's own kinds are in the format; a Restore a Version step names one of
a page's named versions by its id, and a Set the Page Owner step a person by id or name.

- **What an API token may do**: list rules and the Audit Trail with any scope, and add, change, turn on and off,
  duplicate, delete, test and run them with the **write** scope, when its person is an Editor of the whole
  knowledgebase. It never saves a rule holding Revert to Snapshot, never reads an Incoming Webhook's secret, and adds
  no connection.

## The screen

The platform's screen, as every item's is ([ui.md](../../../../liveworkspace/docs/specs/018-automations/blueprints/ui.md)),
over this app's kinds, with pictures of its own in the pickers: a page gaining the green tick (Page Verified), an
amber Review Due pill sliding in (Review Due), an owner's avatar swapping (Page Owner Changed, Set the Page Owner), a
question with no answer under it (Unanswered Question), two pages with opposite lines (Pages Disagree), an agent's
sparkle over a page of removed and added lines (Agent Suggested a Change), the tick lifting off (Clear Verification),
an envelope to the owner (Email the Page Owner), and a page joining a stack the agent reads (Always in Context).

- Which AI ([ai-keys.md "In the apps"](../../../../liveworkspace/docs/specs/003-accounts/ai-keys.md#in-the-apps)): Describe a Rule runs on the person's own key, or the knowledgebase's team's, when one applies, else built-in AI, and its dialog shows the source line with Try an Example above the box; Summarise with AI always runs on built-in AI, and its panel says so.
- Describe a Rule offers examples a knowledgebase fits ("Tell Slack when a page is due for review", "Email the owner
  when an agent changes their page", "Post unanswered questions to Slack").
- The empty state's **How Rules Work** opens the help centre's Automations article (`/help/tools/automations`).

## Where a rule's change shows

A snapshot or a version a rule made reads "Automation · <rule>", as the platform's do. A page whose owner, verification
or Always in Context a rule changed shows the change as Page Health shows any: the rule is not named there.

## Unsubscribing

The link in a rule's email to a typed-in address opens `/email-optout?d=<documentId>&t=<token>`: what unsubscribing
does and one **Unsubscribe** button, which posts to the api's door. Opening the page sends nothing.

## Telemetry

Category `Document`, the platform's event names ([Telemetry](../017-telemetry/telemetry.md)). The editor sends
`UI·Opened` `Automations` (and `AutomationsOffline`, `AutomationsSignIn` for the gates, `AutomationDescribe`,
`AutomationTemplate.<id>`), and under `Document`: Created `AutomationRule` / `AutomationDraft` / `AutomationSecret`,
Changed and Copied `AutomationSecret`, Toggled `AutomationOn` / `AutomationOff`, Deleted `AutomationRule`, Tested
`AutomationRule` and Ran `AutomationManual` (Run Rule). The room's counts go out as `Document·Ran`, one batch a wake.
liveworkspace.app's telemetry page charts them on liveknowledge's Connections tab, under Automations.

## Performance

A trigger costs its write nothing unless a rule that is on hears it: each call site asks the engine's set of heard
kinds first (one Set lookup), and reads nothing more. Measured in the blueprint ("Cost on the hot paths").
