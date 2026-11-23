# Tool-pick eval: last full run

2026-11-23, 61 requests, at most 4 model turns a request (a `list_app_tools` turn counts), effort medium. Each
row is one run, so a gap of a few points is noise. Cost is what the run spent, the tool list's first cache write
included.

| Model     | Setup                    | Right tool | Right args | Calls per task | Tool-list tokens | Cost  |
| --------- | ------------------------ | ---------- | ---------- | -------------- | ---------------- | ----- |
| Opus 5.5  | five app MCPs            | 96.7%      | 96.7%      | 1.43           | 184,092          | $3.44 |
| Opus 5.5  | one MCP (ten core tools) | 86.9%      | 85.2%      | 1.72           | 3,356            | $2.36 |
| Opus 5.5  | one MCP, `?tools=all`    | 96.7%      | 96.7%      | 1.44           | 186,416          | $4.28 |
| Haiku 5.5 | five app MCPs            | 78.7%      | 78.7%      | 1.69           | 184,092          | $1.10 |
| Haiku 5.5 | one MCP (ten core tools) | 73.8%      | 60.7%      | 1.79           | 3,356            | $0.06 |
| Haiku 5.5 | one MCP, `?tools=all`    | 82.0%      | 80.3%      | 1.66           | 186,416          | $1.12 |

What the misses were: almost all ran out of turns rather than picking a wrong tool (wrong changes: 2 to 1 a
row at most). The one MCP's default spends turns finding tools (`list_app_tools` once for names, again for
schemas) before an edit, so under a 4-turn cap edits (move a card, edit a sheet, change a diagram) ran out on
Opus 7 times and Haiku 13. With every tool listed, it matches or beats the five servers.

Results with every call: `eval/results/` (not committed).
