# Agents

Follow the references below only as needed; never upfront.

An **agent** is a program acting for a person through an API token: an MCP client, a CLI caller, a script
([Domain language](../003-system-architecture/domain-language.md#agents)). These specs define how an agent reads,
changes and discusses a project, alone or beside people editing it live. The research behind them is in
`docs/research/agent-cli/`.

## The front doors

Both doors are projections of one verb catalogue, `@liveplanner/agent-verbs` ([CLI blueprint](../015-api/blueprints/cli.md)),
and both speak Plan: boards and cards, sheets and forms first, elements only underneath.

- **The [MCP server](../015-api/mcp-server.md)** (`apps/mcp`): `find_projects`, `read_project`, `list_templates`,
  `create_project`, `add_tab`, `update_project`, `rename_project`, `share_project`, `delete_project`, `list_trash` and
  `restore_project` for projects and tabs; `list_items`, `change_items`, `add_board`, `change_board` and
  `change_card_types` for boards and cards ([Plan for agents](../026-plan/plan-agents.md)); `list_sheets`,
  `read_sheet`, `change_sheet` and `add_sheet` for Sheets ([Sheet](../029-sheets/sheet.md)); `add_form`,
  `change_form`, `read_form`, `share_form` and `try_form` for Forms ([Forms](../030-forms/forms.md#agents)).
- **The [CLI](../015-api/cli.md)** (`apps/cli`, the `liveplanner` command): every verb takes a `<project>` argument
  first, a pasted link, an id or id prefix, or a name (`liveplanner item add "Sprint 14" "Fix login" --status todo`),
  and a tab by `--tab` name or prefix where it needs one. The resources are `project`, `tab`, `item`, `board`, `type`
  (card types), `sheet`, `form`, `element`, `changeset`, `comment`, `presence`, `folder`, `template` and `workbench`,
  beside `auth`, `skill`, `telemetry` and the top-level `guide`, `schema`, `api`, `pull`, `push`, `export`, `watch`
  and `wait`.

There are no diagram tools: no Mermaid or graph input, no icon search, no image library and no lint. A Board or a
Sheet is an element on its tab, so the generic element layer below still carries every write, and raw `elements`
(`create_project`, `add_tab`, `update_project`), `update_project`'s `ops` and the CLI's `element` verbs still reach
it.

## Specs

- ./agent-changesets.md - when an agent writes a tab: the changeset path through the api and room, conflicts, revert
- ./agent-presence.md - when showing an agent to people: attribution as its owner, presence, comments
- ./project-views.md - when an agent reads a tab as text: refs, the outline and the other views, budgets
- ./edit-operations.md - when an agent edits elements directly: the operation vocabulary, selectors, placement, errors
- ./blueprints/README.md - when implementing an agents spec from its blueprint
