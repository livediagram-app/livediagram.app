import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { MCP_TOOL_VERBS, mcpShareDocument } from './mcp-tools';

// The MCP's tools as verbs (docs/specs/015-api/cli.md "One catalogue for the CLI and the MCP"). The MCP's own
// parity test checks the server registers each as declared; this checks the declarations themselves.

describe('the MCP tool verbs', () => {
  it('name each tool once, under an id of its own, with words and a behaviour', () => {
    expect(MCP_TOOL_VERBS.map((v) => v.mcp.tool)).toEqual([
      'list_items',
      'change_items',
      'add_board',
      'change_board',
      'change_card_types',
      'list_sheets',
      'read_sheet',
      'change_sheet',
      'add_sheet',
      'change_pages',
      'write_article',
      'list_images',
      'read_form',
      'add_form',
      'change_form',
      'share_form',
      'try_form',
      'find_documents',
      'read_document',
      'list_templates',
      'search_icons',
      'create_document',
      'add_tab',
      'update_document',
      'share_document',
      'rename_document',
      'delete_document',
      'list_trash',
      'restore_document',
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
      'list_items',
      'list_sheets',
      'read_sheet',
      'list_images',
      'read_form',
      'find_documents',
      'read_document',
      'list_templates',
      'search_icons',
      'list_trash',
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
