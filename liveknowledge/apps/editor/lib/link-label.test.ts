import type { ElementLink } from '@liveknowledge/document';
import { describe, expect, it } from 'vitest';
import { describeLink } from './link-label';

const tabs = [{ id: 't1', name: 'Overview' }];

describe('describeLink', () => {
  it('returns a url verbatim', () => {
    expect(describeLink({ kind: 'url', url: 'https://example.com/x' })).toBe(
      'https://example.com/x',
    );
  });

  it('names a knowledgebase link', () => {
    expect(describeLink({ kind: 'document', documentId: 'd1', name: 'Roadmap' })).toBe(
      'Knowledgebase: Roadmap',
    );
  });

  it('names the target tab when it is in the tab list', () => {
    expect(describeLink({ kind: 'tab', tabId: 't1' }, tabs)).toBe('Goes to page "Overview"');
  });

  it('falls back to a generic phrase when the tab is not found', () => {
    expect(describeLink({ kind: 'tab', tabId: 'gone' }, tabs)).toBe(
      'Goes to a page in this knowledgebase',
    );
    expect(describeLink({ kind: 'tab', tabId: 't1' })).toBe('Goes to a page in this knowledgebase');
  });

  it('describes an element link with the resolved tab name', () => {
    expect(describeLink({ kind: 'element', tabId: 't1', elementId: 'e1' }, tabs)).toBe(
      'An element on page "Overview"',
    );
  });

  it('falls back generically for an element link with no matching tab', () => {
    expect(describeLink({ kind: 'element', tabId: 'gone', elementId: 'e1' }, tabs)).toBe(
      'An element on a page in this knowledgebase',
    );
  });

  it('treats a whitespace-only tab name as no name', () => {
    const blank: { id: string; name: string }[] = [{ id: 't1', name: '   ' }];
    expect(describeLink({ kind: 'tab', tabId: 't1' }, blank)).toBe(
      'Goes to a page in this knowledgebase',
    );
  });

  it('covers every ElementLink kind', () => {
    const kinds: ElementLink['kind'][] = ['url', 'document', 'tab', 'element'];
    expect(kinds).toHaveLength(4);
  });
});
