import { describe, expect, it } from 'vitest';
import { headlineCase, titleCase } from './title-case';

describe('titleCase', () => {
  it('raises every word and leaves the rest of each word alone', () => {
    expect(titleCase('flowchart')).toBe('Flowchart');
    expect(titleCase('arrow to the right')).toBe('Arrow To The Right');
    expect(titleCase('PNG')).toBe('PNG');
  });
});

describe('headlineCase', () => {
  it('raises each word but keeps short articles and prepositions lowercase', () => {
    expect(headlineCase('Thumbs up')).toBe('Thumbs Up');
    expect(headlineCase('Arrow to the right')).toBe('Arrow to the Right');
    expect(headlineCase('Empty the box')).toBe('Empty the Box');
  });

  it('raises a small word when it leads', () => {
    expect(headlineCase('a list')).toBe('A List');
  });

  it('never lowers letters a word already has', () => {
    expect(headlineCase('OK hand')).toBe('OK Hand');
    expect(headlineCase('Q&A board')).toBe('Q&A Board');
    expect(headlineCase('YouTube embed')).toBe('YouTube Embed');
  });
});
