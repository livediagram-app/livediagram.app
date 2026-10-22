import { describe, expect, it } from 'vitest';
import { documentPath } from './document-paths';

describe('documentPath', () => {
  it("is the document's page in the editor, its id encoded", () => {
    expect(documentPath('abc-123')).toBe('/document/abc-123');
    expect(documentPath('a/b c')).toBe('/document/a%2Fb%20c');
  });
});
