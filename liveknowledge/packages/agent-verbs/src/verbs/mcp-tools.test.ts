import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { MCP_TOOL_VERBS, mcpShareDocument } from './mcp-tools';

// The MCP's tools as verbs (docs/specs/015-api/cli.md "One catalogue for the CLI and the MCP"). The MCP's own
// parity test checks the server registers each as declared; this checks the declarations themselves.

describe('the MCP tool verbs', () => {
  it('name each tool once, under an id of its own, with words and a behaviour', () => {
    expect(MCP_TOOL_VERBS.map((v) => v.mcp.tool)).toEqual([
      'get_context',
      'list_pages',
      'search_pages',
      'read_page',
      'report_gap',
      'create_page',
      'suggest_edit',
      'write_page',
      'move_page',
      'request_approval',
      'list_page_comments',
      'change_page_comments',
      'find_documents',
      'create_document',
      'rename_document',
      'share_document',
      'archive_document',
      'unarchive_document',
      'delete_document',
      'restore_document',
      'list_trash',
      'list_templates',
      'list_images',
      'upload_image',
      'delete_image',
      'list_threads',
      'change_threads',
      'list_rules',
      'change_rules',
    ]);
    for (const v of MCP_TOOL_VERBS) {
      expect(v.id).toBe(`mcp.${v.mcp.tool}`);
      expect(v.summary).toBe(v.mcp.title);
      expect(v.description.length).toBeGreaterThan(40);
      expect(['read', 'write', 'destructive']).toContain(v.behaviour);
    }
  });

  it('hold the raw shapes they publish, and the same shapes as zod objects', () => {
    for (const v of MCP_TOOL_VERBS) {
      expect(Object.keys(v.input.shape)).toEqual(Object.keys(v.mcpShapes.input));
      expect(Object.keys(v.output.shape)).toEqual(Object.keys(v.mcpShapes.output));
      expect(Object.keys(v.mcpShapes.output).length).toBeGreaterThan(0);
      expect(z.toJSONSchema(v.output)).toHaveProperty('type', 'object');
    }
  });

  it('read only where a read-only token could call them', () => {
    const reads = MCP_TOOL_VERBS.filter((v) => v.behaviour === 'read').map((v) => v.mcp.tool);
    expect(reads).toEqual([
      'get_context',
      'list_pages',
      'search_pages',
      'read_page',
      'list_page_comments',
      'find_documents',
      'list_trash',
      'list_templates',
      'list_images',
      'list_threads',
      'list_rules',
    ]);
  });
});

// docs/specs/015-api/mcp-server.md: share_document makes a Participant link when the agent names no level.
describe('share_document', () => {
  it('names the default level the api applies', () => {
    expect(mcpShareDocument.description).toContain('"participate" (the default');
    expect(mcpShareDocument.description).not.toMatch(/"view" \([^)]*default/);
  });
});

// docs/specs/024-agents/knowledgebase-for-agents.md: the words an agent chooses its tools by.
describe('the page tools', () => {
  const tool = (name: string) => MCP_TOOL_VERBS.find((v) => v.mcp.tool === name)!;

  it('send an agent to get_context first', () => {
    expect(MCP_TOOL_VERBS[0]!.mcp.tool).toBe('get_context');
    expect(tool('get_context').description).toMatch(/^Call this first\./);
  });

  it('say how far each answer can be trusted', () => {
    for (const name of ['get_context', 'list_pages', 'search_pages', 'read_page']) {
      expect(tool(name).description).toContain('conflicts_with');
      expect(Object.keys(tool(name).mcpShapes.output)).toContain('next');
    }
    expect(tool('search_pages').description).toContain('Prefer a verified passage');
  });

  it('keep a direct write for the write scope and off verified pages', () => {
    expect(tool('write_page').behaviour).toBe('destructive');
    expect(tool('write_page').description).toContain('never on a verified page');
    expect(tool('write_page').description).toContain('suggest_edit');
    expect(tool('report_gap').idempotent).toBe(true);
    expect(tool('move_page').idempotent).toBe(true);
  });

  it('never call the product anything but a knowledgebase', () => {
    for (const v of MCP_TOOL_VERBS) {
      const words = JSON.stringify([
        v.description,
        z.toJSONSchema(v.input, { io: 'input' }),
        z.toJSONSchema(v.output),
      ]);
      expect(words).not.toMatch(/wiki|knowledge base/i);
      expect(words).not.toContain('\u2014');
      // The rule format's step kind add_tab (Add a Page from a Template) keeps its shared name, quoted as a kind;
      // no tool of that name is offered.
      const tools = words.replace(/\\?"add_tab\\?"/g, '');
      expect(tools).not.toMatch(/\bupdate_document|read_document|add_tab|write_article\b/);
    }
  });
});
