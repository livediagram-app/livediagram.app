# Forms

A **Form tab** is a Plan tab that holds one form: questions someone builds in place, shared as a **form link**
that anyone can open and fill in without an account. Each **response** becomes a card on a Board tab of the same
document, in the status the form names, so collecting answers leads straight into working them on a board. It is
livediagram's answer to Google Forms: building a form, sharing it and reading the answers happen in the document
where the work then happens.

## Why

Boards and Sheets are where a team keeps its data, but data often starts with someone outside the team: a bug
report, a job application, an event RSVP, a feature request. Today that means a separate forms product, then
copying answers across by hand or through an integration. A Form tab removes the hop: the form is built beside the
board it feeds, every answer arrives as a card already in the right column, and the people answering never see the
document.

## Domain language

| Term                | Meaning                                                                                       | Not                           |
| ------------------- | --------------------------------------------------------------------------------------------- | ----------------------------- |
| **Form tab**        | A tab of kind `form`: one form, filling the tab                                               | form page, survey tab         |
| **form**            | The definition a Form tab holds: its heading, sections, questions, look and where answers go  | survey, questionnaire         |
| **section**         | One page of a form, shown alone with Next and Back; a form has at least one                   | page (Illustrate's), step     |
| **question**        | One thing a form asks: a prompt, a question type, whether it is required, and its answer slot | field (that is a card's)      |
| **question type**   | What a question takes (Short Answer, Multiple Choice...)                                      | field kind (that is a card's) |
| **mapping**         | Where a question's answer is kept on the card: Title, Description or one custom field         | binding, link                 |
| **destination**     | The Board tab, card type and status every response is made in                                 | target, inbox                 |
| **form link**       | The public address of a published form (`/form/<code>`); it grants nothing on the document    | share link (that is a doc's)  |
| **respondent**      | Anyone filling in a form through its form link; always anonymous                              | user, visitor, submitter      |
| **response**        | One submitted set of answers; it is made into one card                                        | submission, entry, reply      |
| **response number** | The form's own running count, 1, 2, 3, never reused (`Bug Report #14`)                        | key (that is the card's)      |

A Form tab is a tab **Kind** ([Domain language](../003-system-architecture/domain-language.md)), as a Board tab is:
it is what the tab is and it brings its own behaviour. It is always in Plan mode.

## The Form tab

- A Form tab follows the Plan tab kinds' rules ([Plan tabs](../026-plan/plan-tabs.md#the-kinds)): always in Plan,
  its mode switch reading Plan, picking another mode asks **Open a New <Mode> Tab?** ("A Form tab is always in Plan.
  Its mode can’t change, but you can carry on in a new <Mode> tab."), no palette, Shift+D does nothing, its tab
  menu lists no modes. Its pill leads with a clipboard-list glyph.
- The tab and its form share one name ([Names](../026-plan/plan-tabs.md#names)): the form's **heading** is the tab's
  name. Renaming either renames both in one undo step. A Form tab still on its default name takes its starter's name
  ("Bug Report"); a tab with a name of its own gives it to the form.
- The form is stored on the tab (`tab.form`), as a Dashboard's layout is, and syncs and undoes as tab content.
- A Form tab whose form is removed (none can be from the UI; an agent or a stale copy could) shows Start Planning.

### Starting a form

Start Planning ([Plan mode](../026-plan/plan-mode.md#starting-a-board)) gains a **Forms** category after
Spreadsheets, its cards each a picture of the form over its name and line:

| Starter             | Line                                     | Questions (type → mapping)                                                                                                                                                                                                                                                       |
| ------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Blank Form**      | Start from one question                  | Untitled Question (Short Answer, unmapped)                                                                                                                                                                                                                                       |
| **Bug Report**      | Reports land on your triage board        | Summary (Short Answer → Title, required); What happened? (Paragraph → Description, required); Severity (Single Choice → Severity); Email (Email → Email)                                                                                                                         |
| **Feedback**        | Ratings and comments, ready to sort      | How would you rate us? (Rating, stars → Rating, required); What did you like? (Paragraph); What could be better? (Paragraph); Email (Email → Email)                                                                                                                              |
| **Feature Request** | Ideas from anyone, voted on by your team | Idea (Short Answer → Title, required); Why do you need it? (Paragraph → Description); How important is it? (Rating, numbers "Nice to have" to "Essential" → Importance)                                                                                                          |
| **Event RSVP**      | Who is coming, and what they need        | Name (Short Answer → Title, required); Email (Email → Email, required); Attending? (Single Choice → Attending, required); Dietary needs (Multiple Choice → Dietary Needs)                                                                                                        |
| **Job Application** | Candidates straight into your pipeline   | Section "About You": Full name (→ Title, required), Email (→ Email, required), Portfolio or LinkedIn (Link → Profile); Section "Experience": Years of experience (Number, whole, 0 to 60 → Years of Experience), Why do you want to join us? (Paragraph → Description, required) |
| **Contact**         | Messages you can assign and close        | Name (Short Answer → Requested By, required); Email (Email → Email, required); Subject (Short Answer → Title, required); Message (Paragraph → Description, required)                                                                                                             |

Choosing a starter makes the tab and any new Board tab in one change and one undo step; the card type and fields
it brings are a card-type change of their own and stay after an undo, as a template's types do:

1. makes the tab a Form tab holding the starter's form;
2. picks the **destination**: the document's first Board tab whose board takes a card type the starter suits (a
   Bug for Bug Report, an Idea for Feature Request), else a new Board tab after the Form tab named
   "<Form> Responses" with three columns (**New**, **In Progress**, **Done**), its status **New**;
3. picks the **card type**: the starter's ready-made type, the document's own copy first (Bug for Bug Report, Idea
   for Feature Request, Candidate for Job Application, Request for Contact), else a new type named after the form
   ("Feedback", "Event RSVP") in the starter's colour with the checklist glyph;
4. adds the custom fields the starter's mappings name to that type (a field of that name and kind already on it is
   reused, never doubled, and a choice field gains any option it lacks); a new choice or rating field (Severity,
   Rating, Importance, Attending) is drawn on the card face, so it reads at a glance on the board.

Blank Form takes the document's first board and the first card type it takes; with no board, it makes the Responses
board and a "Response" card type.

**From a board**: a Board tab's board (not an All Cards or Archive one) offers **New Form** as its own row at the end of
its cog's menu, for an Editor. It makes a Blank form named "<Board> Form" on a new Form tab right after the board's
tab (in the board tab's theme), its responses going to that board's first column as the board's first card type, and
opens it, in one undo step.

## Building a form

An **Editor** builds the form **in place**, and everything about it is edited there, on a phone as on a desktop: no
side panel. The Form tab shows the form as respondents will see it, centred in a column 640 px wide (full width less
16 px gutters on a phone), on the tab theme's background. Above it sits the **status bar** (see
[Hearing about responses](#hearing-about-responses)), which ends with **Preview** (**Back to Editing** while
previewing), the help link and the form's **cog**.

- The answer controls the builder draws (unselected questions, and a selected one's control) are a picture of the
  form: they show a not-allowed cursor and take no input; a press on one selects its question.
- **Share Form** is the header's Share button: on a Form tab, for someone who may edit it, the header's **Share** is
  **Share Form** (filled once the form is published), so the page never shows two share buttons. Everyone else keeps
  the document's Share.

### The form card, top to bottom

- **Cover**: a band 160 px tall (96 on a phone) across the top of the column, in the cover colour (from the
  [colour picker](../004-interface-design/colour-picker.md); none takes the form colour) and a style: **Solid**,
  **Gradient** (into a light tint of the form colour) or **Dots**; or one of the slide backgrounds' **Gradients**
  ([Illustrate pages](../007-editor/illustrate-pages.md) "Backgrounds"), drawn in their place (a colour or style
  picked after clears it). Without a cover, a 10 px band of the form colour. **Add Cover** / **Change Cover** on
  hover (always shown on a touch screen, which has no hover) opens the cover popover, with **Remove Cover**.
- **Heading**: the form's name (1 to 80 characters), edited in place; **Description** under it (up to 1,000
  characters, plain text with line breaks and links made clickable), placeholder "Add a description".
- **Questions**, each a card. The selected one (click, or Tab onto it and Enter) shows its editing chrome: a
  **left accent bar** in the form colour, the prompt as an editable field beside its **type button**, the help text
  under it ("Description (optional)"), a choice question's options, a text answer's box (Short Answer, Paragraph,
  Number, Email, Link) as respondents see it with its **placeholder** typed straight into it, grey as it will show
  ("Placeholder: shown in the box until someone types." under it; emptied, the type's own hint), or any other type's
  answer control as respondents see it, disabled; its own **settings** in a tinted block (bounds and Whole Numbers Only, fewest and most
  picks, Show as Dropdown, scale, style and end labels: whichever its type has), and a **footer**: **Answer goes to**
  (a badge naming the mapping, opening [Answer Goes To](#mapping-where-an-answer-goes) under itself, a sheet on a
  phone, which closes once a choice is made), **Move Up**, **Move Down**, **Duplicate**, **Delete** and
  **Required**. Selecting a question grows its card open to the editing chrome, and letting go shrinks it back
  (220 ms; none under reduced motion). Escape lets go of it. Unselected questions show exactly
  what respondents see. Text is saved as typing pauses (half a second) and when a field is left, so typing is one
  undo step a pause, not one a key.
- **Sections**: a form with more than one section draws each as a block with its own title and description,
  headed "Section 2 of 3". The first section's title and description are the form's heading and description. A later
  section's block ends with its rule's badge ([Showing a section only sometimes](#showing-a-section-only-sometimes)).
- **Add bar**: under the selected question (or at the end when none is), a pill with **Add <Type>** (the selected
  question's type, as people tend to ask runs of the same kind; Short Answer with none), an arrow listing every type,
  and **Add Section**, which splits the form after the selected question (else adds an empty section at the end). The
  new question is selected with its prompt focused. A later section's header has **Delete Section**: its questions
  join the section before it.
- **Drag** a question by its handle (six dots at its top, on hover, always on a touch screen, and on the selected
  card; mouse, pen or touch) to
  reorder it, between sections too: a line in the form colour marks where it will land, the page scrolls near its
  edges and Escape cancels. Alt+Up and Alt+Down move the selected question from the keyboard.

### Showing a section only sometimes

A section after the first can show **only when an earlier answer is** one of some answers (a form branching on "Are
you coming?"):

- **The rule** (`showIf`): one earlier **Single Choice**, **Multiple Choice** or **Checkbox** question, and the answers
  that show the section (any of: a choice's options; a Checkbox's **Ticked** or **Not Ticked**). A Multiple Choice
  matches when any pick is one of them; a Checkbox left alone reads as Not Ticked; an unanswered choice matches none.
- **In the builder**: under a later section's description, a badge reads the rule back ("Always shown", or "Shown
  when Coming? is Yes or Maybe") and opens its editor (a popover; a sheet on a phone): **Always**, or **Only when an
  earlier answer is…** with the question (a select of the earlier questions that fit) and the answers (toggle chips,
  at least one). With no fitting earlier question it says to add one first. Unpicking every answer clears the rule.
- **A broken rule** (its question deleted, moved after the section, changed to a type that does not fit, or none of
  its answers still offered) shows the section always, and the badge says "Always shown: its question was removed or
  changed" (amber) until a rule is chosen again.
- **Filling in**: which sections show is worked out from the answers so far, section by section, and a rule reads
  only answers from sections that show, so a hidden section's answers never decide another's. **Next** and **Back**
  step over a hidden section, the progress counts only the sections that show ("Section 2 of 3"), and the last
  section that shows ends with **Submit** (changing an answer can change which that is).
- **On the api**: a response is checked against, and keeps, only the questions of the sections its answers show; a
  hidden section's required questions are not asked and its answers are dropped.

### Responses Go To and Settings

The status bar's **cog** (an Editor's) opens one panel, 320 px wide under it (a sheet on a phone), switching between
**Responses Go To** (first) and **Settings**; a paused form's fix opens it on Responses Go To.

- **The connect box**: while a form sends its responses nowhere (no board and no sheet), an Editor's builder shows a
  box above the form's title, "Where Should Responses Go?", with **New Board** (Responses Go To's New Board),
  **New Sheet** (its New Sheet) and, when the document already has a Board or Sheet tab, **Choose Existing**, which
  opens the cog on Responses Go To. It goes as soon as the form names a board or a sheet; a broken destination is
  the status bar's to report, not the box's. A Participant or Viewer never sees it.

- **Responses Go To** (the destination): **Board** (the document's Board tabs, its last choice **+ New Board**: a
  Board tab after this one, "<Form> Responses", New, In Progress, Done), **Card Type** (the types that board takes,
  its last choice **+ New Card Type**: a type named after the form, which a board confining its types also takes),
  **Column** (the board's columns, as chips); a pencil beside Card Type opens that type's editor (its fields), to shape it before mapping answers. A sentence under it reads the result back: "Each response becomes a
  **Bug** card in **New** on **Bugs**." A destination that no longer holds says why instead.
- **Settings**: **Accepting Responses** (the link's switch; dimmed until published), **Close On** (a date and time,
  with Clear; a time already past says the form is closed) beside **Response Limit** (1 to 2,000), **Confirmation
  Message** (up to 500 characters, default "Thanks, your response has been recorded."), **Closed Message** (up to
  500 characters, default "This form is no longer accepting responses."). A form has no colour setting of its own: it
  wears its tab's [look](#look), changed from **Style** as ever.

### Look

A form wears its tab's look, in the builder and on the form link's page alike, so a form on a hand-drawn Doodle tab
reads hand-drawn and one on a Boardroom tab reads crisp. The form card stays white (light) or the dark card colour,
so text contrast never depends on the theme.

- **Colour**: always the tab theme's own colour for each half (the theme's line colour; on Default, the brand blue
  of each half), never the card type's or the starter's. It paints the cover's default band, the accent bars, focus
  rings, selected choices, the progress bar, links and the filled buttons, whose labels take whichever of light or
  dark text reads on it. A colour an earlier build stored on a form (`accent`) is dropped when the form is read.
- **Font**: the tab font, on everything in the form (a tab with none keeps the app font).
- **Finish**: **Flexible** draws boxes as they are; **Professional** squares their corners (2 px); **Sketch** draws
  every box (cards, fields, choices, ratings, buttons) by hand: a wandering outline at a marker's 2 px in ink
  (slate 700 light, slate 300 dark), neighbours wobbling differently, with a pencil-offset shadow. Focus, a pick and
  an error keep their own outline colours.
- **Backdrop**: the theme's canvas colour, its light or dark half following the viewer.
- A custom theme draws as Default, on the page and in the builder alike: the form link's page cannot read its
  owner's themes, and the builder shows what respondents will see.
- The look dresses the form alone: the builder's status bar and the cog's panel are the editor's and keep its look.

### Preview

**Preview** (in the menu box) hides every piece of editing chrome and draws the form
exactly as the form link does, working: sections, validation and the confirmation. Escape or **Back to Editing**
returns; both start at the form's top.

**Submit in Preview makes the card**, so the whole road from question to board can be tried before the link goes out:
the answers are checked as the api checks them, and the card a response would make lands on the destination, in its
column, with every answer mapped, except that

- its title starts **"Preview: "** (then the Title answer, or the form's heading when no question goes to Title);
- on a **published** form it is a counted **response** (`POST .../tabs/:tabId/form-preview`, an Editor's): it takes
  the next response number and counts toward the total and the limit, is taken while the form is closed too, and
  sends no email; a previewer who had seen every response has seen it too (one with others unseen keeps them new);
- on a form with **no link yet** there is no count to add it to: the editor makes the card itself (no number, no
  **New** dot, the Editor in Created By, one undo step).

The confirmation adds "This was a preview: its card, marked Preview, is on <board>." A destination that cannot take
a card refuses with "Preview can't add its card until Responses Go To names a board and column."

### Question types

| Type                | The respondent sees                                                              | Settings                                                                      | Kept as                       |
| ------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------- |
| **Short Answer**    | A one-line text box                                                              | Placeholder, typed into its box                                               | Text, up to 200 characters    |
| **Paragraph**       | A growing text area                                                              | Placeholder, typed into its box                                               | Text, up to 2,000 characters  |
| **Number**          | A number box                                                                     | Placeholder, typed into its box; Minimum, Maximum, Whole Numbers Only         | A number                      |
| **Email**           | An email box                                                                     | Placeholder, typed into its box                                               | An email address              |
| **Link**            | A web address box                                                                | Placeholder, typed into its box                                               | An `https://` URL             |
| **Date**            | A date picker                                                                    |                                                                               | A date (`YYYY-MM-DD`)         |
| **Single Choice**   | Radio buttons (or a dropdown past 7 options)                                     | Options (2 to 20), Show as Dropdown                                           | One option                    |
| **Multiple Choice** | Checkboxes                                                                       | Options (2 to 20), Minimum and Maximum Picks                                  | A list of options             |
| **Rating**          | Stars, or numbered buttons on a scale (Numbers' labels under the first and last) | Scale 3 to 10 (5 by default), Stars or Numbers, Low and High labels (Numbers) | A whole number 1 to the scale |
| **Checkbox**        | One checkbox beside the prompt ("I agree to...")                                 |                                                                               | true or false                 |

- A prompt is 1 to 200 characters ("Untitled Question" until typed); help text up to 500.
- Options are 1 to 40 characters (a Choice field's limit, as a question's options may become its field's), unique
  ignoring case (a repeat is put back), edited as a list: Enter adds the next ("Option 3", selected), Backspace in an
  empty one removes it, Alt+Up and Alt+Down move it, pasting several lines adds one option a line. **Add “Other”**
  adds an Other option with its own text box to Single and Multiple Choice; typing in it picks it, and its text is
  kept as the answer.
- A **required** question is marked with a red asterisk and its accessible name says "required". A required
  Checkbox must be ticked.

### Mapping: where an answer goes

Every question's answer is kept on the response's card. **Answer Goes To** offers:

- **Description** (the default): the answer is written into the card's Description under its prompt, in form order:
  each unmapped answered question a bold line of the prompt, then the answer (choices joined by commas, a Rating as
  "4 / 5", a Checkbox as Yes or No). Unanswered questions are left out.
- **Title**: Short Answer, Email, Number, Single Choice and Date questions may map to Title; one question at most
  (picking it for one unmaps it from another, saying so).
- **A custom field** of the destination card type whose kind takes the answer (below), or **New Field "<Prompt>"**,
  which adds a custom field of the right kind named after the prompt (made unique) to the card type at once. A
  field mapped by another question is shown as taken.

| Question type   | Field kinds it may map to                            |
| --------------- | ---------------------------------------------------- |
| Short Answer    | Text, Long Text                                      |
| Paragraph       | Long Text                                            |
| Number          | Number, Currency                                     |
| Email           | Email, Text                                          |
| Link            | Link, Text                                           |
| Date            | Date                                                 |
| Single Choice   | Choice (options matched by name), Text               |
| Multiple Choice | Multiple Choice (options matched by name), Long Text |
| Rating          | Rating (scale equal or larger), Number               |
| Checkbox        | Checkbox                                             |

- A Single or Multiple Choice question may map to a Choice or Multiple Choice field only while the field holds every
  option it offers and it has no Other (an Other answer is no option of the field). Mapped, it keeps the field's
  options in step: an option added or renamed on the question is added to the field. The field never loses an
  option this way (a card may hold it): one removed or renamed on the question stays on the field.
- A mapping whose field is later deleted, hidden from the type, or no longer fits (its kind or options changed)
  falls back to Description: the question's chip turns amber reading "Description (its field was removed)", an
  unselected question says "Goes to Description", and Answer Goes To explains, until changed.
- New Field "<Prompt>" is offered while the type has fewer than 12 custom fields, and says so at the limit.
- When nothing maps to Title, a card's title is the **form's heading and the response number** ("Bug Report #14").
  Answer Goes To shows a tip on a question that could be the Title while nothing is: "Tip: map one question to Title
  so cards read well on the board."

### New card field kinds

Two kinds join the [custom field kinds](../026-plan/item-types.md) so form answers keep their shape on a card:

- **Multiple Choice**: several of up to 20 named options. Its value is a list of option names in option order. On a
  card it reads as the names joined by commas; the panel edits it as checkboxes; a board cannot lane by it (a card
  belongs in one lane). The type editor takes its options one a line, as Choice's.
- **Rating**: a whole number from 1 to the field's scale (3 to 10, `scale`, 5 by default, chosen in the type editor
  as "Out of 3" to "Out of 10"), drawn as that many stars filled to the value (or "7 / 10" when the scale is past 5);
  the panel edits it with a radio group of stars (numbers past 5): a click, or the arrow keys, Home and End. Clearing
  is the ✕ beside it.

Both are added from the type editor's Add Field tiles like any other kind (making twelve tiles, six to a row), are
carried by CSV (Multiple Choice as names joined by `; `, read back from semicolons, or from commas when every part is
an option; Rating as its number, refused outside its scale), the MCP card tools (`change_card_types` takes
`multichoice` with options and `rating` with `scale`; `change_items` takes picks by name and a rating within its
scale; `list_items` lists a rating's scale) and Sheets card references (a Multiple Choice as its text, a Rating as its
number).

## Publishing and the form link

- **Share Form** (the header's Share on a Form tab, an Editor's) opens the **Share Form** dialog, separate from the
  document's Share dialog:
  - Its subtitle: "Anyone with the link can fill in this form. They won’t see your document."
  - Not yet published: a line on what publishing does and **Publish Form**, which makes the form link. While
    responses have nowhere to go, it is held back with the reason and **Choose Where Responses Go**. While the form
    is **not ready** it is held back under "Before publishing:", each problem a line, a question's or section's with
    **Show** (closing the dialog and selecting the question, or scrolling to the section):
    - "Add a question: a form needs at least one." (no questions);
    - "A question has no wording yet.";
    - "A choice question has no options." (a Single or Multiple Choice with none);
    - "An answer goes to a card field that was removed or no longer fits." (a broken mapping);
    - "A section shows only on an answer that is no longer there." (a broken section rule).
      The api checks the same (`publishProblems`) and refuses with 409 `form_not_ready` and the problems.
  - Published: the link in a read-only field with **Copy Link** (it reads "Copied" for a moment), **Open** (a new
    browser tab), **Accepting Responses** with the count so far, and **Delete Link**, which asks first ("Delete this
    link? People with it will see this form isn’t available. Publishing again makes a new link.").
  - A document kept on this device only (an offline document) cannot publish: the dialog says forms are published
    from documents saved to livediagram.
- The form link is `/form/<code>`: a code of 22 random characters (base 62, about 131 bits), separate from every
  share link. It grants **nothing** on the document: no read, no room, no images.
- One live link per Form tab. Its response number carries on across a deleted or suspended link and a new one.
- **Open**: the form accepts responses while it is open, its Close On time has not passed, its Response Limit is not
  reached, and its document is not in the Trash. Otherwise it is **closed**, and the form link shows the closed page.
  Closing and reopening keep the link and the response number.
- **Live**: the form link always shows the form as its Form tab holds it now. A question added, reworded or removed
  takes effect for the next person to open the link; a respondent already filling it in submits against what they
  saw, and an answer to a question since removed is dropped, never refused.
- A Form tab deleted deletes its form link in the same request. A document copied, a tab duplicated or a document
  restored from a file copies the form **unpublished**: a copy never answers the original's link.
- A copy keeps its destination: a duplicated tab's still names the document's board; a copied document's names a tab
  the copy may not hold, and then reads as needing a choice (below) until one is made.
- Publishing needs a destination whose Board tab (a live board on it), card type (taken by that board) and column
  still exist; **Publish Form** is held back with the reason otherwise. A published form whose destination breaks
  later shows its link as closed and refuses responses, and the Form tab's status bar says "Responses are paused."
  with the reason and **Choose Where Responses Go**, which opens the Responses Go To tab.

## Filling in a form

The form link opens a page of its own, outside the editor: no Explorer, no document chrome, no sign-in prompt, and
no editor code loaded (its own small bundle).

- **Look**: the form in its tab's [look](#look) (colour, font, finish and backdrop, each following the respondent's
  system). The Report This Form panel keeps livediagram's own look. A footer: "Made with livediagram" linking to the marketing site, and
  **Report This Form** (below).
- **Sections**: one section at a time, a progress bar across the top ("Section 2 of 3"), **Back** and **Next**; Next
  checks only that section's questions. The last section's button is **Submit**. Sections that do not show for the
  answers so far are stepped over and not counted ([Showing a section only sometimes](#showing-a-section-only-sometimes)).
- **Answers are kept while filling in**: in the browser's session storage per form, so a reload or a wrong Back keeps
  what was typed; cleared on submit. **Submit Another Response** starts afresh.
- **Checking answers**: each field is checked when it loses focus (an empty one only on Next or Submit, so tabbing
  through is no mistake) and again on Next or Submit. An error shows under
  the question in red with an icon ("This question is required", "Enter an email address like name@example.com",
  "Enter a whole number from 1 to 10", "Pick at most 3"), the question's border turns red, and on Next or Submit a
  summary at the top lists every error as a link to its question, with focus moved to the summary.
- **Submitting**: the button reads "Sending…" with a spinner and is disabled; on success the page shows the
  **confirmation**: a check mark drawn in, the form's heading, its Confirmation Message, and **Submit Another
  Response**. A failure keeps every answer and says why: "We couldn’t send your response. Check your connection and
  try again.", "This form is busy. Try again in a few minutes." or "You’ve sent a lot of responses. Wait a minute and
  try again."; a form closed or full meanwhile shows "This form has just closed, so your response wasn’t recorded."
  An answer the api refuses goes back to its section, its error shown.
- **Loading**: grey placeholder cards; a form that cannot be read says "We couldn’t load this form" with **Try
  Again**. The page's title is the form's heading.
- **Closed**: the form's heading and its Closed Message, nothing else. **Not found** (a deleted or unknown link):
  "This form isn’t available" and "It may have been deleted, or the link may be wrong."
- **Accessibility**: every question is a labelled control or a named group (`radiogroup`, `group`); help text is the control's
  description; errors are linked with `aria-describedby` and `aria-invalid`; the error summary is a focusable
  `role="alert"` region; stars are a radio group with arrow-key movement and labels ("4 stars of 5"); everything is
  usable by keyboard alone; contrast meets WCAG 2.2 AA on every theme; the check mark's draw-in is still under
  reduced motion.
- **Report This Form** opens a short form in place under the footer: a reason (Spam, Phishing or Asking for
  Passwords, Offensive, Something Else) and an optional note of up to 300 characters, **Cancel** and **Send Report**;
  "Thanks. We’ve recorded your report." after. One report per browser per form (a random id kept in the browser). Moderation follows
  [Community](../025-community/community.md#reports-and-moderation): nobody reviews by hand. Once reports have come
  from three distinct browsers on three distinct networks, the form link is **suspended** for good: it shows the not
  found page, its Form tab says "This form’s link was suspended after reports from respondents", and the owner is
  emailed. Publishing again makes a new link; a document whose form links have been suspended twice cannot publish
  another.
- Beside Submit, in small type: "Never submit passwords through livediagram forms."

## What a response makes

On submit the api, in one write:

1. reads the Form tab's form as it now stands and checks it is open (else `form_closed`);
2. checks each answer against its question (type, required, limits, options); a missing required answer or a bad
   value refuses the response with the question's id and reason, which the page shows under the question;
3. takes the next **response number**;
4. makes **one card** in the destination: the card type, the status (a new card is never refused a status its type
   leaves out), at the bottom of that column; its Title, Description and custom fields from the mappings; its
   creator the form itself (`createdBy`: the name "<Form> form", the form's colour), so its panel says "Created by
   Bug Report form"; and `fromForm` (`<form tab id>:<response number>`), a plain field no card face draws;
5. relays the new card to the document's room, so everyone with the board open sees it arrive.

- The card's panel says so at the foot of Details, under Created by: "Form response #14, 15 Oct 2026, 14:02".
- The answers are checked again on the api, and the card it would make is checked by the item store before a number
  is taken, so a refused response never uses one.
- A response is only its card. Editing or deleting the card edits or deletes the response; there is no second copy.
- The document's item store limit ([Items](../026-plan/items.md#limits)) holds: a document at its limit refuses
  responses (`form_full`; the page says the form has just closed); the Form tab's status bar says "Responses are
  paused: this document holds as many cards as it can."

## Responses to a Sheet

Responses Go To opens on a switch: **Cards on a Board** (above: a card each, answers mapped to fields) or **Rows in a
Sheet** (a row each, a column per question, no mapping; `form.sheet`: `{ tabId, sheetId }`). Switching keeps the
board settings, for switching back.

- **Choosing the sheet**: **Sheet** lists the document's Sheet tabs' sheets by their tab's name ("Budget", "Budget 2"
  for a second on it), its last choice **+ New Sheet**: a Sheet tab "<Form> Responses" after the Form tab (in its
  theme), a blank sheet on it the destination, opened so the sheet is made. Picking Rows in a Sheet with no sheet
  yet makes one the same way. A sentence reads it back: "Each response becomes a row on **Budget**, a column per
  question. No mapping needed." A sheet no longer on its tab says "Its sheet was removed. Choose where responses go."
  and pauses the form, as a broken board destination does.
- **In the builder**: a question's footer reads "Its own column in the sheet" in place of the Answer goes to badge.
- **The row** (`responseRowWrite`, `@livediagram/forms`): the sheet's first row holds the headers, **#**,
  **Submitted** and each question's wording (a repeated wording gets " (2)"); a question finds its column by its
  header, ignoring case, and one with none takes the next free column after the last header (columns added in one
  insert when the sheet has too few). Headers the form writes are bold, and a sheet given its first headers has row 1
  frozen. The response takes the first row after the last row holding anything (rows added when there are none).
  Its cells: the response number, the time ("2026-10-15 14:03 UTC"; the api knows no one's zone), and each answer: a
  Number or Rating as a number, a Checkbox as true or false, the rest as text (several picks "Vegan, Halal"); an
  unanswered question leaves its cell empty.
- **Stored** through the sheet store's own write (`storeSheetWrite`: validation, caps, the rev guard, the relay),
  unchecked against the sheet's validation rules so a response always lands; by the form's person ("<Form> form").
  A sheet too full refuses as `form_full`; the number stays claimed whatever happens.
- **Preview**: a published form's preview is a counted row (its number, "· Preview" after its time); an unpublished
  form's preview is written by the api too (`.../form-preview` with no link), its # reading **Preview**.
- **Elsewhere**: the response count opens the sheet's tab; the Inbox names the sheet's tab; no board shows the
  form's Form strip. Publishing checks no mappings for a sheet form.

## Hearing about responses

- **The board's Form strip**: a board on a Board tab that a form sends its responses to shows, leading its widgets
  (in the header, or in the band's controls card when the board fills its tab), one pill per such form, with no one
  adding it: the clipboard glyph, the form's name, a dot (green while accepting, grey closed or unpublished, its state
  read out), "3 responses · 1 new", **Copy Form Link** (an Editor's, once published; it reads "Copied") and **Open
  Form** (opens the Form tab). It reads the count without marking anything seen (only opening the Form tab does), and
  refreshes as the Form tab's status bar does. It is not a stored widget: it comes and goes with the form's
  destination.
- **On the board**: a card made by a response shows a **New** dot (the brand colour, beside its flag, named "New
  response") until it is opened in this browser, or until a week has passed. What has been opened is kept per browser.
- **On the Form tab**: the **status bar** over the form: its state (**Not Published**, **Accepting Responses**,
  **Paused**, **Closed**, **Suspended**, or **Draft** for an offline document), the count ("14 responses · 3 new",
  new to this reader), which opens the destination's tab (its tooltip names it). The count is read when the tab opens
  and every 30 seconds while it is shown.
- **Inbox**: a **Form Responses** section in the Explorer's [Inbox](../013-workspace/inbox.md) lists each live
  form, in a document the reader owns or reaches through a team, that has responses the reader has not seen: "3 new
  responses to **Bug Report**", its document's chip, newest response first; a row opens the destination board (the
  Form tab when it has none). Unseen is counted by response number: opening the Form tab marks every response so far
  seen for that reader, and publishing marks them seen for the publisher. The Inbox's own badge still counts only
  what is assigned to the reader.
- **Email**: the document's owner gets "New response to Bug Report", naming the card's title and its document, with
  **Open the board**. At most one email per form per 15 minutes: the next one sent says "And 4 more responses have
  arrived since the last email." Turned off with **Someone Fills In My Form** in Settings' email notifications;
  never sent where email is not configured (a self-hosted install without it).

## Who may do what

| Action                                                   | Editor                                 | Participant | Viewer |
| -------------------------------------------------------- | -------------------------------------- | ----------- | ------ |
| See the Form tab (as a Preview, no editing chrome)       | ✓                                      | ✓           | ✓      |
| Build: questions, sections, mappings, destination, look  | ✓                                      |             |        |
| Publish, open, close, delete the link, see the form link | ✓                                      |             |        |
| See the response count, which opens the destination      | ✓                                      | ✓           | ✓      |
| Fill in the form through its link                        | anyone with the link, signed in or not |             |        |

A Participant or Viewer sees the form drawn as the form link draws it (working, but sending nothing and making no
card: only an Editor's Preview makes one), with a
line over it: "This is a form. Its responses become cards on **Bugs**." A tab-scoped share link to a Form tab shows the
same. The form link's code is never sent to a Participant or a Viewer; they see the status and the count. A locked
Form tab reads as a Viewer's does.

## Abuse and limits

- **Rate limits**: 60 a minute from one network (an IPv4 /24 or IPv6 /56, as Community's likes), for a form's reads
  and its responses each, enough for a classroom behind one address; and 500 responses an hour to one form from
  everyone. Past them `429 rate_limited` / `form_busy`, and the page says so (above).
- **A hidden field** respondents never see: a response that fills it is dropped (answered as a success, so a bot
  learns nothing), counted in telemetry.
- **Size**: a response body is at most 64 KB; a form holds at most 10 sections and 100 questions.
- **A form link** reads the form as it stands, never from a cache (`Cache-Control: no-store`): an edit, a close or a
  delete shows at once. A read is three small rows (the link, the document, the tab), cheap at any rate the limiter
  lets through.
- Every miss (an unknown, deleted or suspended code, a document in the Trash, a tab gone or no longer a Form tab)
  answers the same `404 form_not_found`.
- No respondent identity is kept: no address, no account, no cookie. A response's card carries the answers alone.

## Agents

The MCP server's `list_items` and `change_items` see a form's cards as any cards (`fromForm` among their fields).
`read_document` shows a Form tab as `kind=form`. Reading a form's questions, and building or publishing forms through
an agent, are later steps.

## Telemetry

| Category | Action   | Type                                               | When                                                  |
| -------- | -------- | -------------------------------------------------- | ----------------------------------------------------- |
| Form     | Created  | the starter (`Blank`, `BugReport`, `Rsvp`, ...)    | A starter is chosen on Start Planning                 |
| Form     | Created  | `FromBoard`                                        | New Form on a board's cog                             |
| Form     | Added    | the question type (`ShortAnswer`, `Rating`, ...)   | Add Question                                          |
| Form     | Shared   | `Link`                                             | Publish Form                                          |
| Form     | Shared   | `BoardCopy`                                        | Copy Form Link on a board's Form strip                |
| Form     | Toggled  | `Open` / `Closed`                                  | Accepting Responses flipped (before the change lands) |
| Form     | Sent     | `Response` / `Dropped` (hidden field)              | The api accepts or drops a response (server-side)     |
| Form     | Sent     | `Preview`                                          | An Editor's Preview makes its card                    |
| Form     | Reported | `Spam` / `Phishing` / `Offensive` / `Other`        | A report is filed (server-side)                       |
| Activity | Selected | `FormResponses`                                    | A Form Responses row in the Inbox                     |
| UI       | Toggled  | `NotifyFormResponsesOn` / `NotifyFormResponsesOff` | The email switch in Settings                          |
| Email    | Sent     | `FormResponse` / `FormSuspended`                   | Those emails go (server-side)                         |

Every chart is on the public dashboard's **Forms** stack.

## Out of scope

- Signing in to respond, one response per person, editing a response after submitting.
- File uploads, logic that skips sections by an answer, quizzes and scores.
- A responses summary of charts per question (a Dashboard over the board covers it for now).
- Building or publishing forms through the MCP server or the CLI.
- A QR code of the form link, and importing questions from another form.
- A cover image (a cover is a colour and a style): an image would join the image store's reference index.
- Dragging a choice's options (Alt+Up and Alt+Down move them).
