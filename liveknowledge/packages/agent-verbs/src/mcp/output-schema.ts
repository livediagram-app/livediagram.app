// The output shapes of the tools every liveworkspace app's MCP server has, in this product's words
// (docs/specs/015-api/mcp-server.md §4.17): what each returns on success, advertised as its `outputSchema` and
// carried as `structuredContent`. The SDK validates every successful result against these on the way out, so a
// shape here that stops matching tools.ts fails the call rather than shipping a wrong contract. Error results are
// exempt and carry text only. The page tools' outputs are knowledge-schema.ts.
import { EMPTY_DOCUMENT_STALE_DAYS, TRASH_REASONS } from '@liveknowledge/api-schema';
import { z } from 'zod';
import { foundArchived } from './archive-tools';

const url = z.string().describe('Link that opens the knowledgebase in the liveknowledge editor.');
const documentId = z.string().describe('The knowledgebase id.');
const pageId = z.string().describe('The page id.');

export const findDocumentsOutput = {
  count: z.number().int().describe('How many knowledgebases matched.'),
  documents: z
    .array(
      z.object({
        id: documentId,
        name: z.string().describe('The knowledgebase name.'),
        updatedAt: z.number().describe('When it was last saved, as a ms epoch.'),
        library: z
          .string()
          .describe('Where it lives: "personal", or the name of the team whose library holds it.'),
        url,
        archived: foundArchived,
      }),
    )
    .describe('The matches, most relevant first.'),
  next: z.string().describe('The tool to call next, and with what.'),
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
        kind: z.string().describe('Pass as "template" on create_document.'),
        title: z.string().describe('The template display name.'),
        description: z.string().describe('What the template scaffolds.'),
        category: z.string().describe('The id of the category it belongs to.'),
      }),
    )
    .describe('Every template in the library.'),
};

export const createDocumentOutput = {
  id: documentId,
  documentId: documentId.describe(
    'The knowledgebase id again, under the name the other tools take it by.',
  ),
  name: z.string().describe('The stored name (shortened if it was over the cap).'),
  pages: z
    .array(
      z.object({
        page: pageId,
        title: z.string().describe('The page title.'),
        parent: z.string().optional().describe('The id of the page it sits under.'),
      }),
    )
    .describe('The pages it starts with, in tree order. None is verified.'),
  folder: z
    .string()
    .describe(
      'The Explorer folder it appears in: "My Work" for the root, or the name of the user\'s ' +
        'default folder it was filed in.',
    ),
  url,
  next: z.string().describe('The tool to call next, and with what.'),
};

export const shareDocumentOutput = {
  url: z.string().describe('The share link. Opening it needs no sign-in.'),
  role: z.enum(['view', 'participate', 'edit']).describe('What the link grants.'),
  expiresAt: z
    .number()
    .nullable()
    .describe('When the link stops working, as a ms epoch; null when it never expires.'),
  documentUrl: url,
};

export const renameDocumentOutput = {
  renamed: z
    .enum(['document', 'page'])
    .describe('Whether the knowledgebase ("document") or one of its pages was renamed.'),
  name: z.string().describe('The stored name (shortened if it was over the cap).'),
  id: documentId.optional().describe('The renamed knowledgebase id (knowledgebase renames).'),
  page: pageId.optional().describe('The renamed page id (page renames).'),
  url: url.optional().describe('Link that opens the knowledgebase (knowledgebase renames).'),
};

export const deleteDocumentOutput = {
  deleted: z
    .enum(['document', 'page'])
    .describe('Whether the knowledgebase ("document") or one of its pages was deleted.'),
  documentId,
  page: pageId.optional().describe('The deleted page id (page deletes).'),
  trashed: z.boolean().optional().describe('True when the knowledgebase went to the Trash.'),
  restorableForDays: z
    .number()
    .int()
    .optional()
    .describe('Days the knowledgebase can be restored with restore_document before it is purged.'),
};

export const listTrashOutput = {
  trash: z
    .array(
      z.object({
        id: documentId,
        name: z.string().describe('The knowledgebase name.'),
        library: z
          .string()
          .describe('Whose Trash: "personal", or the name of the team (or "team").'),
        reason: z
          .enum(TRASH_REASONS)
          .describe(
            `Why it is in the Trash: "deleted" by someone, or "empty" (moved automatically after ${EMPTY_DOCUMENT_STALE_DAYS} days with no content).`,
          ),
        deletedAt: z.string().describe('When it was deleted, as an ISO timestamp.'),
        purgeAt: z.string().describe('When it is purged for good, as an ISO timestamp.'),
      }),
    )
    .describe('The knowledgebases that can still be restored.'),
};

export const restoreDocumentOutput = {
  restored: z
    .literal('document')
    .describe('Always "document" (the knowledgebase): pages have no Trash.'),
  id: documentId,
  name: z.string().nullable().describe('The restored knowledgebase name, or null if unknown.'),
  url,
};
