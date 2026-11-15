// The interactive view's own tools (each product's docs/specs/015-api/mcp-server.md "Interactive view (MCP Apps)"):
// view_tab, the call the view in a chat host makes through the host to draw a tab (or one page of it, or a tab's
// boards), and view_live, the view-only room ticket it follows the file with ("Live updates", livediagram's). A host
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

// What a canvas view_tab answers after the tabs: the SVG, its view box, the boxes a click can open and the link.
const drawingOutput = (product: AgentProduct) => ({
  svg: z.string().describe('The tab drawn as SVG, as the PNG preview draws it.'),
  viewBox: z.object(box).describe('The part of the tab the SVG shows.'),
  elements: z
    .array(
      z.object({
        id: z.string().describe('The element id, for the editor link.'),
        ref: z.string().describe('Its ref, as the views name it.'),
        label: z.string().nullable().describe('Its label, or null.'),
        ...box,
      }),
    )
    .describe('Every boxed element drawn, bottom to top, so a click finds the one under it.'),
  url: urlOutput(product),
});

const tabInput = () => ({
  tabId: z.string().optional().describe('Which tab to draw; defaults to the first.'),
});

/** view_tab and view_live for a canvas product (livediagram): a whole tab drawn as SVG, followed live. */
export function createViewTools<K extends string>(product: AgentProduct, idKey: K) {
  const word = wordOf(product);
  const id = idShape(idKey, word);
  const viewTab = mcpTool('view_tab', {
    behaviour: 'read',
    title: 'Draw a tab for the interactive view',
    description:
      `The interactive view’s own call: a tab drawn as SVG with its elements’ boxes and the ${word}’s tabs, for ` +
      `hosts that show the view. To read a tab, use read_${product.noun}.`,
    inputSchema: { ...id, ...tabInput() },
    outputSchema: { ...id, ...tabOutput(), ...drawingOutput(product) },
  });

  const viewLive = mcpTool('view_live', {
    behaviour: 'read',
    title: `Follow a ${word} live in the interactive view`,
    description:
      `The interactive view’s own call: a short-lived, view-only ticket into the ${word}’s room, so the view ` +
      `draws the tab again when it changes. To read a tab, use read_${product.noun}.`,
    inputSchema: id,
    outputSchema: {
      ...id,
      url: z.string().describe('The room’s WebSocket address, to open with ?t=<ticket>.'),
      ticket: z
        .string()
        .describe('The view-only room ticket: it admits at view and lapses at expiresAt.'),
      expiresAt: z.number().describe('When the ticket lapses, epoch milliseconds.'),
    },
  });

  return { viewTab, viewLive };
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
