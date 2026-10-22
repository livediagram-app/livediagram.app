import { describe, expect, it } from 'vitest';
import { LINK_ADDRESS_PROBLEM, linkDetail, matchingTabs, resolveLinkAddress } from './link-address';

// docs/specs/026-plan/plan-tabs.md "Cards", Links: what the address field means.
const tabs = [
  { id: 'a', name: 'Roadmap' },
  { id: 'b', name: 'Sprint Board' },
  { id: 'c', name: 'Budget' },
];

describe('resolveLinkAddress', () => {
  it('links the tab picked from the list while the field still shows its name', () => {
    expect(resolveLinkAddress('Budget', 'c', tabs)).toEqual({ tabId: 'c' });
  });
  it('links a tab whose name is typed in full, in any case', () => {
    expect(resolveLinkAddress('  sprint board ', null, tabs)).toEqual({ tabId: 'b' });
  });
  it('links a site, adding https:// to a bare host, and an email', () => {
    expect(resolveLinkAddress('example.com', null, tabs)).toEqual({ url: 'https://example.com/' });
    expect(resolveLinkAddress('mailto:team@example.com', null, tabs)).toEqual({
      url: 'mailto:team@example.com',
    });
  });
  it('refuses anything else, with the problem to show', () => {
    expect(resolveLinkAddress('javascript:alert(1)', null, tabs)).toEqual({
      problem: LINK_ADDRESS_PROBLEM,
    });
    expect(resolveLinkAddress('', null, tabs)).toEqual({ problem: LINK_ADDRESS_PROBLEM });
  });
  it('drops a pick once the text no longer names it', () => {
    expect(resolveLinkAddress('example.com', 'c', tabs)).toEqual({ url: 'https://example.com/' });
  });
});

describe('matchingTabs', () => {
  it('lists every tab for an empty field', () => {
    expect(matchingTabs(tabs, ' ').map((t) => t.id)).toEqual(['a', 'b', 'c']);
  });
  it('lists the names holding the text, those starting with it first', () => {
    expect(matchingTabs(tabs, 'b').map((t) => t.id)).toEqual(['c', 'b']);
    expect(matchingTabs(tabs, 'zzz')).toEqual([]);
  });
});

describe('linkDetail', () => {
  it('shows a site’s host and path, an email’s address, and where a tab link goes', () => {
    expect(linkDetail({ id: '1', label: '', url: 'https://example.com/' })).toBe('example.com');
    expect(linkDetail({ id: '1', label: '', url: 'https://example.com/docs' })).toBe(
      'example.com/docs',
    );
    expect(linkDetail({ id: '1', label: 'Team', url: 'mailto:a@b.co' })).toBe('a@b.co');
    expect(linkDetail({ id: '1', label: '', url: 'mailto:a@b.co' })).toBe('Email');
    expect(linkDetail({ id: '1', label: '', tabId: 'a' })).toBe('Tab in this document');
  });
});
