import { describe, expect, it } from 'vitest';
import { DRAFT_FLOW } from '@liveknowledge/document';
import { opForReader, roleReadsDraft } from './room-draft-filter';

// docs/specs/030-knowledgebase/editing.md "Share roles"; blueprint "Security and trust": a session that cannot edit is
// never sent a page's draft.

describe('the draft withheld from a reader', () => {
  it("withholds the draft's writing whole", () => {
    expect(opForReader({ kind: 'article', flow: DRAFT_FLOW, tabId: 't', blocks: [] })).toBeNull();
    const saved = { kind: 'article', flow: 'art-1', tabId: 't' };
    expect(opForReader(saved)).toBe(saved);
  });

  it('sends a whole tab without either half', () => {
    const tab = {
      id: 't',
      name: 'n',
      elements: [],
      articles: { 'art-1': { blocks: [] }, [DRAFT_FLOW]: { blocks: [] } },
      draft: { by: 'P', at: 1, base: {} },
    };
    const out = opForReader({ kind: 'tab', tab }) as { tab: Record<string, unknown> };
    expect(out.tab.draft).toBeUndefined();
    expect(Object.keys(out.tab.articles as object)).toEqual(['art-1']);
    const plain = { kind: 'tab', tab: { id: 't', name: 'n', elements: [] } };
    expect(opForReader(plain)).toBe(plain);
  });

  it("strips a meta patch's draft record, and withholds a patch that was only that", () => {
    expect(
      opForReader({ kind: 'tab-meta', tabId: 't', patch: { draft: { by: 'P', at: 1, base: {} } } }),
    ).toBeNull();
    expect(
      opForReader({ kind: 'tab-meta', tabId: 't', patch: { draft: {}, name: 'New' } }),
    ).toEqual({ kind: 'tab-meta', tabId: 't', patch: { name: 'New' } });
    expect(
      opForReader({ kind: 'tab-meta', tabId: 't', patch: { draft: {} }, clear: ['parent'] }),
    ).toEqual({ kind: 'tab-meta', tabId: 't', patch: {}, clear: ['parent'] });
    expect(
      opForReader({ kind: 'tab-meta', tabId: 't', patch: { draft: {} }, pageSteps: [] }),
    ).toEqual({ kind: 'tab-meta', tabId: 't', patch: {}, pageSteps: [] });
    const name = { kind: 'tab-meta', tabId: 't', patch: { name: 'x' } };
    expect(opForReader(name)).toBe(name);
  });

  it('passes everything else, and nonsense, through', () => {
    const cursor = { kind: 'cursor', x: 1, y: 2 };
    expect(opForReader(cursor)).toBe(cursor);
    expect(opForReader(null)).toBeNull();
    expect(opForReader('x')).toBe('x');
    const odd = { kind: 'tab-meta', patch: null };
    expect(opForReader(odd)).toBe(odd);
  });

  it('reads the draft for an Editor and a Participant only', () => {
    expect(roleReadsDraft('edit')).toBe(true);
    expect(roleReadsDraft('participate')).toBe(true);
    for (const role of ['view', 'comment', undefined, null])
      expect(roleReadsDraft(role)).toBe(false);
  });
});
