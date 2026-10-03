// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MADE_BY_AI_LABEL, MadeByAiPill, isMadeByAi } from './MadeByAiPill';

afterEach(cleanup);

describe('isMadeByAi', () => {
  it('reads a set provenance as made by AI, and none as made by a person', () => {
    expect(isMadeByAi({ source: 'mcp' })).toBe(true);
    expect(isMadeByAi({ source: 'ai' })).toBe(true);
    expect(isMadeByAi({ source: null })).toBe(false);
    expect(isMadeByAi({})).toBe(false);
  });
});

describe('MadeByAiPill', () => {
  it('says it in words, not colour alone', () => {
    render(<MadeByAiPill />);
    expect(screen.getByText(MADE_BY_AI_LABEL)).toBeTruthy();
  });
});
