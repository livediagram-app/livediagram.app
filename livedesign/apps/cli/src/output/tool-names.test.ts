import { describe, expect, it } from 'vitest';
import { VERBS } from '@livepages/agent-verbs';
import { MCP_TOOL_VERBS } from '@livepages/agent-verbs/mcp';
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
    expect(inCliWords('That document has no Form tab. Make one with add_form.')).toBe(
      'That document has no Form tab. Make one with livepages form add.',
    );
    expect(inCliWords('read_form lists its problems; not_a_form_tab stays')).toBe(
      'livepages form get lists its problems; not_a_form_tab stays',
    );
  });

  it('prints an error in those words, text and JSON alike', () => {
    const failure = { exit: 3 as const, code: 'form_tab_none', message: 'Make one with add_form.' };
    expect(formatError(failure, false)).toBe('error: Make one with livepages form add.\n');
    expect((JSON.parse(formatError(failure, true)) as { message: string }).message).toBe(
      'Make one with livepages form add.',
    );
  });
});
