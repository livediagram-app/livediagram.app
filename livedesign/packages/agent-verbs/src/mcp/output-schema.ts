// The tools' zod output shapes (docs/specs/015-api/mcp-server.md §4.17): what each tool returns on
// success, advertised as its `outputSchema` and carried as `structuredContent`.
// The SDK validates every successful result against these on the way out, so a
// shape here that stops matching tools.ts fails the call rather than shipping a
// wrong contract. Error results are exempt and carry text only.
import { EMPTY_DESIGN_STALE_DAYS, TRASH_REASONS } from '@livedesign/api-schema';
import { z } from 'zod';

const url = z.string().describe('Link that opens the design in the livedesign editor.');
const designId = z.string().describe('The design id.');
const tabId = z.string().describe('The tab id.');

export const findDesignsOutput = {
  count: z.number().int().describe('How many designs matched.'),
  designs: z
    .array(
      z.object({
        id: designId,
        name: z.string().describe('The design name.'),
        updatedAt: z.number().describe('When it was last saved, as a ms epoch.'),
        library: z
          .string()
          .describe('Where it lives: "personal", or the name of the team whose library holds it.'),
        url,
      }),
    )
    .describe('The matches, most relevant first.'),
};

export const readDesignOutput = {
  id: designId,
  name: z.string().describe('The design name.'),
  tab: z
    .object({
      id: tabId,
      name: z.string().describe('The tab name.'),
      rev: z.number().describe('The tab revision: pass it as rev to update_design.'),
      view: z.string().optional().describe('The view read (format "view").'),
      text: z.string().optional().describe('The view text (format "view").'),
      elements: z
        .array(z.record(z.string(), z.unknown()))
        .optional()
        .describe(
          'The tab elements (format "json"), in the format of the livedesign://schema/elements resource.',
        ),
    })
    .describe('The tab that was read.'),
  tabs: z
    .array(z.object({ id: tabId, name: z.string().describe('The tab name.') }))
    .describe('Every tab of the design, in order: pass one as tabId to read it.'),
  url,
};

export const searchIconsOutput = {
  icons: z
    .array(
      z.object({
        id: z.string().describe('The id, as "iconId" takes it.'),
        label: z.string().describe('What the icon shows.'),
        set: z.string().describe('Its catalogue: line-art, or Technology (brand and cloud marks).'),
      }),
    )
    .describe('The best matches first.'),
  more: z.number().describe('How many more matched beyond the limit.'),
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
        kind: z.string().describe('Pass as "template" on create_design / add_tab.'),
        title: z.string().describe('The template display name.'),
        description: z.string().describe('What the template scaffolds.'),
        category: z.string().describe('The id of the category it belongs to.'),
      }),
    )
    .describe('Every template in the library.'),
};

export const createDesignOutput = {
  id: designId,
  designId: designId.describe(
    'The design id again, under the name the other tools take it by.',
  ),
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
  lint: z
    .array(z.string())
    .describe('The page lint summary line of each tab as written, in tabIds order.'),
};

// What a changeset answered (docs/specs/024-agents/agent-changesets.md): its id (null when it
// changed nothing), the revision it left the tab at, its result lines, and the lint's summary line
// (docs/specs/024-agents/page-lint.md).
const changesetAnswer = {
  changesetId: z.string().nullable().describe('The changeset written; null when nothing changed.'),
  rev: z.number().describe('The tab revision now, to pass as rev on the next update_design.'),
  text: z.string().describe('What the changeset did, one line per element, and how to revert it.'),
  lint: z.string().describe('The page lint summary line of the tab as written.'),
};

export const addTabOutput = {
  designId,
  tabId: tabId.describe('The new tab id.'),
  name: z.string().describe('The stored tab name (shortened if it was over the cap).'),
  url,
  ...changesetAnswer,
};

export const updateDesignOutput = {
  id: designId,
  designId: designId.describe(
    'The design id again, under the name the other tools take it by.',
  ),
  tabId: tabId.describe('The tab that was edited.'),
  url,
  ...changesetAnswer,
};

export const shareDesignOutput = {
  url: z.string().describe('The share link. Opening it needs no sign-in.'),
  role: z.enum(['view', 'participate', 'edit']).describe('What the link grants.'),
  expiresAt: z
    .number()
    .nullable()
    .describe('When the link stops working, as a ms epoch; null when it never expires.'),
  designUrl: url,
};

export const renameDesignOutput = {
  renamed: z
    .enum(['design', 'tab'])
    .describe('Whether the design or one of its tabs was renamed.'),
  name: z.string().describe('The stored name (shortened if it was over the cap).'),
  id: designId.optional().describe('The renamed design id (design renames).'),
  tabId: tabId.optional().describe('The renamed tab id (tab renames).'),
  url: url.optional().describe('Link that opens the design (design renames).'),
};

export const deleteDesignOutput = {
  deleted: z
    .enum(['design', 'tab'])
    .describe('Whether the design or one of its tabs was deleted.'),
  designId,
  tabId: tabId.optional().describe('The deleted tab id (tab deletes).'),
  trashed: z.boolean().optional().describe('True when the design went to the Trash.'),
  restorableForDays: z
    .number()
    .int()
    .optional()
    .describe('Days the design can be restored with restore_design before it is purged.'),
};

export const listTrashOutput = {
  trash: z
    .array(
      z.object({
        id: designId,
        name: z.string().describe('The design name.'),
        library: z
          .string()
          .describe('Whose Trash: "personal", or the name of the team (or "team").'),
        reason: z
          .enum(TRASH_REASONS)
          .describe(
            `Why it is in the Trash: "deleted" by someone, or "empty" (moved automatically after ${EMPTY_DESIGN_STALE_DAYS} days with no content).`,
          ),
        deletedAt: z.string().describe('When it was deleted, as an ISO timestamp.'),
        purgeAt: z.string().describe('When it is purged for good, as an ISO timestamp.'),
      }),
    )
    .describe('The designs that can still be restored.'),
};

export const restoreDesignOutput = {
  restored: z.literal('design').describe('Always "design": tabs have no Trash.'),
  id: designId,
  name: z.string().nullable().describe('The restored design name, or null if unknown.'),
  url,
};
