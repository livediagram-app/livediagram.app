import { describe, expect, it, vi } from 'vitest';
import { createTemplateSearch, templateQueryWords } from './template-search';

const TODO = {
  kind: 'todo-list',
  title: 'To-Do List',
  description: 'Tasks to tick off, one by one.',
};
const RETRO = {
  kind: 'retro',
  title: 'Retrospective',
  description: 'What went well, what to change.',
};

describe('templateQueryWords', () => {
  it('splits a query into lower-cased words, leaving out punctuation alone', () => {
    expect(templateQueryWords('  Mind  MAP ')).toEqual(['mind', 'map']);
    expect(templateQueryWords('- , .')).toEqual([]);
    expect(templateQueryWords('')).toEqual([]);
  });
});

describe('createTemplateSearch', () => {
  const words = (kind: string) => (kind === 'retro' ? ['Meetings', 'agile sprint review'] : []);

  it('matches every template on an empty query', () => {
    const matches = createTemplateSearch(words);
    expect(matches(TODO, '')).toBe(true);
    expect(matches(RETRO, ' - ')).toBe(true);
  });

  it('finds a word in the title, description, kind or the words the product gives', () => {
    const matches = createTemplateSearch(words);
    expect(matches(RETRO, 'retrospective')).toBe(true);
    expect(matches(RETRO, 'went WELL')).toBe(true);
    expect(matches(TODO, 'todo-list')).toBe(true);
    expect(matches(RETRO, 'sprint meetings')).toBe(true);
    expect(matches(TODO, 'sprint')).toBe(false);
  });

  it('needs every word typed', () => {
    const matches = createTemplateSearch(words);
    expect(matches(RETRO, 'sprint gantt')).toBe(false);
  });

  it('reads punctuation as a space or drops it, on both sides', () => {
    const matches = createTemplateSearch(words);
    expect(matches(TODO, 'to do')).toBe(true);
    expect(matches(TODO, 'todo')).toBe(true);
    expect(matches(TODO, 'to-do')).toBe(true);
    expect(matches(TODO, 'one-by-one')).toBe(true);
  });

  it('builds each template its words once, however many searches run', () => {
    const wordsOf = vi.fn(words);
    const matches = createTemplateSearch(wordsOf);
    matches(RETRO, 'sprint');
    matches(RETRO, 'review');
    matches(RETRO, '');
    expect(wordsOf).toHaveBeenCalledTimes(1);
  });
});
