// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  PAGE_TREE_KEPT,
  readOpenedPages,
  readTreeCollapsed,
  writeOpenedPages,
  writeTreeCollapsed,
} from './page-tree-open';

beforeEach(() => window.localStorage.clear());

describe('the pages opened in the tree', () => {
  it('are kept per knowledgebase, in this browser', () => {
    writeOpenedPages('k1', new Set(['a', 'b']));
    writeOpenedPages('k2', new Set(['c']));
    expect([...readOpenedPages('k1')]).toEqual(['a', 'b']);
    expect([...readOpenedPages('k2')]).toEqual(['c']);
    expect(readOpenedPages('k3').size).toBe(0);
  });

  it('forget a knowledgebase with nothing opened', () => {
    writeOpenedPages('k1', new Set(['a']));
    writeOpenedPages('k1', new Set());
    expect(window.localStorage.getItem('liveknowledge:v3:page-tree-opened')).toBe('{}');
  });

  it('keep the most recent knowledgebases, dropping the oldest', () => {
    for (let i = 0; i <= PAGE_TREE_KEPT; i++) writeOpenedPages(`k${i}`, new Set(['a']));
    expect(readOpenedPages('k0').size).toBe(0);
    expect(readOpenedPages(`k${PAGE_TREE_KEPT}`).size).toBe(1);
    // Written again, a knowledgebase is the most recent.
    writeOpenedPages('k1', new Set(['a']));
    writeOpenedPages('new', new Set(['a']));
    expect(readOpenedPages('k1').size).toBe(1);
    expect(readOpenedPages('k2').size).toBe(0);
  });

  it('read nothing from a store that is not theirs, and write nothing with no knowledgebase', () => {
    window.localStorage.setItem('liveknowledge:v3:page-tree-opened', '["a"]');
    expect(readOpenedPages('k1').size).toBe(0);
    window.localStorage.setItem('liveknowledge:v3:page-tree-opened', '{"k1":["a",7],"k2":"x"}');
    expect([...readOpenedPages('k1')]).toEqual(['a']);
    expect(readOpenedPages('k2').size).toBe(0);
    writeOpenedPages(null, new Set(['a']));
    expect(readOpenedPages(null).size).toBe(0);
  });

  it('ignore the older record of closed pages, whose meaning was the reverse', () => {
    window.localStorage.setItem('liveknowledge:v2:page-tree-closed', '{"k1":["a"]}');
    expect(readOpenedPages('k1').size).toBe(0);
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
