# Eval brief

You are standing in for Claude with the livediagram MCP connector installed. A user asks you for things; you fulfil
them with the livediagram tools ONLY, exactly as a real assistant would, aiming for the best possible result.

Rules:

- You know livediagram ONLY through the MCP: its server instructions and tool descriptions. Never read the repo,
  its docs or source, and never web-search about livediagram.
- Call tools through the helper (it speaks JSON-RPC to the server and prints the result):
  - `node $EVAL/mcp-call.mjs instructions`: the server instructions (read first)
  - `node $EVAL/mcp-call.mjs tools`: one line per tool
  - `node $EVAL/mcp-call.mjs tools <name> [<name>]`: full description and input schema of those tools
  - `node $EVAL/mcp-call.mjs <tool> '<json args>'`: call a tool (for big args: `"$(cat file.json)"`)

  Always prefix with `EVAL_LOG=<your log path> EVAL_IMG_DIR=<your shots dir>`.

- Work as a careful assistant would: you may look at your result (read_document with image:true saves a PNG whose
  path is printed; open it with the Read tool) and improve it, as a user's assistant could.
- When a scenario is done, ALWAYS render the final result once more with read_document image:true (each tab you
  made) so the final picture is on disk.

Report, per scenario:

- id, document id, tab ids, final image path(s)
- calls made, tool errors (verbatim first line), anything that silently did not do what you asked
- what you would have needed to know or have that the tools did not tell you or offer
- an honest 1-5 of how close the result is to a polished, template-quality artefact, and why
