---
name: ideation-loop
description: One pass over the liveworkspace products that looks for genuinely good product ideas (gaps in the code on main, what competitors ship, telemetry and feedback) and logs the few that make the cut as Idea cards in the Work Tracker plan's Ideas board. The owner accepts or rejects each one through its Reviewed field. Run with `/loop 4h /ideation-loop`.
---

# Ideation loop: one pass

Finds ideas worth building across the products and logs them as **Idea** cards in the **Work Tracker** plan
(liveworkspace team library). The owner judges each one with the card's **Reviewed** field, and the plan's
"Progress Idea" Automations rule does the rest:

- **Accepted**: the card becomes a Work Item in **Under Review**, where the review loop picks it up.
- **Rejected**: the card moves to **Cancelled**. It stays there as a record of what the owner turned down.

This loop only writes Idea cards. It never sets Reviewed, never moves a card, never writes code and never
opens a PR.

This loop runs unattended. Act on these rules and never stop to ask (AskUserQuestion). Put decisions in the
report.

## The bar

Quality over quantity. **A pass that logs nothing is a good pass when nothing good turned up.** Never log an idea
to fill a quota. An idea makes the cut only when all of these hold:

- **Real need.** You can point to evidence: a competitor that ships it and users who rely on it, a telemetry
  signal, a Community post, a help article that has to explain around the gap, or a flow on main that clearly
  stops short.
- **It fits.** It suits the product it is for and the platform's direction (read the product's specs and
  `liveworkspace/docs/specs`). Shared capabilities belong to the platform once, not to each product.
- **It's new.** Main doesn't already do it, and no card covers it (any type, any column, including Done and
  Cancelled). A rejected idea, or a close cousin of one, never comes back unless something material has changed,
  and then the card says what.
- **It's feasible.** You read the code it would touch and can say roughly where it lands and what makes it hard.
- **It's worth it.** The value clearly beats the cost and the risk. Not a bug fix (that's the bug loop) and not a
  polish nit.

A typical pass logs 0 to 5. If you have more than 5 candidates, keep the strongest 5 and save the rest in the
state file's "Candidates" list for a later pass to re-check.

## 0. State

The run history is per-user, in your Claude memory folder for this project: `project_ideation_loop.md`. Read it
first, create it if missing. It holds:

- **Last sources** and **Last products**: what the last passes covered, so each pass rotates (see step 2).
- **Last run**: absolute date and time.
- **Candidates**: promising ideas held back, each with its evidence and why it waited.
- **Lessons**: one line per pattern the owner rejected ("no AI chat panels", "no per-product themes") and per
  pattern they accepted. Rebuild it from the board each pass (step 1); it steers what you pitch.

Also read the owner's `declined-ideas.md` memory if present. Everything in it is rejected.

## Setup (once per machine)

- The liveplanner MCP (`https://mcp.liveplanner.app/mcp`), as a claude.ai connector or with
  `claude mcp add --transport http liveplanner https://mcp.liveplanner.app/mcp`. You must be a member of the
  liveworkspace team.
- Plan: `find_projects` with query `Work Tracker`, the one in the `liveworkspace` library. It's currently
  `b884c689-4dee-4437-a705-9375b23aa0a1`.

## 1. Read the board

One `list_items` call on the plan, no filters. Its output is large: save it and read it with `jq`, never whole.
From it:

- The **Idea** type's fields, by id from `types[].custom`. Today: `description` (built in), `priority` (built
  in, carries over on conversion), Solution `f-solution`, App `f-apps`, Source `f-source`, Effort `f-effort`, Reviewed `f-reviewed` and Reason `f-reason` (the owner's). If the type
  has changed, follow what it says now and note it in the report.
- Every card's title and description, of every type and in every column, to check for duplicates.
- The owner's verdicts: Ideas in **Cancelled** with Reviewed `Rejected`, and cards that were Ideas and are now
  Work Items (they still carry `f-reviewed: Accepted`). Turn these into the state file's Lessons. The
  **Reason** field, when the owner filled it, is the strongest signal: learn the pattern it names, not just the
  title. A rejection with no Reason teaches only "not this idea".
- Ideas still in **Under Review** that the owner hasn't judged yet. While **8 or more** are waiting, log nothing
  new this pass: research anyway, save the best to Candidates, and say so in the report. The owner's queue is the
  limit, not your output.

## 2. Research

Work from `origin/main` (`git fetch -q origin`). Read it with `git show origin/main:<path>` or a scratchpad
worktree (`git worktree add <scratchpad>/main origin/main`, removed at the end). Never change the main checkout.

Each pass takes the **next two products** after "Last products", rotating through liveworkspace (the platform),
livediagram, liveplanner, livedocuments, livedesign and livehuddle, plus whatever cross-product idea you meet on
the way. For each product, use all three sources:

1. **Gaps in the code.** Read its specs, its help centre's article list and its editor's main flows on main. Look
   for flows that stop short (you can create but not reorder, import but not export, share but not revoke), features
   one product has and its siblings lack (a platform idea, not a copy), options every user expects, and specs that
   name later work.
2. **Competitors.** Web search what the product's category leaders ship (for example Miro, Lucidchart and
   Excalidraw for livediagram; Trello, Asana, Linear and Notion databases for liveplanner; Notion and Google Docs
   for livedocuments; Figma and Canva for livedesign; Gather and Zoom for livehuddle). Favour features users
   mention in reviews, changelogs and "why we switched" posts over feature-matrix filler. Compare on the
   competitor's ground: what a user of that tool would miss here.
3. **Telemetry and feedback.** The public telemetry summary (see the `prod-checks` memory for where it lives and
   how to read it): features with heavy use that hit a wall, and errors that point at a missing path. Community
   posts and feature requests on the products' Community pages. Help articles that explain a workaround.

Spend the effort on depth: an idea with evidence and a clear landing spot beats three hunches. Run independent
searches and reads in parallel. Do this yourself, without subagents, unless a product's research is too big for
one context; then at most two `Explore` agents, each briefed with the bar above and asked for candidates with
evidence, not prose.

## 3. Write the cards

For each idea that makes the cut, check the board once more for a duplicate (step 1), then add every card in
**one** `change_items` batch:

```json
{
  "op": "add",
  "type": "Idea",
  "status": "Under Review",
  "title": "...",
  "fields": {
    "description": "...",
    "f-solution": "...",
    "f-apps": ["livediagram"],
    "f-source": "Competitor",
    "f-effort": "Medium",
    "priority": "medium"
  }
}
```

- **Title**: plain Title Case, the outcome a user gets ("Reorder Rows by Dragging in Sheets"), not the
  mechanism. No numbers, prefixes or emoji.
- **description** (the problem): what users can't do today and why it matters, then the evidence, each item with a
  link or path: the competitors that ship it, the telemetry numbers, the Community post, the spec or file on main
  that shows the gap. Three to eight lines.
- **Solution** (`f-solution`): the proposed shape in a few lines: what the user sees, where it lands in the code
  (packages and files), whether it's a platform capability and the main risk.
- **App** (`f-apps`): every product it touches; `liveworkspace` for platform work.
- **Source** (`f-source`): where the strongest evidence came from: `Code Gap`, `Competitor`, `Telemetry` or
  `Feedback` (Community posts, help workarounds). One value, even when several sources agree; the description
  lists them all. The Lessons track which sources the owner accepts most.
- **Effort** (`f-effort`): a rough size from reading the code it would touch: `Small` (about a day), `Medium` (a
  few days) or `Large` (needs splitting into parts).
- **Priority** (built-in `priority`, written lowercase: `low`, `medium`, `high`): calibrated, not inflated.
  `high` only for a clear, evidenced gap that costs users today; `medium` for a solid improvement; `low` for nice
  to have. `urgent` (shown as Critical) is never right for an idea.
- Never set **Reviewed** or **Reason**: they're the owner's verdict, and setting Reviewed fires the conversion
  rule.
- No comment threads on Idea cards. If an idea needs a question answered first, it isn't ready: keep it in
  Candidates.

The rule converts the card's type but doesn't copy its fields (App, Solution, Source and Effort land on fields a Work
Item doesn't show; card 837 tracks the fix). Until that is fixed in the automation code, write the description so it stands alone: the review
loop reads it as the Work Item's Problem.

## 4. Wrap up

- Remove any scratchpad worktree you made (`git worktree remove`).
- Update the state file: Last sources, Last products, Last run, Candidates (drop what you logged or ruled out)
  and Lessons.
- Report in a few lines: the cards logged (number, title, product, priority), the strongest candidates held back
  and why, and any lesson that changed what you pitched. A pass that logged nothing says what it checked.
