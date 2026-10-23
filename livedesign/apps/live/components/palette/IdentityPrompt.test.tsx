// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Participant } from '@/lib/identity';
import { IdentityPrompt } from './IdentityPrompt';

// The visitor name prompt (docs/specs/007-editor/new-design-route.md): a visitor confirms the name others will see.
afterEach(cleanup);

const ada: Participant = { id: 'p1', name: 'Ada', color: '#0ea5e9', status: 'online' };

function prompt(over: Partial<Parameters<typeof IdentityPrompt>[0]> = {}) {
  const onJoin = vi.fn();
  const onCancel = vi.fn();
  const view = render(
    <IdentityPrompt participant={ada} onJoin={onJoin} onCancel={onCancel} {...over} />,
  );
  return { onJoin, onCancel, view };
}

describe('IdentityPrompt', () => {
  it('greets the visitor by the design', () => {
    prompt({ designName: '  API sketch ' });
    expect(screen.getByRole('heading', { name: "Welcome to 'API sketch'" })).toBeTruthy();
    cleanup();
    prompt();
    expect(screen.getByRole('heading', { name: 'Welcome to this design' })).toBeTruthy();
  });

  it('joins with the name typed, or the one they had when left empty', () => {
    const { onJoin } = prompt();
    const field = screen.getByLabelText('Your name');
    fireEvent.change(field, { target: { value: 'Grace' } });
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(onJoin).toHaveBeenLastCalledWith('Grace');
    fireEvent.change(field, { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(onJoin).toHaveBeenLastCalledWith('Ada');
  });

  it('follows the participant until the visitor types', () => {
    const { view, onJoin, onCancel } = prompt({ participant: { ...ada, name: 'Guest' } });
    view.rerender(<IdentityPrompt participant={ada} onJoin={onJoin} onCancel={onCancel} />);
    expect(screen.getByLabelText('Your name')).toHaveProperty('value', 'Ada');
  });

  it("locks a signed-in visitor's account name", () => {
    prompt({ lockedName: 'Ada Lovelace' });
    const field = screen.getByLabelText('Your name') as HTMLInputElement;
    expect(field.value).toBe('Ada Lovelace');
    expect(field.readOnly).toBe(true);
    expect(screen.queryByRole('button', { name: 'Generate a different name' })).toBeNull();
  });

  it('cancels with Cancel, the X and Escape', () => {
    const { onCancel, onJoin } = prompt();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(3);
    expect(onJoin).not.toHaveBeenCalled();
  });
});
