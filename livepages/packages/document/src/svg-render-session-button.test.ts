import { describe, expect, it } from 'vitest';
import { createShape } from './factories';
import { svgBoxed } from './svg-render';
import type { BoxedElement } from './index';

// docs/specs/012-collaboration/session-button.md: a Session button in an image draws as the canvas does.
const button = (session?: unknown) =>
  ({
    ...createShape('session-button', 0, 0),
    id: 's',
    label: '',
    session,
  }) as unknown as BoxedElement;

describe('a Session button in an export', () => {
  it('draws the timer for a button with no tool, or one it does not know, as the canvas does', () => {
    for (const session of [undefined, { tool: 'poll' }]) {
      const svg = svgBoxed(button(session));
      expect(svg, JSON.stringify(session)).toContain('5:00');
    }
  });
});
