// view_tab (docs/specs/015-api/mcp-server.md "Interactive view (MCP Apps)"): the interactive view's own tool. The
// view in the chat host calls it through the host to draw a tab and to switch tabs; a host with MCP Apps keeps it
// from the model, which reads with read_document.
import { z } from 'zod';
import { mcpTool } from '@liveworkspace/agent-verbs/mcp/tool';

const box = {
  x: z.number().describe('Left, in the tab’s coordinates.'),
  y: z.number().describe('Top, in the tab’s coordinates.'),
  width: z.number().describe('Width.'),
  height: z.number().describe('Height.'),
};

export const viewTabShape = {
  documentId: z.string().describe('The document id.'),
  tabId: z.string().optional().describe('Which tab to draw; defaults to the first.'),
};

export const viewTabOutput = {
  documentId: z.string().describe('The document id.'),
  tabId: z.string().describe('The tab drawn.'),
  name: z.string().describe('The tab name.'),
  tabs: z
    .array(
      z.object({ id: z.string().describe('The tab id.'), name: z.string().describe('Its name.') }),
    )
    .describe('Every tab of the document, in order, for switching.'),
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
  url: z.string().describe('Link that opens the document in the livediagram editor.'),
};

export const mcpViewTab = mcpTool('view_tab', {
  behaviour: 'read',
  title: 'Draw a tab for the interactive view',
  description:
    'The interactive view’s own call: a tab drawn as SVG with its elements’ boxes and the document’s tabs, for ' +
    'hosts that show the view. To read a tab, use read_document.',
  inputSchema: viewTabShape,
  outputSchema: viewTabOutput,
});

// view_live (docs/specs/015-api/mcp-server.md "Live updates"): the ticket the view follows the document's room with,
// minted for the token's owner, view-only and short-lived. Kept from the model like view_tab.
export const viewLiveShape = {
  documentId: z.string().describe('The document id.'),
};

export const viewLiveOutput = {
  documentId: z.string().describe('The document id.'),
  url: z.string().describe('The room’s WebSocket address, to open with ?t=<ticket>.'),
  ticket: z
    .string()
    .describe('The view-only room ticket: it admits at view and lapses at expiresAt.'),
  expiresAt: z.number().describe('When the ticket lapses, epoch milliseconds.'),
};

export const mcpViewLive = mcpTool('view_live', {
  behaviour: 'read',
  title: 'Follow a document live in the interactive view',
  description:
    'The interactive view’s own call: a short-lived, view-only ticket into the document’s room, so the view ' +
    'draws the tab again when it changes. To read a tab, use read_document.',
  inputSchema: viewLiveShape,
  outputSchema: viewLiveOutput,
});
