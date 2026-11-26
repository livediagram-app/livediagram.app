// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { vi } from 'vitest';
import {
  openParentsOf,
  subscribeOpenedPages,
  withParentsOpened,
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

describe('opening the pages above a page', () => {
  // Handbook > Guides > Setup, Notes
  const pages = [{ id: 'h' }, { id: 'g', parent: 'h' }, { id: 's', parent: 'g' }, { id: 'n' }];

  it('adds every page above each one asked about, and answers the same set when nothing changes', () => {
    const none = new Set<string>();
    expect([...withParentsOpened(none, pages, ['s'])].sort()).toEqual(['g', 'h']);
    expect(withParentsOpened(none, pages, ['n', 'h'])).toBe(none);
    const both = new Set(['g', 'h']);
    expect(withParentsOpened(both, pages, ['s'])).toBe(both);
  });

  it('stops at a cycle in a damaged list', () => {
    const loop = [
      { id: 'a', parent: 'b' },
      { id: 'b', parent: 'a' },
    ];
    expect([...withParentsOpened(new Set(), loop, ['a'])]).toEqual(['b']);
  });

  it('keeps them for the knowledgebase and tells the trees on screen', () => {
    const heard = vi.fn();
    const stop = subscribeOpenedPages(heard);
    openParentsOf('k1', pages, ['s']);
    expect([...readOpenedPages('k1')].sort()).toEqual(['g', 'h']);
    expect(heard).toHaveBeenCalledWith('k1', pages, ['s']);
    stop();
    openParentsOf('k2', pages, ['s']);
    expect(heard).toHaveBeenCalledTimes(1);
    openParentsOf(null, pages, ['s']);
    expect(readOpenedPages(null).size).toBe(0);
  });
});
