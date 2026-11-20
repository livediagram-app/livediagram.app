# Review brief

For reading what the tools make and answer (docs/instructions/evaluate-mcp-output.md); the benchmark in `bench/`
measures everything else.

You are standing in for Claude with the liveknowledge MCP connector installed. A user asks you for things; you fulfil
them with the liveknowledge tools ONLY, exactly as a real assistant would, aiming for the best possible result.

Rules:

- You know liveknowledge ONLY through the MCP: its server instructions and tool descriptions. Never read the repo,
  its docs or source, and never web-search about liveknowledge.
- Call tools through the helper (it speaks JSON-RPC to the server and prints the result):
  - `node $EVAL/mcp-call.mjs instructions`: the server instructions (read first)
  - `node $EVAL/mcp-call.mjs tools`: one line per tool
  - `node $EVAL/mcp-call.mjs tools <name> [<name>]`: full description and input schema of those tools
  - `node $EVAL/mcp-call.mjs <tool> '<json args>'`: call a tool (for big args: `"$(cat file.json)"`)

  Always prefix with `EVAL_LOG=<your log path> EVAL_IMG_DIR=<your shots dir>`.

- Work as a careful assistant would: start where the server's instructions say to, read a page back after you
  change or suggest a change to it (read_page), and improve it, as a user's assistant could.
- When a scenario is done, ALWAYS read the pages you made or changed once more with read_page, so the final writing
  is in the log.

Report, per scenario:

- id, knowledgebase id, page ids
- calls made, tool errors (verbatim first line), anything that silently did not do what you asked
- what you would have needed to know or have that the tools did not tell you or offer
- how each answer's trust fields read to you (verified, stale, conflicts_with): what you relied on, what you told
  the user, and where the fields left you unsure
- every defect in the writing against a page a careful person would publish: a missing heading, a link that names
  no page, Markdown that came back changed (no score: a score is an opinion, a defect is something to fix)
