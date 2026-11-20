# v1 scope

What the first version of liveknowledge does. Each feature names its spec; a feature is in v1 only if it is here.

| #   | Feature                                                                                         | Spec                                                             |
| --- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 1   | Wikis of pages in a page tree, written on a continuous page with the article engine             | [Wikis and pages](../030-wiki/wikis-and-pages.md)                |
| 2   | Page links, backlinks, and other apps' items embedded in a page                                 | [Links and embeds](../030-wiki/links-and-embeds.md)              |
| 3   | Owners, verified pages and reviews that come due                                                | [Verification](../030-wiki/verification.md)                      |
| 4   | Search across a wiki                                                                            | [Search and Ask](../030-wiki/search-and-ask.md)                  |
| 5   | Ask: cited answers from the wiki, on the team's own Claude key                                  | [Search and Ask](../030-wiki/search-and-ask.md)                  |
| 6   | AI Knowledge: agents' reads, unanswered questions, conflicts, suggested edits, Always in Context | [AI Knowledge](../030-wiki/ai-knowledge.md)                      |
| 7   | Wiki Home                                                                                       | [Wiki Home](../030-wiki/wiki-home.md)                            |
| 8   | Import from a Markdown folder, Notion and Confluence                                            | [Wiki import](../020-import-export/wiki-import.md)               |
| 9   | The MCP server and the CLI, in pages                                                            | [Wiki for agents](../024-agents/wiki-for-agents.md)              |
| 10  | The platform's features: one account, the Explorer, sharing and roles, comments, snapshots, Offline, the Drive mirror, the Community, Settings, telemetry, help, Download Your Data | [Platform registration](../016-platform/platform-registration.md) |

Storage is the wiki's Durable Object, as every app's item is: its pages, link table, search index, read counts,
questions, conflicts and the encrypted key. liveknowledge has no D1 database.

Share roles (Editor, Participant, Viewer) are specified in every feature's spec and tested per role.
