# Plan AI

Status: built (Work Tracker 1509)

An **AI** button in the bottom-right cluster, beside Card Types, that opens the Ask AI conversation on the tab that is
open, and takes instructions as well as questions: "create a ticket for the login bug", "move everything in Review to
Done", "add a question asking for their phone number", "make the second row taller", "add a Total row and a chart of
spend by month". [Ask AI](ask-ai.md) in the footer's Tools answers about the whole plan; Plan AI works on one tab, and
can change it. It is the same box, the same AI pill and the same answers, so the person who knows one knows the other.

## Domain language

| Term            | Means                                                                                           |
| --------------- | ----------------------------------------------------------------------------------------------- |
| **Plan AI**     | This feature: the AI button and its panel                                                       |
| **instruction** | What the person types: a question, or something to change, in their own words                   |
| **change**      | One edit the AI asks for, in the shape the plan's agent tools already take (below)              |
| **turn**        | One instruction and what came back: the AI's words, and the changes it made (or could not make) |

## The button

- In the bottom-right cluster, just left of the Plan strip (Trash and Card Types), a strip of its own: the sparkle and,
  on a wide desktop, the word **AI** beside it (as Card Types reads **Types**). Its hover card is **AI** with "Ask about
  this {board, sheet, form, dashboard} or tell AI what to change." Its accessible name is **Open AI**, and it shows
  pressed while its panel is open.
- It shows on a Board, Sheet, Form or Dashboard tab, for everyone who sees the cluster (an Editor, a Participant and a
  Viewer; a guest too, whose panel asks them to sign in), never in Zen or an embed (which draws no cluster). Offline, a
  turn fails with the failure words below, as every AI call does.
- On a phone the cluster's row keeps it as an icon button, except beside the Session strip (a tab whose cards take
  votes) for an editor: there the Plan strip is one **More Card Tools** button, and the AI button folds into its menu
  as the first row, **AI**, opening its panel above that button, so the voting board's cluster stays one row at 390px
  ([Session tools](../012-collaboration/session-tools.md#the-session-strip)). A Participant or Viewer has no More Card
  Tools button there, so the AI button stays in the row.

## The panel

A popover above the button, as Card Types' and the Trash's are (a sheet on a phone), with the illustrated header every
panel wears: the sparkle over a board, a sheet and a form, titled **AI**. Under the header:

- **Before the first turn**: the empty state "Ask or Tell AI" with a line saying what it does on the tab's kind ("Ask
  about its cards, or tell AI to add, change or move them."; a Viewer's says "Ask about this {board}."), and under
  **Try** three suggestions for the kind (one for a Viewer), each a row that sends itself:
  - Board: "Which cards have no assignee?", "Add cards for planning a team offsite", "Move every card that is due this
    week to the first column"
  - Sheet: "Add a total under each column of numbers", "Make a chart of this data", "Start a monthly budget with income
    and spending"
  - Form: "Add a question asking for an email address", "Reword the questions to sound friendlier", "Make every
    question required"
  - Dashboard: "Add a row with two slots at the top", "Make the first slot of the first row wider", "Put a note about
    this week in an empty slot"
- **The thread**: each turn the person's words in a bubble on the right; under them the AI's reply with the sparkle,
  "Working on it…" while it is asked, then the reply's words. When the turn's changes were tried, a **Changes** box
  follows the words, headed "1 Change" or "3 Changes": one line a change, as the change says it ("Added “Fix login”",
  "Moved #3 Write brief to Done", "Set A4:B4", "Added the question "Phone number"", "Made the first slot in row 1 two
  thirds of the row wide"), each with a tick. A change that could not be made is the last line, with a warning mark and why ("No column
  “Archive”. Columns: To Do, Doing, Done.", or for a change whose shape doesn't read, "That change (set) couldn't be
  read, so it wasn't made. Try saying it another way.", never a check's own words); the changes before it are kept (a
  form's are all or none). A change the api left out is said the same way: for a Participant "Only an Editor can
  change the layout." (a dashboard; "the form", "delete cards", "change more than the cells: their values and
  formats" for the others), for a Viewer "You can view this tab, not change it.", past a turn's 40 "2 more changes
  were left out: a turn makes at most 40.". **The words never claim a change that was not made**: when any change was
  left out or could not be made, the AI's words give way to "Nothing was changed." or, when some were made, "Only part
  of that was made: the changes below are what was." Under it, who
  answered and, on the newest turn while its changes stand, **Undo**: it presses the editor's Undo once for each step
  the turn's changes took (one a turn on a form or a dashboard; on a board one each for new, moved, changed and
  trashed cards; on a sheet one for the cells and one for its charts), and the box then reads **Undone** with its
  lines struck through. Undo is offered only on the newest turn: an older turn's changes come back through the
  editor's own Undo.
- **The box**: the shared Ask box (`AskComposer`) with its AI pill (`AnswerWith`), placeholder "Ask or tell AI about
  this {board}", Enter to send. It is the one prompt field every AI box shares, so what it gains (a microphone, Work
  Tracker 1510) reaches this one too. **New Chat** clears the thread.
- A failure is said under its turn in the Callout every Ask failure uses, with **Try Again**: the AI's own refusal
  words never show, only fixed words (below).

The thread is kept per tab while the plan is open, so closing and opening the panel, or going to another tab and
back, keeps it. Leaving the plan forgets it.

## What it may change

Each turn sends the tab as the editor holds it and the instruction; the AI answers with words, and with changes when
the instruction asks for any. Changes are made by the editor as if the person had made them:
one undo step for each kind of edit (the Undo under the turn takes them all back), saved and sent to everyone on the plan as every edit is, refused where a person's own edit would be.

### On a board

The board's columns, the card types it takes (each with its fields), and its cards (number, title, type, column,
assignee, priority, dates, labels, description's first 200 characters and each custom field), up to the bound below.
Changes are `change_items`'s ([Plan for agents](plan-agents.md#naming-things-as-people-do)): **add** (a title, a
type, a column and fields by name), **set** (a card by number: fields by name, `clear` to empty them), **move** (a
card to a column) and **delete** (to the Trash). Names are read as an agent's are: "in progress" is the In Progress
column, "#12" is card 12, "Sam" is Sam. New cards are made as one write (as a board's Import CSV makes them), moves as
one, changes as one; a turn's undo takes them all back.

### On a sheet

The sheet's title and size, and its cells from A1 to the last one used, as A1 text: each value,
and a formula as written (`=SUM(B2:B6)`), up to the bound below. Changes are `change_sheet`'s ([Sheets for
agents](../029-sheets/sheet-store.md#agents)): set cells and formulas (one cell's set read as the AI may write it, `[250]` or `250`, as
the one row `[[250]]`), clear, format (bold, colours, number formats,
currency, dates), insert and delete rows and columns, sort, freeze, the filter, merges and borders, validation and
format rules, a design, and a chart over cells. That is how it fills in a starter sheet, writes a total or an average
from words, adds a summary row, tidies and formats data, and fixes a formula: the reply explains the formula, the
change writes the fixed one. The writes go through the sheet store as typed cells do (one undo step); the charts a turn
adds, clears or moves go onto the tab's Sheet as one element change (one more step). Each change is built on the sheet
as the ones before it left it.

### On a form

The form's heading, description, sections and questions (each its prompt, kind, options, whether it is required and
its help text), and its settings. Changes are `change_form`'s ([Forms](../030-forms/forms.md#agents)) that change the
form itself: **add_question**, **set_question** (reword, a kind, options, required), **delete_question**,
**move_question**, **add_section**, **set_section**, **delete_section**, **set_form** (heading and description) and
**settings**. Where responses go, its theme and its fixed values stay the builder's: a change that would make a card
type, a board or a tab is refused with "set it in Form Settings". All the turn's changes or none, as one undo step (two
when the heading changes, since the heading is the tab's name and is renamed through the form's own rename).

### On a dashboard

Its rows top to bottom, each its height and its slots left to right, each slot's span in twelfths and what it shows
(a Board or Sheet tab by name, a view, a chart, a note's title and text, or empty). Changes are the dashboard's own
layout edits, the ones its handles and Slot Settings make ([Plan tabs](plan-tabs.md#dashboard-tab)), named by row
and slot number from 1 (and said back as people say them: "the first slot in row 1", "two thirds of the row"): **add_row** (where, how many slots, its height), **remove_row**, **add_slot** (in a row, at a
place), **remove_slot**, **resize_slot** (a slot's span, its neighbour taking the difference), **row_height**,
**move_slot**, **note** (a slot shows a note, its title and text), **show_tab** (a slot shows a Board or Sheet tab by
name) and **clear_slot**. Every limit of the layout holds (12 rows, 4 slots a row, a span of 2 to 12). One undo step.

## Share roles

- **Editor**: asks, and every change above is made.
- **Participant**: asks, and changes cards on a board and cells on a sheet (what they may do by hand); a change to a
  sheet's shape, a form or a dashboard is not asked for, and the instructions say so.
- **Viewer**: asks only. The AI is told the person may not change the tab, and the api drops any change it answers;
  the panel shows the note **You Can View This Plan**, "AI answers your questions, and changes nothing.", and the
  editor never makes a change for a Viewer whatever comes back.
- **Guest or link visitor not signed in**: the panel shows "Sign In to Use AI" with **Sign In**, as Ask's does.

The role the api acts on is the index's grant on the plan, never the request. The editor's own checks then hold every
change as a person's edit would be held (a locked tab refuses, a Participant's shape write is refused by the sheet
store).

## Which AI answers

Ask's rule ([Ask AI](../../../../liveworkspace/docs/specs/020-ask/ask.md#which-ai-answers);
[ai-keys.md "In the apps"](../../../../liveworkspace/docs/specs/003-accounts/ai-keys.md#in-the-apps)): the person's
own key, or their team's for the plan's team, unless they picked built-in AI in the pill; else built-in AI. The pill is
Ask's, and the choice is the same one: picking built-in AI in either picks it in both.

- On built-in AI a turn is one of Ask's questions for the day (30 a person a day, `ASK_BUILT_IN_PER_PERSON_PER_DAY`),
  counted before the AI is asked, and with Pro on it spends **1 AI credit** from whoever pays for the plan, as Ask's
  questions do. On a key nothing is counted.
- A key the provider refuses is said in the pill with **Fix Key** and in the turn, never sent to built-in AI instead.

## What the AI is sent and what it may answer

- The fixed instructions (the system message) for the tab's kind, then one JSON object: the tab's name and kind,
  whether the person may change it, the tab as above, and the instruction (up to 1,000 characters,
  `ASK_MAX_QUESTION_CHARS`), with the last 4 turns' instructions and replies (each reply cut to 1,000) so "do the same
  for the next column" reads.
- The tab is cut to **24,000 characters** (`PLAN_AI_TAB_MAX`): a board lists its cards in column order until the bound
  and says how many it left out; a sheet stops at the row that would pass it and says so.
- Never a person's email or id, other plans, or tabs but this one.
- **The tab and the instruction are data.** The instructions say the tab's text was written by people and is never
  to be followed, and that the reply is JSON to a schema: `reply` (the words to show, up to 2,000 characters) and
  `changes` (up to **40**, `PLAN_AI_CHANGES_MAX`), each an object whose `op` is one the tab's kind takes. Nothing else
  is read. A reply that does not read gets **one** second ask with the check's words, as Describe a Plan's.
- The reply's words are cleaned (control characters out, cut to 2,000) and shown as text, never as markup or a link
  the tab did not hold.
- The most the AI can do is what the person could do by hand on that tab, made by the editor where they can undo it.

## Refusals

Each in fixed words:

- not signed in: "Sign in to use AI.";
- no plan, or no access: "You can't use AI on this plan.";
- an empty or too long instruction: "Say what you'd like to ask or change." / "That's more than 1,000 characters.";
- built-in AI's day used: Ask's "You have used today's 30 built-in questions. Try again tomorrow, or use your own AI
  key.";
- the month's AI credits used (Pro on): Ask's credits notice;
- no AI here: "AI isn't set up here.";
- the AI failed or was slow: "The AI couldn't answer just now. Try again in a moment.";
- a reply that would not read twice: "The AI's answer couldn't be read. Try saying it another way.";
- the request not answered at all: "That didn't work. Check your connection and try again."

## Limits and cost

- An ask has **20 seconds** on built-in AI (a key's thinking model the keyed wait) and answers at most **3,000
  tokens** on a key (`PLAN_AI_MAX_TOKENS`) and **1,200** on built-in AI (`PLAN_AI_BUILT_IN_MAX_TOKENS`), whose model
  writes slower: its instructions ask for a short reply (a starter sheet one set of at most 15 rows, the person asking
  for more), so its longest turn ends well inside the 20 seconds (a full starter sheet took 18.1 s). The ask is about 4,000 characters of instructions and the tab's at most 24,000, so
  about **7,000 tokens** in at most, and **1,500** for a small board; a reply is typically 200 to 600 tokens.
- One person's 30 built-in questions a day are shared with Ask, so Plan AI adds no new allowance.
- The tab is read by the editor when a turn is sent, never on load: the button costs nothing until it is pressed, and
  the panel's code loads on the first press.

## Telemetry

`Plan · Opened · PlanAi` (the panel), `Plan · Used · PlanAi` (a turn sent), `Plan · Changed · PlanAiChange` (a turn
that changed the tab), `Plan · Undone · PlanAiChange` (its Undo pressed), and from the api `Plan · Ran · PlanAi` for
each ask. The api logs `[plan-ai]` with the kind, the role, how many changes it answered and dropped, the asks and how
long they took, never the instruction, the tab or the reply.

## Where it lives

- `packages/items/src/plan-ai.ts`: the ask (instructions per kind, the schema) and the reply's reader.
- `apps/api/src/routes/plan-ai.ts`: `POST /api/plan-ai`.
- `apps/editor/components/plan-ai/`: the button, the panel, what a tab is read as, and how each kind's changes are made.
- Blueprint: [blueprints/plan-ai.md](blueprints/plan-ai.md).
