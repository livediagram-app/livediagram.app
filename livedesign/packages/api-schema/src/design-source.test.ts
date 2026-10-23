import { describe, expect, it } from 'vitest';
import { DESIGN_SOURCES, isDesignSource, isMadeByAiSource } from './design-source';

describe('design sources', () => {
  it('are the AI assistant, the MCP and the CLI', () => {
    expect(DESIGN_SOURCES).toEqual(['ai', 'mcp', 'cli']);
    expect(['ai', 'mcp', 'cli', 'web', null].map(isDesignSource)).toEqual([
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
