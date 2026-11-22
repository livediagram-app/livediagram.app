import { afterEach, describe, expect, it } from 'vitest';
import {
  clearTitleFocus,
  newKnowledgebaseTakesCaret,
  takeTitleFocus,
  wantTitleFocus,
} from './page-title-focus';

afterEach(clearTitleFocus);

describe('the Title focus ask', () => {
  it('is spent by its answer, and answers only the page asked for', () => {
    wantTitleFocus('a');
    expect(takeTitleFocus('b')).toBe(false);
    expect(takeTitleFocus('a')).toBe(true);
    expect(takeTitleFocus('a')).toBe(false);
  });
});

describe('newKnowledgebaseTakesCaret', () => {
  it('is true for no template and for a blank one, which /new?blank=1 names', () => {
    expect(newKnowledgebaseTakesCaret(null)).toBe(true);
    expect(newKnowledgebaseTakesCaret('blank')).toBe(true);
  });

  it('is false for a template that brings its own writing', () => {
    expect(newKnowledgebaseTakesCaret('article')).toBe(false);
  });
});
