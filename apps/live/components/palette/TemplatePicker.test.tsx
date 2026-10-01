// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

import type { Participant } from '@/lib/identity';
import { TemplatePicker } from './TemplatePicker';

// jsdom has no ResizeObserver; the height-animated boxes only need one to exist.
beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

// Nor scrollTo / scrollIntoView, which the template shelf's carousel uses.
Element.prototype.scrollTo ??= () => {};
Element.prototype.scrollIntoView ??= () => {};

const participant: Participant = { id: 'p1', name: 'Ada', color: '#0ea5e9', status: 'online' };

// docs/specs/007-editor/new-document-route.md "Start Blank": it lives on the outside surfaces that link
// to /new?blank=1; inside the wizard the footer's Skip commits the same blank defaults.
describe('TemplatePicker, the welcome wizard', () => {
  it('has no Start Blank or Just Draw button of its own', () => {
    render(
      <TemplatePicker
        mode="welcome"
        participant={participant}
        currentThemeId="brand"
        onPick={vi.fn()}
        onSkip={() => {}}
      />,
    );
    expect(screen.queryByRole('button', { name: /just draw/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^start blank$/i })).toBeNull();
  });
});

// docs/specs/007-editor/new-document-route.md "Escape backs out".
describe('TemplatePicker, Escape', () => {
  const renderWelcome = () => {
    const onPick = vi.fn();
    const onSkip = vi.fn();
    const onBackOut = vi.fn();
    render(
      <TemplatePicker
        mode="welcome"
        participant={participant}
        currentThemeId="brand"
        onPick={onPick}
        onSkip={onSkip}
        onBackOut={onBackOut}
      />,
    );
    return { onPick, onSkip, onBackOut };
  };

  it('backs out of the wizard from the Template step, creating nothing', () => {
    const { onPick, onSkip, onBackOut } = renderWelcome();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onBackOut).toHaveBeenCalledTimes(1);
    expect(onSkip).not.toHaveBeenCalled();
    expect(onPick).not.toHaveBeenCalled();
  });

  it('steps back from Location to Template first', () => {
    const { onBackOut } = renderWelcome();
    fireEvent.click(screen.getByRole('button', { name: /^Next/ }));
    expect(screen.getByText(/Location/)).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onBackOut).not.toHaveBeenCalled();
    expect(screen.getByRole('searchbox', { name: 'Search templates' })).toBeTruthy();
  });

  it('clears a search first', () => {
    const { onBackOut } = renderWelcome();
    const search = screen.getByRole('searchbox', { name: 'Search templates' });
    fireEvent.change(search, { target: { value: 'kanban' } });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect((search as HTMLInputElement).value).toBe('');
    expect(onBackOut).not.toHaveBeenCalled();
  });

  it('backs out with the X too, from any step, creating nothing', () => {
    const { onPick, onSkip, onBackOut } = renderWelcome();
    fireEvent.click(screen.getByRole('button', { name: /^Next/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onBackOut).toHaveBeenCalledTimes(1);
    expect(onSkip).not.toHaveBeenCalled();
    expect(onPick).not.toHaveBeenCalled();
  });

  it('keeps closing as before without a back-out (Quick Start over the canvas)', () => {
    const onSkip = vi.fn();
    render(
      <TemplatePicker
        mode="templates"
        participant={participant}
        currentThemeId="brand"
        onPick={vi.fn()}
        onSkip={onSkip}
      />,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});
