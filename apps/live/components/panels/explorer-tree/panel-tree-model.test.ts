// The panel splits My documents' root as the page does (docs/specs/013-workspace/folders.md#dynamic-synthetic-folders).

import { describe, expect, it } from 'vitest';
import type { DocumentListItem } from '@/lib/api-client';
import { splitRootDocuments } from './panel-tree-model';

const doc = (id: string, source: string | null) => ({ id, source }) as unknown as DocumentListItem;

describe('splitRootDocuments', () => {
  it('puts what a person made in Unsorted and what an AI tool made in Generated', () => {
    const { unsorted, generated } = splitRootDocuments([doc('a', null), doc('b', 'mcp')]);
    expect(unsorted.map((d) => d.id)).toEqual(['a']);
    expect(generated.map((d) => d.id)).toEqual(['b']);
  });
});
