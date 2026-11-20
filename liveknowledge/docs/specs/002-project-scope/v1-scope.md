# v1 scope

What the first version of liveknowledge does. Each feature names its spec; a feature is in v1 only if it is here.

| #   | Feature                                                                                                                                                                             | Spec                                                                         |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 1   | Knowledgebases of pages in a page tree, written on a continuous page with the article engine                                                                                        | [Knowledgebases and pages](../030-knowledgebase/knowledgebases-and-pages.md) |
| 2   | Page links, backlinks, and other apps' items embedded in a page                                                                                                                     | [Links and embeds](../030-knowledgebase/links-and-embeds.md)                 |
| 3   | Owners, verified pages and reviews that come due                                                                                                                                    | [Verification](../030-knowledgebase/verification.md)                         |
| 4   | Search across a knowledgebase                                                                                                                                                       | [Search and Ask](../030-knowledgebase/search-and-ask.md)                     |
| 5   | Ask: cited answers from the knowledgebase, on the team's own Claude key                                                                                                             | [Search and Ask](../030-knowledgebase/search-and-ask.md)                     |
| 6   | AI Knowledge: agents' reads, unanswered questions, conflicts, suggested edits, Always in Context                                                                                    | [AI Knowledge](../030-knowledgebase/ai-knowledge.md)                         |
| 7   | Knowledgebase Home                                                                                                                                                                  | [Knowledgebase Home](../030-knowledgebase/knowledgebase-home.md)             |
| 8   | Import from a Markdown folder, Notion and Confluence                                                                                                                                | [Knowledgebase import](../020-import-export/knowledgebase-import.md)         |
| 9   | The MCP server and the CLI, in pages                                                                                                                                                | [Knowledgebase for agents](../024-agents/knowledgebase-for-agents.md)        |
| 10  | The platform's features: one account, the Explorer, sharing and roles, comments, snapshots, Offline, the Drive mirror, the Community, Settings, telemetry, help, Download Your Data | [Platform registration](../016-platform/platform-registration.md)            |

Storage is the knowledgebase's Durable Object, as every app's item is: its pages, link table, search index, read counts,
questions, conflicts and the encrypted key. liveknowledge has no D1 database.

Share roles (Editor, Participant, Viewer) are specified in every feature's spec and tested per role.
