import { describe, expect, it } from 'vitest';
import { DOCUMENT_SOURCES, isDocumentSource, isMadeByAiSource } from './document-source';

describe('document sources', () => {
  it('are the AI assistant, the MCP and the CLI', () => {
    expect(DOCUMENT_SOURCES).toEqual(['ai', 'mcp', 'cli']);
    expect(['ai', 'mcp', 'cli', 'web', null].map(isDocumentSource)).toEqual([
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
