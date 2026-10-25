// The verbs that make, name, share and remove designs and tabs (docs/specs/015-api/cli.md "Commands"). A new
// design is compiled by POST /api/designs and a new tab is a `replace` changeset on a new tab id (CLI58,
// CLI75), so the CLI never writes a tab whole; names change through their own routes.

import { z } from 'zod';
import { ApiError } from '@liveworkspace/api-client';
import type {
  ChangesetReplaceBody,
  DesignResponse,
  ShareLink,
  TrashedDesign,
} from '@livedesign/api-schema';
import { TRASH_RETENTION_DAYS } from '@livedesign/api-schema';
import { resolveTab } from '../addressing';
import { defineVerb, VerbRefusal, type VerbContext } from '../define';
import { shortestUniquePrefixes } from '@liveworkspace/agent-verbs/refs';
import { classifySource } from '../source-kind';
import { submitChangeset, writeFlags, type WriteFlags } from '../write';
import { designOf } from './shared';

const docArg = z.string().describe('A name, id prefix or livedesign URL');
const sourceFlags = {
  file: z.string().optional().describe('An elements file to fill it from, or - for stdin'),
  template: z.string().optional().describe('A template kind to build it from'),
};

// A design ref in what a lifecycle verb prints: eight characters of its id, unique in practice and short.
const REF_LENGTH = 8;
const refOf = (id: string) => id.slice(0, REF_LENGTH);
// A request whose answer has no body worth reading (204): its failure still throws the api's error.
async function send(ctx: VerbContext, path: string, init: RequestInit): Promise<void> {
  const res = await ctx.api.fetch(path, init);
  if (!res.ok) throw new ApiError(res.status, await res.text());
}

const docPath = (id: string) => `/designs/${encodeURIComponent(id)}`;

// What a new tab is made from: a file's elements, a template, or nothing (an empty tab).
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
      hint: 'expected elements: livedesign guide build',
    });
  return source.body.replace!;
}

const lineOutput = z.object({ text: z.string(), id: z.string() });
const lineText = ({ text }: { text: string }) => [text];
const quietId = ({ id }: { id: string }) => [id];

export const designCreate = defineVerb({
  id: 'design.create',
  summary: 'Create a design, empty or from elements or a template',
  description:
    'Creates a design with one tab, compiled by the api from -f (elements) or --template; empty without either. Prints its ref, name and link.',
  behaviour: 'write',
  input: z.object({
    name: z.string().min(1).describe('The new design\u2019s name'),
    tab: z
      .string()
      .optional()
      .describe('The first tab\u2019s name; the design\u2019s name by default'),
    ...sourceFlags,
  }),
  output: lineOutput,
  run: async (ctx, input) => {
    const id = ctx.newId();
    const source = await replaceSourceOf(
      ctx,
      input,
      `livedesign design create ${JSON.stringify(input.name)}, then livedesign edit`,
    );
    const { theme: _t, layout: _l, name: _n, ...tabSource } = source;
    const tab = { id: ctx.newId(), name: input.tab ?? input.name, ...tabSource };
    const { design } = await ctx.api.json<DesignResponse>('/designs', {
      method: 'POST',
      body: JSON.stringify({ id, name: input.name, source: 'cli', tabs: [tab] }),
    });
    const tabs = design.tabs.length;
    return {
      id: design.id,
      text: `+ design ${refOf(design.id)} ${JSON.stringify(design.name)} · ${tabs} tab${tabs === 1 ? '' : 's'} · ${ctx.host}/design/${design.id}`,
    };
  },
  text: lineText,
  quiet: quietId,
  cli: {
    positionals: ['name'],
    flags: { file: { short: 'f' } },
    examples: [
      'livedesign design create "Shop" -f screens.json',
      'livedesign design create "Crumb & Co" --template logo-design',
    ],
    prints: '+ design <ref> "<name>" · <n> tabs · <link>',
  },
});

export const designRename = defineVerb({
  id: 'design.rename',
  summary: 'Rename a design',
  description: 'Gives a design a new name.',
  behaviour: 'write',
  input: z.object({ doc: docArg, name: z.string().min(1).describe('The new name') }),
  output: lineOutput,
  run: async (ctx, input) => {
    const found = await designOf(ctx, input.doc);
    const { design } = await ctx.api.json<DesignResponse>(docPath(found.id), {
      method: 'PUT',
      body: JSON.stringify({ name: input.name }),
    });
    return {
      id: found.id,
      text: `~ design ${refOf(found.id)} ${JSON.stringify(found.name)}→${JSON.stringify(design.name)}`,
    };
  },
  text: lineText,
  quiet: quietId,
  cli: {
    positionals: ['doc', 'name'],
    examples: [
      'livedesign design rename "Auth flow" "Sign-in flow"',
      'livedesign design rename 3f9c "Sign-in flow"',
    ],
    prints: '~ design <ref> "<old>"→"<new>"',
  },
});

export const designShare = defineVerb({
  id: 'design.share',
  summary: 'Make a share link',
  description:
    'Creates a share link to a design: view (default) lets people open and read it, participate also lets them comment, react and add stickies and text without reshaping it, edit lets them change anything; none needs sign-in. Expires never (default), in a week, a month or six months.',
  behaviour: 'write',
  input: z.object({
    doc: docArg,
    role: z
      .enum(['view', 'participate', 'edit'])
      .default('view')
      .describe('view, participate or edit'),
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
    const found = await designOf(ctx, input.doc);
    const { link } = await ctx.api.json<{ link: ShareLink }>(`${docPath(found.id)}/share`, {
      method: 'POST',
      body: JSON.stringify({ role: input.role, expiry: input.expiry }),
    });
    const url = `${ctx.host}/design/shared?s=${encodeURIComponent(link.code)}`;
    return { text: url, url, role: link.role, expiresAt: link.expiresAt };
  },
  text: lineText,
  quiet: ({ url }) => [url],
  cli: {
    positionals: ['doc'],
    examples: [
      'livedesign design share "Auth flow"',
      'livedesign design share 3f9c --role edit --expiry week',
    ],
    prints: 'the link',
  },
});

export const designRm = defineVerb({
  id: 'design.rm',
  summary: `Move a design to the Trash for ${TRASH_RETENTION_DAYS} days`,
  description: `Moves a design to the Trash, where it can be restored for ${TRASH_RETENTION_DAYS} days.`,
  behaviour: 'destructive',
  input: z.object({ doc: docArg }),
  output: lineOutput,
  run: async (ctx, input) => {
    const found = await designOf(ctx, input.doc);
    await send(ctx, docPath(found.id), { method: 'DELETE' });
    return {
      id: found.id,
      text: `- design ${refOf(found.id)} ${JSON.stringify(found.name)} · in the Trash for ${TRASH_RETENTION_DAYS} days · restore: livedesign design restore ${found.id}`,
    };
  },
  text: lineText,
  quiet: quietId,
  cli: {
    positionals: ['doc'],
    examples: ['livedesign design rm "Old draft"', 'livedesign design rm 3f9c'],
    prints: '- design <ref> "<name>" · in the Trash · the restore command',
  },
});

export const designRestore = defineVerb({
  id: 'design.restore',
  summary: 'Bring a design back from the Trash',
  description:
    'Restores a design from the Trash to its folder, or the root of its space when that folder is gone.',
  behaviour: 'write',
  input: z.object({ doc: z.string().describe('A name or id prefix of a design in the Trash') }),
  output: lineOutput,
  run: async (ctx, input) => {
    const { trash } = await ctx.api.json<{ trash: TrashedDesign[] }>('/trash');
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
          ? `"${input.doc}" matches ${matches.length} designs in the Trash`
          : `nothing in the Trash matches "${input.doc}"`,
        lines: (matches.length ? matches : trash.slice(0, 5)).map(
          (d) => `${refs.get(d.id)}  ${JSON.stringify(d.name)}  ${d.teamName ?? 'personal'}`,
        ),
        hint: 'livedesign api GET /trash',
      });
    const [doc] = matches;
    await ctx.api.json(`/trash/${encodeURIComponent(doc!.id)}/restore`, { method: 'POST' });
    return {
      id: doc!.id,
      text: `+ design ${refOf(doc!.id)} ${JSON.stringify(doc!.name)} restored`,
    };
  },
  text: lineText,
  quiet: quietId,
  cli: {
    positionals: ['doc'],
    examples: ['livedesign design restore "Old draft"', 'livedesign design restore 3f9c2a71'],
    prints: '+ design <ref> "<name>" restored',
  },
});

export const tabAdd = defineVerb({
  id: 'tab.add',
  summary: 'Add a tab, empty or from elements or a template',
  description:
    'Adds a tab to a design as one changeset on a new tab, filled from -f (elements) or --template; empty without either. Prints the tab, the result lines and the tab rm that undoes it.',
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
    const design = await designOf(ctx, input.doc);
    const source = await replaceSourceOf(
      ctx,
      input,
      `livedesign tab add ${JSON.stringify(input.doc)} ${JSON.stringify(input.name)}, then livedesign edit`,
    );
    const target = {
      designId: design.id,
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
    // Reverting the changeset takes the tab's elements back but leaves the tab, so the footer names what removes it.
    const footer = response.text.replace(
      /revert: livedesign changeset revert \S+ \S+$/m,
      `undo: livedesign tab rm ${design.id} ${target.tabId}`,
    );
    return {
      // The tab first, as `tab rename` names it: an empty tab has no element lines, so this is all that says which.
      text: `+ tab ${target.tabId} ${JSON.stringify(input.name)}\n${footer}`,
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
      'livedesign tab add "Auth flow" Details -f detail.mmd',
      'livedesign tab add 3f9c Logo --template blank-logo',
    ],
    prints:
      '+ tab <id> "<name>", the result lines, then the revision, lint verdict and the tab rm that undoes it',
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
    const design = await designOf(ctx, input.doc);
    const tab = resolveTab(design.tabs, input.tab, input.doc, ctx.log);
    const { tab: renamed } = await ctx.api.json<{ tab: { name: string } }>(
      `${docPath(design.id)}/tabs/${encodeURIComponent(tab.id)}/name`,
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
      'livedesign tab rename "Auth flow" Overview Summary',
      'livedesign tab rename 3f9c tab-2 "Data model"',
    ],
    prints: '~ tab <id> "<old>"→"<new>"',
  },
});

export const tabRm = defineVerb({
  id: 'tab.rm',
  summary: 'Delete a tab',
  description: 'Deletes one tab of a design; the other tabs stay.',
  behaviour: 'destructive',
  input: z.object({ doc: docArg, tab: z.string().describe('The tab, by name or id prefix') }),
  output: lineOutput,
  run: async (ctx, input) => {
    const design = await designOf(ctx, input.doc);
    const tab = resolveTab(design.tabs, input.tab, input.doc, ctx.log);
    await send(ctx, `${docPath(design.id)}/tabs/${encodeURIComponent(tab.id)}`, {
      method: 'DELETE',
    });
    return { id: tab.id, text: `- tab ${tab.id} ${JSON.stringify(tab.name)}` };
  },
  text: lineText,
  quiet: quietId,
  cli: {
    positionals: ['doc', 'tab'],
    examples: ['livedesign tab rm "Auth flow" Scratch', 'livedesign tab rm 3f9c tab-2'],
    prints: '- tab <id> "<name>"',
  },
});
