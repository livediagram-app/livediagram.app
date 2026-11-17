import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { describe, expect, it } from 'vitest';
import { directoryProblems, TOOL_NAME_MAX } from './directory';

const SCHEMA = { type: 'object' as const };
const READ: Tool = {
  name: 'find_examples',
  title: 'Find examples',
  description: 'Finds the caller’s examples by name.',
  inputSchema: SCHEMA,
  annotations: { readOnlyHint: true, openWorldHint: false },
};

describe('directoryProblems', () => {
  it('passes a read, a write, a destructive and a URL-fetching tool that follow the rules', () => {
    const tools: Tool[] = [
      READ,
      {
        ...READ,
        name: 'add_example',
        annotations: { readOnlyHint: false, destructiveHint: false },
      },
      { ...READ, name: 'delete_example', annotations: { destructiveHint: true } },
      {
        ...READ,
        name: 'upload_image',
        description: 'Uploads a picture, or a public https URL for the server to fetch.',
        annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
      },
      // A title in annotations counts as much as one on the tool.
      {
        ...READ,
        name: 'list_examples',
        title: undefined,
        annotations: { readOnlyHint: true, title: 'List' },
      },
    ];
    expect(directoryProblems(tools)).toEqual([]);
  });

  it('names every rule a tool misses', () => {
    const long = 'x'.repeat(TOOL_NAME_MAX + 1);
    expect(
      directoryProblems([
        { ...READ, name: long },
        { name: 'bad name', inputSchema: SCHEMA },
        {
          ...READ,
          name: 'sneaky_read',
          annotations: { readOnlyHint: true, destructiveHint: false },
        },
        { ...READ, name: 'fetcher', annotations: { readOnlyHint: true, openWorldHint: true } },
        { ...READ, name: 'blank', title: '  ', description: 'Short.', annotations: undefined },
      ]),
    ).toEqual([
      `${long}: name is 65 characters, over 64`,
      'bad name: name uses characters other than letters, digits, _ . and -',
      'bad name: has no title',
      'bad name: has no description that says what it does',
      'bad name: writes but states neither readOnlyHint true nor a destructiveHint',
      'sneaky_read: is read-only but states destructiveHint',
      'fetcher: reaches the open web (openWorldHint) but its description never says it fetches a URL',
      'blank: has no title',
      'blank: has no description that says what it does',
      'blank: writes but states neither readOnlyHint true nor a destructiveHint',
    ]);
  });
});
