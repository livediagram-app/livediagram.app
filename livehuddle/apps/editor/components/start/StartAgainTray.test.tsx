// @vitest-environment jsdom
import { cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

// docs/specs/007-editor/start-diagramming.md "Bringing it back"
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('pillPlace', () => {
  it('stands the pill clear of Draw’s dock: under a top dock, over a bottom one', async () => {
    const { pillPlace } = await import('./StartAgainTray');
    expect(pillPlace({ top: 12, bottom: 60 }, 900)).toEqual({ top: 70 });
    expect(pillPlace({ top: 830, bottom: 880 }, 900)).toEqual({ bottom: 80 });
    expect(pillPlace(null, 900)).toEqual({ top: 80 });
  });
});
