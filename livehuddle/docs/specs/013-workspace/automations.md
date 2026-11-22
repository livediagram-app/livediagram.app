# Automations

Rules a Space runs on its own: when something happens, if some conditions hold, then do these steps. The feature is
the platform's, built once and the same in every app: [Automations](../../../../liveworkspace/docs/specs/018-automations/automations.md) holds what a rule is, where rules live
and run, the limits, who may do what, the shared triggers, conditions, steps and values, Connections, Test Rule and
Run Rule. This spec holds only what this app adds.

## Where it is

**Automations** in the footer's **Tools** menu, in the Automate group, where Webhooks was. Webhooks is gone as a tool
of its own: the addresses a rule posts to are **Connections**, a tab of the Automations screen
([Connections](../../../../liveworkspace/docs/specs/018-automations/automations.md#connections)).

## Share roles

| Role                                     | Automations                                                               |
| ---------------------------------------- | ------------------------------------------------------------------------- |
| **Editor** of the whole Space, signed in | Everything: rules, Run Rule, Test Rule, the Audit Trail, Connections      |
| Editor through a link to one tab         | No Automations row; the routes answer 403 `automations_need_editor`       |
| **Participant**, **Viewer**              | No Automations row; a rule's changes read "Automation · <rule>"           |
| A guest (an Editor link, signed out)     | The row opens to **Sign In**                                              |
| An API token of an Editor                | None: livehuddle has no agent tools; a token through the API as an Editor |

A Space kept **Offline** offers **Sync Space** first: it has no rules until it is stored.

## Triggers of its own

Beside the shared ones (Scheduled, Run by Hand, Incoming Webhook, Tab Added, Tab Removed, Edited, Then Quiet, Not
Edited For, Snapshot Taken, Someone Joined, Access Requested). livehuddle has no comment threads or actions, so no
comment or action triggers.

| Trigger                | Starts when                                                                          | Picks                                    |
| ---------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------- |
| **Someone Arrived**    | a person comes into a tab ([Tab attendance](../012-collaboration/tab-attendance.md)) | a tab (optional); only when it was empty |
| **Everyone Left**      | the last person leaves a tab and it stays empty for a while (1 minute to 12 hours)   | a tab (optional); how long               |
| **Suggestion Dropped** | someone drops a note in the Suggestion Box                                           | none                                     |

- **Someone Arrived** reads the room's own attendance: the same visit the Attendance list shows. With **Only When It
  Was Empty** on, it fires for the first person in and not for those who follow, so "the office is open" is said
  once. A person who reconnects inside two minutes continues their visit and starts nothing.
- **Everyone Left** waits out the chosen time with the tab still empty, so a dropped connection or a short break
  fires nothing. It carries who was there and for how long, from the visits that just closed.
- **Which space.** Arrivals and departures are read per tab, as Tab Attendance counts them: a rule with a tab
  picked hears that tab, one with none hears every tab, each on its own (a Space of one tab reads as the whole Space).
- **Suggestion Dropped** carries the note's text and nothing about who wrote it: the box is anonymous, and Who Did
  It reads nothing.
- A knock, a nudge, a raised hand and a bell start no rule: they are moments, never stored or logged
  ([Knock](../012-collaboration/knock.md)), and the Audit Trail would log them.

## Steps of its own

| Step                          | Does                                                            |
| ----------------------------- | --------------------------------------------------------------- |
| **Clear the Suggestion Box**  | deletes every note in the box                                   |
| **Add a Tab from a Template** | adds a tab made from a chosen Space template, named by the rule |

**Revert to Snapshot** (shared) is the one that matters most here: Everyone Left → Revert to Snapshot puts a meeting
room back as it was, chairs, whiteboard and all, once the room has emptied.

## Values of its own

| Value               | Reads                                                        | In                 |
| ------------------- | ------------------------------------------------------------ | ------------------ |
| `{{visit.people}}`  | the names of who was there, in the order they came, up to 20 | Everyone Left      |
| `{{visit.count}}`   | how many people were there                                   | Everyone Left      |
| `{{visit.minutes}}` | minutes from the first arrival to the last leaving           | Everyone Left      |
| `{{suggestion}}`    | the note's text, its opening 500 characters                  | Suggestion Dropped |

`{{person}}` is who arrived, in Someone Arrived.

## Templates

| Template                            | Rule                                                                                                |
| ----------------------------------- | --------------------------------------------------------------------------------------------------- |
| **Reset Every Night**               | Every day at 00:00 → Revert to Snapshot (pick one)                                                  |
| **Tidy Up When Everyone Leaves**    | Everyone Left (10 minutes) → Revert to Snapshot (pick one)                                          |
| **The Office Is Open**              | Someone Arrived, only when it was empty → Post to Slack "{{person}} is in {{item.name}}"            |
| **Stand-Up in Fifteen**             | Every weekday at 09:45 → Post to Slack "Stand-up in 15 minutes: {{item.url}}"                       |
| **Meeting Wrap-Up**                 | Everyone Left (5 minutes) → Send Email to the owner with `{{visit.people}}` and `{{visit.minutes}}` |
| **Suggestions to Slack**            | Suggestion Dropped → Post to Slack "{{suggestion}}"                                                 |
| **Empty the Suggestion Box Weekly** | Weekly on Monday at 08:00 → Clear the Suggestion Box                                                |
| **A Visitor Arrived**               | Someone Joined → Send Email to the owner                                                            |
| **Snapshot Every Friday**           | Weekly on Friday at 17:00 → Take Snapshot "Week of {{now.date}}"                                    |
| **Access Requests to Slack**        | Access Requested → Post to Slack                                                                    |

**Reset Every Night** leads: a workshop Space put back to a snapshot every night is what the Automations screen is
for here. A Scheduled time is on the quarter hour, so the stand-up reminder goes at 09:45 for a 10:00 stand-up.

## Steps in other apps

Every step of the platform's [Steps in other apps](../../../../liveworkspace/docs/specs/018-automations/automations.md#steps-in-other-apps) is in this Space's Add a Step, under **In Other Apps**:
Create a Card in a Plan, Write a Page in a Knowledgebase, Post in a Space, Add a Tab to a Document and Notify. Each
acts as the rule's author, with their rights alone, through the target app's own door; lost access pauses the rule,
and a chain stops after 3 hops or on a rule it already ran. Their values are this Space's own, as every step's.

**As a target**, a Space takes **Post in a Space**: a sticky note on a chosen tab, its text the rule's, signed "Automation · <rule>", by the author. livehuddle has no chat, so a note on a tab is the post.

**Starter: Meeting Ended, Send Actions to Plan**: Everyone Left, Summarise with AI, then Create a Card in a Plan titled `Actions from {{tab.name}}, {{now.date}}` with `{{summary}}`, linked back to the Space.

## The screen

The platform's screen, as every item's is ([ui.md](../../../../liveworkspace/docs/specs/018-automations/blueprints/ui.md)),
over this app's kinds, with pictures of its own in the pickers:

| Kind                         | Picture                                                     | Panel                                                    |
| ---------------------------- | ----------------------------------------------------------- | -------------------------------------------------------- |
| **Someone Arrived**          | an avatar walking into a dark room as its lights come up    | the tab (Any Tab or one); **Only When It Was Empty**, on |
| **Everyone Left**            | the last avatar walking out of a room, a clock running down | how long (1 minute to 12 hours, as a duration); the tab  |
| **Suggestion Dropped**       | a note dropping into the Suggestion Box                     | none: it says when it starts                             |
| **Clear the Suggestion Box** | the box's notes lifting out, the box left empty             | none: it says what it does                               |

- A "space" in Someone Arrived and Everyone Left is a tab, as Tab Attendance counts it: the tab picker's hint says
  so. No comment or action trigger is offered: livehuddle has none.
- **Add a Tab from a Template** offers the templates New Tab does.
- The Templates gallery holds the table above in four sections: **Keep It Safe**, **Rooms and Meetings**, **The
  Suggestion Box** and **Stay in the Loop**.
- Describe a Rule offers examples a Space fits, the headline one first ("Reset this Space to a snapshot every night",
  "When everyone leaves a room, put it back as it was", "Tell Slack when someone arrives in an empty room").
- The empty state's **How Rules Work** opens the help centre's Automations article (`/help/tools/automations`).
- The people a rule can name (Who Did It, Send Email to a person) are the signed-in account and the Space team's
  joined members, read when the screen first opens, never on the editor's load.

## Where a rule's change shows

A snapshot a rule took, and the safety snapshot its revert takes first, read "Automation · <rule>" in Snapshots, as
the platform's do. livehuddle's rules write no comment and no version, and a note a rule clears leaves no "by"
line, so there is nothing else to name the rule on.

## Unsubscribing

The link in a rule's email to a typed-in address opens `/email-optout?d=<documentId>&t=<token>`: what unsubscribing
does and one **Unsubscribe** button, which posts to the api's door. Opening the page sends nothing, so a mail
scanner that follows links unsubscribes nobody.

## Telemetry

Category `Document`, the category every Space event is counted under (code still says document), with the
platform's event names ([Telemetry](../017-telemetry/telemetry.md)). The editor sends `UI·Opened` `Automations` (and
`AutomationsOffline`, `AutomationsSignIn` for the gates, `AutomationDescribe`, `AutomationTemplate.<id>`), and under
`Document`: Created `AutomationRule` / `AutomationDraft` / `AutomationSecret`, Changed and Copied
`AutomationSecret`, Toggled `AutomationOn` / `AutomationOff`, Deleted `AutomationRule`, Tested `AutomationRule` and
Ran `AutomationManual` (Run Rule). The room's counts go out as `Document·Ran`, one batch a wake.
