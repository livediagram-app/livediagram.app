// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  articleHandleOf,
  registerArticleHandle,
  useArticleHandle,
  type ArticleEditorHandle,
} from './article-editor-store';

// docs/specs/007-editor/article-pages.md "The page toolbar": the docked toolbar re-reads its handle as
// an editor registers, so the strip fills on load without a hover.
describe('useArticleHandle', () => {
  it('follows an editor as it registers and as it goes', () => {
    const { result } = renderHook(() => useArticleHandle('f-seq'));
    expect(result.current).toBeUndefined();
    const handle = { flow: 'f-seq' } as ArticleEditorHandle;
    let off = () => {};
    act(() => {
      off = registerArticleHandle(handle);
    });
    expect(result.current).toBe(handle);
    expect(articleHandleOf('f-seq')).toBe(handle);
    act(() => off());
    expect(result.current).toBeUndefined();
  });

  it('is nothing for no flow', () => {
    expect(renderHook(() => useArticleHandle(undefined)).result.current).toBeUndefined();
  });
});
