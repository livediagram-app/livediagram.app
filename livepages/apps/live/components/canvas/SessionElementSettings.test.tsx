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
    livePoll: { startPoll: vi.fn() },
    pollCollaborators: [],
    documentShareable: false,
    documentTeamId: null,
    startTimer: vi.fn(),
    startVote: vi.fn(),
    layers: [],
    activeLayerId: null,
  }),
}));

afterEach(cleanup);

const junk = (config: Record<string, unknown>) => config as unknown as SessionButtonConfig;

describe('SessionElementSettings with a malformed config', () => {
  it('shows a poll whose question is not text and whose answers hold a number', () => {
    render(
      <SessionElementSettings
        config={junk({
          tool: 'poll',
          style: 'choice',
          question: -1,
          options: [1, 'Tea', 'Coffee'],
        })}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByDisplayValue('Tea')).toBeTruthy();
    expect(screen.queryByDisplayValue('-1')).toBeNull();
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
