// The form tools' input and output shapes (docs/specs/030-forms/forms.md "Agents", docs/specs/015-api/mcp-server.md
// §4.9e): read_form, add_form, change_form and share_form. Everything is named as the builder names it; the limits
// come from @liveplanner/forms, so the tools and the builder agree.
import { z } from 'zod';
import {
  FORM_DESCRIPTION_MAX,
  FORM_HEADING_MAX,
  FORM_RESPONSE_LIMIT_MAX,
  HELP_MAX,
  MESSAGE_MAX,
  OPTION_MAX,
  OPTIONS_MAX,
  PLACEHOLDER_MAX,
  PROMPT_MAX,
  QUESTIONS_MAX,
  QUESTION_TYPES,
  QUESTION_TYPE_NAMES,
  RATING_SCALE_MAX,
  RATING_SCALE_MIN,
  SCALE_LABEL_MAX,
  SECTIONS_MAX,
  STARTER_IDS,
  type QuestionType,
  type StarterId,
} from '@liveplanner/forms';
import { PAGE_MOTIONS } from '@liveworkspace/page-background';
import { FORM_CHANGES_MAX } from '../forms/form-calls';

const url = z.string().describe('Link that opens the plan in the liveplanner editor.');
const projectId = z.string().describe('The plan (from find_projects).');
const tab = z
  .string()
  .optional()
  .describe('The Form tab, by id or name. Absent: the plan’s first Form tab.');

const typeIds = QUESTION_TYPES.map((t) => `${t} (${QUESTION_TYPE_NAMES[t]})`).join(', ');
const questionFields = {
  prompt: z.string().describe(`What the question asks, 1 to ${PROMPT_MAX} characters.`),
  help: z.string().optional().describe(`A line under the prompt, up to ${HELP_MAX} characters.`),
  required: z
    .boolean()
    .optional()
    .describe('An answer is needed to submit (a Checkbox must be ticked).'),
  placeholder: z
    .string()
    .optional()
    .describe(
      `Grey text in the answer box until someone types (short, paragraph, number, email, link), up to ${PLACEHOLDER_MAX}.`,
    ),
  options: z
    .array(z.string())
    .optional()
    .describe(
      `single and multi: the options in order, 1 to ${OPTIONS_MAX}, each up to ${OPTION_MAX} characters, unique.`,
    ),
  other: z
    .boolean()
    .optional()
    .describe('single and multi: an "Other" option with its own text box.'),
  dropdown: z
    .boolean()
    .optional()
    .describe('single: a dropdown whatever its length (past 7 options it is one anyway).'),
  min: z.number().optional().describe('number: the lowest answer. multi: the fewest picks.'),
  max: z.number().optional().describe('number: the highest answer. multi: the most picks.'),
  whole: z.boolean().optional().describe('number: whole numbers only.'),
  scale: z
    .number()
    .int()
    .optional()
    .describe(
      `rating: the top score, ${RATING_SCALE_MIN} to ${RATING_SCALE_MAX} (5 when left out).`,
    ),
  style: z
    .enum(['stars', 'numbers'])
    .optional()
    .describe('rating: stars (the default) or numbered buttons.'),
  lowLabel: z
    .string()
    .optional()
    .describe(`rating with numbers: the label under the first, up to ${SCALE_LABEL_MAX}.`),
  highLabel: z
    .string()
    .optional()
    .describe(`rating with numbers: the label under the last, up to ${SCALE_LABEL_MAX}.`),
  goesTo: z
    .string()
    .optional()
    .describe(
      'Board forms: where the answer is kept on the response’s card: "Title" (one question at most; short, email, ' +
        'number, single or date), "Description" (the default: written under its prompt), or a card field’s name. ' +
        'A name the card type lacks makes that field, of the kind the question fits (a choice or rating shown on the ' +
        'card; a choice with "other" a text field, as an Other answer is no option). An existing currency field takes ' +
        'a number.',
    ),
};
const questionType = z
  .enum(QUESTION_TYPES as unknown as [QuestionType, ...QuestionType[]])
  .describe(`The question type: ${typeIds}.`);
const question = z
  .object({ type: questionType, ...questionFields })
  .describe('A question, with the settings its type has.');
const questionSet = z
  .object({
    type: questionType.optional(),
    ...questionFields,
    prompt: questionFields.prompt.optional(),
  })
  .describe(
    'The settings to change; a text setting given as "" is cleared, a switch given false is turned off.',
  );

const questionRef = z.string().describe('A question: its id, or its prompt.');
const sectionRef = z
  .union([z.string(), z.number().int().min(1)])
  .describe('A section: its id, its title, or its place (1 is the first).');
const showIf = z
  .object({
    question: questionRef.describe(
      'An earlier Single Choice, Multiple Choice or Checkbox question.',
    ),
    anyOf: z
      .array(z.string())
      .min(1)
      .describe(
        'The answers that show the section: the question’s options, or "Ticked" / "Not Ticked".',
      ),
  })
  .describe('Show the section only when an earlier answer is one of these.');

const respondsTo = z
  .object({
    to: z
      .enum(['board', 'sheet'])
      .describe('Cards on a board (to work through) or rows in a sheet (to count).'),
    board: z
      .string()
      .optional()
      .describe(
        'An existing Board tab’s name (or its board’s title). Absent: a new Board tab "<Form> Responses" with New, ' +
          'In Progress and Done, taking the form’s card type alone.',
      ),
    cardType: z
      .string()
      .optional()
      .describe(
        'The card type each response becomes, by name. A name the plan lacks brings in the ready-made type of ' +
          'that name (Bug, Idea, Candidate, Request...) or makes a new one. Absent: the form’s own, the board’s ' +
          'first, or a new type named after the form.',
      ),
    column: z
      .string()
      .optional()
      .describe('An existing board’s column, by name. Absent: its first.'),
    sheet: z
      .string()
      .optional()
      .describe(
        'An existing sheet, by its Sheet tab’s name. Absent: a new Sheet tab "<Form> Responses", its header row a ' +
          'column per question.',
      ),
  })
  .describe('Where each response goes.');

const hex = z.string().describe('A hex colour such as #0f172a.');
const cover = z
  .object({
    color: hex.optional().describe('A solid band.'),
    gradient: z
      .tuple([hex, hex])
      .optional()
      .describe('A two-stop gradient: the colours it runs from and to.'),
    angle: z.number().optional().describe('The gradient’s angle in degrees (default 160).'),
    motion: z
      .enum(PAGE_MOTIONS as unknown as [string, ...string[]])
      .optional()
      .describe('A gradient that moves on screen (still in pictures and under reduced motion).'),
    pattern: z.enum(['dots', 'grid', 'lines']).optional().describe('A pattern over the colour.'),
  })
  .describe('The band across the form’s top: a colour or gradient, and a pattern. No pictures.');

const settings = {
  closesAt: z
    .string()
    .nullable()
    .optional()
    .describe(
      'When the form stops taking responses, an ISO date and time; one with no offset (no Z or +hh:mm) is UTC. ' +
        'Respondents are not shown it beforehand: say it in the description if they should know. null clears it.',
    ),
  limit: z
    .number()
    .int()
    .nullable()
    .optional()
    .describe(
      `The most responses it takes (each submission counts one, whatever it holds), 1 to ${FORM_RESPONSE_LIMIT_MAX}; null clears it.`,
    ),
  confirmation: z
    .string()
    .nullable()
    .optional()
    .describe(`Shown after submitting, up to ${MESSAGE_MAX} characters; null for the default.`),
  closedMessage: z
    .string()
    .nullable()
    .optional()
    .describe(
      `Shown on the link once closed, up to ${MESSAGE_MAX} characters; null for the default.`,
    ),
};

const sectionInput = z.object({
  title: z
    .string()
    .optional()
    .describe('The section’s title (ignored on the first: that is the form’s heading).'),
  description: z.string().optional().describe('A line under the section’s title.'),
  showIf: showIf.optional(),
  questions: z.array(question).describe('The section’s questions, in order.'),
});

// --- read_form --------------------------------------------------------------------------------------------------

export const readFormShape = {
  projectId,
  tab,
  image: z
    .boolean()
    .optional()
    .describe(
      'Also attach a PNG of the form on its tab’s look, every page in turn as Preview reviews them (respondents ' +
        'see one page at a time; a page shown only sometimes is marked). About a thousand tokens.',
    ),
};

const readQuestion = z
  .object({
    id: z.string().describe('The question’s id, which change_form takes.'),
    type: z.string().describe('Its type id (short, single, rating...).'),
    typeName: z
      .string()
      .describe('Its type as the builder names it (Short Answer, Single Choice...).'),
    prompt: z.string().describe('What it asks.'),
    goesTo: z
      .string()
      .optional()
      .describe('Title, Description, or the card field’s name (board forms).'),
    goesToBroken: z
      .boolean()
      .optional()
      .describe('Its field was removed or no longer fits: it goes to Description.'),
    column: z
      .string()
      .optional()
      .describe('Sheet forms: the header of the sheet column its answers fill.'),
  })
  .passthrough();

export const readFormOutput = {
  projectId: z.string().describe('The plan.'),
  tabId: z.string().describe('The Form tab.'),
  heading: z.string().describe('The form’s heading, which is its tab’s name.'),
  description: z.string().optional().describe('The line under the heading.'),
  state: z
    .enum(['not_published', 'accepting', 'closed', 'paused', 'suspended'])
    .describe(
      'accepting: the link takes responses. paused: published, but responses have nowhere to go.',
    ),
  closedReason: z
    .string()
    .optional()
    .describe(
      'Why a published form is closed: switched_off, closes_at (its time passed) or limit (it is full).',
    ),
  link: z
    .string()
    .nullable()
    .describe('The form link anyone can fill it in at; null unpublished or for a non-Editor.'),
  responses: z.number().describe('Responses so far.'),
  unseen: z
    .number()
    .describe('Responses the caller has not seen (opening the Form tab sees them).'),
  respondsTo: z
    .record(z.string(), z.string())
    .describe(
      'Where responses go: {to: "board", board, cardType, column}, {to: "sheet", sheet} or {to: "nowhere"}.',
    ),
  respondsToProblem: z.string().optional().describe('Why responses cannot land there now.'),
  sections: z
    .array(
      z.object({
        id: z.string().describe('The section’s id.'),
        place: z.number().describe('Its place, 1 the first.'),
        title: z.string().optional().describe('Its title (a later section’s).'),
        description: z.string().optional().describe('The line under its title.'),
        showIf: z
          .object({
            questionId: z.string().describe('The earlier question it reads.'),
            prompt: z.string().describe('That question’s prompt.'),
            anyOf: z.array(z.string()).describe('The answers that show it.'),
          })
          .optional()
          .describe('Shown only on these answers; absent, always.'),
        showIfBroken: z
          .boolean()
          .optional()
          .describe('Its rule’s question changed or went: it shows always.'),
        questions: z.array(readQuestion).describe('Its questions, in order.'),
      }),
    )
    .describe('The pages of the form, in order.'),
  cover: z.record(z.string(), z.unknown()).optional().describe('The cover band’s colours.'),
  settings: z
    .record(z.string(), z.unknown())
    .describe('closesAt (ISO), limit, and the confirmation and closed messages respondents see.'),
  problems: z
    .array(z.string())
    .describe('What stops it being published, in Share Form’s words; empty when ready.'),
  lines: z.array(z.string()).optional().describe('What the call did.'),
  made: z.array(z.string()).optional().describe('The plans and tabs the call made.'),
  url,
};

// --- add_form ---------------------------------------------------------------------------------------------------

export const addFormShape = {
  projectId: projectId
    .optional()
    .describe(
      'The plan to add the Form tab to. Absent: a new plan named after the form, holding it.',
    ),
  name: z
    .string()
    .max(FORM_HEADING_MAX)
    .optional()
    .describe(`The form’s heading, which is its tab’s name, up to ${FORM_HEADING_MAX} characters.`),
  starter: z
    .enum(STARTER_IDS.filter((s) => s !== 'blank') as [StarterId, ...StarterId[]])
    .optional()
    .describe(
      'A ready-made form: bug-report, feature-request, job-application and contact send cards to a board; ' +
        'feedback and rsvp send rows to a sheet. Its questions, card type and fields come with it.',
    ),
  description: z
    .string()
    .max(FORM_DESCRIPTION_MAX)
    .optional()
    .describe('A line under the heading (questions only; a starter brings its own).'),
  questions: z
    .array(question)
    .max(QUESTIONS_MAX)
    .optional()
    .describe('The questions, in order, on one page. Use sections for several pages.'),
  sections: z
    .array(sectionInput)
    .max(SECTIONS_MAX)
    .optional()
    .describe(
      'Pages of questions, shown one at a time with Next and Back; a later one may show only on an earlier answer.',
    ),
  respondsTo: respondsTo
    .optional()
    .describe('Where responses go. Absent: a starter’s own way; for questions, a new board.'),
  theme: z
    .string()
    .optional()
    .describe('The Form tab’s theme; the plan’s when left out. A form wears its tab’s look.'),
  settings: z
    .object(settings)
    .optional()
    .describe('When it closes, how many responses it takes, and its messages.'),
};

// --- change_form ------------------------------------------------------------------------------------------------

const change = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('add_question'),
    question,
    section: sectionRef
      .optional()
      .describe('Add at the end of this section. Absent: the end of the form.'),
    after: questionRef.optional().describe('Add right after this question.'),
    before: questionRef
      .optional()
      .describe('Add right before this question (before the first: first).'),
  }),
  z.object({ op: z.literal('set_question'), question: questionRef, set: questionSet }),
  z.object({ op: z.literal('delete_question'), question: questionRef }),
  z.object({
    op: z.literal('move_question'),
    question: questionRef,
    section: sectionRef.optional().describe('Move to the end of this section.'),
    after: questionRef.optional().describe('Move right after this question.'),
    before: questionRef
      .optional()
      .describe('Move right before this question (before the first: first).'),
  }),
  z.object({
    op: z.literal('add_section'),
    title: z.string().optional(),
    description: z.string().optional(),
    after: questionRef
      .optional()
      .describe('Split the form after this question. Absent: an empty section at the end.'),
    showIf: showIf.optional(),
  }),
  z.object({
    op: z.literal('set_section'),
    section: sectionRef,
    title: z.string().optional(),
    description: z.string().optional(),
    showIf: showIf.nullable().optional().describe('null: always shown.'),
  }),
  z.object({
    op: z.literal('delete_section'),
    section: sectionRef.describe('Its questions join the section before.'),
  }),
  z.object({
    op: z.literal('set_form'),
    heading: z
      .string()
      .optional()
      .describe(`The form’s heading and its tab’s name, up to ${FORM_HEADING_MAX}.`),
    description: z.string().optional(),
    theme: z
      .string()
      .optional()
      .describe(
        'The Form tab’s theme (mocha, ocean, forest...): the form’s colour, font and finish follow it.',
      ),
    cover: cover
      .nullable()
      .optional()
      .describe(
        'The cover band; null removes it. The form’s own colour (bars, buttons) is its tab theme’s: set theme to ' +
          'match a cover.',
      ),
  }),
  z.object({ op: z.literal('settings'), ...settings }),
  respondsTo.extend({ op: z.literal('responds_to') }),
]);

export const changeFormShape = {
  projectId,
  tab,
  changes: z
    .array(change)
    .min(1)
    .max(FORM_CHANGES_MAX)
    .describe(
      `Up to ${FORM_CHANGES_MAX} changes, applied in order as one write; each an object with its "op".`,
    ),
};

// --- share_form -------------------------------------------------------------------------------------------------

export const shareFormShape = {
  projectId,
  tab,
  action: z
    .enum(['publish', 'close', 'delete_link'])
    .describe(
      'publish: make the form link (or open a closed one again, same link). close: stop taking responses, the link ' +
        'kept. delete_link: remove the link; publishing again makes a new one.',
    ),
};

// --- try_form ---------------------------------------------------------------------------------------------------

export const tryFormShape = {
  projectId,
  tab,
  answers: z
    .record(z.string(), z.unknown())
    .describe(
      'Each answer by its question’s id or prompt, as a respondent gives it: text for short, paragraph, email, ' +
        'link; a number for number and rating; "YYYY-MM-DD" for date; an option for single; a list of options ' +
        'for multi; true for checkbox. On a choice with Other, any other text is the Other answer. A question ' +
        'left out is unanswered.',
    ),
};

export const tryFormOutput = {
  projectId: z.string().describe('The plan.'),
  tabId: z.string().describe('The Form tab.'),
  made: z.enum(['card', 'row']).describe('A card on a board, or a row in a sheet.'),
  number: z
    .number()
    .nullable()
    .describe(
      'The response number a published form gave it (it counts); null when nothing counts it.',
    ),
  where: z.string().describe('Where it went: the board and column, or the sheet.'),
  title: z.string().nullable().describe('The card’s title, "Preview: ..."; null for a row.'),
  itemId: z
    .string()
    .nullable()
    .describe('The card’s id when this call made it (an unpublished form); else null.'),
  lines: z.array(z.string()).describe('Answers left out because their section did not show.'),
  url: z.string().describe('The plan in the editor.'),
};

export const addFormOutput = readFormOutput;
export const changeFormOutput = readFormOutput;
export const shareFormOutput = readFormOutput;
