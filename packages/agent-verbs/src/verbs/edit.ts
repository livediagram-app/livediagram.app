// The verbs that change a tab (docs/specs/015-api/cli.md "Commands"): `changeset apply` (and its alias `edit`)
// from a file or stdin, one element command a call, and `tab diff` against a read copy.

import { z } from 'zod';
import type { ChangesetResponse } from '@livediagram/api-schema';
import { diffView } from '@livediagram/document-views';
import { argvToOperationLine } from '../argv-line';
import { readPlainTab } from '../copies';
import { defineVerb, VerbRefusal, type Verb, type VerbContext } from '../define';
import { classifySource } from '../source-kind';
import { submitChangeset, writeFlags, type WriteFlags } from '../write';
import { tabOf } from './shared';

const docArg = z.string().describe('A name, id prefix or livediagram URL');
const tabFlag = z
  .string()
  .optional()
  .describe('A tab name or id prefix; the first tab when omitted');

// What a write prints: the api's result lines and footer; `--json` the whole answer.
const writeOutput = z.object({
  text: z.string(),
  dryRun: z.boolean(),
  changeset: z.object({ id: z.string(), rev: z.number() }).nullable(),
});

const outputOf = (response: ChangesetResponse) => ({
  text: response.text,
  dryRun: response.dryRun,
  changeset: response.changeset && { id: response.changeset.id, rev: response.changeset.rev },
});

async function targetOf(ctx: VerbContext, doc: string, tab: string | undefined) {
  const found = await tabOf(ctx, doc, tab);
  return { documentId: found.document.id, tabId: found.tab.id, tabName: found.tab.name, doc };
}

export const changesetApply = defineVerb({
  id: 'changeset.apply',
  summary: 'Apply edit operations, a graph, Mermaid or elements from a file',
  description:
    'Sends a file (or stdin, with -f -) as one changeset: edit operations in the line form or JSON, or a graph, Mermaid or elements that replace the tab. All or nothing; prints one result line per element, then the revision, the lint verdict and the revert command.',
  behaviour: 'write',
  input: z.object({
    doc: docArg,
    tab: tabFlag,
    file: z.string().describe('The file to send, or - for stdin'),
    ...writeFlags,
  }),
  output: writeOutput,
  run: async (ctx, input) => {
    const text = await ctx.readInput(input.file);
    const source = classifySource(text);
    ctx.log(`source ${source.kind}`);
    if (source.kind === 'unknown')
      throw new VerbRefusal({
        status: 400,
        code: 'unknown_source',
        message: `can't tell what ${input.file === '-' ? 'stdin' : input.file} holds`,
        hint: 'expected edit operations, a graph, Mermaid or elements: livediagram guide edit',
      });
    const target = await targetOf(ctx, input.doc, input.tab);
    return outputOf(await submitChangeset(ctx, target, source.body, input as WriteFlags));
  },
  text: ({ text }) => [text],
  quiet: ({ changeset }) => (changeset ? [changeset.id] : []),
  cli: {
    positionals: ['doc'],
    flags: { file: { short: 'f' } },
    examples: [
      'livediagram edit "Auth flow" -f ops.txt',
      'livediagram changeset apply 3f9c -f - --dry-run < arch.json',
    ],
    prints: 'one result line per element, then the revision, lint verdict and revert command',
  },
});

const ELEMENT_OPERATIONS = {
  add: {
    summary: 'Add an element',
    words: '<kind> [id=<id>] key=value… [<placement>]',
    example: 'square id=verify label="Verify email" below:n3',
  },
  set: {
    summary: 'Change fields of elements',
    words: '<selector> key=value…',
    example: 'n3 label="Sign in" shape=stadium',
  },
  rm: { summary: 'Remove elements', words: '<selector>', example: 'n7' },
  move: {
    summary: 'Move elements beside another, or by an offset',
    words: '<selector> <placement> | by=dx,dy',
    example: 'n3 below:n2',
  },
  connect: {
    summary: 'Draw an arrow from one element to another',
    words: '<from> <to> [key=value…]',
    example: 'n3 n7 label=retry',
  },
  insert: {
    summary: 'Put an element on an arrow, between its ends',
    words: '<kind> key=value… between <a> <b>',
    example: 'square label=Verify between n3 n4',
  },
  wrap: {
    summary: 'Put elements in a new frame or lane',
    words: '<selector…> in frame|lane key=value…',
    example: 'n3 n4 in frame label=Auth',
  },
} as const;

type ElementOperation = keyof typeof ELEMENT_OPERATIONS;

function elementVerb(op: ElementOperation): Verb {
  const { summary, words, example } = ELEMENT_OPERATIONS[op];
  return defineVerb({
    id: `element.${op}`,
    summary,
    description: `Sends one \`${op} ${words}\` edit operation as a changeset; the words are the operation's, without quoting the arrow. Prints one result line per element, then the revision, the lint verdict and the revert command.`,
    behaviour: op === 'rm' ? 'destructive' : 'write',
    input: z.object({
      doc: docArg,
      tab: tabFlag,
      words: z.array(z.string()).min(1).describe(`The operation's words: ${words}`),
      ...writeFlags,
    }),
    output: writeOutput,
    run: async (ctx, input) => {
      const line = argvToOperationLine(op, input.words);
      ctx.log(`operation ${line}`);
      const target = await targetOf(ctx, input.doc, input.tab);
      return outputOf(
        await submitChangeset(ctx, target, { operations: line }, input as WriteFlags),
      );
    },
    text: ({ text }) => [text],
    quiet: ({ changeset }) => (changeset ? [changeset.id] : []),
    cli: {
      positionals: ['doc', '...words'],
      examples: [
        `livediagram element ${op} "Auth flow" ${example}`,
        `livediagram element ${op} 3f9c ${example} --dry-run`,
      ],
      prints: 'one result line per element, then the revision, lint verdict and revert command',
    },
  }) as Verb;
}

export const elementVerbs: readonly Verb[] = (
  Object.keys(ELEMENT_OPERATIONS) as ElementOperation[]
).map(elementVerb);

export const tabDiff = defineVerb({
  id: 'tab.diff',
  summary: 'What changed in a tab since a revision this CLI read',
  description:
    'Compares the tab now with the read copy at --since: added, removed and changed elements, one line each. The copy is the tab as this CLI last read it at that revision.',
  behaviour: 'read',
  input: z.object({
    doc: docArg,
    tab: tabFlag,
    since: z.coerce.number().int().min(0).describe('A revision this CLI has read'),
    budget: z.coerce
      .number()
      .int()
      .min(1)
      .optional()
      .describe('Fit the diff to about this many tokens'),
  }),
  output: z.object({ text: z.string(), json: z.unknown() }),
  run: async (ctx, input) => {
    const found = await tabOf(ctx, input.doc, input.tab);
    const documentId = found.document.id;
    const tabId = found.tab.id;
    const before = await ctx.copies?.at(documentId, tabId, input.since);
    if (!before) {
      const held = (await ctx.copies?.revisions(documentId, tabId)) ?? [];
      throw new VerbRefusal({
        status: 404,
        code: 'no_copy',
        message: `no copy of rev ${input.since}; tab diff compares against a revision this CLI has read`,
        lines: [held.length ? `read copies: rev ${held.join(', ')}` : 'no read copies of this tab'],
        hint: `livediagram tab view ${JSON.stringify(input.doc)} --tab ${JSON.stringify(found.tab.name)}`,
      });
    }
    const after = await readPlainTab(ctx, documentId, tabId);
    if (!after) throw new Error('the tab read carried no revision');
    await ctx.copies!.record(documentId, tabId, after);
    const tabIds = found.document.tabs.map((t) => t.id);
    const view = diffView(
      before.tab,
      after.tab,
      { since: before.rev, rev: after.rev, tabIds },
      {
        door: 'cli',
        ...(input.budget ? { budget: input.budget } : {}),
      },
    );
    return { text: view.text, json: view.json };
  },
  text: ({ text }) => [text],
  json: ({ json }) => json,
  cli: {
    positionals: ['doc'],
    examples: [
      'livediagram tab diff "Auth flow" --since 41',
      'livediagram tab diff 3f9c --tab Overview --since 41 --json',
    ],
    prints: 'the diff view: one line per element added, removed or changed',
  },
});
