# Automations

Rules a document runs on its own: when something happens, if some conditions hold, then do these steps. The feature is
the platform's, built once and the same in every app: [Automations](../../../../liveworkspace/docs/specs/018-automations/automations.md) holds what a rule is, where rules live
and run, the limits, who may do what, the shared triggers, conditions, steps and values, Connections, Test Rule and
Run Rule. This spec holds only what this app adds.

## Where it is

**Automations** in the footer's **Tools** menu, in the Automate group, where Webhooks was. Webhooks is gone as a tool
of its own: the addresses a rule posts to are **Connections**, a tab of the Automations screen
([Connections](../../../../liveworkspace/docs/specs/018-automations/automations.md#connections)).

## Share roles

| Role                                        | Automations                                                                               |
| ------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **Editor** of the whole document, signed in | Everything: rules, Run Rule, Test Rule, the Audit Trail, Connections                      |
| Editor through a link to one tab            | No Automations row; the routes answer 403 `automations_need_editor`                       |
| **Participant**, **Viewer**                 | No Automations row; a rule's changes read "Automation · <rule>"                           |
| A guest (an Editor link, signed out)        | The row opens to **Sign In**                                                              |
| An API token of an Editor                   | Lists, adds, changes, tests and runs rules; no secrets, connections or Revert to Snapshot |

A document kept **Offline** offers **Sync Canvas** first (the gate History's row opens too, in its words): it has no rules until it is stored. The row wears **Sign In** or **Sync Canvas** beside its name while either stands.

## Triggers of its own

Beside the shared ones (Scheduled, Run by Hand, Incoming Webhook, Tab Added, Tab Removed, Edited, Then Quiet, Not
Edited For, Snapshot Taken, Someone Joined, Access Requested, and the comment and action triggers):

| Trigger                | Starts when                                                                            | Picks            |
| ---------------------- | -------------------------------------------------------------------------------------- | ---------------- |
| **Poll Ended**         | a facilitator ends a [live poll](../012-collaboration/live-poll.md)                    | none             |
| **Question Asked**     | someone adds a note to a [Q&A board](../012-collaboration/qa-board.md)                 | a tab (optional) |
| **Agent Made Changes** | an agent (an API token, through the MCP server, the CLI or the API) changes the canvas | a tab (optional) |

- **Poll Ended** carries the question and the tally (each option and its count), never who answered what. The poll
  itself still leaves no trace on the document: only a rule someone wrote carries its result out, in that rule's own
  message.
- **Question Asked** carries the note's text. Notes are anonymous to the rule as they are on the board: Who Did It
  reads nothing.
- **Agent Made Changes** fires once per changeset, with the token's name as Who Did It.
- **Poll Ended**'s Who Did It is whoever ended the poll as the room knows them: the name on their cursor and their
  share role. The room holds no account for a session, so a chosen person never matches and an email to "whoever
  started it" has nobody to send to; email the owner, a chosen person or an address instead.
- The **comment and action triggers** are heard when the document next settles its comments for the Inbox: on idle,
  within about a minute. The threads standing when a rule is turned on start nothing; neither does anything written
  while no such rule was on.

## Steps of its own

| Step                          | Does                                                                                      |
| ----------------------------- | ----------------------------------------------------------------------------------------- |
| **Add a Tab from a Template** | adds a tab made from a chosen template, named by the rule (values allowed), last in order |

The tab is made as **New Tab** makes it from that template, and everyone with the document open sees it arrive. A
document that already holds **200** tabs fails the step ("This document has 200 tabs, the most a rule adds to"), so a
rule on a schedule never adds tabs for ever; a template that is gone fails it too.

## Values of its own

| Value               | Reads                                                        | In             |
| ------------------- | ------------------------------------------------------------ | -------------- |
| `{{poll.question}}` | the poll's question                                          | Poll Ended     |
| `{{poll.results}}`  | each option and its count, one a line, the most chosen first | Poll Ended     |
| `{{poll.answers}}`  | how many people answered                                     | Poll Ended     |
| `{{question}}`      | the note's text, its opening 500 characters                  | Question Asked |

## Templates

| Template                         | Rule                                                                                        |
| -------------------------------- | ------------------------------------------------------------------------------------------- |
| **Reset Every Night**            | Every day at 00:00 → Revert to Snapshot (pick one). For a workshop board that starts clean. |
| **Snapshot Every Friday**        | Weekly on Friday at 17:00 → Take Snapshot "Week of {{now.date}}"                            |
| **Tell Slack When This Changes** | Edited, Then Quiet (30 minutes) → Post to Slack                                             |
| **Comments to Slack**            | Comment Added → Post to Slack "{{person}}: {{comment}}"                                     |
| **Review Finished**              | All Threads Resolved → Send Email to the owner                                              |
| **A Fresh Retro Each Sprint**    | Weekly on Monday at 09:00 → Add a Tab from a Template (Retrospective) "Retro {{now.date}}"  |
| **Poll Results to Slack**        | Poll Ended → Post to Slack "{{poll.question}}" with `{{poll.results}}`                      |
| **Questions to Slack**           | Question Asked → Post to Slack                                                              |
| **Is This Still Right?**         | Not Edited For 90 days → Send Email to the owner                                            |
| **Weekly Summary by Email**      | Weekly on Friday at 16:00 → Summarise with AI → Send Email with `{{summary}}`               |
| **Tell Me When an Agent Edits**  | Agent Made Changes → Send Email to the owner                                                |
| **Snapshot Before a Release**    | Incoming Webhook → Take Snapshot "Before {{webhook.version}}"                               |
| **Access Requests to Slack**     | Access Requested → Post to Slack                                                            |

What a template leaves to you (a snapshot, a connection, a template) is left empty and marked until picked.

## Send Email

A rule's email to a person of the document (the owner, a chosen person, whoever started it) goes to their verified
address, and only while they have not turned **assigned action** emails off in Settings. A typed-in address gets the
rule's words, fixed words saying which rule and which canvas sent it and why, and a link that stops this document's
rules emailing that address.

## Files and copies

- The document's **file** (its Drive file, a snapshot) carries its rules: each one's body and whether it was on,
  never who made it, a pause or a secret. A snapshot's **revert** puts back content only: the rules stay as they are.
- An **import** of that file, and **Make a Copy**, bring the rules into the new document **turned off**, each checked
  as a save checks it, the tabs they name at the new document's tabs. What was the source's own (a snapshot, a
  connection) is left to pick, and so is a tab the new document lacks (a copy of one tab). A rule that does not read
  is left behind.
- A copy made **through a share link or a Community post** takes no rules: they are an Editor's of the whole
  document, and may name addresses.

## Archived and in the Trash

A document that is archived or in the Trash runs nothing, as the platform spec says. The index tells the document
where it stands on every archive, move out, trash and restore; a document that comes back takes up again, a held
Wait more than a day past its time settling Skipped.

## Steps in other apps

Every step of the platform's [Steps in other apps](../../../../liveworkspace/docs/specs/018-automations/automations.md#steps-in-other-apps) is in this document's Add a Step, under **In Other Apps**:
Create a Card in a Plan, Write a Page in a Knowledgebase, Post in a Space, Add a Tab to a Document and Notify. Each
acts as the rule's author, with their rights alone, through the target app's own door; lost access pauses the rule,
and a chain stops after 3 hops or on a rule it already ran. Their values are this document's own, as every step's.

**As a target**, a livediagram document takes **Add a Tab to a Document**: a tab from a chosen livediagram template, named by the rule, made as Add a Tab from a Template makes one, by the author.

**Starter: Session Ended, Summarise into Knowledgebase** (Work Tracker 1347): Edited, Then Quiet after 30 minutes, Summarise with AI, then Write a Page in a Knowledgebase titled `{{item.name}} Session, {{now.date}}` with `{{summary}}` and a link back. livediagram has no Everyone Left (its Spaces moved to livehuddle), so the session's end is the board going quiet.

## Agents

`list_rules` and `change_rules` in the MCP server and `rule` in the CLI, as the platform spec says
([Agents](../../../../liveworkspace/docs/specs/018-automations/automations.md#agents)); the tools' contract is
[MCP server §4.9e](../015-api/mcp-server.md#49e-automations-rules-list_rules-and-change_rules). Its own kinds (Poll Ended, Question Asked, Agent Made Changes, Add a Tab from a Template) are in the format; a template is named by its kind, as `list_templates` lists them.

- **What an API token may do**: list rules and the Audit Trail (a read-only token too), and add, change, turn on and
  off, duplicate, delete, test and run them when its person is an Editor of the whole document. It never saves a rule
  holding Revert to Snapshot, never makes or reads an Incoming Webhook's secret, and adds no connection.
- **Naming**: a rule by its id or exact name; a tab and a person by id or name; `test` and `run` take the tab a
  run is about where the trigger is about one.
- **Refusals**: those the routes answer, in words with the next call to make, and a rule or tab it cannot name,
  each with what was applied before it.

## The screen

The platform's screen, as every item's is ([ui.md](../../../../liveworkspace/docs/specs/018-automations/blueprints/ui.md)),
over this app's kinds: Poll Ended, Question Asked and Agent Made Changes have pictures of their own in the pickers
(a poll card whose bars settle under a **Closed** chip; a Q&A list gaining a note with an upvote; an agent's cursor
and sparkle changing a shape on a small canvas). Question Asked and Agent Made Changes take a tab (Any Tab or one);
Poll Ended has nothing to set and says when it starts. The Templates gallery holds the table above in four sections:
**Keep It Safe**, **Stay in the Loop**, **Workshops** and **Agents and Tools**. Describe a Rule offers examples a
canvas fits ("Every Friday at 5, take a snapshot and email me", "Reset this board every night", "Tell Slack when
someone comments"). The empty state's **How Rules Work** opens the help centre's Automations article
(`/help/tools/automations`).

## Where a rule's change shows

A snapshot a rule took, and the safety snapshot its revert takes first, are authored by the rule: History shows the
rule's name in the Automation colour, never "You". livediagram's rules write no comment and add no "by" line a
reader can press, so there is no reader's rule sheet here.

## Unsubscribing

The link in a rule's email to a typed-in address opens `/email-optout?d=<documentId>&t=<token>`: what unsubscribing
does and one **Unsubscribe** button, which posts to the api's door. Opening the page sends nothing, so a mail
scanner that follows links unsubscribes nobody.

## Telemetry

Category `Document`, the platform's event names ([Telemetry](../017-telemetry/telemetry.md)). The editor sends
`UI·Opened` `Automations` (and `AutomationsOffline`, `AutomationsSignIn` for the gates, `AutomationDescribe`,
`AutomationTemplate.<id>`), and under `Document`: Created `AutomationRule` / `AutomationDraft` / `AutomationSecret`,
Changed and Copied `AutomationSecret`, Toggled `AutomationOn` / `AutomationOff`, Deleted `AutomationRule`, Tested
`AutomationRule` and Ran `AutomationManual` (Run Rule). The room's counts go out as `Document·Ran`, one batch a wake,
and a rule's email counts as `Email·Sent·AutomationEmail`.

## Blueprint

[blueprints/automations.md](blueprints/automations.md): the api's wiring and the editor's.
