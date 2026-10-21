// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Tab } from '@liveplanner/document';
import { useTemplateFlow } from './useTemplateFlow';

// A form template picked in the editor (docs/specs/030-forms/forms.md "Starting a form") starts its form on the tab, as
// Start Planning's Forms do, and lays no template elements.

describe('chooseTemplate with a form template', () => {
  it('starts the form on the tab', async () => {
    let tabs: Tab[] = [{ id: 't1', name: '', elements: [] }];
    const startForm = vi.fn();
    const { result } = renderHook(() =>
      useTemplateFlow({
        activeId: 't1',
        tabs,
        selfParticipant: { id: 'me', name: 'Me', color: '#000' } as never,
        documentName: 'Q3 roadmap',
        nameDocument: vi.fn(),
        getViewportCenter: () => ({ x: 0, y: 0 }),
        commitTabs: (update) => {
          tabs = update(tabs);
        },
        confirmName: vi.fn(),
        setSelectedId: vi.fn(),
        setEditingId: vi.fn(),
        setSelfParticipant: vi.fn(),
        setIdentityPromptOpen: vi.fn(),
        requestFit: vi.fn(),
        putToolDown: vi.fn(),
        markTabLoaded: vi.fn(),
        bringCardTypes: vi.fn(),
        seedCards: vi.fn(),
        startForm,
      }),
    );
    await act(async () => {
      await result.current.chooseTemplate('rsvp-form');
    });
    expect(startForm).toHaveBeenCalledWith('rsvp');
    expect(tabs[0]!.elements).toEqual([]);
  });
});
