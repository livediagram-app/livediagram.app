import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  createBoardViewTool,
  createPageViewTool,
  createViewLiveTool,
  createViewTools,
} from './view-tool';

// Everything the tool says: its words and both schemas with their descriptions.
const wordsOf = (v: { description: string; input: z.ZodType; output: z.ZodType }) =>
  JSON.stringify([v.description, z.toJSONSchema(v.input), z.toJSONSchema(v.output)]);

// Each product's docs/specs/015-api/mcp-server.md "Interactive view (MCP Apps)": the view's own tools, in the
// product's words and id key.

const diagram = { cli: 'livediagram', noun: 'document', collection: 'documents' };
const design = { cli: 'livedesign', noun: 'design', collection: 'designs' };
const planner = {
  cli: 'liveplanner',
  noun: 'project',
  collection: 'projects',
  word: 'plan',
  words: 'plans',
};

describe('the view tools', () => {
  it('draws a whole tab for a canvas product, and follows it live', () => {
    const { viewTab, viewLive } = createViewTools(diagram, 'documentId');
    expect([viewTab.mcp.tool, viewTab.behaviour, viewLive.mcp.tool]).toEqual([
      'view_tab',
      'read',
      'view_live',
    ]);
    expect(Object.keys(viewTab.mcpShapes.input)).toEqual(['documentId', 'tabId']);
    expect(Object.keys(viewTab.mcpShapes.output)).not.toContain('pages');
    expect(viewTab.mcp.title).toBe('Draw a tab for the interactive view');
    expect(viewTab.description).toContain('use read_document');
    expect(Object.keys(viewLive.mcpShapes.output)).toEqual([
      'documentId',
      'url',
      'ticket',
      'expiresAt',
      'canEdit',
    ]);
  });

  // livediagram's mcp-server.md "Edits in the view": a rename or a move, answered with the tab drawn again.
  it('saves a canvas product’s edits from the view, each element marked with what an edit may do', () => {
    const { viewTab, viewEdit } = createViewTools(diagram, 'documentId');
    expect([viewEdit.mcp.tool, viewEdit.behaviour]).toEqual(['view_edit', 'write']);
    expect(viewEdit.description).toContain('use update_document');
    expect(Object.keys(viewEdit.mcpShapes.input)).toEqual(['documentId', 'tabId', 'edits']);
    expect(Object.keys(viewEdit.mcpShapes.output)).toEqual([
      ...Object.keys(viewTab.mcpShapes.output),
      'changesetId',
    ]);
    const edits = (list: unknown[]) =>
      viewEdit.input.safeParse({ documentId: 'd', tabId: 't', edits: list }).success;
    expect(edits([{ elementId: 'a', label: 'Pay', dx: -12.5, dy: 4 }])).toBe(true);
    expect(edits([])).toBe(false);
    expect(edits(Array.from({ length: 21 }, () => ({ elementId: 'a', dx: 1 })))).toBe(false);
    expect(edits([{ elementId: 'a', label: 'x'.repeat(501) }])).toBe(false);
    expect(edits([{ elementId: 'a', dx: 100_001 }])).toBe(false);
    const element = { id: 'a', ref: 'a', label: null, x: 0, y: 0, width: 1, height: 1 };
    const drawn = (el: object) =>
      viewTab.output.safeParse({
        documentId: 'd',
        tabId: 't',
        name: 'Main',
        tabs: [],
        svg: '<svg/>',
        viewBox: { x: 0, y: 0, width: 1, height: 1 },
        elements: [el],
        url: 'https://www.livediagram.app/document/d',
      }).success;
    expect(drawn({ ...element, canRename: true, canMove: false })).toBe(true);
    expect(drawn(element)).toBe(false);
  });

  it('draws one page at a time for a product of pages, by its own id key', () => {
    const viewTab = createPageViewTool(design, 'designId');
    expect(Object.keys(viewTab.mcpShapes.input)).toEqual(['designId', 'tabId', 'pageId']);
    expect(viewTab.mcp.title).toBe('Draw a page for the interactive view');
    const out = viewTab.output.parse({
      designId: 'd',
      tabId: 't',
      name: 'Logo',
      tabs: [{ id: 't', name: 'Logo' }],
      pageId: 'p2',
      pages: [
        { id: 'p1', name: 'Page 1' },
        { id: 'p2', name: 'Dark' },
      ],
      svg: '<svg/>',
      viewBox: { x: 0, y: 0, width: 1, height: 1 },
      elements: [],
      url: 'https://www.livedesign.app/design/d',
    });
    expect(out.pageId).toBe('p2');
    expect(wordsOf(viewTab)).not.toMatch(/document/i);
  });

  it('draws a board’s columns and cards for liveplanner, in its words', () => {
    const viewTab = createBoardViewTool(planner, 'projectId');
    expect(viewTab.mcp.tool).toBe('view_tab');
    expect(Object.keys(viewTab.mcpShapes.input)).toEqual(['projectId', 'tabId']);
    expect(viewTab.description).toContain('list_items');
    expect(viewTab.mcpShapes.output.url.description).toBe(
      'Link that opens the plan in the liveplanner editor.',
    );
    expect(wordsOf(viewTab)).not.toMatch(/document/i);
  });

  // Each product's mcp-server.md "Live updates": a read-only view follows its file too, with no edit answer.
  it('follows a page or board product live, in its words, with no canEdit', () => {
    const designLive = createViewLiveTool(design, 'designId');
    expect([designLive.mcp.tool, designLive.behaviour]).toEqual(['view_live', 'read']);
    expect(Object.keys(designLive.mcpShapes.input)).toEqual(['designId']);
    expect(Object.keys(designLive.mcpShapes.output)).toEqual([
      'designId',
      'url',
      'ticket',
      'expiresAt',
    ]);
    expect(designLive.description).toContain('draws the tab again');
    expect(designLive.description).toContain('use read_design');
    expect(wordsOf(designLive)).not.toMatch(/document/i);
    const planLive = createViewLiveTool(planner, 'projectId', { shows: 'board' });
    expect(Object.keys(planLive.mcpShapes.output)).toEqual([
      'projectId',
      'url',
      'ticket',
      'expiresAt',
    ]);
    expect(planLive.mcp.title).toBe('Follow a plan live in the interactive view');
    expect(planLive.description).toContain('draws the board again');
    expect(planLive.description).toContain('To read the cards, use list_items');
    expect(wordsOf(planLive)).not.toMatch(/document/i);
  });
});
