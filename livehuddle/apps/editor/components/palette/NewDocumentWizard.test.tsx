// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NewDocumentWizard } from './NewDocumentWizard';

// docs/specs/007-editor/new-document-route.md "One-step wizard": with one mode there is no question, so Create makes a
// Blank Space at once; it never asks where the document goes or what it is called.
afterEach(cleanup);

function wizard(over: { busy?: boolean } = {}) {
  const props = { onCreate: vi.fn(), onSkip: vi.fn(), onBackOut: vi.fn(), onOpenExisting: vi.fn() };
  render(<NewDocumentWizard {...props} {...over} />);
  return props;
}

describe('NewDocumentWizard', () => {
  it('asks nothing: no mode, no Location step, no name, no rail', () => {
    wizard();
    expect(screen.queryByRole('group', { name: 'What are you making?' })).toBeNull();
    expect(screen.queryByText('Location')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Next/ })).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('radiogroup', { name: 'Save location' })).toBeNull();
  });

  it('creates a Blank Space from Create', () => {
    const p = wizard();
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(p.onCreate).toHaveBeenCalledWith('blank-session');
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

  it('opens the Explorer from Open Existing Space', () => {
    const p = wizard();
    fireEvent.click(screen.getByRole('button', { name: 'Open Existing Space' }));
    expect(p.onOpenExisting).toHaveBeenCalledTimes(1);
  });

  it('while creating, shows it, and creates nothing more nor backs out', () => {
    const p = wizard({ busy: true });
    const create = screen.getByRole('button', { name: /Creating/ });
    expect(create.getAttribute('aria-busy')).toBe('true');
    fireEvent.click(create);
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
