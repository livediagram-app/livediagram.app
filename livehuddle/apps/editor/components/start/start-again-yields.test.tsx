// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

// docs/specs/007-editor/start-diagramming.md "Bringing it back": an empty tab's Show Templates steps aside while a
// mode's message (an armed tool's Cancel) is up, as both stand in the same place under the strip or the Draw dock.
afterEach(() => {
  cleanup();
  localStorage.clear();
  document.body.innerHTML = '';
});

describe('Show Templates and a mode message', () => {
  it('globals.css hides the yielding message while a mode message is on the page', () => {
    const css = readFileSync(join(__dirname, '../../app/globals.css'), 'utf8');
    expect(css).toMatch(
      /body:has\(\[data-mode-message\]\) \[data-yields-to-mode\] \{\s*display: none;\s*\}/,
    );
  });
});
