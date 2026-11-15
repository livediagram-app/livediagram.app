import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createBoardViewTool, createPageViewTool, createViewTools } from './view-tool';

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
    ]);
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
});
