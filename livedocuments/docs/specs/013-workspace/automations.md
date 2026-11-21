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

A document kept **Offline** offers **Sync Document** first: it has no rules until it is stored. The row wears
**Sign In** or **Sync Document** beside its name while either stands. An embed and a workbench frame show no row.

## Triggers of its own

Beside the shared ones (Scheduled, Run by Hand, Incoming Webhook, Tab Added, Tab Removed, Edited, Then Quiet, Not
Edited For, Snapshot Taken, Someone Joined, Access Requested, and the comment and action triggers):

| Trigger                | Starts when                                                                              | Picks            |
| ---------------------- | ---------------------------------------------------------------------------------------- | ---------------- |
| **Version Named**      | someone names a version of a tab ([Version history](../006-document/version-history.md)) | a tab (optional) |
| **Version Restored**   | someone restores a tab to an earlier version                                             | a tab (optional) |
| **Agent Made Changes** | an agent (an API token) changes pages or writes an article                               | a tab (optional) |

A version a rule names starts no Version Named rule unless the rule lets its changes start other rules.

## Steps of its own

| Step                          | Does                                                                                          |
| ----------------------------- | --------------------------------------------------------------------------------------------- |
| **Name This Version**         | names the current content of a tab (the run's tab, or a chosen one), values allowed           |
| **Restore a Version**         | puts a chosen tab back to one of its named versions, as Restore does (it can be undone there) |
| **Add a Tab from a Template** | adds a tab made from a chosen template, named by the rule                                     |

- **Name This Version** fails when the tab already holds its 25 names ("This tab has 25 named versions").
- **Restore a Version** names a tab and one of its named versions; a version unnamed or gone since fails the run.
  Unlike Revert to Snapshot it touches one tab and ends no session, so steps may follow it.

## Values of its own

| Value              | Reads              | In                              |
| ------------------ | ------------------ | ------------------------------- |
| `{{version.name}}` | the version's name | Version Named, Version Restored |

**Summarise with AI** reads articles as Markdown and pages by their text, the run's tab alone when the trigger is
about one.

## Templates

| Template                           | Rule                                                                                       |
| ---------------------------------- | ------------------------------------------------------------------------------------------ |
| **Name a Version Every Friday**    | Weekly on Friday at 17:00 → Name This Version "Week of {{now.date}}" (pick a tab)          |
| **Tell Me When This Changes**      | Edited, Then Quiet (30 minutes) → Send Email to the owner                                  |
| **Time for a Review**              | Not Edited For 90 days → Send Email to the owner "Is {{item.name}} still right?"           |
| **Comments to Slack**              | Comment Added → Post to Slack "{{person}}: {{comment}}"                                    |
| **Signed Off**                     | All Threads Resolved → Name This Version "Reviewed {{now.date}}" → Send Email to the owner |
| **Weekly Summary by Email**        | Weekly on Friday at 16:00 → Summarise with AI → Send Email with `{{summary}}`              |
| **Announce a New Version**         | Version Named → Post to Slack "{{version.name}} of {{item.name}} is ready"                 |
| **Tell Me When an Agent Writes**   | Agent Made Changes → Send Email to the owner                                               |
| **Snapshot Every Month**           | Monthly on day 1 at 09:00 → Take Snapshot "{{now.date}}"                                   |
| **Reset a Form Letter Each Night** | Every day at 00:00 → Restore a Version (pick a tab and a version)                          |
| **Access Requests to Slack**       | Access Requested → Post to Slack                                                           |

## Agents

`list_rules` and `change_rules` in the MCP server and `rule` in the CLI, as the platform spec says
([Agents](../../../../liveworkspace/docs/specs/018-automations/automations.md#agents)); the tools' contract is
[MCP server §4.9e](../015-api/mcp-server.md#49e-automations-rules-list_rules-and-change_rules). Its own kinds (Version Named, Version Restored, Agent Made Changes, Name This Version, Restore a Version, Add a Tab from a Template) are in the format; a Restore a Version step names one of a tab's named versions by its id, as `list_versions` lists them, and a template by its kind, as `list_templates` lists them.

- **What an API token may do**: list rules and the Audit Trail (a read-only token too), and add, change, turn on and
  off, duplicate, delete, test and run them when its person is an Editor of the whole document. It never saves a rule
  holding Revert to Snapshot, never makes or reads an Incoming Webhook's secret, and adds no connection.
- **Naming**: a rule by its id or exact name; a tab and a person by id or name; `test` and `run` take the tab a
  run is about where the trigger is about one.
- **Refusals**: those the routes answer, in words with the next call to make, and a rule or tab it cannot name,
  each with what was applied before it.

## The screen

The platform's screen, as every item's is ([ui.md](../../../../liveworkspace/docs/specs/018-automations/blueprints/ui.md)),
over this app's kinds, with pictures of its own in the pickers:

| Kind                   | Picture                                                   | Panel                                                   |
| ---------------------- | --------------------------------------------------------- | ------------------------------------------------------- |
| **Version Named**      | a tab's version list gaining a named entry                | the tab (Any Tab or one)                                |
| **Version Restored**   | a page rolling back to a marked version                   | the tab (Any Tab or one)                                |
| **Agent Made Changes** | an agent's cursor and sparkle writing lines onto a page   | the tab (Any Tab or one)                                |
| **Name This Version**  | a version list where a name tag lands on the newest entry | the tab (the run's tab, where the trigger has one, or a |
|                        |                                                           | chosen one) and the name, values allowed                |
| **Restore a Version**  | a page rolling back to a marked version                   | the tab, then one of that tab's named versions          |

- **Restore a Version** lists the picked tab's **named** versions, newest first, read when the tab is picked. A tab
  with none says so ("No named versions yet": name one in Version History first); a version since unnamed or gone
  stays in the list as "(No Longer Here)" until another is picked, and the Rules list says it is gone. A failed read
  offers **Try Again**.
- **Add a Tab from a Template** offers the templates New Tab does.
- The Templates gallery holds the table above in four sections: **Keep It Safe**, **Stay in the Loop**, **Versions
  and Reviews** and **Agents and Tools**.
- Describe a Rule offers examples a document fits ("Every Friday at 5, name a version and email me", "Tell Slack
  when someone comments", "Restore my form letter every night").
- The empty state's **How Rules Work** opens the help centre's Automations article (`/help/tools/automations`).

## Where a rule's change shows

A snapshot a rule took, and the safety snapshot its revert takes first, read "Automation · <rule>" in Snapshots, as
the platform's do. A version a rule names, and the one its restore keeps first, are authored by the rule, and the
Version History panel reads them "Automation · <rule>" too, never as a person. livedocuments' rules write no
comment, so there is no reader's rule sheet here.

## Unsubscribing

The link in a rule's email to a typed-in address opens `/email-optout?d=<documentId>&t=<token>`: what unsubscribing
does and one **Unsubscribe** button, which posts to the api's door. Opening the page sends nothing, so a mail
scanner that follows links unsubscribes nobody.

## Telemetry

Category `Document`, the platform's event names ([Telemetry](../017-telemetry/telemetry.md)). The editor sends
`UI·Opened` `Automations` (and `AutomationsOffline`, `AutomationsSignIn` for the gates, `AutomationDescribe`,
`AutomationTemplate.<id>`), and under `Document`: Created `AutomationRule` / `AutomationDraft` / `AutomationSecret`,
Changed and Copied `AutomationSecret`, Toggled `AutomationOn` / `AutomationOff`, Deleted `AutomationRule`, Tested
`AutomationRule` and Ran `AutomationManual` (Run Rule). The room's counts go out as `Document·Ran`, one batch a wake.
