// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { blocksToDoc } from './article-convert';
import {
  clearLivePageTitle,
  followLivePageTitle,
  noteLivePageTitle,
  titleTextOf,
  useLivePageTitle,
} from './live-page-title';

// docs/specs/030-knowledgebase/knowledgebases-and-pages.md "Name": the tree names the open page from its Title as
// each key lands.
afterEach(clearLivePageTitle);

describe('titleTextOf', () => {
  it('reads the Title paragraph, and none where the writing has no Title', () => {
    const doc = blocksToDoc([
      {
        id: 't',
        type: 'paragraph',
        style: 'title',
        runs: [{ text: 'Release ' }, { text: 'Process' }],
      },
      { id: 'p', type: 'paragraph', runs: [{ text: 'Body' }] },
    ]);
    expect(titleTextOf(doc)).toBe('Release Process');
    expect(
      titleTextOf(blocksToDoc([{ id: 'p', type: 'paragraph', runs: [{ text: 'Body' }] }])),
    ).toBeNull();
  });
});

describe('useLivePageTitle', () => {
  it('gives the open page the typed title, and no other row', () => {
    const open = renderHook(() => useLivePageTitle(true));
    const other = renderHook(() => useLivePageTitle(false));
    expect(open.result.current).toBeNull();
    act(() => noteLivePageTitle('Release'));
    expect(open.result.current).toBe('Release');
    expect(other.result.current).toBeNull();
    act(() => followLivePageTitle('Release Notes'));
    expect(open.result.current).toBe('Release Notes');
    act(() => clearLivePageTitle());
    expect(open.result.current).toBeNull();
  });

  it('follows other changes only once the Title was typed here', () => {
    const open = renderHook(() => useLivePageTitle(true));
    act(() => followLivePageTitle('From a Peer'));
    expect(open.result.current).toBeNull();
    act(() => noteLivePageTitle(''));
    expect(open.result.current).toBe('');
    act(() => followLivePageTitle(null));
    expect(open.result.current).toBe('');
  });
});
