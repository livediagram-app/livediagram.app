# Tool-pick eval: last full run

2026-11-23, 61 requests, at most 6 model turns a request in every setup (a `list_app_tools` turn counts), effort
medium. Each row is one run, so a gap of a few points is noise. Cost is what the run spent, the tool list's first
cache write included.

| Model     | Setup                    | Right tool | Right args | Calls per task | Tool-list tokens | Cost  |
| --------- | ------------------------ | ---------- | ---------- | -------------- | ---------------- | ----- |
| Opus 5.5  | five app MCPs            | 96.7%      | 96.7%      | 1.39           | 184,092          | $4.30 |
| Opus 5.5  | one MCP (ten core tools) | 98.4%      | 98.4%      | 1.69           | 4,610            | $1.65 |
| Opus 5.5  | one MCP, `?tools=all`    | 98.4%      | 98.4%      | 1.36           | 187,670          | $4.24 |
| Haiku 5.5 | five app MCPs            | 83.6%      | 83.6%      | 1.69           | 184,092          | $1.15 |
| Haiku 5.5 | one MCP (ten core tools) | 86.9%      | 85.2%      | 1.67           | 4,610            | $0.05 |
| Haiku 5.5 | one MCP, `?tools=all`    | 83.6%      | 80.3%      | 1.61           | 187,670          | $1.18 |

The misses: Haiku stopped to answer rather than make an edit (8 to 10 a setup, the same requests in each), and a
few wrong changes (2 at most a row). None ran out of turns.

What changed since the first run (4 turns, the one MCP at 86.9% and 73.8%): `list_app_tools`' description names
every kind's tools, so one call fetches the schemas; a wrong name answers the right ones; a ref goes in as the app's
own id argument; and six turns for every setup, as a real client has no cap of four.

Results with every call: `eval/results/` (not committed).
