import { describe, expect, it } from 'vitest';
import { DOCUMENT_SOURCES, isDocumentSource, isMadeByAiSource } from './document-source';

describe('document sources', () => {
  it('are the MCP and the CLI', () => {
    expect(DOCUMENT_SOURCES).toEqual(['mcp', 'cli']);
    expect(['mcp', 'cli', 'ai', 'web', null].map(isDocumentSource)).toEqual([
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
