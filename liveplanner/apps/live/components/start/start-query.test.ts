// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { handStartQuery, takeStartQuery } from './start-query';

// docs/specs/007-editor/new-project-route.md "Choosing a mode"
describe('start query', () => {
  it('hands a search to the next start panel, once', () => {
    handStartQuery('mind map');
    expect(takeStartQuery()).toBe('mind map');
    expect(takeStartQuery()).toBe('');
  });

  it('clears a stale one when none is handed', () => {
    handStartQuery('old');
    handStartQuery(null);
    expect(takeStartQuery()).toBe('');
  });
});
