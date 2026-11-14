// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createEditorContext } from './createEditorContext';

const { EditorContext, useEditorContext, useOptionalEditorContext } = createEditorContext<{
  id: string;
}>();

describe('createEditorContext', () => {
  it('hands the provided editor to its consumers', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <EditorContext.Provider value={{ id: 'e1' }}>{children}</EditorContext.Provider>
    );
    expect(renderHook(() => useEditorContext(), { wrapper }).result.current).toEqual({ id: 'e1' });
    expect(renderHook(() => useOptionalEditorContext(), { wrapper }).result.current).toEqual({
      id: 'e1',
    });
  });

  it('answers null outside an editor, and the required read throws', () => {
    expect(renderHook(() => useOptionalEditorContext()).result.current).toBeNull();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useEditorContext())).toThrow(/within an EditorContext.Provider/);
  });
});
