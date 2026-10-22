import { describe, expect, it } from 'vitest';
import { migrateStoredTab } from './stored-tab';

describe('migrateStoredTab, element links from before the document rename', () => {
  it('upgrades a legacy link and keeps the tab kind', () => {
    const tab = {
      kind: 'diagram' as const,
      elements: [
        { id: 'e', type: 'shape', link: { kind: 'diagram', diagramId: 'd1', name: 'Roadmap' } },
      ],
    } as unknown as Parameters<typeof migrateStoredTab>[0];
    const out = migrateStoredTab(tab) as unknown as { kind: string; elements: { link: unknown }[] };
    expect(out.kind).toBe('diagram');
    expect(out.elements[0]!.link).toEqual({ kind: 'document', documentId: 'd1', name: 'Roadmap' });
  });
});
