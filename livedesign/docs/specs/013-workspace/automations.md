# Automations

Rules a design runs on its own: when something happens, if some conditions hold, then do these steps. The feature is
the platform's, built once and the same in every app: [Automations](../../../../liveworkspace/docs/specs/018-automations/automations.md) holds what a rule is, where rules live
and run, the limits, who may do what, the shared triggers, conditions, steps and values, Connections, Test Rule and
Run Rule. This spec holds only what this app adds.

## Where it is

**Automations** in the footer's **Tools** menu, in the Automate group, where Webhooks was. Webhooks is gone as a tool
of its own: the addresses a rule posts to are **Connections**, a tab of the Automations screen
([Connections](../../../../liveworkspace/docs/specs/018-automations/automations.md#connections)).

## Share roles

| Role                                      | Automations                                                                               |
| ----------------------------------------- | ----------------------------------------------------------------------------------------- |
| **Editor** of the whole design, signed in | Everything: rules, Run Rule, Test Rule, the Audit Trail, Connections                      |
| Editor through a link to one tab          | No Automations row; the routes answer 403 `automations_need_editor`                       |
| **Participant**, **Viewer**               | No Automations row; a rule's changes read "Automation · <rule>"                           |
| A guest (an Editor link, signed out)      | The row opens to **Sign In**                                                              |
| An API token of an Editor                 | Lists, adds, changes, tests and runs rules; no secrets, connections or Revert to Snapshot |

A design kept **Offline** offers **Sync Design** first: it has no rules until it is stored.

## Triggers of its own

Beside the shared ones (Scheduled, Run by Hand, Incoming Webhook, Tab Added, Tab Removed, Edited, Then Quiet, Not
Edited For, Snapshot Taken, Someone Joined, Access Requested, and the comment and action triggers):

| Trigger                | Starts when                                                          | Picks                  |
| ---------------------- | -------------------------------------------------------------------- | ---------------------- |
| **Component Changed**  | a main component of the design's library is changed                  | a component (optional) |
| **Agent Made Changes** | an agent (an API token) changes the canvas, its pages or a component | a tab (optional)       |

**Component Changed** fires once after a burst of changes to the library settles (2 minutes of quiet), not per
change, with the component's name. With a component picked, only that component's changes count. A revert, a copy
and a shared tab taken in put mains back or bring them in, so none of them is a change. A copy or an imported file
keeps the rule with its component left to pick, and the rule stays off until one is picked. An agent's change to a
component has no tab, so only an Agent Made Changes rule with no tab picked hears it.

The [blueprint](blueprints/automations.md) holds how livedesign wires the platform's engine and mounts its screen.

## Steps of its own

| Step                          | Does                                                      |
| ----------------------------- | --------------------------------------------------------- |
| **Add a Tab from a Template** | adds a tab made from a chosen template, named by the rule |

## Values of its own

| Value                | Reads                                       | In                |
| -------------------- | ------------------------------------------- | ----------------- |
| `{{component.name}}` | the changed component's name (the last one) | Component Changed |

## Templates

| Template                         | Rule                                                                                   |
| -------------------------------- | -------------------------------------------------------------------------------------- |
| **Feedback to Slack**            | Comment Added → Post to Slack "{{person}} on {{tab.name}}: {{comment}}"                |
| **Feedback Addressed**           | All Threads Resolved → Send Email to the owner                                         |
| **Ready for Build**              | Run by Hand → Take Snapshot "Handoff {{now.date}}" → Post to Slack with `{{item.url}}` |
| **Tell Slack When This Changes** | Edited, Then Quiet (30 minutes) → Post to Slack                                        |
| **Library Updated**              | Component Changed → Post to Slack "{{component.name}} changed in {{item.name}}"        |
| **Snapshot Every Friday**        | Weekly on Friday at 17:00 → Take Snapshot "Week of {{now.date}}"                       |
| **Weekly Summary by Email**      | Weekly on Friday at 16:00 → Summarise with AI → Send Email with `{{summary}}`          |
| **Tell Me When an Agent Edits**  | Agent Made Changes → Send Email to the owner                                           |
| **Is This Still Current?**       | Not Edited For 90 days → Send Email to the owner                                       |
| **Access Requests to Slack**     | Access Requested → Post to Slack                                                       |

Each Post to Slack leaves its connection to pick; nothing else is left to the person.

## Agents

`list_rules` and `change_rules` in the MCP server and `rule` in the CLI, as the platform spec says
([Agents](../../../../liveworkspace/docs/specs/018-automations/automations.md#agents)); the tools' contract is
[MCP server §4.9e](../015-api/mcp-server.md#49e-automations-rules-list_rules-and-change_rules). Its own kinds (Component Changed, Agent Made Changes, Add a Tab from a Template) are in the format; Component Changed keeps to one main component by its id, as `read_design`'s components view prints it, and a template is named by its kind, as `list_templates` lists them.

- **What an API token may do**: list rules and the Audit Trail (a read-only token too), and add, change, turn on and
  off, duplicate, delete, test and run them when its person is an Editor of the whole design. It never saves a rule
  holding Revert to Snapshot, never makes or reads an Incoming Webhook's secret, and adds no connection.
- **Naming**: a rule by its id or exact name; a tab and a person by id or name; `test` and `run` take the tab a
  run is about where the trigger is about one.
- **Refusals**: those the routes answer, in words with the next call to make, and a rule or tab it cannot name,
  each with what was applied before it.

## The screen

The platform's screen, as every item's is ([ui.md](../../../../liveworkspace/docs/specs/018-automations/blueprints/ui.md)),
over this app's kinds, with pictures of its own in the pickers:

| Kind                   | Picture                                                         | Panel                                     |
| ---------------------- | --------------------------------------------------------------- | ----------------------------------------- |
| **Component Changed**  | a main component's button changing, its two instances following | Any Component, or one main of the library |
| **Agent Made Changes** | an agent's cursor dragging a block into a frame, with a sparkle | the tab (Any Tab or one)                  |

- **Component Changed** lists the design's main components by name, the archived ones last as "(Archived)", read
  when the panel shows. Picking one keeps its name with the rule, for the words. The panel says the rule waits until
  the library has been quiet for 2 minutes after the last change. A main since deleted stays in the list as "(No
  Longer Here)" until another is picked, and the Rules list says it is gone; a copy's rule asks for its component
  ("Pick a component"). A library with no mains says so; a failed read offers **Try Again**.
- **Add a Tab from a Template** offers the templates New Tab does.
- The Templates gallery holds the table above in four sections: **Feedback and Handoff** (Feedback to Slack, Feedback
  Addressed, Ready for Build), **Stay in the Loop** (Tell Slack When This Changes, Weekly Summary by Email, Access
  Requests to Slack), **Keep It Safe** (Snapshot Every Friday, Is This Still Current?) and **Library and Agents**
  (Library Updated, Tell Me When an Agent Edits).
- Describe a Rule offers examples a design fits ("Tell Slack when a component in the library changes", "Every Friday
  at 5, take a snapshot and email me", "Post every new comment to Slack").
- The empty state's **How Rules Work** opens the help centre's Automations article (`/help/tools/automations`).

## Where a rule's change shows

A snapshot a rule took, and the safety snapshot its revert takes first, read "Automation · <rule>" in Snapshots, as
the platform's do. livedesign's rules write no comment and name no version, so
there is no other line to read.

## Unsubscribing

The link in a rule's email to a typed-in address opens `/email-optout?d=<designId>&t=<token>`: what unsubscribing
does and one **Unsubscribe** button, which posts to the api's door. Opening the page sends nothing, so a mail
scanner that follows links unsubscribes nobody.

## Telemetry

Category `Document` (the category every product's dashboard shares for its item), the platform's event names
([Telemetry](../017-telemetry/telemetry.md)). The editor sends `UI·Opened` `Automations` (and `AutomationsOffline`,
`AutomationsSignIn` for the gates, `AutomationDescribe`, `AutomationTemplate.<id>`), and under `Document`: Created
`AutomationRule` / `AutomationDraft` / `AutomationSecret`, Changed and Copied `AutomationSecret`, Toggled
`AutomationOn` / `AutomationOff`, Deleted `AutomationRule`, Tested `AutomationRule` and Ran `AutomationManual` (Run
Rule). The room's counts go out as `Document·Ran`, one batch a wake.
