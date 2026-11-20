// The input shapes of the tools every liveworkspace app's MCP server has, in this product's words
// (docs/specs/015-api/mcp-server.md §4; docs/specs/024-agents/knowledgebase-for-agents.md): finding, making,
// sharing, renaming, deleting and restoring a knowledgebase. The api and its links call a knowledgebase a
// `document`, so the tool names and `documentId` keep that word; everything a model reads says knowledgebase, and
// what is inside one is a page. The page tools' shapes are knowledge-schema.ts.
import { z } from 'zod';
import { findArchived } from './archive-tools';
import { ARTICLE_MARKDOWN_MAX, NAME_MAX_LENGTH, truncateName } from '@liveknowledge/document';
export { SERVER_INSTRUCTIONS } from './server-instructions';

/** The most pages create_document makes in one call. */
export const CREATE_PAGES_MAX = 20;

export const findDocumentsShape = {
  query: z
    .string()
    .optional()
    .describe(
      "Only knowledgebases whose name, or whose folder's name, contains each word of this text (any case).",
    ),
  limit: z.number().int().min(1).max(50).optional().describe('Max results (default 20).'),
  archived: findArchived,
};

// A knowledgebase or page name (docs/specs/006-document/name-length.md). Shortened with the same truncateName the
// api worker applies, so the name a tool reports back is the one stored; the cap is stated in the description.
const nameField = (what: string, schema: z.ZodString = z.string()) =>
  schema
    .describe(
      `${what} Keep it short: at most ${NAME_MAX_LENGTH} characters. A longer name is ` +
        'shortened at a word boundary with an ellipsis.',
    )
    .transform(truncateName);

export const createDocumentPage = z.object({
  title: nameField('The page’s title.', z.string().min(1)),
  markdown: z
    .string()
    .max(ARTICLE_MARKDOWN_MAX)
    .optional()
    .describe(
      'The page’s writing as Markdown: headings, lists, tables, code fences, links, and [[Title]] for a link ' +
        'to another page of this call. Absent: an empty page.',
    ),
  parent: z
    .string()
    .optional()
    .describe('The title of an earlier page of this call to put it under. Absent: the top level.'),
});

export const createDocumentShape = {
  name: nameField('Name for the new knowledgebase.'),
  pages: z
    .array(createDocumentPage)
    .min(1)
    .max(CREATE_PAGES_MAX)
    .optional()
    .describe(
      `The pages it starts with, in tree order (a parent before the pages under it), up to ${CREATE_PAGES_MAX}; ` +
        'create_page adds more. Absent: one empty page named after the knowledgebase.',
    ),
  template: z
    .string()
    .optional()
    .describe(
      'Start the first page from a template instead: a kind from list_templates. Not with "pages".',
    ),
  // Making a knowledgebase is a use (docs/specs/015-api/mcp-server.md §4.3).
  markUsed: z
    .boolean()
    .optional()
    .describe(
      "Whether it joins the user's Most Used and Recent on Home at once. Default true. Pass false when " +
        "making many in one go, so a batch never pushes the user's own work out of reach.",
    ),
};

export const shareDocumentShape = {
  documentId: z.string().describe('The knowledgebase to share (from find_documents).'),
  role: z
    .enum(['view', 'participate', 'edit'])
    .optional()
    .describe(
      'What the link grants. "participate" (default): recipients edit text and comment ' +
        'but cannot add, move or delete pages; right for a review. "view": they only read. ' +
        '"edit": they can change anything. No sign-in is needed to open any.',
    ),
  expiry: z
    .enum(['never', 'week', 'month', 'sixMonths'])
    .optional()
    .describe('When the link stops working. Defaults to "never" (until revoked).'),
};

const onePage = (verb: string) =>
  z
    .string()
    .min(1)
    .optional()
    .describe(
      `${verb} this ONE page (its id, or its title when one page alone has it) instead of the whole knowledgebase.`,
    );

export const deleteDocumentShape = {
  documentId: z.string().describe('The knowledgebase to delete (from find_documents).'),
  page: onePage('Delete only').describe(
    'Delete only this ONE page (its id, or its title when one page alone has it) instead of the whole ' +
      'knowledgebase. A page is deleted outright, with no Trash; a knowledgebase keeps at least one page.',
  ),
};

// The Trash (docs/specs/013-workspace/trash.md): restore one knowledgebase by id.
export const restoreDocumentShape = {
  documentId: z.string().describe('The knowledgebase to restore (from list_trash).'),
};

// Listing the Trash takes no arguments: it is everything the user may restore.
export const listTrashShape = {};

export const renameDocumentShape = {
  documentId: z.string().describe('The knowledgebase to rename (from find_documents).'),
  name: nameField('The new name.', z.string().min(1)),
  page: onePage('Rename'),
};
