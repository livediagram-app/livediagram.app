// The form verbs (docs/specs/030-forms/forms.md "Agents"): `form get` (read_form), `form add` (add_form), `form
// change` (change_form, its changes from a JSON file or stdin), `form share` (share_form) and `form try` (try_form, its
// answers from a JSON file or stdin), over the calls the MCP's tools share. A Form tab is named by name or id; questions by id or prompt.
import { z } from 'zod';
import { STARTER_IDS, type StarterId } from '@livediagram/forms';
import { defineVerb, VerbRefusal, type Verb, type VerbContext } from '../define';
import { addForm, changeForm, readForm, shareForm, type FormCallResult } from '../forms/form-calls';
import type { FormChange } from '../forms/form-changes';
import { tryForm } from '../forms/form-try';
import type { FormReading } from '../forms/form-read';
import type { QuestionInput } from '../forms/form-question';
import { documentOf } from './shared';

const docArg = z.string().describe('A name, id prefix or livediagram URL');
const tabFlag = z
  .string()
  .optional()
  .describe('The Form tab, by name or id; the first when omitted');
const HINT = 'read the form with: livediagram form get <doc>';

const readingOutput = z.object({
  documentId: z.string(),
  tabId: z.string(),
  heading: z.string(),
  state: z.string(),
  link: z.string().nullable(),
  responses: z.number(),
  respondsTo: z.record(z.string(), z.string()),
  problems: z.array(z.string()),
  sections: z.array(z.unknown()),
  lines: z.array(z.string()),
  made: z.array(z.string()),
});
type ReadingOutput = z.infer<typeof readingOutput>;

function outputOf(ctx: VerbContext, result: FormCallResult): ReadingOutput {
  if (!result.ok)
    throw new VerbRefusal({
      status: result.code.endsWith('_unknown') || result.code === 'form_tab_none' ? 404 : 400,
      code: result.code,
      message: result.message,
      hint: HINT,
    });
  const r: FormReading = result.reading;
  return {
    documentId: result.documentId,
    tabId: r.tabId,
    heading: r.heading,
    state: r.state,
    link: r.code ? `${ctx.host}/form/${r.code}` : null,
    responses: r.responses,
    respondsTo: r.respondsTo,
    problems: r.problems,
    sections: r.sections,
    lines: result.lines,
    made: result.made,
  };
}

const respondsLine = (r: Record<string, string>) =>
  r['to'] === 'board'
    ? `responses: ${r['cardType']} cards in ${r['column']} on ${r['board']}`
    : r['to'] === 'sheet'
      ? `responses: rows in ${r['sheet']}`
      : 'responses: nowhere yet';

const textOf = (o: ReadingOutput) => [
  ...o.lines.map((l) => `~ ${l}`),
  ...o.made.map((m) => `+ ${m}`),
  `${o.heading}  ${o.state}  ${o.responses} responses${o.link ? `  ${o.link}` : ''}`,
  respondsLine(o.respondsTo),
  ...(o.sections as FormReading['sections']).flatMap((s) => [
    `section ${s.place}${s.title ? ` ${s.title}` : ''}${s.showIf ? ` (shown when ${s.showIf.prompt} is ${s.showIf.anyOf.join(' or ')})` : ''}`,
    ...s.questions.map(
      (q) =>
        `  ${q.id}  ${q.type}${q.required ? '*' : ''}  ${q.prompt}${q.goesTo ? `  → ${q.goesTo}` : ''}`,
    ),
  ]),
  ...o.problems.map((p) => `! ${p}`),
];

async function jsonFrom<T>(ctx: VerbContext, path: string, what: string): Promise<T> {
  try {
    return JSON.parse(await ctx.readInput(path)) as T;
  } catch {
    throw new VerbRefusal({
      status: 400,
      code: 'usage',
      message: `${what} is not JSON`,
      hint: 'see: livediagram help form',
    });
  }
}

export const formGet = defineVerb({
  id: 'form.get',
  summary: 'Read a form',
  description:
    "Prints a Form tab's form: its state, link and response count, where responses go, each section and question with its id and where its answer goes, and anything stopping it being published.",
  behaviour: 'read',
  input: z.object({ doc: docArg, tab: tabFlag }),
  output: readingOutput,
  run: async (ctx, input) => {
    const document = await documentOf(ctx, input.doc);
    return outputOf(ctx, await readForm(ctx.api, document.id, input.tab));
  },
  text: textOf,
  quiet: (o) => (o.link ? [o.link] : []),
  cli: {
    positionals: ['doc'],
    examples: ['livediagram form get "Team offsite"', 'livediagram form get 3f9c --tab RSVP'],
    prints:
      'the form: state and link, where responses go, each question with its id, then any problems',
  },
});

export const formAdd = defineVerb({
  id: 'form.add',
  summary: 'Add a form',
  description:
    'Adds a Form tab from a starter (bug-report, feedback, feature-request, rsvp, job-application, contact) or from add_form input in a JSON file (or stdin); without a document, makes one of its own.',
  behaviour: 'write',
  input: z.object({
    doc: z.string().optional().describe('The document; a new one when omitted'),
    starter: z
      .enum(STARTER_IDS.filter((s) => s !== 'blank') as [StarterId, ...StarterId[]])
      .optional()
      .describe('A ready-made form'),
    name: z.string().optional().describe('The form’s heading'),
    from: z
      .string()
      .optional()
      .describe(
        'A JSON file of add_form input (questions, sections, respondsTo...), or - for stdin',
      ),
  }),
  output: readingOutput,
  run: async (ctx, input) => {
    const given =
      input.from !== undefined
        ? await jsonFrom<Record<string, unknown>>(ctx, input.from, 'the form')
        : {};
    const documentId = input.doc ? (await documentOf(ctx, input.doc)).id : undefined;
    const result = await addForm(
      ctx.api,
      {
        ...(given as { questions?: QuestionInput[] }),
        ...(documentId ? { documentId } : {}),
        ...(input.starter ? { starter: input.starter } : {}),
        ...(input.name ? { name: input.name } : {}),
      },
      'cli',
    );
    return outputOf(ctx, result);
  },
  text: textOf,
  quiet: (o) => [o.tabId],
  cli: {
    positionals: ['doc'],
    examples: [
      'livediagram form add --starter rsvp --name "Summer Party"',
      'livediagram form add "Ops" --from survey.json',
    ],
    prints: 'what was made, then the form as form get prints it',
  },
});

export const formChange = defineVerb({
  id: 'form.change',
  summary: 'Change a form',
  description:
    "Applies change_form's changes from a JSON file (or stdin), in order, as one write: questions, sections and their rules, the heading and cover, settings and where responses go.",
  behaviour: 'destructive',
  input: z.object({
    doc: docArg,
    changes: z.string().describe('A JSON file of changes, or - for stdin'),
    tab: tabFlag,
  }),
  output: readingOutput,
  run: async (ctx, input) => {
    const document = await documentOf(ctx, input.doc);
    const changes = await jsonFrom<FormChange[]>(ctx, input.changes, 'the changes');
    return outputOf(ctx, await changeForm(ctx.api, document.id, input.tab, changes, 'cli'));
  },
  text: textOf,
  quiet: (o) => [o.tabId],
  cli: {
    positionals: ['doc', 'changes'],
    examples: [
      'livediagram form change "Team offsite" changes.json',
      'cat changes.json | livediagram form change 3f9c -',
    ],
    prints: 'what changed, then the form as form get prints it',
  },
});

export const formShare = defineVerb({
  id: 'form.share',
  summary: 'Publish or close a form',
  description:
    'Publishes a form (its link anyone can fill it in at), closes it (the link kept), or deletes its link. A form with problems is refused with what to fix.',
  behaviour: 'write',
  input: z.object({
    doc: docArg,
    action: z.enum(['publish', 'close', 'delete_link']).describe('publish, close or delete_link'),
    tab: tabFlag,
  }),
  output: readingOutput,
  run: async (ctx, input) => {
    const document = await documentOf(ctx, input.doc);
    return outputOf(ctx, await shareForm(ctx.api, document.id, input.tab, input.action));
  },
  text: textOf,
  quiet: (o) => (o.link ? [o.link] : []),
  cli: {
    positionals: ['doc', 'action'],
    examples: [
      'livediagram form share "Team offsite" publish',
      'livediagram form share 3f9c close',
    ],
    prints: 'the form as form get prints it, its link when published',
  },
});

const tryOutput = z.object({
  documentId: z.string(),
  tabId: z.string(),
  made: z.enum(['card', 'row']),
  number: z.number().nullable(),
  where: z.string(),
  title: z.string().nullable(),
  itemId: z.string().nullable(),
  lines: z.array(z.string()),
});

export const formTry = defineVerb({
  id: 'form.try',
  summary: 'Try a form',
  description:
    'Fills in a form as a respondent would, from a JSON file (or stdin) of answers by question id or prompt, as the builder’s Preview does: the answers are checked first, then make a card or row titled "Preview: …". A published form counts it as a response.',
  behaviour: 'write',
  input: z.object({
    doc: docArg,
    answers: z.string().describe('A JSON file of answers by question id or prompt, or - for stdin'),
    tab: tabFlag,
  }),
  output: tryOutput,
  run: async (ctx, input) => {
    const document = await documentOf(ctx, input.doc);
    const answers = await jsonFrom<Record<string, unknown>>(ctx, input.answers, 'the answers');
    const result = await tryForm(ctx.api, document.id, input.tab, answers);
    if (!result.ok)
      throw new VerbRefusal({
        status: result.code.endsWith('_unknown') || result.code === 'form_tab_none' ? 404 : 400,
        code: result.code,
        message: result.message,
        hint: HINT,
      });
    const { ok: _ok, ...output } = result;
    return output;
  },
  text: (o) => [
    ...o.lines.map((l) => `~ ${l}`),
    `+ ${o.made === 'card' ? `card "${o.title}"` : 'row'} in ${o.where}${o.number ? `, response #${o.number}` : ', not counted'}`,
  ],
  quiet: (o) => (o.itemId ? [o.itemId] : []),
  cli: {
    positionals: ['doc', 'answers'],
    examples: [
      'livediagram form try "Team offsite" answers.json',
      'echo \'{"Your name": "Ada"}\' | livediagram form try 3f9c -',
    ],
    prints: 'the card or row it made and where, and whether it counted',
  },
});

export const formVerbs: readonly Verb[] = [
  formGet,
  formAdd,
  formChange,
  formShare,
  formTry,
] as Verb[];
