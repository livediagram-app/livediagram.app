// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StartFromTemplates } from './StartFromTemplates';

// docs/specs/007-editor/start-diagramming.md
afterEach(() => {
  cleanup();
  localStorage.clear();
});

const mount = (mode: 'diagram' | 'facilitate', onTemplate = vi.fn()) =>
  render(
    <StartFromTemplates
      key={mode}
      mode={mode}
      tabId="t1"
      onTemplate={onTemplate}
      onOtherModeTemplate={vi.fn()}
    />,
  );

describe('StartFromTemplates', () => {
  it('names each mode its own start', () => {
    mount('diagram');
    expect(screen.getByRole('heading', { name: 'Start Diagramming' })).toBeTruthy();
    cleanup();
    mount('facilitate');
    expect(screen.getByRole('heading', { name: 'Start Facilitating' })).toBeTruthy();
  });

  it('lands a chosen template, and a blank closes the panel', () => {
    const onTemplate = vi.fn();
    mount('diagram', onTemplate);
    fireEvent.click(document.querySelector('[data-start-card="flowchart"]')!);
    expect(onTemplate).toHaveBeenCalledWith('flowchart');
    fireEvent.click(document.querySelector('[data-start-card="blank"]')!);
    expect(onTemplate).toHaveBeenCalledWith('blank');
    expect(screen.queryByRole('heading', { name: 'Start Diagramming' })).toBeNull();
  });

  it('remembers a close per tab and mode, so switching mode still offers that mode its start', () => {
    mount('diagram');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('heading', { name: 'Start Diagramming' })).toBeNull();
    cleanup();
    mount('diagram');
    expect(screen.queryByRole('heading', { name: 'Start Diagramming' })).toBeNull();
    cleanup();
    mount('facilitate');
    expect(screen.getByRole('heading', { name: 'Start Facilitating' })).toBeTruthy();
  });
});

describe('StartFromTemplates, switching category', () => {
  it('opens the picked category at the top of its cards', () => {
    mount('diagram');
    const scroller = document.querySelector('[data-start-card]')!.closest('.overflow-y-auto')!;
    scroller.scrollTop = 300;
    fireEvent.click(document.querySelector('[data-rail="flowcharts"]')!);
    expect(scroller.scrollTop).toBe(0);
  });
});
