// The tools' zod output shapes (docs/specs/015-api/mcp-server.md §4.17): what each tool returns on
// success, advertised as its `outputSchema` and carried as `structuredContent`.
// The SDK validates every successful result against these on the way out, so a
// shape here that stops matching tools.ts fails the call rather than shipping a
// wrong contract. Error results are exempt and carry text only.
import { EMPTY_PROJECT_STALE_DAYS, TRASH_REASONS } from '@liveplanner/api-schema';
import { z } from 'zod';

const url = z.string().describe('Link that opens the plan in the liveplanner editor.');
const projectId = z.string().describe('The plan id.');
const tabId = z.string().describe('The tab id.');

export const findProjectsOutput = {
  count: z.number().int().describe('How many plans matched.'),
  projects: z
    .array(
      z.object({
        id: projectId,
        name: z.string().describe('The plan name.'),
        updatedAt: z.number().describe('When it was last saved, as a ms epoch.'),
        library: z
          .string()
          .describe('Where it lives: "personal", or the name of the team whose library holds it.'),
        url,
      }),
    )
    .describe('The matches, most relevant first.'),
};

export const readProjectOutput = {
  id: projectId,
  name: z.string().describe('The plan name.'),
  tab: z
    .object({
      id: tabId,
      name: z.string().describe('The tab name.'),
      rev: z.number().describe('The tab revision: pass it as rev to update_project.'),
      view: z.string().optional().describe('The view read (format "view").'),
      text: z.string().optional().describe('The view text (format "view").'),
      elements: z
        .array(z.record(z.string(), z.unknown()))
        .optional()
        .describe(
          'The tab elements (format "json"), in the format of the liveplanner://schema/elements resource.',
        ),
    })
    .describe('The tab that was read.'),
  tabs: z
    .array(z.object({ id: tabId, name: z.string().describe('The tab name.') }))
    .describe('Every tab of the plan, in order: pass one as tabId to read it.'),
  url,
};

export const listTemplatesOutput = {
  categories: z
    .array(
      z.object({
        id: z.string().describe('The category id each template references.'),
        label: z.string().describe('The category display name.'),
        description: z.string().describe('What the category holds.'),
      }),
    )
    .describe('The template categories, in display order.'),
  templates: z
    .array(
      z.object({
        kind: z.string().describe('Pass as "template" on create_project / add_tab.'),
        title: z.string().describe('The template display name.'),
        description: z.string().describe('What the template scaffolds.'),
        category: z.string().describe('The id of the category it belongs to.'),
      }),
    )
    .describe('Every template in the library.'),
};

export const createProjectOutput = {
  id: projectId,
  projectId: projectId.describe('The plan id again, under the name the other tools take it by.'),
  name: z.string().describe('The stored name (shortened if it was over the cap).'),
  tabCount: z.number().int().describe('How many tabs were created.'),
  tabIds: z.array(z.string()).describe('The new tab ids, in order.'),
  folder: z
    .string()
    .describe(
      'The Explorer folder it appears in: "My Work" for the root, or the name of the user\'s ' +
        'default folder it was filed in.',
    ),
  url,
};

// What a changeset answered (docs/specs/024-agents/agent-changesets.md): its id (null when it
// changed nothing), the revision it left the tab at, and its result lines.
const changesetAnswer = {
  changesetId: z.string().nullable().describe('The changeset written; null when nothing changed.'),
  rev: z.number().describe('The tab revision now, to pass as rev on the next update_project.'),
  text: z.string().describe('What the changeset did, one line per element, and how to revert it.'),
};

export const addTabOutput = {
  projectId,
  tabId: tabId.describe('The new tab id.'),
  name: z.string().describe('The stored tab name (shortened if it was over the cap).'),
  url,
  note: z.string().optional().describe('Said when a template has more tabs than add_tab adds.'),
  ...changesetAnswer,
};

export const updateProjectOutput = {
  id: projectId,
  projectId: projectId.describe('The plan id again, under the name the other tools take it by.'),
  tabId: tabId.describe('The tab that was edited.'),
  url,
  ...changesetAnswer,
};

export const shareProjectOutput = {
  url: z.string().describe('The share link. Opening it needs no sign-in.'),
  role: z.enum(['view', 'participate', 'edit']).describe('What the link grants.'),
  expiresAt: z
    .number()
    .nullable()
    .describe('When the link stops working, as a ms epoch; null when it never expires.'),
  projectUrl: url,
};

export const renameProjectOutput = {
  renamed: z.enum(['project', 'tab']).describe('Whether the plan or one of its tabs was renamed.'),
  name: z.string().describe('The stored name (shortened if it was over the cap).'),
  id: projectId.optional().describe('The renamed plan id (plan renames).'),
  tabId: tabId.optional().describe('The renamed tab id (tab renames).'),
  url: url.optional().describe('Link that opens the plan (plan renames).'),
};

export const deleteProjectOutput = {
  deleted: z.enum(['project', 'tab']).describe('Whether the plan or one of its tabs was deleted.'),
  projectId,
  tabId: tabId.optional().describe('The deleted tab id (tab deletes).'),
  trashed: z.boolean().optional().describe('True when the plan went to the Trash.'),
  restorableForDays: z
    .number()
    .int()
    .optional()
    .describe('Days the plan can be restored with restore_project before it is purged.'),
};

export const listTrashOutput = {
  trash: z
    .array(
      z.object({
        id: projectId,
        name: z.string().describe('The plan name.'),
        library: z
          .string()
          .describe('Whose Trash: "personal", or the name of the team (or "team").'),
        reason: z
          .enum(TRASH_REASONS)
          .describe(
            `Why it is in the Trash: "deleted" by someone, or "empty" (moved automatically after ${EMPTY_PROJECT_STALE_DAYS} days with no content).`,
          ),
        deletedAt: z.string().describe('When it was deleted, as an ISO timestamp.'),
        purgeAt: z.string().describe('When it is purged for good, as an ISO timestamp.'),
      }),
    )
    .describe('The plans that can still be restored.'),
};

export const restoreProjectOutput = {
  restored: z.literal('project').describe('Always "project": tabs have no Trash.'),
  id: projectId,
  name: z.string().nullable().describe('The restored plan name, or null if unknown.'),
  url,
};
