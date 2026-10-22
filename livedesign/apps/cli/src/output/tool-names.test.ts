import { describe, expect, it } from 'vitest';
import { VERBS } from '@livedesign/agent-verbs';
import { MCP_TOOL_VERBS } from '@livedesign/agent-verbs/mcp';
import { COMMAND_OF_TOOL, inCliWords } from './tool-names';
import { formatError } from './cli-error';

// docs/specs/015-api/cli.md "Output": a refusal from the shared engine names the command, never the MCP tool.
describe('the CLI words for MCP tools', () => {
  it('has a command for every MCP tool, each one the CLI has', () => {
    const tools = MCP_TOOL_VERBS.map((v) => v.mcp.tool).sort();
    expect(Object.keys(COMMAND_OF_TOOL).sort()).toEqual(tools);
    const ids = new Set(VERBS.map((v) => v.id));
    for (const command of Object.values(COMMAND_OF_TOOL)) {
      const [resource, verb] = command.split(' ');
      expect(ids.has(`${resource}.${verb}`) || ids.has(resource!), command).toBe(true);
    }
  });

  it('writes a tool in a message as the command', () => {
    expect(inCliWords('That document has no page 4. Add one with change_pages.')).toBe(
      'That document has no page 4. Add one with livedesign page set.',
    );
    expect(inCliWords('read_document lists its pages; read_documents stays')).toBe(
      'livedesign document view lists its pages; read_documents stays',
    );
  });

  it('prints an error in those words, text and JSON alike', () => {
    const failure = { exit: 3 as const, code: 'page_none', message: 'Add one with change_pages.' };
    expect(formatError(failure, false)).toBe('error: Add one with livedesign page set.\n');
    expect((JSON.parse(formatError(failure, true)) as { message: string }).message).toBe(
      'Add one with livedesign page set.',
    );
  });
});
