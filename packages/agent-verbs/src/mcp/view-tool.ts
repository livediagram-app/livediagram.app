// The interactive view's own tools (each product's docs/specs/015-api/mcp-server.md "Interactive view (MCP Apps)"):
// view_tab, the call the view in a chat host makes through the host to draw a tab (or one page of it, or a tab's
// boards), and view_live, the view-only room ticket it follows the file with ("Live updates", every product's). A host
// with MCP Apps keeps both from the model, which reads with read_<noun>. Each product declares them from here with
// its own words and id key, so the four servers describe the view the same way; the handlers are each MCP's.

import { z } from 'zod';
import { wordOf, type AgentProduct } from '../product';
import { mcpTool } from './tool';

const box = {
  x: z.number().describe('Left, in the tab’s coordinates.'),
  y: z.number().describe('Top, in the tab’s coordinates.'),
  width: z.number().describe('Width.'),
  height: z.number().describe('Height.'),
};

const idShape = <K extends string>(idKey: K, word: string) =>
  ({ [idKey]: z.string().describe(`The ${word} id.`) }) as { [P in K]: z.ZodString };

// What every view_tab answers about the tab: the one drawn and the ones the view can switch to.
const tabOutput = () => ({
  tabId: z.string().describe('The tab drawn.'),
  name: z.string().describe('The tab name.'),
  tabs: z
    .array(
      z.object({ id: z.string().describe('The tab id.'), name: z.string().describe('Its name.') }),
    )
    .describe('Every tab the view can switch to, in order.'),
});

const urlOutput = (product: AgentProduct) =>
  z.string().describe(`Link that opens the ${wordOf(product)} in the ${product.cli} editor.`);

// What an edit in the view may do to an element (livediagram's mcp-server.md "Edits in the view").
const editableOutput = {
  canRename: z.boolean().describe('Whether an edit in the view may change its label.'),
  canMove: z.boolean().describe('Whether an edit in the view may move it.'),
};

// What a canvas view_tab answers after the tabs: the SVG, its view box, the boxes a click can open and the link. A
// view that edits marks each box with what an edit may do to it.
const drawingOutput = (product: AgentProduct, editable = false) => ({
  svg: z.string().describe('The tab drawn as SVG, as the PNG preview draws it.'),
  viewBox: z.object(box).describe('The part of the tab the SVG shows.'),
  elements: z
    .array(
      z.object({
        id: z.string().describe('The element id, for the editor link.'),
        ref: z.string().describe('Its ref, as the views name it.'),
        label: z.string().nullable().describe('Its label, or null.'),
        ...box,
        ...(editable ? editableOutput : {}),
      }),
    )
    .describe('Every boxed element drawn, bottom to top, so a click finds the one under it.'),
  url: urlOutput(product),
});

// The most edits one view_edit carries, and the longest label it sets (livediagram's mcp-server.md "view_edit").
export const VIEW_EDIT_MAX = 20;
export const VIEW_EDIT_LABEL_MAX = 500;
const MOVE_LIMIT = 100_000;
const offset = (axis: string) =>
  z
    .number()
    .min(-MOVE_LIMIT)
    .max(MOVE_LIMIT)
    .optional()
    .describe(`How far to move it ${axis}, in the tab's pixels; rounded to a whole pixel.`);

const tabInput = () => ({
  tabId: z.string().optional().describe('Which tab to draw; defaults to the first.'),
});

/**
 * view_tab, view_live and view_edit for a canvas product (livediagram): a whole tab drawn as SVG, followed live, and
 * renamed or moved in the view when the token is edit-level.
 */
export function createViewTools<K extends string>(product: AgentProduct, idKey: K) {
  const word = wordOf(product);
  const id = idShape(idKey, word);
  const drawn = { ...id, ...tabOutput(), ...drawingOutput(product, true) };
  const viewTab = mcpTool('view_tab', {
    behaviour: 'read',
    title: 'Draw a tab for the interactive view',
    description:
      `The interactive view’s own call: a tab drawn as SVG with its elements’ boxes and the ${word}’s tabs, for ` +
      `hosts that show the view. To read a tab, use read_${product.noun}.`,
    inputSchema: { ...id, ...tabInput() },
    outputSchema: drawn,
  });

  const viewLive = createViewLiveTool(product, idKey, { editable: true });

  const viewEdit = mcpTool('view_edit', {
    behaviour: 'write',
    title: `Save an edit made in the interactive view`,
    description:
      `The interactive view’s own call: elements renamed or moved by the person in the view, saved as one ` +
      `changeset, answered with the tab drawn again. To change a ${word}, use update_${product.noun}.`,
    inputSchema: {
      ...id,
      tabId: z.string().describe('The tab the elements are on.'),
      edits: z
        .array(
          z.object({
            elementId: z.string().describe('The element’s id.'),
            label: z.string().max(VIEW_EDIT_LABEL_MAX).optional().describe('Its new label.'),
            dx: offset('across'),
            dy: offset('down'),
          }),
        )
        .min(1)
        .max(VIEW_EDIT_MAX)
        .describe('The edits, in order: each a new label, a move, or both.'),
    },
    outputSchema: {
      ...drawn,
      changesetId: z
        .string()
        .nullable()
        .describe('The changeset saved, or null when nothing changed.'),
    },
  });

  return { viewTab, viewLive, viewEdit };
}

/**
 * view_live for any product's view ("Live updates"): a short-lived, view-only ticket into the file's room, so the view
 * draws what it shows again when the file changes. `editable` (livediagram's, "Edits in the view") adds `canEdit`;
 * `shows` names what the view draws (a tab, or liveplanner's board).
 */
export function createViewLiveTool<K extends string>(
  product: AgentProduct,
  idKey: K,
  opts: { editable?: boolean; shows?: 'tab' | 'board' } = {},
) {
  const word = wordOf(product);
  const id = idShape(idKey, word);
  const read = opts.shows === 'board' ? 'list_items' : `read_${product.noun}`;
  return mcpTool('view_live', {
    behaviour: 'read',
    title: `Follow a ${word} live in the interactive view`,
    description:
      `The interactive view’s own call: a short-lived, view-only ticket into the ${word}’s room, so the view ` +
      `draws the ${opts.shows ?? 'tab'} again when it changes. To read ${opts.shows === 'board' ? 'the cards' : 'a tab'}, use ${read}.`,
    inputSchema: id,
    outputSchema: {
      ...id,
      url: z.string().describe('The room’s WebSocket address, to open with ?t=<ticket>.'),
      ticket: z
        .string()
        .describe('The view-only room ticket: it admits at view and lapses at expiresAt.'),
      expiresAt: z.number().describe('When the ticket lapses, epoch milliseconds.'),
      ...(opts.editable
        ? {
            canEdit: z
              .boolean()
              .describe(
                'Whether the token may rename and move elements through the view: edit-level, never a read-only token.',
              ),
          }
        : {}),
    },
  });
}

/** view_tab for a product of pages (livedocuments, livedesign): one page of a tab at a time, with the tab's pages. */
export function createPageViewTool<K extends string>(product: AgentProduct, idKey: K) {
  const word = wordOf(product);
  const id = idShape(idKey, word);
  return mcpTool('view_tab', {
    behaviour: 'read',
    title: 'Draw a page for the interactive view',
    description:
      'The interactive view’s own call: a page of a tab drawn as SVG with its elements’ boxes, the tab’s pages ' +
      `and the ${word}’s tabs, for hosts that show the view. To read a tab, use read_${product.noun}.`,
    inputSchema: {
      ...id,
      ...tabInput(),
      pageId: z
        .string()
        .optional()
        .describe('Which page to draw (from `pages`); defaults to the first.'),
    },
    outputSchema: {
      ...id,
      ...tabOutput(),
      pageId: z.string().nullable().describe('The page drawn, or null for a tab without pages.'),
      pages: z
        .array(
          z.object({
            id: z.string().describe('The page id.'),
            name: z.string().describe('Its name, or its place ("Page 2").'),
          }),
        )
        .describe('Every page of the tab, in order, for the pager.'),
      ...drawingOutput(product),
    },
  });
}

/** view_tab for a board product (liveplanner): a tab's boards, their columns and the cards each draws. */
export function createBoardViewTool<K extends string>(product: AgentProduct, idKey: K) {
  const id = idShape(idKey, wordOf(product));
  const card = z.object({
    id: z.string().describe('The card id, for the editor link.'),
    ref: z.string().describe('Its number, as "#12".'),
    title: z.string().describe('Its title, cut to fit.'),
    color: z.string().nullable().describe('Its type’s colour, or null.'),
  });
  const column = z.object({
    name: z.string().describe('The column name.'),
    status: z.string().describe('The status its cards hold.'),
    count: z.number().describe('How many cards it holds, drawn or not.'),
    wipLimit: z.number().nullable().describe('Its WIP limit, or null.'),
    done: z.boolean().describe('Whether its cards count as done.'),
    cards: z.array(card).describe('The cards drawn, in the board’s order; at most what fits.'),
  });
  return mcpTool('view_tab', {
    behaviour: 'read',
    title: 'Draw a board for the interactive view',
    description:
      'The interactive view’s own call: a tab’s boards with their columns and the cards that fit, for hosts that ' +
      'show the view. To read the cards, use list_items.',
    inputSchema: {
      ...id,
      tabId: z
        .string()
        .optional()
        .describe('Which tab to draw; defaults to the first with a board.'),
    },
    outputSchema: {
      ...id,
      ...tabOutput(),
      boards: z
        .array(
          z.object({
            id: z.string().describe('The board element’s id, for the editor link.'),
            title: z.string().describe('The board title.'),
            columns: z.array(column).describe('Its columns, in order.'),
          }),
        )
        .describe('The tab’s boards, in canvas order; none for a plan without a board.'),
      url: urlOutput(product),
    },
  });
}
