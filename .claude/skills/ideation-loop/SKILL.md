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
- **It's new.** Main doesn't already do it, no open PR is building it, and no card covers it: no Work Item or Idea,
  in any column (see "Check for an existing card" in step 3). A rejected idea, or a close cousin of one, never comes
  back unless something material has changed, and then the card says what.
- **It's feasible.** You read the code it would touch and can say roughly where it lands and what makes it hard.
- **It's worth it.** The value clearly beats the cost and the risk. Not a bug fix (that's the bug loop). Polish
  counts when it changes how a whole flow feels, not when it's one nit.

## Kinds of idea

Look for all three, every pass. Each card's **Kind** field says which it is:

- **Polish** (`Polish`): make something we already have feel better. Rough edges in one flow taken together: too
  many steps, unclear wording, missing feedback (no progress, no undo, no confirmation), awkward defaults, weak
  empty states, jarring motion, a phone layout that works but feels cramped. Compare it with how the best tool in
  its category does the same thing. One card covers the whole flow, never a single nit.
- **Extend** (`Extend`): make a feature we already have more valuable by taking it further. Who uses it, what do
  they do next, and where does it stop them? For example, a board filter that can be saved and shared, a template
  gallery people can add to, an import that also keeps comments, an export that also goes to another tool.
- **New Feature** (`New Feature`): something missing that would make a product clearly more valuable, the kind of
  thing a user moving from a competitor expects, or that opens a new use for the product.

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
  in, carries over on conversion), Solution `f-solution`, App `f-apps`, Kind `f-kind`, Source `f-source`, Effort `f-effort`, Reviewed `f-reviewed` and Reason `f-reason` (the owner's). If the type
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
the way. It also takes the **next two wider sources** after "Last sources" (below), rotating, so every source
comes round every few passes.

### Product sources (every pass, for each of the two products)

1. **Gaps in the code** (Source `Code Gap`). Read its specs, its help centre's article list and its editor's main flows on main. Look
   for flows that stop short (you can create but not reorder, import but not export, share but not revoke), features
   one product has and its siblings lack (a platform idea, not a copy), options every user expects, and specs that
   name later work. For **Polish** and **Extend**, use the product too: walk one or two of its main flows in a
   browser, at desktop and phone width, on a dev server that's already running (read-only: never start, stop or
   restart one) or on staging. Note every step that feels slow, unclear or unfinished, and every place you wanted
   to go one step further and couldn't.
2. **Competitors** (Source `Competitor`). Web search what the product's category leaders ship (for example Miro, Lucidchart and
   Excalidraw for livediagram; Trello, Asana, Linear and Notion databases for liveplanner; Notion and Google Docs
   for livedocuments; Figma and Canva for livedesign; Gather and Zoom for livehuddle). Favour features users
   mention in reviews, changelogs and "why we switched" posts over feature-matrix filler. Compare on the
   competitor's ground: what a user of that tool would miss here.
3. **Telemetry and feedback** (Source `Telemetry` or `Feedback`). The public telemetry summary (see the
   `prod-checks` memory for where it lives and how to read it): features with heavy use that hit a wall, and errors
   that point at a missing path. Community posts and feature requests on the products' Community pages. Help
   articles that explain a workaround.

### Wider sources (two per pass, rotating, across every product)

4. **Board history** (Source `Board History`). The Work Tracker itself: Done cards whose PR or threads name a
   later step nobody filed; Cancelled cards whose reason has since changed; On Hold cards whose blocker is gone;
   and clusters of Bug cards in one area, which point at a design that needs rethinking rather than another fix.
   Ideas the dev loop filed as optional follow-ups sit here too: never duplicate them.
5. **PR history** (Source `PR History`). Merged PRs from the last few weeks
   (`gh pr list --state merged --limit 50 --json number,title,body`) and their review comments: "later", "out of
   scope", "follow-up" and "not in this PR" notes that never became a card. Also GitHub issues and Dependabot
   alerts that hint at a bigger change.
6. **Cloudflare usage** (Source `Cloudflare Usage`). The GraphQL Analytics API, read-only (the `prod-checks`
   memory has how): Workers, Durable Objects and D1 hotspots by cost, time or error rate. An idea here is a change
   that cuts cost or speeds up a hot path without users noticing, with the numbers.
7. **Industry trends** (Source `Industry Trends`). Launches, funding news and new product categories beyond the
   direct competitors: patterns users will soon expect (AI assists, new collaboration styles, new file formats).
   Pitch only trends with real adoption, not hype, and say how ours would differ.
8. **Standards** (Source `Standards`). New browser APIs that are Baseline or close to it, WCAG updates, MCP spec
   changes, and import and export formats of other tools. An idea here is something a standard now makes possible
   or expected.
9. **Owner notes** (Source `Owner Notes`). Parked ideas in the project's Claude memory (files named `*-idea.md`,
   and project notes with open questions) and the "Not planned" or "Later" tables in the specs. Recheck each one
   against new evidence. Never pitch one of the declined ideas, and never revive a "Not planned" item without
   saying what changed.

Set **Source** to where the strongest evidence came from, even if a product source and a wider source both
found it.

Spend the effort on depth: an idea with evidence and a clear landing spot beats three hunches. Run independent
searches and reads in parallel. Do this yourself, without subagents, unless a product's research is too big for
one context; then at most two `Explore` agents, each briefed with the bar above and asked for candidates with
evidence, not prose.

## 3. Write the cards

### Check for an existing card

This check matters most: a duplicate wastes the owner's review and can split one piece of work across two cards.
Before writing, check every idea against the board you read in step 1, by meaning, not by title:

- **Search wide.** `jq` over every card's title, description and Acceptance Criteria (Work Items) or Solution
  (Ideas), case-insensitive, for the idea's key nouns **and their synonyms** ("version history", "revisions",
  "snapshots", "restore", "undo history"). Cover **every column**: On Hold, Under Review, Reviewed, Selected for
  Development, In Progress, Implemented, Done, Development Failure and Cancelled.
- **Read the near matches in full**, including their comment threads (`list_threads` with their `item`), since
  decisions often live there.
- **Check open work**: `gh pr list --state open --search "<keywords>"` and the titles of open PRs, since a PR can be
  building it before its card exists.
- **Then decide:**
  - **Covered** by a card in any open column, or by an open PR: skip it.
  - **Done**, or Implemented: main has it or soon will. Skip it, or pitch only the part that's clearly beyond what
    that card built, and name the card.
  - **Cancelled** (a Work Item, or an Idea Rejected or not): the owner turned it down. Treat it as rejected (see the
    bar).
  - **On Hold**: parked on purpose. Skip it unless new evidence changes why it was parked, and then say so.
  - **Partly covered**: pitch only the part no card covers, and name the related card in the description
    ("Builds on card 742, which covers X but not Y"). Write "card N", never "Work Tracker N".
- In the report, list every idea dropped as a duplicate with the card that covers it, so the owner can see the
  check ran.

### Add the cards

Add every idea that survives the check in **one** `change_items` batch:

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
    "f-kind": "Extend",
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
- **Kind** (`f-kind`): `Polish`, `Extend` or `New Feature` (see "Kinds of idea").
- **Source** (`f-source`): where the strongest evidence came from, one of the sources in step 2 (`Code Gap`,
  `Competitor`, `Telemetry`, `Feedback`, `Board History`, `PR History`, `Cloudflare Usage`, `Industry Trends`,
  `Standards`, `Owner Notes`). One value, even when several sources agree; the description lists them all. The
  Lessons track which kinds and sources the owner accepts most.
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
