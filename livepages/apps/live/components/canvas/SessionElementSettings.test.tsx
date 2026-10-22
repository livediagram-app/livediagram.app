// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { SessionButtonConfig } from '@livepages/document';
import { SessionElementSettings } from './SessionElementSettings';

// A session button's settings read its stored config as the press reads it (docs/specs/012-collaboration/
// session-button.md): a value that arrived malformed (an API write, an import) shows as its default, never
// failing the menu.

vi.mock('@/app/document/[id]/EditorContext', () => ({
  useEditorContext: () => ({
    startTimer: vi.fn(),
    startVote: vi.fn(),
    layers: [],
    activeLayerId: null,
  }),
}));

afterEach(cleanup);

const junk = (config: Record<string, unknown>) => config as unknown as SessionButtonConfig;

describe('SessionElementSettings with a malformed config', () => {
  it('shows a tool it does not know as the timer the button starts', () => {
    render(<SessionElementSettings config={junk({ tool: 'poll' })} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /^Start .* countdown$/ })).toBeTruthy();
  });

  it('shows a timer and a vote whose numbers are not numbers', () => {
    expect(() =>
      render(
        <SessionElementSettings
          config={junk({ tool: 'timer', minutes: 'x' })}
          onChange={vi.fn()}
        />,
      ),
    ).not.toThrow();
    cleanup();
    expect(() =>
      render(
        <SessionElementSettings config={junk({ tool: 'vote', dots: {} })} onChange={vi.fn()} />,
      ),
    ).not.toThrow();
  });
});
