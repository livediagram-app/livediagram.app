import { describe, expect, it } from 'vitest';
import { DESIGN_SOURCES, isDesignSource, isMadeByAiSource } from './design-source';

describe('design sources', () => {
  it('are the MCP and the CLI', () => {
    expect(DESIGN_SOURCES).toEqual(['mcp', 'cli']);
    expect(['mcp', 'cli', 'ai', 'web', null].map(isDesignSource)).toEqual([
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
