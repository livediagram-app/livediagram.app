# Agent-facing CLI ergonomics and discoverability

Research for the `livediagram` CLI, an interface built mainly for AI agents. Measured on 2026-10-03.
This report covers one angle: how a CLI should look to an LLM caller, and what that means for livediagram.
It records evidence and recommendations; the spec, once written, decides.

## 1. The answer in brief

- **Use a CLI with progressive help, not a CLI that copies the MCP.** The livediagram MCP costs about **12.2k tokens**
  of tool definitions on every turn (21.5k with the deprecated aliases). A CLI costs nothing until the agent asks.
  Then it pays about 380 tokens for the top-level help and about 350 for one command's help.
- **Default to a compact, line-per-thing text view.** On the system-architecture template, the outline view
  is **14x smaller** than minified JSON (181 vs 2,619 tokens). The geometry view is **6.6x smaller** (399).
  Add `--json` when asked, with field selection, so it never balloons the way `gh … --json <all fields>`
  did: **35.8k tokens for 10 PRs**.
- **Give several views of one tab, each sized for one question.** `outline` covers structure and wording,
  `layout` covers geometry, `comments` covers open threads, `check` covers problems, and `json` covers everything.
- **Use short refs that stay stable.** Show the shortest unique id prefix, at least 4 characters, the way git
  shortens SHAs. Also accept an exact label, and a document name or a pasted livediagram URL.
  A full UUID costs 23 tokens. A prefix costs 4.
- **After every write, print the delta**: `+ e7a1 square "Token cache" @520,140 160x60`. In SWE-agent, showing
  the result after each edit, with guardrails, was the largest single interface win (+7.7 pp).
- **Make errors something the model can fix.** Say what was wrong and the closest valid values, then give one
  runnable corrected command, all on stderr. SWE-agent found a 42.8% chance an agent never recovers after one
  failed edit, so the first error message matters.
- **Never prompt when not attached to a terminal.** Support `--dry-run` on every write. Make destructive verbs
  reversible rather than confirm-gated, and add a local undo journal, because the API has no tab history.
- **Use one registry as the source.** Help, `guide`, `schema` and a shipped `SKILL.md` all come from the same
  command registry and from `packages/document` vocabularies, as `packages/agent-verbs/src/mcp/schema.ts` already does.
  CI tests enforce the token budgets.
- **Keep the CLI and the MCP side by side.** A chat agent with no shell still needs the MCP. Put the editing
  core (refs, ops, views, deltas, normalisation) in a shared package so neither interface drifts from the other.
- **The API has a blocking gap.** A tab `PUT` from a token is stored as sent, with no room cursor, so no merge
  happens. It reaches live viewers "only when they next load the tab" (`docs/specs/015-api/api.md`). An agent
  editing while a person watches therefore needs an element-ops endpoint that goes through the room
  (section 7).

## 2. What the evidence says

### 2.1 SWE-agent: the Agent-Computer Interface (Yang et al., 2024)

The paper behind SWE-agent ([arXiv 2405.15793](https://arxiv.org/abs/2405.15793)) treats the interface as a
design surface in its own right. The same model did **64% better (relative) with the ACI than with a bare shell**.
Its four principles:

1. Actions should be **simple and easy to understand**: few options, concise docs ("many bash commands have
   documentation that includes dozens of options").
2. Actions should be **compact and efficient**: important operations consolidated into as few actions as possible.
3. Feedback should be **informative but concise**: substantive state, no noise. An empty result says so
   explicitly ("Your command ran successfully and did not produce any output").
4. **Guardrails** mitigate error propagation. Their example is a linter on `edit` that rejects syntax-breaking edits
   and shows the before and after.

Ablations on SWE-bench Lite (GPT-4 Turbo, 18.0% baseline):

| Interface change                                   | Resolved | Delta |
| -------------------------------------------------- | -------- | ----- |
| No edit command (sed/redirection only)             | 10.3%    | -7.7  |
| Edit without linting guardrail                     | 15.0%    | -3.0  |
| Iterative search (one result at a time, IDE-style) | 12.0%    | -6.0  |
| No search command                                  | 15.7%    | -2.3  |
| File viewer 30 lines                               | 14.3%    | -3.7  |
| File viewer whole file                             | 12.7%    | -5.3  |
| Full history instead of last 5 observations        | 15.0%    | -3.0  |

What this means for livediagram:

- A **window that is too small or too large both hurt**. A tab view should be bounded and pageable, never "the whole JSON".
- **Summarised search beats iterative search**. SWE-agent caps results at 50 and asks for a narrower query
  beyond that. `doc ls` and `el ls --grep` should list everything up to a cap and say how to narrow.
- **Editing is where agents fail**: 51.7% of trajectories had at least one failed edit. Validating before
  writing and echoing the result is the highest-leverage feature.
- Human interfaces are not agent interfaces. Their example: chains of `cd`/`ls`/`cat` are wasteful. For us, that
  means "read the full tab JSON, patch it, PUT it back" is the human-API path, not the agent path.

### 2.2 Anthropic: writing tools for agents

From [Writing effective tools for agents](https://www.anthropic.com/engineering/writing-tools-for-agents) (Sep 2025):

- **Do not just wrap endpoints.** Build tools that consolidate a workflow, such as `search_contacts` rather than
  `list_contacts`, or `get_customer_context` rather than three getters. For us, `tab view` should return the
  outline with comment counts, not "GET tab" plus "GET comments".
- **Namespace by service and resource.** Prefix versus suffix naming changed their eval results. The
  `<resource> <verb>` form is a namespace.
- **Return high-signal fields and avoid opaque ids.** "Merely resolving arbitrary alphanumeric UUIDs to more
  semantically meaningful … (or even a 0-indexed ID scheme) significantly improves Claude's precision …
  by reducing hallucinations."
- **Offer `response_format: concise | detailed`.** Their concise Slack response was about a third of the detailed
  one (72 vs 206 tokens). This maps to CLI views and `--json`.
- **Paginate, filter, range-select and truncate with sensible defaults**, and **steer when truncating**:
  say what was cut and how to ask for it. Claude Code caps a tool response at 25k tokens.
- **Prompt-engineer errors** into "specific and actionable improvements" rather than codes or tracebacks.
- **Describe the tool as you would to a new hire.** Use unambiguous parameter names (`user_id`, not `user`).
- **Evaluate with realistic multi-step tasks** and read the transcripts. Count tool calls, tokens and errors.
  Agents improved the tools more than human experts did.

### 2.3 Agent Skills and progressive disclosure

From [Equipping agents with Agent Skills](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)
(Oct 2025, an open standard since Dec 2025), disclosure happens in three levels:

1. **Frontmatter** (`name`, `description`) sits in the system prompt for every installed skill, so it must be
   small. Ours measures 62 tokens.
2. The **SKILL.md body** loads only when the skill is relevant.
3. **Linked files and scripts** load only as needed, "effectively unbounded". Scripts run without being read.

From [Code execution with MCP](https://www.anthropic.com/engineering/code-execution-with-mcp): when tools are
presented as files to explore on demand, one workflow dropped from **150,000 to 2,000 tokens (-98.7%)**. A
`search_tools` tool with a detail-level parameter is the in-protocol version of the same idea.

For a CLI, `--help` **is** level 2 and `guide`/`schema` **are** level 3. Playwright makes this explicit, as
the next section shows.

### 2.4 Code mode and the CLI-over-MCP argument

- **Cloudflare Code Mode** ([Code Mode](https://blog.cloudflare.com/code-mode/),
  [the whole API in about 1,000 tokens](https://blog.cloudflare.com/code-mode-mcp/)) argues that "LLMs are better at
  writing code to call MCP, than at calling MCP directly". The reason given is that models have seen a lot of
  code and very few synthetic tool calls. Their Cloudflare API server exposes two tools (`search`, `execute`) in
  about 1k tokens, against **1.17M tokens** as plain MCP tools (-99.9%).
- **Mario Zechner (pi)** ([What if you don't need MCP](https://mariozechner.at/posts/2025-11-02-what-if-you-dont-need-mcp/),
  [pi](https://mariozechner.at/posts/2025-11-30-pi-coding-agent/)): pi "does not and will not support MCP".
  Playwright MCP (21 tools, 13.7k tokens) and Chrome DevTools MCP (26 tools, 18k tokens) take 7 to 9% of the
  context before any work starts. His alternative is "CLI tools with README files", read only when needed,
  composable through pipes and files. pi's own system prompt and tools come in under 1,000 tokens.
- **The fair counterweight**, also from Mario ([MCP vs CLI](https://mariozechner.at/posts/2025-08-15-mcp-vs-cli/),
  120 runs): a well-made MCP and a well-made CLI were "**truly a wash**". Both succeeded 100% of the time, and
  the MCP was 23% faster and 2.5% cheaper, partly because Claude Code runs a safety check on every bash call.
  Output cleanliness mattered more than the protocol: terminalcp's clean output beat tmux by 39% on the complex
  task. The lesson is **design quality over transport**.
- **Playwright CLI** ([microsoft/playwright-cli](https://github.com/microsoft/playwright-cli)) sits alongside
  Playwright MCP. Coding agents "increasingly favor CLI-based workflows exposed as SKILLs … more token-efficient:
  they avoid loading large tool schemas". It ships `install --skills`, and works without the skill too
  ("It'll read the skill off `playwright-cli --help` on its own"). It uses short element refs (`click e21`) taken
  from a `snapshot`, and offers `snapshot --depth=N` and `find <text>` to stay small.

The conclusion for livediagram: the **audience decides the transport**.

- **Coding agents with a shell** (Claude Code, pi, Codex) are best served by the CLI plus a skill. They can
  compose it: `git diff | livediagram el apply`, Mermaid from a file, render to PNG and look at it.
- **Chat agents without a shell** (claude.ai, the "change it while I talk" case) only have MCP. So the MCP stays.
- Both should sit on **one editing core**: the same refs, ops, views and deltas. Then the CLI's good ideas
  (compact views, deltas, refs) improve the MCP too, and vice versa.

### 2.5 Prior-art CLIs: what to borrow, what to avoid

| CLI            | Borrow                                                                                                                                                                                                                                                                                            | Avoid                                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| gh             | `resource verb` shape. Piped output turns to plain TSV (no colour, no truncation). `--json fields` with **no argument lists the valid fields**. Built-in `--jq`/`--template`. `GH_PROMPT_DISABLED`, `NO_COLOR`. "Did you mean list?" on typos. Documented exit codes (0, 1, 2 cancelled, 4 auth). | `--json` with every field: 35.8k tokens for 10 PRs, because `body` and friends come along.               |
| kubectl        | `explain TYPE.FIELD` as the schema browser, served from the server's OpenAPI. `apply` is declarative and idempotent. `diff` and `--dry-run=client\|server`. `-o name` for ids only.                                                                                                               | `get --help` is 1,473 tokens. Too many output modes (14) to explain to a model.                          |
| wrangler       | Nested resources (`d1 execute`). Clear per-command help (about 380 tokens).                                                                                                                                                                                                                       | ANSI colour and an emoji log-file line **on stderr even when piped** (measured): noise in agent context. |
| playwright-cli | Help doubles as the skill. Refs from a snapshot. Output written to files with the path printed, not inlined (screenshots, snapshots). `--depth`, `find`.                                                                                                                                          | One flat list of about 70 commands: 2.2k tokens in the README alone.                                     |
| jq             | Stdin-first. `-r` raw, `-c` compact. `-e` sets the exit code from the result.                                                                                                                                                                                                                     |                                                                                                          |
| git            | **Porcelain vs plumbing**: friendly default output, plus a stable `--porcelain[=v2]` and `-z` contract for scripts. Abbreviated SHAs that grow until unique. "did you mean".                                                                                                                      | Help pages that run to man pages.                                                                        |
| aws            | `--output json\|text\|table\|yaml\|off`, where `off` means "exit code only". `--query` (JMESPath). `AWS_PAGER=""`.                                                                                                                                                                                | The pager is on by default in a TTY, which hangs agents that use a pseudo-terminal.                      |
| gcloud         | `--format=value(name)`, `--filter`, `--limit`, `--page-size`. Projections pick fields.                                                                                                                                                                                                            | A large format mini-language.                                                                            |
| llm            | Stdin piping (`cat f \| llm -t …`). `llm models --options` lists what is valid where it is used. `--schema` for structured output.                                                                                                                                                                |                                                                                                          |

## 3. Measurements

Token counts use `o200k_base` (via `js-tiktoken`) as a proxy. Claude's tokenizer gives different absolute
numbers, but the ratios hold. All local, read-only.

### 3.1 Help text sizes

| Command                                     | Tokens  | Lines |
| ------------------------------------------- | ------- | ----- |
| `gh --help`                                 | 485     | 65    |
| `gh pr --help`                              | 386     | 47    |
| `gh pr list --help`                         | 465     | 52    |
| `gh pr view --help`                         | 242     | 28    |
| `git --help`                                | 509     | 45    |
| `git commit -h`                             | 900     | 65    |
| `kubectl --help`                            | 678     | 73    |
| `kubectl get --help`                        | 1,473   | 126   |
| `wrangler --help`                           | 854     | 64    |
| `wrangler d1 --help`                        | 378     | 24    |
| `wrangler d1 execute --help`                | 381     | 28    |
| `jq --help`                                 | 649     | 63    |
| playwright-cli command list                 | 2,243   | 155   |
| **mock `livediagram --help`** (§6.1)        | **380** | 32    |
| **mock `livediagram el --help`** (§6.2)     | **162** | 14    |
| **mock `livediagram el add --help`** (§6.3) | **349** | 28    |

The best-designed CLIs land at **250 to 500 tokens per help screen**, whatever their surface size. gh covers
a huge API at 485 at the top. Past about 900 tokens, the help is a manual.

### 3.2 The current MCP's upfront cost

`tools/list` from the real `registerTools` (in-memory client, `apps/mcp/src/mcp-test-client.ts`):

| Tool                                                              | Tokens          |
| ----------------------------------------------------------------- | --------------- |
| `create_document`                                                 | 4,631           |
| `add_tab`                                                         | 2,439           |
| `update_document`                                                 | 2,401           |
| the other eight                                                   | 257 to 384 each |
| **11 current tools**                                              | **≈12.2k**      |
| **all 19 advertised (with `*_diagram` aliases until 2027-04-30)** | **21.5k**       |
| schema resource `livediagram://schema/elements`                   | 1,898           |

The element format is repeated inline in each of the three element-taking tools, about 2k tokens each time.
With a CLI, the agent reads `livediagram schema sticky` (about 100 tokens) only when it places a sticky.

### 3.3 One tab, five representations

The templates were built with `buildTemplate(kind, 0, 0)` and serialised five ways.
"compact" is one line per element with geometry; "outline" is labels and edges only.

| Template            | Elements | JSON pretty | JSON min | compact (geometry) | outline |
| ------------------- | -------- | ----------- | -------- | ------------------ | ------- |
| flowchart           | 33       | 3,874       | 2,764    | 488                | 192     |
| system-architecture | 27       | 3,713       | 2,619    | 399                | 181     |
| orgchart            | 49       | 7,214       | 4,982    | 771                | 334     |
| er-diagram          | 17       | 3,025       | 2,058    | 331                | 184     |
| retrospective       | 35       | 4,511       | 3,178    | 633                | 237     |
| sequence-diagram    | 34       | 4,534       | 3,026    | 583                | 351     |
| swimlane            | 24       | 2,982       | 2,123    | 348                | 155     |
| kanban              | 99       | 13,798      | 9,646    | 1,643              | 536     |

The compact view runs **5 to 7x** smaller than minified JSON, and the outline **11 to 18x** smaller.
Minified JSON is still heavy because of UUIDs and presentation fields (`textSize`, `padding`, `layerId`,
alignment). A model rarely needs these to reason about a diagram. The mock outline in §6.4, with lane
grouping, id prefixes and comment counts, is 279 tokens.

### 3.4 Reference costs

| Reference form                 | Tokens |
| ------------------------------ | ------ |
| full element UUID              | 23     |
| document URL with UUID         | 33     |
| 4-hex prefix (`e7a1`)          | 4      |
| quoted label (`"API gateway"`) | 4      |
| positional handle (`s12`)      | 2      |

Positional handles are cheapest but **unstable**: they shift when elements are added or removed, so a handle
the agent saw two turns ago now points at something else. Prefixes are stable at twice the cost. Labels are
readable, but ambiguous and they change. Hence: show prefixes, accept all three, and fail loudly on ambiguity
(§6.5).

### 3.5 Output shape: gh as the cautionary example

| `gh pr list -s all -L 10` on this repo | Tokens |
| -------------------------------------- | ------ |
| default (piped TSV, 5 columns)         | 429    |
| `--json number,title`                  | 216    |
| `--json` with every scalar field       | 35,834 |

Choosing fields is the difference between a cheap call and a context-filling one. The default `--json`
needs a **default field set**, not "everything".

## 4. Principles for the livediagram CLI

### 4.1 Shape and naming

- `livediagram <resource> <verb> [ref] [flags]`. Resources: `doc`, `tab`, `el`, `comment`, `template`, plus
  `schema`, `guide`, `auth`, `skill`. Seven or fewer verbs per resource.
- Use the **domain language** exactly (`docs/specs/003-system-architecture/domain-language.md`): document,
  tab, element, comment thread, template, kind. No synonyms such as "board" or "diagram".
- Keep verbs consistent across resources: `ls`, `view`, `add`/`create`, `set`, `rename`, `rm`, `restore`.
  Do not mix `list`/`ls`. Accept the gh-style long forms (`list`, `delete`) as hidden aliases, because models
  will type them.
- **Use positional refs for the subject and flags for everything else.** Flags carry one meaning each across
  the whole CLI: `--json`, `--dry-run`, `-q`, `--limit`.
- Typo help like git and gh: `unknown verb "lst" for "doc"; did you mean: ls`.

### 4.2 Progressive help, with token budgets

| Level | Command                                | Content                                                                   | Budget       |
| ----- | -------------------------------------- | ------------------------------------------------------------------------- | ------------ |
| 0     | skill frontmatter                      | when to use the CLI                                                       | ≤ 80         |
| 1     | `livediagram` / `--help`               | resources with their verbs, ref syntax, output contract, 4 starting moves | ≤ 500        |
| 2     | `livediagram <resource> --help`        | verbs, one line each                                                      | ≤ 250        |
| 3     | `livediagram <resource> <verb> --help` | usage, flags, 2-3 examples, what it prints                                | ≤ 400        |
| 4     | `livediagram schema [kind]`            | kinds list, or one kind's fields, values and defaults (`kubectl explain`) | ≤ 300 each   |
| 4     | `livediagram guide <topic>`            | how-to: build, edit, layout, comments, refs, sync                         | ≤ 1,200 each |
| -     | `livediagram skill [--install]`        | prints or installs `SKILL.md` (body ≤ 1,500), which links to guide topics | -            |

Rules:

- **The top help lists every resource and verb**, so the agent never has to explore to learn what exists.
  Explore only for _how_.
- **Every help screen ends in a pointer to the next level.** Every output that has an obvious next move says it
  in one `next:` line.
- **Examples beat prose.** Each verb shows two or three real invocations and what it prints. The printed shape
  teaches the ref syntax for free.
- **Help states facts, not instructions to the model** (the MCP's §4.15 rule carries over). "The box is
  `square`" rather than "Never use rectangle".
- **Enumerations are generated** from `packages/document` (`SHAPE_KINDS`, `ANCHORS`, `STICKY_PRESETS`,
  `CODE_LANGUAGES`), so help cannot drift from the validator.
- **Budgets are tests.** A unit test renders every help screen and checks it against its budget with a
  tokenizer. Shift-left beats regret.

### 4.3 Output: porcelain by default, plumbing on request

- **Default text is stable porcelain.** One record per line, with the ref first. No colour, spinner or pager when
  stdout is not a TTY, and none ever under `NO_COLOR`. A human TTY may get colour, but the **same words**: an
  agent that runs under a pseudo-terminal must not see different content.
- **`--json`** emits the same records as JSON with a **default field set** that mirrors the text view.
  `--json a,b` picks fields, `--json` with an unknown field lists the valid ones (gh's trick), and `--json all`
  is explicit. Output is one compact JSON document. For streams, `--jsonl`.
- **`-q`** prints ids only (`kubectl -o name`, `aws --output off` family), for chaining.
- **Use no `--jq` for now.** `--json fields` covers most needs, and coding agents have `jq`. Revisit if evals
  show chat-sandbox agents without `jq`.
- **Silence is explicit.** An empty result prints `no elements match "cache" on "Auth flow/Overview"`, never
  nothing (SWE-agent).
- **Binary goes to files.** `tab render` writes a PNG or SVG and prints its path and size. It never prints
  base64 to stdout. An agent with vision opens the file to check its work. This is the CLI form of the MCP's
  inline PNG, at zero cost unless looked at.

### 4.4 Views: different questions, different shapes

`tab view <doc/tab> --view <v>` (the default is `outline`):

| View       | Answers                                    | Shape                                                                                     |
| ---------- | ------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `outline`  | what is on it and how it connects          | header (counts), containers (frames/lanes) with children indented, then `A -> B "label"`  |
| `layout`   | where things are                           | `ref kind "label" @x,y wxh`, arrows as `ref a.e -> b.w`                                   |
| `text`     | all words, for summarising or proofreading | every label, note, sticky, table cell and code block, grouped by container                |
| `comments` | open discussion                            | per thread: element ref + label, then `author, age: text`; resolved hidden unless `--all` |
| `check`    | what is wrong                              | the lint findings (§4.8)                                                                  |
| `json`     | everything, for round-tripping             | the stored `Tab`, minus redacted fields                                                   |

- `el ls` has the same views plus filters (`--kind`, `--in <frame>`, `--grep <text>`, `--near <el>`), so an
  agent can zoom in on part of a 300-element board without reading all of it.
- `doc view` gives a document summary: its tabs with element counts and open-thread counts, share state,
  library and URL. That is the "context" call that replaces several (§2.2).
- Both `outline` and `layout` are **lossy on purpose** and say so in the header when content is omitted
  (`… 12 freehand strokes not shown; --kind freehand`).

### 4.5 Refs and ids

- **Documents**: an exact name, a unique case-insensitive substring, an id prefix, or a pasted
  `livediagram.app` URL. The last matters most for chat agents, which get handed links.
- **Tabs**: `doc/tab` by name or prefix. A bare `doc` means its first tab.
- **Elements**: the shortest unique id prefix within the tab (at least 4 characters, git-style), or an
  exact label in quotes. A ref that matches more than one is an error that lists the candidates (§6.5),
  never a guess.
- **New elements** get real UUIDs (the editor's invariant). The delta line shows their prefix. In a batch
  (`el apply`), ops can name new elements `$name` and refer to them later in the same batch. The result maps
  each `$name` to its prefix. No client-side alias state survives between calls; state lives on the server.
- Labels are never ids: a rename does not break a prefix the agent holds.

### 4.6 Editing: three gears

1. **Build a whole tab from intent**: `tab add|replace <doc/tab> --mermaid <file|->`, `--graph <file|->`
   (the MCP's graph JSON) or `--template <kind>`. The server lays it out. This is the cheapest path to a good
   diagram, and the one the MCP already proves.
2. **Make surgical edits**: `el add | set | connect | move | rm`. Each is one intent with relative placement
   (`--near <el> --side e`, `--in <lane>`), so the agent rarely does coordinate arithmetic. Auto-layout is off,
   because the person's positions are sacred (as in the MCP's `ops` mode).
3. **Apply a batch**: `el apply <file|->` with one op per line (JSONL, or a terse line syntax mirroring the
   delta format). It is atomic: everything validates or nothing is written. This is the code-mode-lite
   path: one call, many changes, one delta back.

Every write:

- **validates before writing**, with the same `isValidTab` plus the MCP's `element-normalise` pass
  (shared, not copied);
- **prints the delta** (`+`, `~`, `-`, with refs) and the URL, nothing more;
- **accepts `--dry-run`**, which prints the delta it would make and exits 0.

### 4.7 Comments

- `comment ls <doc[/tab]>` lists open threads across the document, newest first, with `--all` to include
  resolved ones.
- `comment add <el> "text"` starts or extends a thread. `comment reply <el>` is an alias that makes the intent
  readable. `comment resolve|reopen <el>`.
- Mentions use `@handle`, resolved server-side (`comment-mentions.ts`). An unknown handle is an error that
  lists the candidates.
- Today comments are written by a whole-tab `PUT` (`commentThread` on the element). The CLI must not
  read-modify-write a tab to add one comment while a person is editing it (§7).

### 4.8 Guardrails: a linter for diagrams

`tab check` (also run, and summarised as one line, after every write) reports things a model cannot see
from the outline:

- overlapping nodes, and labels that overflow their box;
- arrows with a free end near an element (meant to be pinned);
- nodes with no connections in a diagram that has connections;
- colours set on themed elements (the theme owns them);
- elements left outside every lane on a swimlane tab.

This is SWE-agent's linter for our domain: catch the slip at the turn it happens, while recovery is cheap.

### 4.9 Errors and exit codes

- Errors go to **stderr** in a fixed shape: `error: <what> (exit N)`, then the candidates or valid values,
  then `hint:` with one runnable corrected command (§6.5). Never a stack trace, unless `--debug` is set.
- Echo the agent's own input in the error (`unknown shape "rectangle"`), so the fix is local to its last turn.
- API errors are translated, not forwarded. `409 empty_tab_overwrite_blocked` becomes
  `refusing to empty a tab with 14 elements; to clear it: tab replace … --allow-empty`.

| Exit | Meaning                                       | An agent should                       |
| ---- | --------------------------------------------- | ------------------------------------- |
| 0    | success (including an empty result)           | carry on                              |
| 1    | unexpected failure (5xx, network)             | retry once, then report               |
| 2    | usage or validation error (model-correctable) | read the hint, fix the call           |
| 3    | not found or ambiguous ref                    | pick from the listed candidates       |
| 4    | not signed in, token expired, or read-only    | ask the person (`auth login`)         |
| 5    | conflict (stale write, tab changed meanwhile) | re-read, re-apply                     |
| 6    | rate limited                                  | wait for the `retry-after` it printed |

This aligns with gh's 4 for auth. The codes stay few enough to state in the top help in one line.

### 4.10 Destructive verbs, dry runs and undo

- **No interactive prompts unless stdin and stdout are both TTYs.** `LIVEDIAGRAM_NO_PROMPT=1` and `CI` also
  disable them. A command that would have asked fails with exit 2 and names the flag (`--yes`).
- **Prefer reversibility to confirmation.** Confirmation teaches agents to append `--yes` reflexively.
  - `doc rm` moves the document to the Trash (30 days) and prints the `doc restore` command. No prompt.
  - `tab rm`, `tab replace` and `el rm` of more than N elements are irreversible on the server (no tab history).
    The CLI writes the pre-image to a **local undo journal** (`$XDG_STATE_HOME/livediagram/undo/`) and prints
    `undo: livediagram undo 7f2c`. They need `--yes` only when not on a TTY **and** more than N elements would
    go.
  - There is no permanent delete in the CLI's default verbs, matching the MCP. Purging stays in Settings.
- `--dry-run` everywhere a write exists (kubectl's `--dry-run=client`). Later, `--dry-run=server` if the API
  grows a validate-only mode.

### 4.11 Pagination and truncation

- Lists default to `--limit 20` and end with one footer line when cut:
  `… 143 more (showing 20); --limit 100, --cursor 9f3a, or narrow with --grep`.
- Tab views cap at about 200 records (about 2.5k tokens). Beyond that, the view prints the containers with
  counts and says how to zoom: `--in "Services"`, `--kind sticky`, `--grep`.
- Long fields are clipped at a fixed length with a marker (`…(+812 chars; el view 4b3f --field code)`), never
  silently.

### 4.12 Idempotency and retries

- Agents retry after timeouts, so creates need protection from duplicates. Give `doc create` and `tab add`
  `--if-absent`: if a document or tab with that exact name already exists, print it with
  `= exists` and exit 0. This is kubectl `apply` semantics without a manifest.
- `el set`, `move` and `rename` are naturally idempotent. `el add` in a batch with `$names` is atomic, so a
  retried batch either wrote all of it or none of it.
- A declarative path for humans and repos, `livediagram apply diagram.mmd --to "Auth flow/Overview"`
  (create or replace), is the natural home for syncing to local files. It belongs to the sync angle; it is
  only noted here.

### 4.13 Non-interactive guarantees

- Auth by `LIVEDIAGRAM_TOKEN` (an `lvd_…` token) with no other setup. `auth login` (browser or device flow)
  is for humans and writes the same token to the config file. `auth status` prints the account, the token
  name, whether it is read-only, and when it expires.
- No pager, no spinner, no update notice, no ANSI and no emoji on stderr when piped (unlike wrangler, §2.5).
- Stdin is a first-class input (`-` for any file argument), so `mermaid | livediagram tab add … --mermaid -`
  works.
- Deterministic ordering in every list (by position for elements, newest-saved first for documents), so two
  identical calls give identical text and a diff of views is meaningful.

### 4.14 One source of truth, and evaluation

- One **command registry** (`name`, `summary`, `args`, `flags`, `examples`, `prints`) generates the help
  screens, `guide` cross-links, `SKILL.md`, the docs page and shell completions.
- Vocabularies come from `packages/document`, like `packages/agent-verbs/src/mcp/schema.ts`. The editing core (ref resolution,
  ops, normalisation, views, deltas, lint) lives in a **shared package** consumed by the CLI and the MCP.
- **Evals before polish** (Anthropic's loop):
  - Write about 20 realistic tasks: "add a Redis cache between the gateway and Orders DB", "summarise the open
    comments and reply to the oldest", "turn this README's architecture section into a tab", "the person says
    'make the database boxes cylinders'".
  - Run fresh agents that know only that `livediagram --help` exists, and record calls, tokens, errors and
    success.
  - Feed the transcripts back to an agent to rewrite the help. Rerun on a held-out set.

## 5. Recommendations, ranked

1. **Ship progressive help with tested budgets**: 500, 250, 400 tokens, plus `schema` and `guide`, plus a
   `SKILL.md` installed by `livediagram skill --install`.
2. **Make the default `tab view` the outline**, with `layout`, `text`, `comments`, `check` and `json` as
   explicit views, and a default field set for `--json`.
3. **Use git-style id prefixes, label refs and URL refs**, with loud ambiguity errors.
4. **Echo the delta after every write**, with `--dry-run` everywhere and a one-line lint summary.
5. **Use model-correctable errors**: what was wrong, valid values, one runnable fix, and the exit codes of §4.9.
6. **Rely on reversibility over prompts**: the Trash for documents, and the local undo journal for tab writes.
7. **Put the editing core in a shared package** so the CLI and the MCP converge (and the MCP's 12.2k-token
   definitions can shrink by reusing the compact views).
8. **Unblock the API first** (section 7). Without it, "change it while I talk" silently loses edits.

## 6. Mock outputs

Measured with `o200k_base`; mocks only, not a committed interface.

### 6.1 `livediagram --help` (380 tokens)

```bash
livediagram - read, edit and comment on livediagram documents.

Usage: livediagram <resource> <verb> [ref] [flags]

Resources
  doc        documents: ls, view, create, rename, share, rm, restore
  tab        canvases in a document: ls, view, add, replace, rename, rm, render
  el         elements on a tab: ls, add, set, connect, move, rm, apply
  comment    element threads: ls, add, reply, resolve, reopen
  template   scaffolds to start from: ls, view
  schema     element kinds and their fields: schema [kind]
  guide      how-tos: build, edit, layout, comments, refs
  auth       login, status, logout

Refs
  doc  name, id prefix, or livediagram.app URL      "Auth flow", 3f9c
  tab  doc/tab                                      "Auth flow/Overview"
  el   id prefix or quoted label within a tab        e7a1, "API gateway"

Output
  Compact text by default. --json [fields] for JSON, -q for ids only.
  Writes print the change they made. --dry-run shows it without writing.

Start
  livediagram doc ls "auth"                   find a document
  livediagram tab view "Auth flow"            outline of its first tab
  livediagram tab add "Auth flow" --mermaid - build a tab from Mermaid on stdin
  livediagram guide build                     building a diagram from scratch

Env: LIVEDIAGRAM_TOKEN (lvd_...), LIVEDIAGRAM_API. Never prompts when piped.
More: livediagram <resource> --help, livediagram <resource> <verb> --help
```

A line for exit codes (`Exit: 0 ok, 2 fix the call, 3 not found, 4 auth, 5 conflict, 6 rate limited`)
would add about 30 tokens and is worth it.

### 6.2 `livediagram el --help` (162 tokens)

```bash
Elements on a tab. Ref a tab as doc/tab (tab defaults to the first).

Verbs
  ls       list elements: one line each (--view outline|elements|layout)
  add      add a node, text, sticky, table, frame, lane, chart or code block
  set      change fields of one or more elements
  connect  draw an arrow between two elements
  move     move elements (absolute --to x,y or relative --by dx,dy)
  rm       remove elements and the arrows pinned to them
  apply    apply a batch of ops from a file or stdin, all or nothing

Every write prints its delta (+ added, ~ changed, - removed) and accepts
--dry-run. Fields per kind: livediagram schema <kind>.
```

### 6.3 `livediagram el add --help` (349 tokens)

```bash
Add an element to a tab.

Usage: livediagram el add <doc/tab> <kind> [label] [flags]

  <kind>   a shape (square, diamond, cylinder, stadium, circle, ...) or
           text, sticky, table, frame, lane, entity, code-block, bar-chart,
           pie-chart, line-chart. List: livediagram schema
  [label]  heading text, up to 40 chars; longer text goes in --note

Placement (pick one; default: right of the last added element)
  --at x,y            top-left in canvas units
  --near <el> [--side n|e|s|w]   beside an element, spaced and aligned
  --in <frame|lane>   inside a frame or lane, after its last child

Flags
  --note <text>        longer explanation shown as the element's note
  --size w,h           default: fits the label
  --set key=value      any other field (repeatable); see schema <kind>
  --connect-from <el>  also draw an arrow from <el> to the new element
  --dry-run            print the delta, write nothing

Examples
  livediagram el add "Auth flow" square "Token cache" --near "API gateway" --side e
  livediagram el add "Auth flow/Data" cylinder "Sessions DB" --in "Data"
  livediagram el add "Retro" sticky "Deploys were slow" --set fillColor=sky

Prints:  + e7a1 square "Token cache" @520,140 160x60
```

There is no `--id` flag. A caller-chosen alias would need state across calls. Aliases exist only as `$name`
inside an `el apply` batch (§4.5).

### 6.4 `livediagram tab view "Auth flow"` (279 tokens; the same tab is 2,619 as minified JSON)

```bash
tab "Overview" in "Auth flow" (3f9c) · 16 nodes, 11 arrows, 2 open threads
lanes: Clients | Edge | Services | Data
Clients
  5c1e Mobile app
  9a02 Web app
Edge
  b7d4 CDN
  01f8 API gateway
Services
  c3a9 Auth service       [2 comments]
  e40b Orders service
  77d2 Order events
  a1c6 Invoice worker
Data
  d90e Users DB (cylinder)
  4b3f Orders DB (cylinder)
  f2a8 Analytics (cylinder)
  6e15 File storage
arrows
  Mobile app -> API gateway "HTTPS"
  Web app -> API gateway "HTTPS"
  Web app -> CDN "assets"
  API gateway -> Auth service "gRPC"
  API gateway -> Orders service "gRPC"
  Orders service -> Order events "publish"
  Order events -> Invoice worker "consume"
  Auth service -> Users DB "SQL"
  Orders service -> Orders DB "SQL"
  Order events -> Analytics "stream"
  Invoice worker -> File storage "PDF"
next: --view layout (geometry) · comment ls "Auth flow" · el set <el> ...
```

Arrows use labels rather than prefixes. That reads better and costs about the same (§3.4). A duplicate label
falls back to the prefix.

### 6.5 Model-correctable errors (about 60 tokens each)

```bash
error: unknown shape "rectangle" (exit 2)
hint: the box is "square"; shapes: square, circle, diamond, cylinder, stadium, hexagon, parallelogram, frame
hint: livediagram el add "Auth flow" square "Token cache" --near "API gateway"
```

```bash
error: "Gateway" matches 2 elements on "Auth flow/Overview" (exit 3)
  01f8 API gateway
  8c2d Payment gateway
hint: use an id prefix, e.g. el set 01f8 --label "Edge gateway"
```

### 6.6 Skill frontmatter (62 tokens, always in context)

```yaml
---
name: livediagram
description: Read, build, edit and comment on livediagram.app diagrams (flowcharts, architecture, ER, boards) with the livediagram CLI. Use when a task mentions a livediagram document or link, or asks to draw or change a diagram.
---
```

## 7. API dependencies and open questions

The ergonomics above only hold if the API can support them. These are the questions the API angle and spec
must settle.

- **Live edits from an agent.** A token's tab `PUT` carries no `X-Room-Cursor`, so no ledger merge happens,
  and the room does not broadcast it. Connected viewers see it only on reload, and their next autosave can
  overwrite it (last writer wins on the whole tab). The "chat agent changes the diagram while the person
  watches" scenario needs a server **element-ops endpoint applied through the document's room** (Durable Object),
  so ops broadcast live and merge at element level. The CLI's `el` verbs and the MCP's `ops` mode would both
  target it.
- **Stale writes.** Nothing like `If-Match`/a tab revision exists, so a read-modify-write races. Exit 5 in
  §4.9 assumes a revision check (or the ops endpoint above, which makes most writes commute).
- **Comment writes** go through the tab today. A thread endpoint (add, reply, resolve) would let `comment add`
  avoid touching anything else on the tab.
- **Rendering.** `tab render` can rasterise locally (resvg in Node, the shared `svg-render.ts`), or use a server
  endpoint. Doing it locally keeps it working offline and on self-hosts.
- **Document lookup by name across team libraries**, without the client sweeping every team, would make
  `doc ls` and name refs a single call (the MCP sweeps today, `find-documents.ts`).
- **Short ids.** If evals show prefixes still produce wrong refs, the alternative is server-issued short element
  ids for new elements. That is a data-model change, so it is deferred until evals ask for it.

## 8. Sources

- Yang et al., _SWE-agent: Agent-Computer Interfaces Enable Automated Software Engineering_, 2024.
  [arXiv 2405.15793](https://arxiv.org/abs/2405.15793)
- Anthropic, [Writing effective tools for agents, with agents](https://www.anthropic.com/engineering/writing-tools-for-agents), 2025-09-11
- Anthropic, [Equipping agents for the real world with Agent Skills](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills), 2025-10-16
- Anthropic, [Code execution with MCP](https://www.anthropic.com/engineering/code-execution-with-mcp)
- Cloudflare, [Code Mode: the better way to use MCP](https://blog.cloudflare.com/code-mode/) and
  [Code Mode: give agents an entire API in 1,000 tokens](https://blog.cloudflare.com/code-mode-mcp/)
- Mario Zechner, [What if you don't need MCP at all?](https://mariozechner.at/posts/2025-11-02-what-if-you-dont-need-mcp/),
  [MCP vs CLI: benchmarking tools for coding agents](https://mariozechner.at/posts/2025-08-15-mcp-vs-cli/),
  [pi coding agent](https://mariozechner.at/posts/2025-11-30-pi-coding-agent/)
- Microsoft, [playwright-cli README](https://github.com/microsoft/playwright-cli)
- GitHub CLI, [formatting](https://cli.github.com/manual/gh_help_formatting), `gh help exit-codes`, `gh help environment`
- AWS CLI, [output formats](https://docs.aws.amazon.com/cli/latest/userguide/cli-usage-output-format.html);
  gcloud, [formats](https://cloud.google.com/sdk/gcloud/reference/topic/formats);
  [llm usage](https://llm.datasette.io/en/stable/usage.html)
- Local, read-only measurements: installed `gh`, `kubectl`, `wrangler`, `git`, `jq`; `@livediagram/templates`
  `buildTemplate`; `apps/mcp` `registerTools` via `mcp-test-client.ts`; `js-tiktoken` `o200k_base`.
- Repo context: `docs/specs/015-api/mcp-server.md`, `docs/specs/015-api/public-api-and-tokens.md`,
  `docs/specs/015-api/api.md` (tab `PUT` row), `apps/api/src/room-client.ts`, `packages/document/src/comments.ts`,
  `packages/document/src/validate.ts`.

Unreachable during research (DNS): Armin Ronacher's "Tools: code is all you need", Simon Willison's skills post,
and clig.dev. Their arguments overlap with the sources above and are not relied on.
