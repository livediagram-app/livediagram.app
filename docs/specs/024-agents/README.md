# Agents

Follow the references below only as needed; never upfront.

An **agent** is a program acting for a person through an API token: an MCP client, a CLI caller, a script
([Domain language](../003-system-architecture/domain-language.md#agents)). These specs define how an agent reads,
changes and discusses a document, alone or beside people editing it live. The front doors are the
[CLI](../015-api/cli.md) and the [MCP server](../015-api/mcp-server.md); the research behind them is in
`docs/research/agent-cli/`.

- ./agent-changesets.md - when an agent writes a tab: the changeset path through the api and room, conflicts, revert
- ./agent-presence.md - when showing an agent to people: attribution, presence, comments and mentions
- ./document-views.md - when an agent reads a tab as text: refs, the outline and the other views, budgets
- ./edit-operations.md - when an agent edits elements: the operation vocabulary, selectors, placement, errors
- ./diagram-lint.md - when checking a diagram without looking at it: the findings, their codes and output
