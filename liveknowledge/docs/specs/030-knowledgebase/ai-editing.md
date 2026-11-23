# AI Editing

Owner, 2026-11-23 (Work Tracker 1394): "please set a knowledgebase setting where MCP / AI Can Suggest Edits (current
default), MCP / AI Can Update Pages (when not verified), MCP / AI Can Update Pages at any time. Add the option to the
knowledgebase context menu and make it open a modal to choose, make it look amazing. Make sure the MCP knows what the
setting is." Then: for the third level, an option shown only when it is chosen, off by default, that takes a page's
verification away when an agent rewrites it.

Status: **built, not yet verified on a deployed Worker** ([blueprint](blueprints/ai-editing.md)). Details marked
"(decided)" were decided by the builder and stand until the owner overturns them.

## What it is

**AI Editing** is one setting of the knowledgebase, beside its Review Period: how far an agent (any write made with an
API token: the MCP server's tools, the CLI and the api called with a token, [Verification](verification.md) "Made by
a person or an agent") may change pages itself rather than suggest the change for a person to accept.

| Level                            | Stored       | One line in the UI                                                                        |
| -------------------------------- | ------------ | ----------------------------------------------------------------------------------------- |
| **Suggest Edits Only** (default) | `suggest`    | Agents suggest changes for a person to accept. No page changes until someone accepts it.  |
| **Edit Unverified Pages**        | `unverified` | Agents rewrite pages nobody has verified. Verified and Review Due pages take suggestions. |
| **Edit Any Page**                | `any`        | Agents rewrite any page, verified ones too. Every change is marked AI Edited.             |

Under **Edit Any Page** one option more, shown only while that level is chosen: **Remove Verification When AI Edits**
("A verified page an agent rewrites goes back to Not Verified, for a person to check and verify again."), off by
default. Off, an agent's rewrite keeps the tick as a person's save does ([Verification](verification.md) "States":
writing on a verified page does not clear the tick, and a large change adds "Changed since verified").

- **The default is Suggest Edits Only**, as the owner named it. A knowledgebase that never chose stores nothing.
- **What an agent may do is the lower of the two:** its connection's scopes ([Knowledgebase for
  agents](../024-agents/knowledgebase-for-agents.md) "Scopes") and this setting. A connection without `write` only
  suggests whatever the level; a connection with `write` writes only as far as the level allows. The setting never
  grants a scope, and Allow Writing never passes the setting.
- **Existing write grants (decided):** a connection an Editor allowed to write before this setting existed now meets
  Suggest Edits Only until an Editor chooses Edit Unverified Pages (what it could do before) or Edit Any Page. Nothing
  is migrated: the knowledgebase is the one place that decides, and its refusal says where to change it.

## What each level lets an agent do

| An agent's write (with `write`)                                    | Suggest Edits Only | Edit Unverified Pages | Edit Any Page |
| ------------------------------------------------------------------ | ------------------ | --------------------- | ------------- |
| `write_page`: a Never Verified page's writing                      | refused            | yes                   | yes           |
| `write_page`: a Verified or Review Due page's writing              | refused            | refused               | yes           |
| `write_page`: a cover alone, the Pages route, a changeset          | refused            | yes                   | yes           |
| A version restore by a token                                       | refused            | Never Verified only   | yes           |
| `suggest_edit`, `create_page`, `move_page`, comments, `report_gap` | by scope           | by scope              | by scope      |

- **Refused** is 409 with a code naming the setting and a message saying to use `suggest_edit`:
  - `ai_editing_suggest_only`: "This knowledgebase's AI Editing setting is Suggest Edits Only, so agents do not
    change pages directly. Suggest the change instead with suggest_edit, for a person to accept."
  - `page_verified` and `page_review_due` under Edit Unverified Pages, as before, their messages now naming the
    setting: "This page is verified, and this knowledgebase's AI Editing setting is Edit Unverified Pages, so an agent
    does not rewrite it. Suggest the change instead with suggest_edit, for a person to accept." A page verified before
    verification was turned off keeps its own words ("A person verified this page before verification was turned
    off..."), with the setting named.
- **Moving and making pages stay by scope (decided):** they change no page's writing. `create_page` makes a page that
  is never verified, `move_page` changes where a page stands, and both keep the scopes' rules.
- **Under Edit Any Page an agent's write is still an agent's:** it stamps the page AI Edited ("Made by a person or an
  agent"), counts as an applied change, and is held by a person's paragraph as any write is. It never Verifies, never
  accepts or dismisses a suggestion and never approves (`needs_a_person` stays).
- **Remove Verification When AI Edits**, on, under Edit Any Page: an agent's write of a Verified or Review Due page's
  writing (`write_page` with Markdown, or a version restore) clears its verification once the write is stored, as the
  rule step **Clear Verification** does ([Automations](../013-workspace/automations.md) "Steps of its own"):
  `verifiedAt` and `verifiedBy` go, the owner stays, and the page reads Never Verified ("Not Verified" in Page Health,
  "Verify once it's right.") on every open editor at once (the fields' `tab-meta` patch). A cover alone, a page never
  verified, a refused or held write, and a person's own save never clear it. Under a Review Period of Never the
  stored mark is cleared the same way, so the page is not shown Verified when a period is set again. The page's
  History keeps the agent's version as every write does; no separate History row is written for the mark (the
  version history records writing, not trust).
- **A changeset** (the Pages-for-agents element route) and the Pages route's other changes are refused under Suggest
  Edits Only and otherwise keep their rules (decided): they never rewrote a page's writing by article, and the setting
  does not widen them.

## Who sets it

- **An Editor, in person** ([Knowledgebases and pages](knowledgebases-and-pages.md#share-roles)): a Participant is an
  Editor minus the knowledgebase's settings, and a Viewer only reads. A token, even one granted `write`, and a
  workbench session never change it (`needs_a_person`, 403): an agent never raises its own reach, as a token never
  raises its own scopes.
- The api enforces it (`PUT knowledge-settings` with `aiEditing` or `aiEditUnverifies`); the menu row is absent for
  everyone else, so the UI never offers what the api would refuse.
- A knowledgebase kept Offline has no row: it has no server for an agent to reach.

## The dialog

- **The door:** **AI Editing** in the knowledgebase's menu, after AI Settings ([Knowledgebases and
  pages](knowledgebases-and-pages.md#the-knowledgebases-menu)), with a shield-and-tick icon.
- **The modal** is centred (never at the top), a steady height whatever is chosen, and on a phone a sheet from the
  bottom. The shared hero header ([Dialog hero header](../../../../liveworkspace/docs/specs/004-index/dialog-hero-header.md))
  with its own art: a page with a pencil under a shield, a sparkle beside it; title **AI Editing**, line "How far
  agents connected over MCP, the CLI or the API may change pages."
- **Three choice cards**, stacked, each a small purpose-made illustration (a speech bubble with a pencil; a page with
  an empty tick ring and a pencil; a page with a filled tick and a pencil), the level's name, its line, and a radio
  mark. The chosen card wears the brand ring and wash. **Default** rides Suggest Edits Only's name as a quiet pill.
- **Remove Verification When AI Edits** is a switch inside the third card, unfolding under its line only while Edit
  Any Page is chosen; its state is kept while another level is chosen, so choosing Edit Any Page again shows it as
  it was.
- Under the cards one quiet line: "A connection also needs Allow Writing, from its card in Insights. Without it, an
  agent only suggests." and the Help article link.
- **Save** and **Cancel** in the footer: nothing changes until Save, and Save is offered only once something differs.
  A failed save says so in the dialog and keeps the choice.
- **Keyboard and screen readers:** the cards are one radio group (native radios: the arrow keys move between them,
  Space chooses), each named by its level and described by its line; the switch is a `role="switch"` with its state.
  Escape and Cancel close without saving. Targets are 44 px at least on a touch screen.
- Light and dark alike; the chrome motion budget (the switch's unfold 200 ms, none with reduced motion).

## For agents

- **`get_context`** (and the CLI's `context`) carries `ai_editing` (`suggest`, `unverified` or `any`),
  `ai_edit_unverifies` (true only where Edit Any Page removes the tick) and `ai_editing_allows`: one sentence of what
  this connection may do here, the lower of its scopes and the setting ("This connection only suggests: use
  suggest_edit."). The server's instructions and `write_page`'s description say the setting decides how far
  `write_page` reaches and that get_context names it.
- No tool or command sets it.

## Telemetry

`UI·Opened·AiEditing` when the dialog opens; on Save, before the write, `UI·Changed·AiEditingSuggest`,
`AiEditingUnverified` or `AiEditingAny` for a new level, and `UI·Toggled·AiEditUnverifiesOn` or `AiEditUnverifiesOff`
for the switch.

## Share roles

| Action                             | Editor | Participant | Viewer |
| ---------------------------------- | ------ | ----------- | ------ |
| See AI Editing (the menu's dialog) | yes    | no          | no     |
| Change AI Editing                  | yes    | no          | no     |

Agents read it through `get_context` whatever their role; it only ever narrows what they may do.
