// The verbs that make, name, share and remove projects and tabs (docs/specs/015-api/cli.md "Commands"). A new
// project is compiled by POST /api/projects and a new tab is a `replace` changeset on a new tab id (CLI58,
// CLI75), so the CLI never writes a tab whole; names change through their own routes.

import { z } from 'zod';
import { ApiError } from '@liveplanner/api-client';
import type {
  ChangesetReplaceBody,
  ProjectResponse,
  ShareLink,
  TrashedProject,
} from '@liveplanner/api-schema';
import { TRASH_RETENTION_DAYS } from '@liveplanner/api-schema';
import { resolveTab } from '../addressing';
import { defineVerb, VerbRefusal, type VerbContext } from '../define';
import { shortestUniquePrefixes } from '../refs';
import { classifySource } from '../source-kind';
import { submitChangeset, writeFlags, type WriteFlags } from '../write';
import { projectOf } from './shared';

const projectArg = z.string().describe('A name, id prefix or liveplanner URL');
const sourceFlags = {
  file: z.string().optional().describe('An elements file to fill it from, or - for stdin'),
  template: z.string().optional().describe('A template kind to build it from'),
};

// A project ref in what a lifecycle verb prints: eight characters of its id, unique in practice and short.
const REF_LENGTH = 8;
const refOf = (id: string) => id.slice(0, REF_LENGTH);
// A request whose answer has no body worth reading (204): its failure still throws the api's error.
async function send(ctx: VerbContext, path: string, init: RequestInit): Promise<void> {
  const res = await ctx.api.fetch(path, init);
  if (!res.ok) throw new ApiError(res.status, await res.text());
}

const docPath = (id: string) => `/projects/${encodeURIComponent(id)}`;

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
      hint: 'expected elements or a replace: liveplanner guide build',
    });
  return source.body.replace!;
}

const lineOutput = z.object({ text: z.string(), id: z.string() });
const lineText = ({ text }: { text: string }) => [text];
const quietId = ({ id }: { id: string }) => [id];

export const projectCreate = defineVerb({
  id: 'project.create',
  summary: 'Create a project, empty or from a template or elements',
  description:
    'Creates a project with one tab, compiled by the api from --template or -f (elements); empty without either. Prints its ref, name and link.',
  behaviour: 'write',
  input: z.object({
    name: z.string().min(1).describe('The new project\u2019s name'),
    tab: z
      .string()
      .optional()
      .describe('The first tab\u2019s name; the project\u2019s name by default'),
    ...sourceFlags,
  }),
  output: lineOutput,
  run: async (ctx, input) => {
    const id = ctx.newId();
    const source = await replaceSourceOf(
      ctx,
      input,
      `liveplanner project create ${JSON.stringify(input.name)}, then liveplanner edit`,
    );
    const { theme: _t, layout: _l, name: _n, ...tabSource } = source;
    const tab = { id: ctx.newId(), name: input.tab ?? input.name, ...tabSource };
    const { project } = await ctx.api.json<ProjectResponse>('/projects', {
      method: 'POST',
      body: JSON.stringify({ id, name: input.name, source: 'cli', tabs: [tab] }),
    });
    const tabs = project.tabs.length;
    return {
      id: project.id,
      text: `+ project ${refOf(project.id)} ${JSON.stringify(project.name)} · ${tabs} tab${tabs === 1 ? '' : 's'} · ${ctx.host}/project/${project.id}`,
    };
  },
  text: lineText,
  quiet: quietId,
  cli: {
    positionals: ['name'],
    flags: { file: { short: 'f' } },
    examples: [
      'liveplanner project create "Sprint 14" --template kanban',
      'liveplanner project create "Retro" --template start-stop-continue',
    ],
    prints: '+ project <ref> "<name>" · <n> tabs · <link>',
  },
});

export const projectRename = defineVerb({
  id: 'project.rename',
  summary: 'Rename a project',
  description: 'Gives a project a new name.',
  behaviour: 'write',
  input: z.object({ project: projectArg, name: z.string().min(1).describe('The new name') }),
  output: lineOutput,
  run: async (ctx, input) => {
    const found = await projectOf(ctx, input.project);
    const { project } = await ctx.api.json<ProjectResponse>(docPath(found.id), {
      method: 'PUT',
      body: JSON.stringify({ name: input.name }),
    });
    return {
      id: found.id,
      text: `~ project ${refOf(found.id)} ${JSON.stringify(found.name)}→${JSON.stringify(project.name)}`,
    };
  },
  text: lineText,
  quiet: quietId,
  cli: {
    positionals: ['project', 'name'],
    examples: [
      'liveplanner project rename "Auth flow" "Sign-in flow"',
      'liveplanner project rename 3f9c "Sign-in flow"',
    ],
    prints: '~ project <ref> "<old>"→"<new>"',
  },
});

export const projectShare = defineVerb({
  id: 'project.share',
  summary: 'Make a share link',
  description:
    'Creates a share link to a project: view (default) lets people open and read it, participate also lets them comment, add stickies, write and vote without reshaping it, edit lets them change anything; none needs sign-in. Expires never (default), in a week, a month or six months.',
  behaviour: 'write',
  input: z.object({
    project: projectArg,
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
    const found = await projectOf(ctx, input.project);
    const { link } = await ctx.api.json<{ link: ShareLink }>(`${docPath(found.id)}/share`, {
      method: 'POST',
      body: JSON.stringify({ role: input.role, expiry: input.expiry }),
    });
    const url = `${ctx.host}/project/shared?s=${encodeURIComponent(link.code)}`;
    return { text: url, url, role: link.role, expiresAt: link.expiresAt };
  },
  text: lineText,
  quiet: ({ url }) => [url],
  cli: {
    positionals: ['project'],
    examples: [
      'liveplanner project share "Auth flow"',
      'liveplanner project share 3f9c --role edit --expiry week',
    ],
    prints: 'the link',
  },
});

export const projectRm = defineVerb({
  id: 'project.rm',
  summary: `Move a project to the Trash for ${TRASH_RETENTION_DAYS} days`,
  description: `Moves a project to the Trash, where it can be restored for ${TRASH_RETENTION_DAYS} days.`,
  behaviour: 'destructive',
  input: z.object({ project: projectArg }),
  output: lineOutput,
  run: async (ctx, input) => {
    const found = await projectOf(ctx, input.project);
    await send(ctx, docPath(found.id), { method: 'DELETE' });
    return {
      id: found.id,
      text: `- project ${refOf(found.id)} ${JSON.stringify(found.name)} · in the Trash for ${TRASH_RETENTION_DAYS} days · restore: liveplanner project restore ${found.id}`,
    };
  },
  text: lineText,
  quiet: quietId,
  cli: {
    positionals: ['project'],
    examples: ['liveplanner project rm "Old draft"', 'liveplanner project rm 3f9c'],
    prints: '- project <ref> "<name>" · in the Trash · the restore command',
  },
});

export const projectRestore = defineVerb({
  id: 'project.restore',
  summary: 'Bring a project back from the Trash',
  description:
    'Restores a project from the Trash to its folder, or the root of its space when that folder is gone.',
  behaviour: 'write',
  input: z.object({ project: z.string().describe('A name or id prefix of a project in the Trash') }),
  output: lineOutput,
  run: async (ctx, input) => {
    const { trash } = await ctx.api.json<{ trash: TrashedProject[] }>('/trash');
    const lower = input.project.toLowerCase();
    const matches = trash.filter(
      (d) =>
        d.id === input.project ||
        (input.project.length >= 4 && d.id.startsWith(input.project)) ||
        d.name.toLowerCase() === lower,
    );
    const refs = shortestUniquePrefixes(trash.map((d) => d.id));
    if (matches.length !== 1)
      throw new VerbRefusal({
        status: 404,
        code: matches.length ? 'ambiguous' : 'not_found',
        message: matches.length
          ? `"${input.project}" matches ${matches.length} projects in the Trash`
          : `nothing in the Trash matches "${input.project}"`,
        lines: (matches.length ? matches : trash.slice(0, 5)).map(
          (d) => `${refs.get(d.id)}  ${JSON.stringify(d.name)}  ${d.teamName ?? 'personal'}`,
        ),
        hint: 'liveplanner api GET /trash',
      });
    const [doc] = matches;
    await ctx.api.json(`/trash/${encodeURIComponent(doc!.id)}/restore`, { method: 'POST' });
    return {
      id: doc!.id,
      text: `+ project ${refOf(doc!.id)} ${JSON.stringify(doc!.name)} restored`,
    };
  },
  text: lineText,
  quiet: quietId,
  cli: {
    positionals: ['project'],
    examples: ['liveplanner project restore "Old draft"', 'liveplanner project restore 3f9c2a71'],
    prints: '+ project <ref> "<name>" restored',
  },
});

export const tabAdd = defineVerb({
  id: 'tab.add',
  summary: 'Add a tab, empty or from a template or elements',
  description:
    'Adds a tab to a project as one changeset on a new tab, filled from --template or -f (elements); empty without either. Prints the tab, the result lines and the tab rm that undoes it.',
  behaviour: 'write',
  input: z.object({
    project: projectArg,
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
    const project = await projectOf(ctx, input.project);
    const source = await replaceSourceOf(
      ctx,
      input,
      `liveplanner tab add ${JSON.stringify(input.project)} ${JSON.stringify(input.name)}, then liveplanner edit`,
    );
    const target = {
      projectId: project.id,
      tabId: ctx.newId(),
      tabName: input.name,
      project: input.project,
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
      /revert: liveplanner changeset revert \S+ \S+$/m,
      `undo: liveplanner tab rm ${project.id} ${target.tabId}`,
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
    positionals: ['project', 'name'],
    flags: { file: { short: 'f' } },
    examples: [
      'liveplanner tab add "Sprint 14" Roadmap --template project-planner',
      'liveplanner tab add 3f9c Board --template kanban',
    ],
    prints:
      '+ tab <id> "<name>", the result lines, then the revision and the tab rm that undoes it',
  },
});

export const tabRename = defineVerb({
  id: 'tab.rename',
  summary: 'Rename a tab',
  description: 'Gives a tab a new name.',
  behaviour: 'write',
  input: z.object({
    project: projectArg,
    tab: z.string().describe('The tab, by name or id prefix'),
    name: z.string().min(1).describe('The new name'),
  }),
  output: lineOutput,
  run: async (ctx, input) => {
    const project = await projectOf(ctx, input.project);
    const tab = resolveTab(project.tabs, input.tab, input.project, ctx.log);
    const { tab: renamed } = await ctx.api.json<{ tab: { name: string } }>(
      `${docPath(project.id)}/tabs/${encodeURIComponent(tab.id)}/name`,
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
    positionals: ['project', 'tab', 'name'],
    examples: [
      'liveplanner tab rename "Auth flow" Overview Summary',
      'liveplanner tab rename 3f9c tab-2 "Data model"',
    ],
    prints: '~ tab <id> "<old>"→"<new>"',
  },
});

export const tabRm = defineVerb({
  id: 'tab.rm',
  summary: 'Delete a tab',
  description: 'Deletes one tab of a project; the other tabs stay.',
  behaviour: 'destructive',
  input: z.object({ project: projectArg, tab: z.string().describe('The tab, by name or id prefix') }),
  output: lineOutput,
  run: async (ctx, input) => {
    const project = await projectOf(ctx, input.project);
    const tab = resolveTab(project.tabs, input.tab, input.project, ctx.log);
    await send(ctx, `${docPath(project.id)}/tabs/${encodeURIComponent(tab.id)}`, {
      method: 'DELETE',
    });
    return { id: tab.id, text: `- tab ${tab.id} ${JSON.stringify(tab.name)}` };
  },
  text: lineText,
  quiet: quietId,
  cli: {
    positionals: ['project', 'tab'],
    examples: ['liveplanner tab rm "Auth flow" Scratch', 'liveplanner tab rm 3f9c tab-2'],
    prints: '- tab <id> "<name>"',
  },
});
