// The verbs that make, name, share and remove documents and tabs (docs/specs/015-api/cli.md "Commands"). A new
// document is compiled by POST /api/documents and a new tab is a `replace` changeset on a new tab id (CLI58,
// CLI75), so the CLI never writes a tab whole; names change through their own routes.

import { z } from 'zod';
import { ApiError } from '@livediagram/api-client';
import type {
  ChangesetReplaceBody,
  DocumentResponse,
  ShareLink,
  TrashedDocument,
} from '@livediagram/api-schema';
import { TRASH_RETENTION_DAYS } from '@livediagram/api-schema';
import { resolveTab } from '../addressing';
import { defineVerb, VerbRefusal, type VerbContext } from '../define';
import { shortestUniquePrefixes } from '../refs';
import { classifySource } from '../source-kind';
import { submitChangeset, writeFlags, type WriteFlags } from '../write';
import { documentOf } from './shared';

const docArg = z.string().describe('A name, id prefix or livediagram URL');
const sourceFlags = {
  file: z
    .string()
    .optional()
    .describe('A graph, Mermaid or elements file to fill it from, or - for stdin'),
  template: z.string().optional().describe('A template kind to build it from'),
};

// A document ref in what a lifecycle verb prints: eight characters of its id, unique in practice and short.
const REF_LENGTH = 8;
const refOf = (id: string) => id.slice(0, REF_LENGTH);
// A request whose answer has no body worth reading (204): its failure still throws the api's error.
async function send(ctx: VerbContext, path: string, init: RequestInit): Promise<void> {
  const res = await ctx.api.fetch(path, init);
  if (!res.ok) throw new ApiError(res.status, await res.text());
}

const docPath = (id: string) => `/documents/${encodeURIComponent(id)}`;

// What a new tab is made from: a file's graph, Mermaid or elements, a template, or nothing (an empty tab).
async function replaceSourceOf(
  ctx: VerbContext,
  input: { file?: string; template?: string },
  editHint: string,
): Promise<ChangesetReplaceBody> {
  if (input.file !== undefined && input.template !== undefined)
    throw new VerbRefusal({
      status: 400,
      code: 'usage',
      message: 'give -f or --template, not both',
      hint: editHint,
    });
  if (input.template !== undefined) return { template: input.template };
  if (input.file === undefined) return { elements: [] };
  const named = input.file === '-' ? 'stdin' : input.file;
  const source = classifySource(await ctx.readInput(input.file));
  ctx.log(`source ${source.kind}`);
  if (source.kind === 'operations')
    throw new VerbRefusal({
      status: 400,
      code: 'usage',
      message: `${named} holds edit operations, which change a tab that exists`,
      hint: editHint,
    });
  if (source.kind === 'unknown')
    throw new VerbRefusal({
      status: 400,
      code: 'unknown_source',
      message: `can't tell what ${named} holds`,
      hint: 'expected a graph, Mermaid or elements: livediagram guide build',
    });
  return source.body.replace!;
}

const lineOutput = z.object({ text: z.string(), id: z.string() });
const lineText = ({ text }: { text: string }) => [text];
const quietId = ({ id }: { id: string }) => [id];

export const documentCreate = defineVerb({
  id: 'document.create',
  summary: 'Create a document, empty or from a graph, Mermaid, elements or a template',
  description:
    'Creates a document with one tab, compiled by the api from -f (a graph, Mermaid or elements) or --template; empty without either. Prints its ref, name and link.',
  behaviour: 'write',
  input: z.object({
    name: z.string().min(1).describe('The new document\u2019s name'),
    tab: z
      .string()
      .optional()
      .describe('The first tab\u2019s name; the document\u2019s name by default'),
    ...sourceFlags,
  }),
  output: lineOutput,
  run: async (ctx, input) => {
    const id = ctx.newId();
    const source = await replaceSourceOf(
      ctx,
      input,
      `livediagram document create ${JSON.stringify(input.name)}, then livediagram edit`,
    );
    const { theme: _t, layout: _l, name: _n, ...tabSource } = source;
    const tab = { id: ctx.newId(), name: input.tab ?? input.name, ...tabSource };
    const { document } = await ctx.api.json<DocumentResponse>('/documents', {
      method: 'POST',
      body: JSON.stringify({ id, name: input.name, source: 'cli', tabs: [tab] }),
    });
    const tabs = document.tabs.length;
    return {
      id: document.id,
      text: `+ document ${refOf(document.id)} ${JSON.stringify(document.name)} · ${tabs} tab${tabs === 1 ? '' : 's'} · ${ctx.host}/document/${document.id}`,
    };
  },
  text: lineText,
  quiet: quietId,
  cli: {
    positionals: ['name'],
    flags: { file: { short: 'f' } },
    examples: [
      'livediagram document create "Shop" -f arch.json',
      'livediagram document create "Retro" --template start-stop-continue',
    ],
    prints: '+ document <ref> "<name>" · <n> tabs · <link>',
  },
});

export const documentRename = defineVerb({
  id: 'document.rename',
  summary: 'Rename a document',
  description: 'Gives a document a new name.',
  behaviour: 'write',
  input: z.object({ doc: docArg, name: z.string().min(1).describe('The new name') }),
  output: lineOutput,
  run: async (ctx, input) => {
    const found = await documentOf(ctx, input.doc);
    const { document } = await ctx.api.json<DocumentResponse>(docPath(found.id), {
      method: 'PUT',
      body: JSON.stringify({ name: input.name }),
    });
    return {
      id: found.id,
      text: `~ document ${refOf(found.id)} ${JSON.stringify(found.name)}→${JSON.stringify(document.name)}`,
    };
  },
  text: lineText,
  quiet: quietId,
  cli: {
    positionals: ['doc', 'name'],
    examples: [
      'livediagram document rename "Auth flow" "Sign-in flow"',
      'livediagram document rename 3f9c "Sign-in flow"',
    ],
    prints: '~ document <ref> "<old>"→"<new>"',
  },
});

export const documentShare = defineVerb({
  id: 'document.share',
  summary: 'Make a share link',
  description:
    'Creates a share link to a document: view (default) lets people open and read it, edit lets them change it; neither needs sign-in. Expires never (default), in a week, a month or six months.',
  behaviour: 'write',
  input: z.object({
    doc: docArg,
    role: z.enum(['view', 'edit']).default('view').describe('view or edit'),
    expiry: z
      .enum(['never', 'week', 'month', 'sixMonths'])
      .default('never')
      .describe('never, week, month or sixMonths'),
  }),
  output: z.object({
    text: z.string(),
    url: z.string(),
    role: z.string(),
    expiresAt: z.number().nullable(),
  }),
  run: async (ctx, input) => {
    const found = await documentOf(ctx, input.doc);
    const { link } = await ctx.api.json<{ link: ShareLink }>(`${docPath(found.id)}/share`, {
      method: 'POST',
      body: JSON.stringify({ role: input.role, expiry: input.expiry }),
    });
    const url = `${ctx.host}/document/shared?s=${encodeURIComponent(link.code)}`;
    return { text: url, url, role: link.role, expiresAt: link.expiresAt };
  },
  text: lineText,
  quiet: ({ url }) => [url],
  cli: {
    positionals: ['doc'],
    examples: [
      'livediagram document share "Auth flow"',
      'livediagram document share 3f9c --role edit --expiry week',
    ],
    prints: 'the link',
  },
});

export const documentRm = defineVerb({
  id: 'document.rm',
  summary: `Move a document to the Trash for ${TRASH_RETENTION_DAYS} days`,
  description: `Moves a document to the Trash, where it can be restored for ${TRASH_RETENTION_DAYS} days.`,
  behaviour: 'destructive',
  input: z.object({ doc: docArg }),
  output: lineOutput,
  run: async (ctx, input) => {
    const found = await documentOf(ctx, input.doc);
    await send(ctx, docPath(found.id), { method: 'DELETE' });
    return {
      id: found.id,
      text: `- document ${refOf(found.id)} ${JSON.stringify(found.name)} · in the Trash for ${TRASH_RETENTION_DAYS} days · restore: livediagram document restore ${found.id}`,
    };
  },
  text: lineText,
  quiet: quietId,
  cli: {
    positionals: ['doc'],
    examples: ['livediagram document rm "Old draft"', 'livediagram document rm 3f9c'],
    prints: '- document <ref> "<name>" · in the Trash · the restore command',
  },
});

export const documentRestore = defineVerb({
  id: 'document.restore',
  summary: 'Bring a document back from the Trash',
  description:
    'Restores a document from the Trash to its folder, or the root of its space when that folder is gone.',
  behaviour: 'write',
  input: z.object({ doc: z.string().describe('A name or id prefix of a document in the Trash') }),
  output: lineOutput,
  run: async (ctx, input) => {
    const { trash } = await ctx.api.json<{ trash: TrashedDocument[] }>('/trash');
    const lower = input.doc.toLowerCase();
    const matches = trash.filter(
      (d) =>
        d.id === input.doc ||
        (input.doc.length >= 4 && d.id.startsWith(input.doc)) ||
        d.name.toLowerCase() === lower,
    );
    const refs = shortestUniquePrefixes(trash.map((d) => d.id));
    if (matches.length !== 1)
      throw new VerbRefusal({
        status: 404,
        code: matches.length ? 'ambiguous' : 'not_found',
        message: matches.length
          ? `"${input.doc}" matches ${matches.length} documents in the Trash`
          : `nothing in the Trash matches "${input.doc}"`,
        lines: (matches.length ? matches : trash.slice(0, 5)).map(
          (d) => `${refs.get(d.id)}  ${JSON.stringify(d.name)}  ${d.teamName ?? 'personal'}`,
        ),
        hint: 'livediagram api GET /trash',
      });
    const [doc] = matches;
    await ctx.api.json(`/trash/${encodeURIComponent(doc!.id)}/restore`, { method: 'POST' });
    return {
      id: doc!.id,
      text: `+ document ${refOf(doc!.id)} ${JSON.stringify(doc!.name)} restored`,
    };
  },
  text: lineText,
  quiet: quietId,
  cli: {
    positionals: ['doc'],
    examples: ['livediagram document restore "Old draft"', 'livediagram document restore 3f9c2a71'],
    prints: '+ document <ref> "<name>" restored',
  },
});

export const tabAdd = defineVerb({
  id: 'tab.add',
  summary: 'Add a tab, empty or from a graph, Mermaid, elements or a template',
  description:
    'Adds a tab to a document as one changeset on a new tab, filled from -f (a graph, Mermaid or elements) or --template; empty without either. Prints the result lines and the revert command.',
  behaviour: 'write',
  input: z.object({
    doc: docArg,
    name: z.string().min(1).describe('The new tab\u2019s name'),
    ...sourceFlags,
    ...writeFlags,
  }),
  output: z.object({
    text: z.string(),
    dryRun: z.boolean(),
    changeset: z.object({ id: z.string(), rev: z.number() }).nullable(),
  }),
  run: async (ctx, input) => {
    const document = await documentOf(ctx, input.doc);
    const source = await replaceSourceOf(
      ctx,
      input,
      `livediagram tab add ${JSON.stringify(input.doc)} ${JSON.stringify(input.name)}, then livediagram edit`,
    );
    const target = {
      documentId: document.id,
      tabId: ctx.newId(),
      tabName: input.name,
      doc: input.doc,
    };
    // A new tab was read at revision 0 by definition: the base says so, and no copy is needed.
    const response = await submitChangeset(
      ctx,
      target,
      { replace: { ...source, name: input.name } },
      { ...(input as WriteFlags), base: 0 },
    );
    return {
      text: response.text,
      dryRun: response.dryRun,
      changeset: response.changeset && { id: response.changeset.id, rev: response.changeset.rev },
    };
  },
  text: lineText,
  quiet: ({ changeset }) => (changeset ? [changeset.id] : []),
  cli: {
    positionals: ['doc', 'name'],
    flags: { file: { short: 'f' } },
    examples: [
      'livediagram tab add "Auth flow" Details -f detail.mmd',
      'livediagram tab add 3f9c Board --template kanban',
    ],
    prints: 'the result lines, then the revision, lint verdict and revert command',
  },
});

export const tabRename = defineVerb({
  id: 'tab.rename',
  summary: 'Rename a tab',
  description: 'Gives a tab a new name.',
  behaviour: 'write',
  input: z.object({
    doc: docArg,
    tab: z.string().describe('The tab, by name or id prefix'),
    name: z.string().min(1).describe('The new name'),
  }),
  output: lineOutput,
  run: async (ctx, input) => {
    const document = await documentOf(ctx, input.doc);
    const tab = resolveTab(document.tabs, input.tab, input.doc, ctx.log);
    const { tab: renamed } = await ctx.api.json<{ tab: { name: string } }>(
      `${docPath(document.id)}/tabs/${encodeURIComponent(tab.id)}/name`,
      {
        method: 'PUT',
        body: JSON.stringify({ name: input.name }),
      },
    );
    return {
      id: tab.id,
      text: `~ tab ${tab.id} ${JSON.stringify(tab.name)}→${JSON.stringify(renamed.name)}`,
    };
  },
  text: lineText,
  quiet: quietId,
  cli: {
    positionals: ['doc', 'tab', 'name'],
    examples: [
      'livediagram tab rename "Auth flow" Overview Summary',
      'livediagram tab rename 3f9c tab-2 "Data model"',
    ],
    prints: '~ tab <id> "<old>"→"<new>"',
  },
});

export const tabRm = defineVerb({
  id: 'tab.rm',
  summary: 'Delete a tab',
  description: 'Deletes one tab of a document; the other tabs stay.',
  behaviour: 'destructive',
  input: z.object({ doc: docArg, tab: z.string().describe('The tab, by name or id prefix') }),
  output: lineOutput,
  run: async (ctx, input) => {
    const document = await documentOf(ctx, input.doc);
    const tab = resolveTab(document.tabs, input.tab, input.doc, ctx.log);
    await send(ctx, `${docPath(document.id)}/tabs/${encodeURIComponent(tab.id)}`, {
      method: 'DELETE',
    });
    return { id: tab.id, text: `- tab ${tab.id} ${JSON.stringify(tab.name)}` };
  },
  text: lineText,
  quiet: quietId,
  cli: {
    positionals: ['doc', 'tab'],
    examples: ['livediagram tab rm "Auth flow" Scratch', 'livediagram tab rm 3f9c tab-2'],
    prints: '- tab <id> "<name>"',
  },
});
