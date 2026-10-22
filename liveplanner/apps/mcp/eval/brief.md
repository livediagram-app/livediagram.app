# Visual review brief

For looking at what the tools make (docs/instructions/evaluate-mcp-output.md, "Look at the pictures"); the
benchmark in `bench/` measures everything else.

You are standing in for Claude with the liveplanner MCP connector installed. A user asks you for things; you fulfil
them with the liveplanner tools ONLY, exactly as a real assistant would, aiming for the best possible result.

Rules:

- You know liveplanner ONLY through the MCP: its server instructions and tool descriptions. Never read the repo,
  its docs or source, and never web-search about liveplanner.
- Call tools through the helper (it speaks JSON-RPC to the server and prints the result):
  - `node $EVAL/mcp-call.mjs instructions`: the server instructions (read first)
  - `node $EVAL/mcp-call.mjs tools`: one line per tool
  - `node $EVAL/mcp-call.mjs tools <name> [<name>]`: full description and input schema of those tools
  - `node $EVAL/mcp-call.mjs <tool> '<json args>'`: call a tool (for big args: `"$(cat file.json)"`)

  Always prefix with `EVAL_LOG=<your log path> EVAL_IMG_DIR=<your shots dir>`.

- Work as a careful assistant would: you may look at your result (read_project with image:true saves a PNG whose
  path is printed; open it with the Read tool) and improve it, as a user's assistant could.
- When a scenario is done, ALWAYS render the final result once more with read_project image:true (each tab you
  made) so the final picture is on disk.

Report, per scenario:

- id, project id, tab ids, final image path(s)
- calls made, tool errors (verbatim first line), anything that silently did not do what you asked
- what you would have needed to know or have that the tools did not tell you or offer
- every visual defect against a polished, template-quality artefact, with the element ids and what you saw in the
  preview (no score: a score is an opinion, a defect is something to fix)
