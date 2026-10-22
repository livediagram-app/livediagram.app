import { describe, expect, it } from 'vitest';
import { PROJECT_SOURCES, isProjectSource, isMadeByAiSource } from './project-source';

describe('project sources', () => {
  it('are the MCP and the CLI', () => {
    expect(PROJECT_SOURCES).toEqual(['mcp', 'cli']);
    expect(['mcp', 'cli', 'ai', 'web', null].map(isProjectSource)).toEqual([
      true,
      true,
      false,
      false,
      false,
    ]);
  });

  it('count as Made by AI only from the MCP', () => {
    expect(['mcp', 'cli', 'ai', null, undefined].map(isMadeByAiSource)).toEqual([
      true,
      false,
      false,
      false,
      false,
    ]);
  });
});
