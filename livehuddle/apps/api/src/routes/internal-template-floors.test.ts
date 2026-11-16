// A Space with floors from the template door (internal-template.ts): a tab per floor after the first, as /new makes
// it, each on its own floor pattern, and the whole file read back by the import's reader.
import { describe, expect, it } from 'vitest';
import { parseDocumentEnvelope } from '@livehuddle/document';
import { templateFloors } from '@livehuddle/templates';
import { readDocumentFile } from '../document-room/document-file';
import { templateDocumentFile } from './internal-template';

describe('a template with floors', () => {
  it('makes a tab for each floor after the first', () => {
    const floors = templateFloors('hotel-and-suites');
    expect(floors.length).toBeGreaterThan(0);
    const file = templateDocumentFile('hotel-and-suites', 'Apollo Hotel')!;
    const parsed = parseDocumentEnvelope(file);
    if (!parsed.ok) throw new Error(parsed.failure);
    const tabs = parsed.envelope.document.tabs;
    expect(tabs).toHaveLength(floors.length + 1);
    expect(tabs.slice(1).map((t) => [t.name, t.backgroundPattern])).toEqual(
      floors.map((f) => [f.name, f.floor]),
    );
    expect(readDocumentFile(file).ok).toBe(true);
  });
});
