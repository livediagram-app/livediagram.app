// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Callout, CALLOUT_TONE } from './Callout';

// liveworkspace/docs/specs/016-notifications/callouts.md

afterEach(cleanup);

describe('Callout', () => {
  it('draws each tone with its surface, small by default', () => {
    for (const tone of ['info', 'success', 'warning', 'error'] as const) {
      const { container } = render(<Callout tone={tone}>Said</Callout>);
      const box = container.firstElementChild!;
      expect(box.getAttribute('data-callout')).toBe(tone);
      for (const c of CALLOUT_TONE[tone].split(' ')) expect(box.classList).toContain(c);
      expect(box.classList).toContain('text-xs');
      cleanup();
    }
  });

  it('medium is 14px; floating adds a shadow and a solid dark surface; className only places', () => {
    const { container } = render(
      <Callout tone="warning" size="md" floating className="mt-3">
        Locked
      </Callout>,
    );
    const box = container.firstElementChild!;
    expect(box.classList).toContain('text-sm');
    expect(box.classList).toContain('shadow-lg');
    expect(box.classList).toContain('dark:bg-amber-950');
    expect(box.classList).not.toContain('dark:bg-amber-500/10');
    expect(box.classList).toContain('mt-3');
  });

  it('a title over the message, one action and a close', () => {
    const retry = vi.fn();
    const close = vi.fn();
    render(
      <Callout
        tone="error"
        role="alert"
        title="Couldn’t save"
        action={{ label: 'Try Again', onSelect: retry }}
        onClose={close}
      >
        Check your connection.
      </Callout>,
    );
    const box = screen.getByRole('alert');
    expect(box.textContent).toContain('Couldn’t save');
    expect(box.textContent).toContain('Check your connection.');
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(retry).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });

  it('as a p, its parts are spans; a disabled action does not run', () => {
    const run = vi.fn();
    const { container } = render(
      <Callout
        tone="info"
        as="p"
        title="Note"
        action={{ label: 'Go', onSelect: run, disabled: true }}
      >
        Text
      </Callout>,
    );
    const p = container.querySelector('p')!;
    expect(p.querySelector('div')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(run).not.toHaveBeenCalled();
  });

  it('an action with a reason stays focusable, says it is unavailable, and does not run', () => {
    const run = vi.fn();
    render(
      <Callout tone="warning" action={{ label: 'Split', onSelect: run, reason: 'Locked' }}>
        Too long
      </Callout>,
    );
    const button = screen.getByRole('button', { name: 'Split' });
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.hasAttribute('disabled')).toBe(false);
    fireEvent.click(button);
    expect(run).not.toHaveBeenCalled();
  });
});
