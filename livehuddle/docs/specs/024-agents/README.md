# Agents

Follow the references below only as needed; never upfront.

An **agent** is a program acting for a person through an API token: a script, or any client of the REST API
([Domain language](../003-system-architecture/domain-language.md#agents)). These specs define how an agent reads,
changes and discusses a document, alone or beside people editing it live. The front door is the REST API (livehuddle has no MCP server or CLI,
[Not in livehuddle](../002-project-scope/not-in-livehuddle.md#the-mcp-server-the-cli-and-workbenches)); the research behind them is in
`docs/research/agent-cli/`.

- ./agent-changesets.md - when an agent writes a tab: the changeset path through the api and room, conflicts, revert
- ./agent-presence.md - when showing an agent to people: attribution as its owner, presence, comments
- ./document-views.md - when an agent reads a tab as text: refs, the outline and the other views, budgets
- ./edit-operations.md - when an agent edits elements: the operation vocabulary, selectors, placement, errors
- ./diagram-lint.md - (Gone from livehuddle, Work Tracker #459 part 5) when tracing the diagram lint livehuddle deleted (livediagram keeps it)
- ./blueprints/README.md - when implementing an agents spec from its blueprint
