// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livediagram/document';
import { useTemplateFlow } from './useTemplateFlow';

// A form template picked in the editor (docs/specs/030-forms/forms.md "Starting a form") starts its form on the tab, as
// Start Planning's Forms do, and lays no template elements.

describe('chooseTemplate with a form template', () => {
  it('starts the form on the tab and closes the picker', async () => {
    let tabs: Tab[] = [{ id: 't1', name: '', elements: [] } as Tab];
    const startForm = vi.fn();
    const setTemplatePickerMode = vi.fn();
    const { result } = renderHook(() =>
      useTemplateFlow({
        activeId: 't1',
        tabs,
        templatePickerMode: 'templates',
        selfParticipant: { id: 'me', name: 'Me', color: '#000' } as never,
        getViewportCenter: () => ({ x: 0, y: 0 }),
        commitTabs: (update) => {
          tabs = update(tabs);
        },
        confirmName: vi.fn(),
        setSelectedId: vi.fn(),
        setEditingId: vi.fn(),
        setSelfParticipant: vi.fn(),
        setTemplatePickerMode,
        requestFit: vi.fn(),
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
    expect(setTemplatePickerMode).toHaveBeenCalledWith('welcome');
    expect(tabs[0]!.elements).toEqual([]);
  });
});
