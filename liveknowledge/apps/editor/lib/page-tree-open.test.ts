// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  PAGE_TREE_KEPT,
  readClosedPages,
  readTreeCollapsed,
  writeClosedPages,
  writeTreeCollapsed,
} from './page-tree-open';

beforeEach(() => window.localStorage.clear());

describe('the pages closed in the tree', () => {
  it('are kept per knowledgebase, in this browser', () => {
    writeClosedPages('k1', new Set(['a', 'b']));
    writeClosedPages('k2', new Set(['c']));
    expect([...readClosedPages('k1')]).toEqual(['a', 'b']);
    expect([...readClosedPages('k2')]).toEqual(['c']);
    expect(readClosedPages('k3').size).toBe(0);
  });

  it('forget a knowledgebase with nothing closed', () => {
    writeClosedPages('k1', new Set(['a']));
    writeClosedPages('k1', new Set());
    expect(window.localStorage.getItem('liveknowledge:v2:page-tree-closed')).toBe('{}');
  });

  it('keep the most recent knowledgebases, dropping the oldest', () => {
    for (let i = 0; i <= PAGE_TREE_KEPT; i++) writeClosedPages(`k${i}`, new Set(['a']));
    expect(readClosedPages('k0').size).toBe(0);
    expect(readClosedPages(`k${PAGE_TREE_KEPT}`).size).toBe(1);
    // Written again, a knowledgebase is the most recent.
    writeClosedPages('k1', new Set(['a']));
    writeClosedPages('new', new Set(['a']));
    expect(readClosedPages('k1').size).toBe(1);
    expect(readClosedPages('k2').size).toBe(0);
  });

  it('read nothing from a store that is not theirs, and write nothing with no knowledgebase', () => {
    window.localStorage.setItem('liveknowledge:v2:page-tree-closed', '["a"]');
    expect(readClosedPages('k1').size).toBe(0);
    window.localStorage.setItem('liveknowledge:v2:page-tree-closed', '{"k1":["a",7],"k2":"x"}');
    expect([...readClosedPages('k1')]).toEqual(['a']);
    expect(readClosedPages('k2').size).toBe(0);
    writeClosedPages(null, new Set(['a']));
    expect(readClosedPages(null).size).toBe(0);
  });
});

describe('the collapsed sidebar', () => {
  it('is open until collapsed, and remembered', () => {
    expect(readTreeCollapsed()).toBe(false);
    writeTreeCollapsed(true);
    expect(readTreeCollapsed()).toBe(true);
    writeTreeCollapsed(false);
    expect(readTreeCollapsed()).toBe(false);
  });
});
