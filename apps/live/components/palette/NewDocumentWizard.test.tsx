// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EditorMode } from '@livediagram/document';
import { NewDocumentWizard } from './NewDocumentWizard';

// docs/specs/007-editor/new-document-route.md "One-step wizard": the wizard asks what you are making, and choosing a
// mode creates the document at once; it never asks where the document goes or what it is called.
afterEach(cleanup);

function wizard(over: { busy?: boolean; initialMode?: EditorMode | null } = {}) {
  const props = { onCreate: vi.fn(), onSkip: vi.fn(), onBackOut: vi.fn(), onOpenExisting: vi.fn() };
  render(<NewDocumentWizard {...props} {...over} />);
  return props;
}

describe('NewDocumentWizard', () => {
  it('asks only what you are making: no Location step, no name, no rail', () => {
    wizard();
    expect(screen.getByRole('group', { name: 'What are you making?' })).toBeTruthy();
    expect(screen.queryByText('Location')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Next/ })).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('radiogroup', { name: 'Save location' })).toBeNull();
  });

  it("creates a chosen mode's blank at once", () => {
    const p = wizard();
    fireEvent.click(screen.getByRole('button', { name: /^Drawing:/ }));
    expect(p.onCreate).toHaveBeenCalledWith('whiteboard');
  });

  it('creates from the number keys too', () => {
    const p = wizard();
    fireEvent.keyDown(screen.getByRole('group', { name: 'What are you making?' }), { key: '5' });
    expect(p.onCreate).toHaveBeenCalledWith('blank-plan');
  });

  it("creates the preset mode's blank from Create, else a Blank Diagram", () => {
    const p = wizard({ initialMode: 'illustrate' });
    expect(screen.getByRole('button', { name: /^Illustrate:/ }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(p.onCreate).toHaveBeenCalledWith('blank-illustration');
    cleanup();
    const q = wizard();
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(q.onCreate).toHaveBeenCalledWith('blank');
  });

  it('Skips to the blank defaults', () => {
    const p = wizard();
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(p.onSkip).toHaveBeenCalledTimes(1);
    expect(p.onCreate).not.toHaveBeenCalled();
  });

  it('backs out with Escape and the X, creating nothing', () => {
    const p = wizard();
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(p.onBackOut).toHaveBeenCalledTimes(2);
    expect(p.onCreate).not.toHaveBeenCalled();
    expect(p.onSkip).not.toHaveBeenCalled();
  });

  it('opens the Explorer from Open Existing Document', () => {
    const p = wizard();
    fireEvent.click(screen.getByRole('button', { name: 'Open Existing Document' }));
    expect(p.onOpenExisting).toHaveBeenCalledTimes(1);
  });

  it('while creating, shows it, and creates nothing more nor backs out', () => {
    const p = wizard({ busy: true, initialMode: 'plan' });
    expect(screen.getByRole('button', { name: /Creating/ })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: /^Plan:/ }).getAttribute('aria-busy')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: /^Drawing:/ }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(p.onCreate).not.toHaveBeenCalled();
    expect(p.onBackOut).not.toHaveBeenCalled();
  });

  it('has no Start Blank or Just Draw button of its own', () => {
    wizard();
    expect(screen.queryByRole('button', { name: /just draw/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^start blank$/i })).toBeNull();
  });
});
