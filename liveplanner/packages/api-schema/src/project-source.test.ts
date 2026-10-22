import { describe, expect, it } from 'vitest';
import { PROJECT_SOURCES, isProjectSource, isMadeByAiSource } from './project-source';

describe('project sources', () => {
  it('are the AI assistant, the MCP and the CLI', () => {
    expect(PROJECT_SOURCES).toEqual(['ai', 'mcp', 'cli']);
    expect(['ai', 'mcp', 'cli', 'web', null].map(isProjectSource)).toEqual([
      true,
      true,
      true,
      false,
      false,
    ]);
  });

  it('count as Made by AI only from the AI assistant and the MCP', () => {
    expect(['ai', 'mcp', 'cli', null, undefined].map(isMadeByAiSource)).toEqual([
      true,
      true,
      false,
      false,
      false,
    ]);
  });
});
