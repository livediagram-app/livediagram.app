// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { markPendingFormStart } from '@/lib/pending-form-start';
import { PendingFormStart } from './PendingFormStart';

// A form template's form starts once its tab is open and editable (docs/specs/030-forms/forms.md "Starting a form").

const ctx = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock('@/app/project/[id]/EditorContext', () => ({ useEditorContext: () => ctx.current }));

afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

const editor = (startForm: () => void, over: Record<string, unknown> = {}) => {
  ctx.current = {
    hydrated: true,
    isReadOnly: false,
    can: { level: 'edit' },
    activeTab: { id: 'tab1', locked: false },
    forms: { startForm },
    ...over,
  };
};

describe('PendingFormStart', () => {
  it('starts the waiting form on its tab, once', () => {
    const startForm = vi.fn();
    markPendingFormStart('tab1', 'rsvp');
    editor(startForm);
    const { rerender } = render(<PendingFormStart />);
    rerender(<PendingFormStart />);
    expect(startForm).toHaveBeenCalledTimes(1);
    expect(startForm).toHaveBeenCalledWith('rsvp');
  });

  it('waits while the editor is not ready or may not edit', () => {
    const startForm = vi.fn();
    markPendingFormStart('tab1', 'feedback');
    editor(startForm, { hydrated: false });
    const { rerender } = render(<PendingFormStart />);
    editor(startForm, { isReadOnly: true });
    rerender(<PendingFormStart />);
    editor(startForm, { can: { level: 'participate' } });
    rerender(<PendingFormStart />);
    editor(startForm, { can: { level: 'view' } });
    rerender(<PendingFormStart />);
    expect(startForm).not.toHaveBeenCalled();
    editor(startForm);
    rerender(<PendingFormStart />);
    expect(startForm).toHaveBeenCalledWith('feedback');
  });

  it('does nothing on a tab nothing waits for', () => {
    const startForm = vi.fn();
    editor(startForm);
    render(<PendingFormStart />);
    expect(startForm).not.toHaveBeenCalled();
  });
});
