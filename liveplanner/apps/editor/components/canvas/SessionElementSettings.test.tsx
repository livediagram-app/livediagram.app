// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { SessionButtonConfig } from '@liveplanner/project';
import { SessionElementSettings } from './SessionElementSettings';

// A session button's settings read its stored config as the press reads it (docs/specs/012-collaboration/
// session-button.md): a value that arrived malformed (an API write, an import) shows as its default, never
// failing the menu.

vi.mock('@/app/project/[id]/EditorContext', () => ({
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
