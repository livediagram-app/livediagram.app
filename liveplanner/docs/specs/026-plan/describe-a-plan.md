# Describe a Plan

Someone with a process of their own ("a hiring pipeline with Applied, Screen, Interview and Offer, and a Candidate
card with Role, Salary Band and Interview Date") can say it in their own words on Start Planning and get the board's
columns, the card types with their fields and a starter rule or two drafted for them, shown as a preview to change before anything is made
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
  its own **Describe a Plan** heading, and as the **Best Match** for a search its name begins with or for "ai",
  "generate", "my own" or "own words" typed whole (its `bestFor` words, [Start panel → A title match
  leads](../007-editor/start-panel.md#the-panel)): "Say what you're
  planning and AI drafts the board's columns and card types for you to check.", a picture of a note of words under
  the sparkle flowing into a board, no kind badge. The dialog's code loads only once it is chosen.
- It opens the **Describe a Plan** dialog (a sheet on a phone): the line "Say what you're planning: the stages work
  moves through and what each card should hold. You check the plan before anything is made.", a text box ("A hiring
  pipeline with Applied, Screen, Interview and Offer, and a Candidate card with Role, Salary Band and Interview Date"),
  its count ("120 / 500"), three example chips that fill the box (**Customer Onboarding**, **Grant Applications**,
  **Home Renovation**), the line "Uses AI: plans and forms share 10 drafts a day.", then **Cancel** and **Draft Plan** (also
  Ctrl or ⌘ Enter). Draft Plan is disabled while the box is empty.
- While it drafts, the button reads **Drafting…** with a spinner and the box is read-only; Cancel stops waiting (the
  call still counts). It takes a few seconds.

## The preview

A draft turns the dialog to its **preview**, titled **Check Your Plan**, with a violet note: the sparkle, **Drafted by
AI** and "Change anything you like. Nothing is made until you press Make Plan."

- **The board**: its name (a text box) and its columns as a row of chips ("4 of 12"), each renamed in place, removed
  with its ×, and **Add Column** at the end while there are fewer than 12.
- **Each card type**: its glyph and colour, its name (a text box), the built-in fields it **Shows** (chips, each
  removable; with none, "Title and Status only"), and its own **Fields** as rows: the name, the kind (a menu of the
  kinds below, by the type editor's names for them), a Choice field's options as chips (renamed in place, removed,
  **Add Option** while it has fewer than 8), and a remove button. **Add Field** under them while the type has fewer
  than 8 ("Add a field for anything else its cards should hold." while it has none), and **Remove Type** (the bin,
  its words hidden on a phone). **Add Card Type** under the types while there are fewer than 4.
- **Starter Rules** (when the draft holds any), under the card types: up to **2** Automations rules for the new
  board, each a card with its **On** switch (on to start), its name (a text box), its sentence as the Rules list draws
  it ("When a card moves to Offer then set Offer Date to today"), and **Remove Rule** (the bin, its words hidden on a
  phone). The line under the heading says "Made with the plan in Automations, where you can change them later." A rule
  switched off is made off; a removed one is not made. A column, card type or field renamed in the preview is renamed
  in the rules that name it (while the old name was its alone and the new one is no other's); one removed leaves the
  rule naming something the plan won't have, said at the rule: "This rule names the column “Offer”, which this plan
  won’t have." (or "card type", "field"), with a rule's name problems ("Give this rule a name.", "Two rules are
  called “…”.") and any refusal of the rule's own check. On a plan in This Browser the rules can't be made (Automations
  runs on a plan saved to an account): the section says "Starter rules need this plan saved to your account, so these
  are left out. Sync the plan, then add rules in Automations." and the rows are not drawn nor checked.
- What is added starts named, its name selected to type over: **New Column**, **New Field**, **Option 2**, **New
  Type** (with a number when the name is taken). A field turned into a Choice keeps its options, or starts with
  **Option 1**; turned into any other kind it holds none.
- A type named as one the plan already has is marked "Already in this plan: yours is kept as it is" and drawn
  read-only (its name, and the plan's own fields as chips), Remove Type aside; Make Plan uses the plan's type.
- Whatever is changed is held to the same checks as the draft (below), each problem said beside its place in rose,
  the place ringed: "Give the board a name.", "Give this column a name.", "Two columns are called “Screen”." (said at both, so neither hides behind the other's focus ring, and each
  ringed chip keeps its rose ring while it is typed in, the focus ring rose too, light and dark; and each
  different problem in a row said under it), "A board
  needs at least one column.", "Keep at least one card type.", and the same for a card type's, a field's and an
  option's names; once the names read, whatever the whole check still finds (a cap, the catalogue's rules) is said at
  its place. Make Plan is disabled while one stands, and the footer says "Fix the marked problem to make the plan."
  (or "Fix the 2 marked problems …").
- **Back** returns to the words, kept; **Make Plan** makes it. The preview scrolls inside the dialog, its footer
  always in view.

**Make Plan** is the only thing that makes anything. It does what choosing a board on Start Planning and adding card
types in the type editor do: the tab becomes a Board tab holding the board (placed as Start Planning places one,
taking the drafted types), named after the board while the tab still has its default name, and the plan gains the
card types it lacks. Undo takes the board away as it would any board; the card types stay, as a Plan template's do.
`Plan · Created · PlanDraft` is sent. Then the starter rules left in are made, as New Rule makes a rule, through the
Automations routes (so only an Editor of the whole plan, signed in, on a plan saved to an account; anyone else never
sees Start Planning or sees the This Browser line above): each named as its draft and made free among the plan's rules
("Stamp Offer Date 2"), in the board's statuses and the plan's types, chain off, in the person's time zone, and turned
off after when its switch is off. They are made in turn after the board; one that can't be made (the plan at its 50
rules, a fault) is said in a toast, "Couldn't add the starter rules. Add them in Automations.", and the plan stays as
made. `Plan · Created · PlanDraftRule` is sent for each rule made. The types the plan lacks are added first, as one change, so the board finds them
as it lands and brings none of its own; each new type uses the new board's columns' statuses. A column named as a
status the plan's boards already have takes that status, so its cards show on the new board too. Should the plan
change under the preview so the draft no longer fits (another person adds a type of that name), Make Plan says the
check's words in the footer and makes nothing.

## What can't be drafted

What can't be drafted is said in the dialog, under the box, the text kept so it can be changed:

- a request that is not a plan (a question, a story, anything off the subject): "That doesn’t read as a plan. Say
  what you’re planning, the stages work moves through and what each card holds, like the examples.";
- a plan the model could not make readable, even on a second try: "Couldn’t draft a plan from that. Try saying it
  another way, or start from a template.";
- the day's drafts spent: "You’ve used today’s 10 AI drafts for plans and forms. Try again tomorrow, or start from a
  template.";
- no model, or one that errs or is slow: "AI isn’t set up here." or "The AI couldn’t answer just now. Try again in a
  moment.";
- the ask not answered at all (offline, or an answer the editor can't read): "That didn't work. Check your connection
  and try again."

The model's own words are never shown: every message is one of these, fixed in code, with curly apostrophes as the
dialog's own words have.

## What the model is sent

- The fixed instructions (the system message), then one JSON object of data (the user message): the **request** (up
  to **500 characters**) and nothing else. The kinds a field may be, the built-in fields a type may show, the glyphs,
  the starter rules' kinds and the limits are part of the instructions.
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
  "Couldn’t draft a plan from that". Each ask is one AI call.

## Starter rules

- The reply may hold **0 to 2 rules** (`rules`, "often none"), each as Describe a Rule's model writes one: a name, a
  trigger, conditions and steps, naming the drafted columns, card types and fields as the draft names them. Only a
  starter's kinds are offered, those a new board can use with nothing else from the plan: a card added (in a
  column), moved (from or to columns), a field changed, its checklist completed or its due date passed; conditions on
  its card type, its column or a field; and up to **3** steps of Move, Set Field, Clear Field, Assign (to whoever
  triggered it), Add or Remove Label, Comment, Flag and Unflag. Never an email, a mention, a webhook, an AI step, a
  wait, a new card or a person by name.
- Each is read by **Describe a Rule's reader** (`readAiDraft`, [Describe a Rule](automations.md#describe-a-rule)):
  its texts cut and cleaned of control characters and links the request lacks, its names put back to the drafted
  plan's, chain off, then the rule check every rule meets (`readRuleBody`); then it must use only the starter kinds
  and name nothing the drafted plan lacks. A rule that fails any of that is left out, never asked again: the plan
  reads without it. What is kept goes back to names, so the preview and Make Plan read it against the plan as it is
  then.
- The most a rule can do is sit in the preview: it is made only by Make Plan, as the person left it.
- Whatever the model answers, the most it can do is put a preview of names in front of the person who asked. The
  route itself writes nothing but its count.

## Limits and cost

- A person describes at most **10 plans a day** (UTC) whatever their asks, counted per account wherever they ask, so
  one account can never spend the deployment's AI on its own. The 10 are shared with [Describe a
  Form](../030-forms/describe-a-form.md): one AI budget per account, plans and forms together. Every call also rides the shared AI limits: the
  15-second wait, the AI Gateway's spend limit when `AI_GATEWAY` is set ([AI actions → Cost](automations.md#cost)),
  and the free 10,000 Neurons on the Workers Free plan.
- An ask has **15 seconds** and answers at most **2,000 tokens**: a reply at every cap (12 columns, four types of
  eight Choice fields with eight options each, and two rules of three steps) is about 6,300 characters, about
  1,600 to 1,800 tokens. The ask's size is measured (`plan-draft.test.ts`, "measures the ask"): about **6,600
  characters** (1,650 tokens) for a 500-character request and 6,200 for a typical one, since the request
  is all the model is sent (the starter rules' words add about 1,100 characters to the instructions and 300 to
  the schema). A typical reply is about 300 tokens, so a draft costs about **22 Neurons**,
  and **70** at worst (a 2,000-token reply); twice that with its second ask.
- One account at its 10, every one asked twice at the worst, is about **1,400 Neurons** a day, about
  a seventh of the account's free 10,000; past the free allowance that is about $0.015 a day.
- The count is kept per account on the server and holds nothing but the day and how many; no request or reply is
  stored. A count that can't be read refuses the ask ("The AI couldn't answer just now"), so a fault never lifts the
  cap.

## Telemetry

`UI · Opened · PlanDescribe` (the dialog), `Plan · Created · PlanDraft` (a plan made from a draft),
`Plan · Created · PlanDraftRule` (each starter rule made with it), and from the api `Plan · Ran · PlanAiDraft` for each
ask and `Plan · Ran · PlanAiOffTopic` for a request that was not a plan. The api logs `[plan-draft]` with the answer
(drafted, off topic, unreadable, capped, failed), the asks, how long they took and, for a draft, how many starter rules
it kept and left out, never the request or the reply.

## Building it

A Large card, built in parts, each leaving main working on its own:

1. This spec and its blueprint, the pure parts (the ask, the reply's reader and the checks), the api route with the
   per-account count, and their tests. Nothing visible.
2. The entry on Start Planning, the dialog, the preview, Make Plan and the sign-in nudge, with their tests, shots and
   the help article (Plan › **Describe a Plan**, `/help/plan/describe-a-plan/`).
3. Starter rules (read by Describe a Rule's reader, shown and changed in the preview, made by Make Plan), the duplicate
   column chips both marked, "ai" leading the search as Best Match, and the api's words with curly apostrophes.
