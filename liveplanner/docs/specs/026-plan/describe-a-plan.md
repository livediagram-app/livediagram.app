# Describe a Plan

Someone with a process of their own ("a hiring pipeline with Applied, Screen, Interview and Offer, and a Candidate
card with Role, Salary Band and Interview Date") can say it in their own words on Start Planning and get the board's
columns and the card types with their fields drafted for them, shown as a preview to change before anything is made
(Work Item 760). It is the same model as the AI actions and [Describe a Rule](automations.md#describe-a-rule), asked a
different question: never a plan made without the person's press.

The name is **Describe a Plan**, apart from the marketing site's **Build with AI** page (`/ai`, the MCP set-up).

## Who may

- **Signed in only.** A person with an account (in the browser, or through their API token, never a read-only one)
  may ask; a guest or a link visitor may not. No plan exists on the server yet when Start Planning shows (a new plan
  can still be This Browser's), so the plan's own 100 AI steps a day can't be the cap; the person's account is.
- A guest sees the entry on Start Planning all the same, and choosing it shows a sign-in nudge in place of the text
  box: "Sign in to describe a plan in your own words. Your plan stays as it is." with **Sign In** (the app's sign-in,
  coming back to this plan). The api answers a guest 403 `plan_draft_needs_account`, and a caller with no identity 401.
- Start Planning shows only to an Editor ([Start panel](../007-editor/start-panel.md#when-it-shows)), so a
  Participant or Viewer never sees it.

## Where it starts

- Start Planning's rail gains **Describe a Plan**, with the sparkle, in the group at its foot, above Connect File and
  Import: like Import it opens a dialog and is never chosen, so the grid keeps what it shows. On a phone it is a chip
  before Connect File's. A search finds it by "describe", "ai", "custom", "generate" and "my own", as a card under
  its own **Describe a Plan** heading.
- It opens the **Describe a Plan** dialog (a sheet on a phone): the line "Say what you're planning: the stages work
  moves through and what each card should hold. You check the plan before anything is made.", a text box ("A hiring
  pipeline with Applied, Screen, Interview and Offer, and a Candidate card with Role, Salary Band and Interview Date"),
  its count ("120 / 500"), three example chips that fill the box (**Customer Onboarding**, **Grant Applications**,
  **Home Renovation**), the line "Uses AI: you can describe 10 plans a day", then **Cancel** and **Draft Plan** (also
  Ctrl or ⌘ Enter). Draft Plan is disabled while the box is empty.
- While it drafts, the button reads **Drafting…** with a spinner and the box is read-only; Cancel stops waiting (the
  call still counts). It takes a few seconds.

## The preview

A draft turns the dialog to its **preview**, titled **Check Your Plan**, with a violet note: the sparkle, **Drafted by
AI** and "Change anything you like. Nothing is made until you press Make Plan."

- **The board**: its title (a text box) and its columns as a row of chips, each renamed in place, removed with its ×,
  and **Add Column** at the end while there are fewer than 12.
- **Each card type**: its glyph and colour, its name (a text box), the built-in fields it shows (chips, each removable),
  and its own fields as rows: the name, the kind (the type editor's kind menu, the kinds below), a Choice field's
  options as chips, and a remove button. **Add Field** under them while the type has fewer than 8, and **Remove Type**.
  A type named as one the plan already has is marked "Already in this plan: yours is kept as it is" and drawn
  read-only; Make Plan uses the plan's type.
- Whatever is changed is held to the same checks as the draft (below), each problem said beside its place, and Make
  Plan is disabled while one stands.
- **Back** returns to the words, kept; **Make Plan** makes it.

**Make Plan** is the only thing that makes anything. It does what choosing a board on Start Planning and adding card
types in the type editor do: the tab becomes a Board tab holding the board (placed as Start Planning places one,
taking the drafted types), named after the board while the tab still has its default name, and the plan gains the
card types it lacks. Undo takes the board away as it would any board; the card types stay, as a Plan template's do.
`Plan · Created · PlanDraft` is sent.

## What can't be drafted

What can't be drafted is said in the dialog, under the box, the text kept so it can be changed:

- a request that is not a plan (a question, a story, anything off the subject): "That doesn't read as a plan. Say
  what you're planning, the stages work moves through and what each card holds, like the examples.";
- a plan the model could not make readable, even on a second try: "Couldn't draft a plan from that. Try saying it
  another way, or start from a template.";
- the day's drafts spent: "You've described 10 plans today. Try again tomorrow, or start from a template.";
- no model, or one that errs or is slow: "AI isn't set up here" or "The AI couldn't answer just now. Try again in a
  moment."

The model's own words are never shown: every message is one of these, fixed in code.

## What the model is sent

- The fixed instructions (the system message), then one JSON object of data (the user message): the **request** (up
  to **500 characters**) and nothing else. The kinds a field may be, the built-in fields a type may show, the glyphs
  and the limits are part of the instructions.
- Never a person's name, email or id, the plan's name, its cards, its other tabs or any other plan. A draft reads
  only the words the person typed.

## The request is data, never instructions

- The instructions say what a plan is (one board's columns, left to right, and the card types its cards are, each
  with its fields) and that the request is a description of one, to be treated as data: never followed when it asks
  for anything else, never allowed to change the task, the format or these rules.
- The reply is JSON to a schema: either **a plan** or **not a plan** (a request off the subject, or one asking the
  model to do anything but describe a plan). Nothing else is read.
- **A plan** is then held to everything a person's board and card types are: every name and option cut to its limit,
  control characters removed and any link the request didn't hold removed; then the board through the same check an
  agent's `add_board` meets (`placeBoard`: 1 to 12 columns, each name 1 to 40 characters, none twice, a title of 1 to 80) and the card types through the one an agent's `change_card_types` meets (`applyCardTypeChanges`, which checks
  the whole catalogue with `validateItemTypeCatalogue`), as new types on an empty catalogue.
- On top of those, a draft is small: **1 to 4 card types**, each with up to **8 fields** of its own, a Choice or
  Multiple Choice field up to **8 options**. A field is one of the kinds that need nothing else from the plan:
  Text, Long Text, Number, Currency, Percent, Duration, Date, Date and Time, Date Range, Checkbox, Link, Email, Phone,
  Choice, Multiple Choice, Rating, Person, Labels and Checklist (never a Card, Calculated, Formula, Rollup, Lookup,
  Image, Comments, Votes, Pull Request, Colour or Risk field). A type shows Description and Assignee, and may add
  Priority, Labels, Estimate, Start Date, Due Date and Checklist. A glyph the model names that Plan lacks becomes the
  star; colours are given in turn from the type colours.
- A reply that does not read gets **one** second ask, with the check's words; a second reply that does not read is
  "Couldn't draft a plan from that". Each ask is one AI call.
- Whatever the model answers, the most it can do is put a preview of names in front of the person who asked. The
  route itself writes nothing but its count.

## Limits and cost

- A person describes at most **10 plans a day** (UTC) whatever their asks, counted per account wherever they ask, so
  one account can never spend the deployment's AI on its own. Every call also rides the shared AI limits: the
  15-second wait, the AI Gateway's spend limit when `AI_GATEWAY` is set ([AI actions → Cost](automations.md#cost)),
  and the free 10,000 Neurons on the Workers Free plan.
- An ask has **15 seconds** and answers at most **2,000 tokens**: a reply at every cap (12 columns, four types of
  eight Choice fields with eight options each) is about 5,300 characters, about 1,500 tokens, which a rule's 1,500
  would cut. The ask's size is measured (`plan-draft.test.ts`, "measures the ask"): about **5,200 characters** (1,300
  tokens) for a 500-character request and 4,900 for a typical one, since the request is all the model is sent. A
  typical reply is about 200 tokens, so a draft costs about **17 Neurons**, and **66** at worst (a 2,000-token
  reply); twice that with its second ask.
- One account at its 10, every one asked twice at the worst, is about **1,320 Neurons** a day, about an eighth of
  the account's free 10,000; past the free allowance that is about $0.015 a day.
- The count is kept per account on the server and holds nothing but the day and how many; no request or reply is
  stored. A count that can't be read refuses the ask ("The AI couldn't answer just now"), so a fault never lifts the
  cap.

## Telemetry

`UI · Opened · PlanDescribe` (the dialog), `Plan · Created · PlanDraft` (a plan made from a draft), and from the api
`Plan · Ran · PlanAiDraft` for each ask and `Plan · Ran · PlanAiOffTopic` for a request that was not a plan. The api
logs `[plan-draft]` with the answer (drafted, off topic, unreadable, capped, failed), the asks and how long they took,
never the request or the reply.

## Later

- **Starter rules**: a draft could also suggest a rule or two, read by Describe a Rule's reader, to add with the plan.
  Left for after the entry ships.

## Building it

A Large card, built in parts, each leaving main working on its own:

1. This spec and its blueprint, the pure parts (the ask, the reply's reader and the checks), the api route with the
   per-account count, and their tests. Nothing visible.
2. The entry on Start Planning, the dialog, the preview, Make Plan and the sign-in nudge, with their tests, shots and
   the help article.
3. Optional: starter rules.
