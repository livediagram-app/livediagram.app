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

| Starter             | Line                                     | Questions (type → mapping)                                                                                                                                                                                 |
| ------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Blank Form**      | Start from one question                  | Untitled Question (Short Answer, unmapped)                                                                                                                                                                 |
| **Bug Report**      | Reports land on your triage board        | Summary (Short Answer → Title, required); What happened? (Paragraph → Description, required); Severity (Single Choice → Severity); Email (Email → Email)                                                   |
| **Feedback**        | Ratings and comments, ready to sort      | How would you rate us? (Rating → Rating, required); What did you like? (Paragraph); What could be better? (Paragraph); Email (Email)                                                                       |
| **Feature Request** | Ideas from anyone, voted on by your team | Idea (Short Answer → Title, required); Why do you need it? (Paragraph → Description); How important is it? (Rating → Importance)                                                                           |
| **Event RSVP**      | Who is coming, and what they need        | Name (Short Answer → Title, required); Email (Email → Email, required); Attending? (Single Choice → Attending); Dietary needs (Multiple Choice → Dietary)                                                  |
| **Job Application** | Candidates straight into your pipeline   | Section "About You": Full name (→ Title, required), Email (→ Email, required), Portfolio (Link → Portfolio); Section "Experience": Years of experience (Number → Years), Why us? (Paragraph → Description) |
| **Contact**         | Messages you can assign and close        | Name (→ Title, required); Email (→ Email, required); Message (Paragraph → Description, required)                                                                                                           |

Choosing a starter makes the tab and any new Board tab in one change and one undo step; the card type and fields
it brings are a card-type change of their own and stay after an undo, as a template's types do:

1. makes the tab a Form tab holding the starter's form;
2. picks the **destination**: the document's first Board tab whose board takes a card type the starter suits (a
   Bug for Bug Report, an Idea for Feature Request), else a new Board tab after the Form tab named
   "<Form> Responses" with three columns (**New**, **In Progress**, **Done**), its status **New**;
3. picks the **card type**: the starter's ready-made type when the catalogue has it or can take it (Bug, Idea,
   Candidate), else a new type named after the form ("Feedback") with the form's colour and the clipboard glyph;
4. adds the custom fields the starter's mappings name to that type (a field of that name and kind already on it is
   reused, never doubled).

Blank Form picks a destination the same way, with a new "Response" card type only once the first question is mapped
to a new field; until then its responses are made as the board's first card type.

## Building a form

An **Editor** builds the form **in place**: the Form tab shows the form as respondents will see it, centred in a
column 640 px wide (full width less 16 px gutters on a phone), on the tab theme's background.

### The form card, top to bottom

- **Cover**: a band 160 px tall (96 on a phone) across the top of the column, the form's cover colour (from the
  [colour picker](../004-interface-design/colour-picker.md)), or a cover image (uploaded through the document's image
  store, drawn cover-cropped). Absent: a 10 px band of the theme's accent. **Change Cover** on hover or focus.
- **Heading**: the form's name (1 to 80 characters), edited in place; **Description** under it (up to 1,000
  characters, plain text with line breaks and links made clickable), placeholder "Add a description".
- **Questions**, each a card. The selected one (click, or Tab onto it and Enter) shows its editing chrome: a
  **left accent bar** in the brand colour, the prompt as an editable heading, the help text under it, the answer
  control as respondents see it (disabled), and a **footer**: Required switch, Duplicate, Delete, and a ⋯ with Move
  Up, Move Down and Move to Section. Unselected questions show exactly what respondents see.
- **Sections**: a form with more than one section draws each as a block with its own title and description,
  headed "Section 2 of 3". The first section's title and description are the form's heading and description.
- **Add bar**: under the selected question (or the last), a floating pill with **Add Question** (a menu of the
  question types, each its icon and name) and **Add Section**. The new question takes the selected one's type, as people tend to ask runs of the same kind.
- **Drag** a question by its handle (six dots, shown on hover and on the selected card) to reorder it, between
  sections too; Alt+Up and Alt+Down move the selected question from the keyboard.

### The Form panel

A side panel at the right (a bottom sheet on a phone) with three tabs:

- **Question** (when a question is selected): **Type** (the question types as a list of icon rows), **Answer
  Goes To** (the mapping, below), type-specific settings (options, scale, limits) and **Required**.
- **Responses Go To** (the destination): **Board** (the document's Board tabs, plus **New Board**), **Card Type**
  (the types that board takes, plus **New Card Type**), **Status** (the board's columns, as coloured chips). A
  sentence under it reads the result back: "Each response becomes a **Bug** card in **Triage** on **Bugs**."
- **Settings**: **Accepting Responses** (the Open switch, below), **Close On** (a date and time, optional),
  **Response Limit** (a number, optional), **Confirmation Message** (up to 500 characters, default "Thanks, your
  response has been recorded."), **Closed Message** (up to 500 characters, default "This form is no longer
  accepting responses."), and the **Look**: the form colour and the cover; the backdrop is the tab theme's, changed
  from the tab menu as ever.

### Preview

**Preview** in the top row hides every piece of editing chrome and draws the form exactly as the form link does,
working (sections, validation, the confirmation), without saving anything. Escape or **Back to Editing** returns.

### Question types

| Type                | The respondent sees                              | Settings                                                                      | Kept as                       |
| ------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------- | ----------------------------- |
| **Short Answer**    | A one-line text box                              | Placeholder                                                                   | Text, up to 200 characters    |
| **Paragraph**       | A growing text area                              | Placeholder                                                                   | Text, up to 2,000 characters  |
| **Number**          | A number box                                     | Minimum, Maximum, Whole Numbers Only                                          | A number                      |
| **Email**           | An email box                                     |                                                                               | An email address              |
| **Link**            | A web address box                                |                                                                               | An `https://` URL             |
| **Date**            | A date picker                                    |                                                                               | A date (`YYYY-MM-DD`)         |
| **Single Choice**   | Radio buttons (or a dropdown past 7 options)     | Options (2 to 20), Show as Dropdown                                           | One option                    |
| **Multiple Choice** | Checkboxes                                       | Options (2 to 20), Minimum and Maximum Picks                                  | A list of options             |
| **Rating**          | Stars, or numbered buttons on a scale            | Scale 3 to 10 (5 by default), Stars or Numbers, Low and High labels (Numbers) | A whole number 1 to the scale |
| **Checkbox**        | One checkbox beside the prompt ("I agree to...") |                                                                               | true or false                 |

- A prompt is 1 to 200 characters ("Untitled Question" until typed); help text up to 500.
- Options are 1 to 80 characters, unique ignoring case, edited as a list (Enter adds the next, Backspace on an
  empty one removes it, pasting several lines adds one each, drag to reorder). An **Other** option with its own
  text box may be added to Single and Multiple Choice; its text is kept as the option.
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

- A Single or Multiple Choice question mapped to a field shares its options: adding, renaming or removing an option on
  the question does the same to the field (one undo step), so the two never drift. A field's option a card already
  holds is never removed by this: the question's Delete Option then removes it from the question only, saying so.
- A mapping whose field is later deleted, or whose kind changes to one that no longer takes the answer, falls back to
  Description; the question shows "Goes to Description: its field was removed" until changed.
- When nothing maps to Title, a card's title is the **form's heading and the response number** ("Bug Report #14").
  The Answer Goes To list shows a hint on Short Answer questions while nothing maps to Title: "Map one question to
  Title so cards read well on the board."

### New card field kinds

Two kinds join the [custom field kinds](../026-plan/item-types.md) so form answers keep their shape on a card:

- **Multiple Choice**: several of up to 20 named options. Its value is a list of option names in option order. On a
  card it reads as the names joined by commas, shortened with "+2" past the space; the panel edits it as checkboxes;
  a board cannot lane by it (a card belongs in one lane).
- **Rating**: a whole number from 1 to the field's scale (3 to 10, `scale`, 5 by default), drawn as that many stars
  filled to the value (or "4 / 10" when the scale is past 5); the panel edits it by clicking a star or with the
  arrow keys. Clearing is the ✕ beside it.

Both are added from the type editor's Add Field tiles like any other kind (making twelve tiles, six to a row), are
carried by CSV (Multiple Choice as names joined by `; `, Rating as its number), the MCP card tools and Sheets card
references (a Multiple Choice as its text, a Rating as its number), and are validated by the item store.

## Publishing and the form link

- **Share Form** (top row, an Editor's) opens the **Share Form** dialog, separate from the document's Share dialog:
  - Not yet published: a line ("Anyone with the link can fill in this form. They won’t see your document.") and
    **Publish Form**, which makes the form link and opens the form.
  - Published: the link in a read-only field with **Copy Link**, **Open** (a new browser tab), the
    **Accepting Responses** switch, and **Delete Link**
    (confirmed: "People with the old link will see this form isn’t available. Publishing again makes a new link.").
- The form link is `/form/<code>`: a code of 12 random characters (base 62), separate from every share link. It
  grants **nothing** on the document: no read, no room, no images except the form's own cover.
- **Open**: the form accepts responses while it is open, its Close On time has not passed, its Response Limit is not
  reached, and its document is not in the Trash. Otherwise it is **closed**, and the form link shows the closed page.
  Closing and reopening keep the link and the response number.
- **Live**: the form link always shows the form as its Form tab holds it now. A question added, reworded or removed
  takes effect for the next person to open the link; a respondent already filling it in submits against what they
  saw, and an answer to a question since removed is dropped, never refused.
- A Form tab deleted deletes its form link in the same request. A document copied, a tab duplicated or a document
  restored from a file copies the form **unpublished**: a copy never answers the original's link.
- A copied Form tab's destination keeps pointing at the copy's Board tab when the board was copied with it, else is
  cleared ("Choose where responses go") and the copy cannot be published until one is chosen.
- Publishing needs a destination whose Board tab, card type and status still exist; **Publish Form** is disabled
  with the reason otherwise. A published form whose destination breaks later (the board deleted, the status removed)
  closes itself on the next response attempt, and the Form tab shows "Responses are paused: their board was
  removed. Choose where responses go." with the Responses Go To tab open.

## Filling in a form

The form link opens a page of its own, outside the editor: no Explorer, no document chrome, no sign-in prompt, and
no editor code loaded (its own small bundle).

- **Look**: the form's cover, then a card on the Form tab's theme backdrop (its light or dark half, following the
  respondent's system; a custom theme draws the default backdrop), with the **form colour** (`accent`, chosen
  under Look, the brand colour by default) on focus rings, selected choices, the progress bar and Submit, lifted on
  dark as type accents are. The card itself is white (light) or the dark card colour, so text contrast never depends
  on the theme. A footer: "Made with livediagram" linking to the marketing site, and
  **Report This Form** (below).
- **Sections**: one section at a time, a progress bar across the top ("Section 2 of 3"), **Back** and **Next**; Next
  checks only that section's questions. The last section's button is **Submit**.
- **Answers are kept while filling in**: in the browser's session storage per form, so a reload or a wrong Back keeps
  what was typed; cleared on submit.
- **Checking answers**: each field is checked when it loses focus and again on Next or Submit. An error shows under
  the question in red with an icon ("This question is required", "Enter an email address like name@example.com",
  "Enter a whole number from 1 to 10", "Pick at most 3"), the question's border turns red, and on Next or Submit a
  summary at the top lists every error as a link to its question, with focus moved to the summary.
- **Submitting**: the button shows a spinner and is disabled; on success the page shows the **confirmation**: a
  check mark drawn in, the form's heading, its Confirmation Message, and **Submit Another Response**. A failure keeps
  every answer and says why ("We couldn’t send your response. Check your connection and try again." with **Try
  Again**; "This form has just closed." for a form closed meanwhile).
- **Closed**: the form's heading and its Closed Message, nothing else. **Not found** (a deleted or unknown link):
  "This form isn’t available" and "It may have been deleted, or the link may be wrong."
- **Accessibility**: every question is a `fieldset` (a choice group) or a labelled control; help text is the control's
  description; errors are linked with `aria-describedby` and `aria-invalid`; the error summary is a focusable
  `role="alert"` region; stars are a radio group with arrow-key movement and labels ("4 stars of 5"); everything is
  usable by keyboard alone; contrast meets WCAG 2.2 AA on every theme; the check mark's draw-in is still under
  reduced motion.
- **Report This Form** opens a short dialog: a reason (Spam, Phishing or Asking for Passwords, Offensive, Something
  Else) and an optional note of up to 300 characters; one report per browser per form. Moderation follows
  [Community](../025-community/community.md#reports-and-moderation): nobody reviews by hand. Once reports have come
  from three distinct browsers on three distinct networks, the form link is **suspended** for good: it shows the not
  found page, its Form tab says "This form’s link was suspended after reports from respondents", and the owner is
  emailed. Publishing again makes a new link; a document whose form links have been suspended twice cannot publish
  another.
- Under Submit, in small type: "Never submit passwords through livediagram forms."

## What a response makes

On submit the api, in one write:

1. reads the Form tab's form as it now stands and checks it is open (else `form_closed`);
2. checks each answer against its question (type, required, limits, options); a missing required answer or a bad
   value refuses the response with the question's id and reason, which the page shows under the question;
3. takes the next **response number**;
4. makes **one card** in the destination: the card type, the status (a new card is never refused a status its type
   leaves out), at the bottom of that column; its Title, Description and custom fields from the mappings; its
   creator the form itself (`createdBy`: the name "<Form> form", the form's colour);
5. relays the new card to the document's room, so everyone with the board open sees it arrive.

- The card carries a **From Form** chip in its panel's Details ("From the Bug Report form, response #14, 15 Oct
  2026 14:02"), linking to the Form tab. It is never shown on the card face.
- A response is only its card. Editing or deleting the card edits or deletes the response; there is no second copy.
- The document's item store limit ([Items](../026-plan/items.md#limits)) holds: a document at its limit refuses
  responses (`form_full`), and the form link shows its Closed Message; the Form tab says "Responses are paused: this
  document holds as many cards as it can."

## Hearing about responses

- **On the board**: a card made by a response shows a **New** dot (the brand colour, top right of the card face) for
  each Editor until they open it, or until a week has passed.
- **On the Form tab**: under the heading, a count ("14 responses · 3 new") and **View on Board**, which opens the
  destination board with the new cards highlighted.
- **Inbox**: a **Form Responses** section in the Explorer's [Inbox](../013-workspace/inbox.md) lists each form, in a
  document the reader may edit, that has responses the reader has not seen: "3 new responses to **Bug Report**" in
  **<Document>**, newest first; a row opens the destination board. Opening the board or the Form tab marks the
  form's responses seen for that reader.
- **Email**: the document's owner gets "New response to Bug Report" with the card's title and a button to open it.
  At most one email per form per 15 minutes: one sent in a quiet spell says "and 4 more since" when others came while
  it was held. Turned off under **Form Responses** in the profile's email notifications; never sent where email is
  not configured (a self-hosted install without it).

## Who may do what

| Action                                                   | Editor                                 | Participant | Viewer |
| -------------------------------------------------------- | -------------------------------------- | ----------- | ------ |
| See the Form tab (as a Preview, no editing chrome)       | ✓                                      | ✓           | ✓      |
| Build: questions, sections, mappings, destination, look  | ✓                                      |             |        |
| Publish, open, close, delete the link, see the form link | ✓                                      |             |        |
| See the response count and View on Board                 | ✓                                      | ✓           | ✓      |
| Fill in the form through its link                        | anyone with the link, signed in or not |             |        |

A Participant or Viewer sees the form drawn as the form link draws it, disabled, with a banner: "This is a form. Its
responses become cards on **Bugs**." A tab-scoped share link to a Form tab shows the same. The form link itself is
never shown to a Participant or a Viewer.

## Abuse and limits

- **Rate limits**: 10 responses a minute from one network (an IPv4 /24 or IPv6 /56, as Community's likes) to any
  form, and 500 responses an hour to one form from everyone. Past them `429 rate_limited`, and the page says "You’ve
  sent a lot of responses. Wait a minute and try again." (the per-form cap: "This form is busy. Try again in a few
  minutes.").
- **A hidden field** respondents never see: a response that fills it is dropped (answered as a success, so a bot
  learns nothing), counted in telemetry.
- **Size**: a response body is at most 64 KB; a form holds at most 10 sections and 100 questions.
- **A form link** reads the form through a cached public answer (60 seconds at the edge, purged on publish, close and
  delete), so a popular form costs no database read per visit.
- No respondent identity is kept: no address, no account, no cookie. A response's card carries the answers alone.

## Agents

The MCP server's `list_items` and `change_items` see a form's cards as any cards. `read_document` with view
`outline` lists a Form tab with its heading, its questions (type, required, mapping) and its destination. Building a
form through an agent is a later step.

## Telemetry

| Category | Action        | Type                                             | When                                     |
| -------- | ------------- | ------------------------------------------------ | ---------------------------------------- |
| Form     | Created       | the starter (`Blank`, `BugReport`, ...)          | A starter is chosen on Start Planning    |
| Form     | QuestionAdded | the question type (`ShortAnswer`, `Rating`, ...) | Add Question                             |
| Form     | Published     | `Link`                                           | Publish Form                             |
| Form     | Opened        | `Open` / `Closed`                                | The switch is flipped                    |
| Form     | Responded     | `Response` / `Dropped` (hidden field)            | The api accepts a response (server-side) |

## Out of scope

- Signing in to respond, one response per person, editing a response after submitting.
- File uploads, logic that skips sections by an answer, quizzes and scores.
- A responses summary of charts per question (a Dashboard over the board covers it for now).
- Building or publishing forms through the MCP server or the CLI.
- A QR code of the form link, and importing questions from another form.
