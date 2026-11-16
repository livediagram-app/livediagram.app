// What Claude's connector directory asks of every tool (each product's docs/specs/015-api/mcp-server.md "Claude
// connector directory", from https://claude.com/docs/connectors/building/review-criteria): a title, the hint that
// says whether it only reads or may destroy, a name of 64 characters or fewer, and a description that says what it
// does. Each product's directory.test.ts runs this over the tools its server really lists, so a new tool that misses
// one fails CI before review would.
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

// The directory's limit on a tool's name.
export const TOOL_NAME_MAX = 64;
// The characters MCP allows in a tool name (the 2025-11-25 spec's tool-name guidance).
const NAME_CHARS = /^[A-Za-z0-9_.-]+$/;
// The shortest description that can say what a tool does.
export const DESCRIPTION_MIN = 20;

/** Every way a listed tool falls short of the directory's rules, one line each; empty when none. */
export function directoryProblems(tools: readonly Tool[]): string[] {
  const problems: string[] = [];
  for (const tool of tools) {
    const { name } = tool;
    const say = (problem: string) => problems.push(`${name}: ${problem}`);
    if (name.length > TOOL_NAME_MAX)
      say(`name is ${name.length} characters, over ${TOOL_NAME_MAX}`);
    if (!NAME_CHARS.test(name)) say('name uses characters other than letters, digits, _ . and -');
    const title = tool.title ?? tool.annotations?.title;
    if (!title?.trim()) say('has no title');
    const description = tool.description?.trim() ?? '';
    if (description.length < DESCRIPTION_MIN) say('has no description that says what it does');
    const hints = tool.annotations;
    if (hints?.readOnlyHint === true) {
      if (hints.destructiveHint !== undefined) say('is read-only but states destructiveHint');
    } else if (typeof hints?.destructiveHint !== 'boolean') {
      say('writes but states neither readOnlyHint true nor a destructiveHint');
    }
    // A tool that reaches past the caller's own library must say so plainly, since review asks why it calls a
    // service that is not the product's own.
    if (hints?.openWorldHint === true && !/\burl\b/i.test(description))
      say('reaches the open web (openWorldHint) but its description never says it fetches a URL');
  }
  return problems;
}
