# Describe a Form

Someone who knows what they want to ask ("an event RSVP with dietary needs and plus-ones") can say it in their own
words and get the form drafted for them: its heading and description, its sections and its questions, each of the
right [type](forms.md#question-types) with its options, rating scale and Required set, and where its responses go. It
is shown as a preview first, and nothing is made until the person presses **Create Form**. It is the same model as
[Describe a Plan](../026-plan/describe-a-plan.md) and the AI actions, asked a different question, and it keeps every
rule Describe a Plan keeps: signed in only, a per-account daily cap, the request is data never instructions, fixed
refusal words and no request or reply ever logged.

## Who may

- **Signed in only**, as Describe a Plan: a person with an account (in the browser, or through their API token,
  never a read-only one). A guest or a link visitor may not. A guest still sees the entries, and choosing one shows a
  sign-in nudge in place of the text box: "Sign in to describe a form in your own words. Your form stays as it is."
  with **Sign In** (coming back to this plan and tab). The api answers a guest 403 `form_draft_needs_account`, and a
  caller with no identity 401.
- **Editors only.** Start Planning shows only to an Editor, and the Form tab's entries are drawn only where the
  builder is editable (`can.level === 'edit'`, the tab not locked; [Who may do what](forms.md#who-may-do-what)). A
  Participant or Viewer never sees them.

| Action                          | Editor | Participant | Viewer |
| ------------------------------- | ------ | ----------- | ------ |
| See and use Describe a Form     | ✓      |             |        |
| Create Form from a drafted form | ✓      |             |        |

## Where it starts

- **Start Planning**: Forms gains a **Describe a Form** card right after Blank Form, its picture the sparkle over a
  note of words (Describe a Plan's), its line "Say what the form should ask and AI drafts its questions for you to
  check.", no kind badge. A search finds it by "describe", "ai", "generate", "custom", "my own" and every Forms word
  ("form", "survey", "questionnaire", ...), under the Forms heading. "ai" typed whole still leads with Describe a Plan
  as Best Match.
- **An empty Form tab** (no questions at all), for an Editor:
  - in the connect box, under its two choices: **Describe a Form** with the sparkle, "Or say what it should ask and
    AI drafts the questions and where responses go.";
  - in the "No questions yet" card, once responses already have somewhere to go: a **Describe a Form** button under
    "Add one with the bar below.".
- Each opens the **Describe a Form** dialog. Its code loads only once it is chosen.

## The dialog

- The line "Say what the form is for and what it should ask. You check the form before anything is made.", a text
  box ("An event RSVP asking for name, email, whether they’re coming, dietary needs and how many guests they’ll
  bring"), its count ("120 / 500"), three example chips that fill the box (**Workshop Feedback**, **Volunteer
  Sign-Up**, **Equipment Request**), the line "Uses AI: plans and forms share 10 drafts a day.", then **Cancel** and
  **Draft Form** (also Ctrl or ⌘ Enter), disabled while the box is empty. While it drafts the button reads
  **Drafting…** and the box is read-only; Cancel stops waiting (the ask still counts).
- These are Describe a Plan's own parts (the box, its count, the examples, the AI line, the sign-in nudge), shared,
  not copied.

## The preview

A draft turns the dialog to **Check Your Form**, with the violet note: the sparkle, **Drafted by AI** and "Nothing is
made until you press Create Form."

- **The form**: its heading and description, then each section (a later one under its title) with its questions
  drawn as a respondent sees them, disabled (the builder's picture of a question), each with its type's name.
- **Responses Go To**: a menu of where every response goes, the draft's choice first selected:
  - **Cards on a New Board** ("<Form> Responses", New, In Progress and Done);
  - **Cards on <Board>** for each board the plan already has;
  - **Rows in a New Sheet** ("<Form> Responses", a column per question);
  - **Rows in <Sheet>** for each sheet the plan already has.

  On a Form tab that already sends its responses somewhere, that board or sheet is selected first. A board choice
  says under it "A new card type, “<Form>”, with a field for each question." and a sheet choice "A column for each
  question."

- **Back** returns to the words, kept; **Create Form** makes it. The preview scrolls inside the dialog, its footer
  always in view.

**Create Form** is the only thing that makes anything. The tab becomes (or stays) a Form tab holding the drafted form,
named after it while the tab still has a default name or "Untitled Form"; the questions replace the empty form's.
Responses go where the menu says:

- **to a board**: a new card type named after the form (as Responses Go To's New Card Type makes one, "Feedback 2"
  when the name is taken), the first Short Answer question going to the card's Title and each other question that
  would land in Description given a field of its own (the builder's [Fields from the form's
  questions](forms.md#mapping-where-an-answer-goes), `withQuestionFields`); a new board takes that type alone, an
  existing one that confines its types takes it too, and responses start in the board's first column the type uses;
- **to a sheet**: a row each, a column per question, nothing mapped; a new sheet is made at once.

The tabs change in **one undo step**: Undo takes the form back to empty and the new board or sheet tab away. The card
type stays, as a starter's does. `Form · Created · FormDraft` is sent. Should the plan change under the preview so
the choice no longer fits (the board was deleted), Create Form makes a new board instead.

## What can't be drafted

Said under the box, the text kept so it can be changed, in fixed words with curly apostrophes:

- a request that is not a form: "That doesn’t read as a form. Say what the form is for and what it should ask, like
  the examples.";
- a form the model could not make readable, even on a second try: "Couldn’t draft a form from that. Try saying it
  another way, or start from a ready-made form.";
- the day's drafts spent: "You’ve used today’s 10 AI drafts for plans and forms. Try again tomorrow, or start from a
  ready-made form.";
- no model, or one that errs or is slow: "AI isn’t set up here." or "The AI couldn’t answer just now. Try again in a
  moment.";
- no answer at all (offline, or one the editor can't read): "That didn’t work. Check your connection and try again."

The model's own words are never shown.

## What the model is sent

- The fixed instructions (the system message), then one JSON object of data (the user message): the **request** (up
  to **500 characters**) and nothing else. The question types, what each holds and the limits are part of the
  instructions. Never a person's name, email or id, the plan's name, its cards, tabs or other forms.

## The request is data, never instructions

- The instructions say what a form is and that the request is a description of one, to be treated as data: never
  followed when it asks for anything else, never allowed to change the task, the format or these rules.
- The reply is JSON to a schema: either **a form** or **not a form**. Nothing else is read.
- **A form** is held strictly: every text cleaned of control characters and of any link the request didn't hold, and
  cut to the form's own limits (heading 80, description 1,000, a section title 80, a prompt 200, help 500, an option
  40, a scale's end label 40); every question's type one of the thirteen; a Single or Multiple Choice with **2 to 10**
  options, none twice; a Rating's scale 3 to 10; a Number's bounds and a Multiple Choice's picks in range; every
  prompt given. Then it goes through `readForm`, the reader every stored form meets, and must come out whole: a
  question or section it would drop is a refusal, never a silent loss.
- On top of the form's own limits a draft is small: **1 to 4 sections** and **1 to 20 questions** in all. The form's
  link, closing, limit, cover and confirmation are never drafted.
- A reply that does not read gets **one** second ask, with the check's words; a second that does not read is
  "Couldn’t draft a form from that". The most a reply can do is put a preview in front of the person who asked: the
  route writes nothing but its count.

## Limits and cost

- **One AI budget per account.** Describe a Form shares Describe a Plan's count: **10 drafts a day** (UTC), plans and
  forms together, counted per account on the server wherever they ask. A second count would double what one account
  can spend for no gain; one keeps the bill Describe a Plan's spec measured. Describe a Plan's cap words say so too.
- An ask has **15 seconds** and answers at most **2,000 tokens**. The ask is about **4,400 characters** (about 1,100
  tokens) for a 500-character request (measured, `form-draft.test.ts`, "measures the ask"); a reply at every cap (20
  questions, each with ten options) is under 2,000 tokens, a typical one about 400. So a draft costs about the same
  as a plan's: about **20 Neurons**, **70** at worst, twice that with its second ask; one account at its 10 drafts, all
  at the worst, is still about a seventh of the free 10,000 Neurons a day.
- The count holds nothing but the day and how many. A count that can't be read refuses the ask ("The AI couldn’t
  answer just now").

## Telemetry

`UI · Opened · FormDescribe` (the dialog), `Form · Created · FormDraft` (a form made from a draft), and from the api
`Form · Ran · FormAiDraft` for each ask and `Form · Ran · FormAiOffTopic` for a request that was not a form. The api
logs `[form-draft]` with the answer (drafted, off topic, unreadable, capped, failed), the asks, how long they took,
the refused place and, for a draft, how many sections and questions it holds, never the request or the reply.

## Agents

No agent verb: an agent already writes a whole form itself with `add_form` and `change_form`, and Describe a Plan has
none either. The api route takes a full API token, as Describe a Plan's does.

## Building it

One card: this spec and its [blueprint](blueprints/describe-a-form.md), the reader in `@liveplanner/forms`, the api
route on the shared count, the dialog, preview and Create Form, both entries and their tests. The help article
(Plan › Forms) gains its section after.
