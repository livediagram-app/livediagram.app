// The tools' zod output shapes (docs/specs/015-api/mcp-server.md §4.17): what each tool returns on
// success, advertised as its `outputSchema` and carried as `structuredContent`.
// The SDK validates every successful result against these on the way out, so a
// shape here that stops matching tools.ts fails the call rather than shipping a
// wrong contract. Error results are exempt and carry text only.
import { z } from 'zod';

const url = z.string().describe('Link that opens the document in the livediagram editor.');
const documentId = z.string().describe('The document id.');
const tabId = z.string().describe('The tab id.');

export const findDocumentsOutput = {
  count: z.number().int().describe('How many documents matched.'),
  documents: z
    .array(
      z.object({
        id: documentId,
        name: z.string().describe('The document name.'),
        updatedAt: z.number().describe('When it was last saved, as a ms epoch.'),
        library: z
          .string()
          .describe('Where it lives: "personal", or the name of the team whose library holds it.'),
        url,
      }),
    )
    .describe('The matches, most relevant first.'),
};

export const readDocumentOutput = {
  id: documentId,
  name: z.string().describe('The document name.'),
  tab: z
    .object({
      id: tabId,
      name: z.string().describe('The tab name.'),
      elements: z
        .array(z.record(z.string(), z.unknown()))
        .describe('The tab elements, in the format of the livediagram://schema/elements resource.'),
    })
    .describe('The tab that was read.'),
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
        kind: z.string().describe('Pass as "template" on create_document / add_tab.'),
        title: z.string().describe('The template display name.'),
        description: z.string().describe('What the template scaffolds.'),
        category: z.string().describe('The id of the category it belongs to.'),
      }),
    )
    .describe('Every template in the library.'),
};

export const createDocumentOutput = {
  id: documentId,
  name: z.string().describe('The stored name (shortened if it was over the cap).'),
  tabCount: z.number().int().describe('How many tabs were created.'),
  tabIds: z.array(z.string()).describe('The new tab ids, in order.'),
  folder: z
    .string()
    .describe(
      'The Explorer folder it appears in: "Generated", or the name of the user\'s default folder ' +
        'it was filed in.',
    ),
  url,
};

export const addTabOutput = {
  documentId,
  tabId: tabId.describe('The new tab id.'),
  name: z.string().describe('The stored tab name (shortened if it was over the cap).'),
  url,
};

export const updateDocumentOutput = {
  id: documentId,
  tabId: tabId.describe('The tab that was edited.'),
  url,
};

export const shareDocumentOutput = {
  url: z.string().describe('The share link. Opening it needs no sign-in.'),
  role: z.enum(['view', 'edit']).describe('What the link grants.'),
  expiresAt: z
    .number()
    .nullable()
    .describe('When the link stops working, as a ms epoch; null when it never expires.'),
  documentUrl: url,
};

export const renameDocumentOutput = {
  renamed: z
    .enum(['document', 'tab'])
    .describe('Whether the document or one of its tabs was renamed.'),
  name: z.string().describe('The stored name (shortened if it was over the cap).'),
  id: documentId.optional().describe('The renamed document id (document renames).'),
  tabId: tabId.optional().describe('The renamed tab id (tab renames).'),
  url: url.optional().describe('Link that opens the document (document renames).'),
};

export const deleteDocumentOutput = {
  deleted: z
    .enum(['document', 'tab'])
    .describe('Whether the document or one of its tabs was deleted.'),
  documentId,
  tabId: tabId.optional().describe('The deleted tab id (tab deletes).'),
  trashed: z.boolean().optional().describe('True when the document went to the Trash.'),
  restorableForDays: z
    .number()
    .int()
    .optional()
    .describe('Days the document can be restored with restore_document before it is purged.'),
};

export const listTrashOutput = {
  trash: z
    .array(
      z.object({
        id: documentId,
        name: z.string().describe('The document name.'),
        library: z
          .string()
          .describe('Whose Trash: "personal", or the name of the team (or "team").'),
        deletedAt: z.string().describe('When it was deleted, as an ISO timestamp.'),
        purgeAt: z.string().describe('When it is purged for good, as an ISO timestamp.'),
      }),
    )
    .describe('The documents that can still be restored.'),
};

export const restoreDocumentOutput = {
  restored: z.literal('document').describe('Always "document": tabs have no Trash.'),
  id: documentId,
  name: z.string().nullable().describe('The restored document name, or null if unknown.'),
  url,
};
