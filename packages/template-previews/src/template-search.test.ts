import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { describe, expect, it, vi } from 'vitest';
import {
  createTemplateSearch,
  templateQueryWords,
  typoAllowance,
  withinEdits,
} from './template-search';

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

describe('typoAllowance', () => {
  it('allows none under four letters, one under eight, two from eight', () => {
    expect([0, 3, 4, 7, 8, 20].map(typoAllowance)).toEqual([0, 0, 1, 1, 2, 2]);
  });
});

describe('withinEdits', () => {
  it('counts a letter added, dropped, changed or two swapped as one edit', () => {
    expect(withinEdits('wireframe', 'wireframe', 0)).toBe(true);
    expect(withinEdits('wirefrme', 'wireframe', 1)).toBe(true);
    expect(withinEdits('wireframee', 'wireframe', 1)).toBe(true);
    expect(withinEdits('wireframa', 'wireframe', 1)).toBe(true);
    expect(withinEdits('wirefarme', 'wireframe', 1)).toBe(true);
    expect(withinEdits('wirefrmee', 'wireframe', 1)).toBe(false);
    expect(withinEdits('wirefrmee', 'wireframe', 2)).toBe(true);
  });

  it('gives up on a length gap or a row already over the limit', () => {
    expect(withinEdits('wire', 'wireframe', 2)).toBe(false);
    expect(withinEdits('abcdef', 'uvwxyz', 2)).toBe(false);
  });
});

describe('createTemplateSearch, typos', () => {
  const WIRE = {
    kind: 'wireframe-website',
    title: 'Website Wireframe',
    description: 'Lay out a page before building it.',
  };
  const matches = createTemplateSearch<string>(() => ['kanban', 'flowchart']);

  it('finds a template one edit away from a word of four letters or more', () => {
    expect(matches(WIRE, 'wirefrme')).toBe(true);
    expect(matches(WIRE, 'kanbn')).toBe(true);
    expect(matches(WIRE, 'flowchrt')).toBe(true);
    expect(matches(WIRE, 'webiste')).toBe(true);
  });

  it('allows two edits only from eight letters', () => {
    expect(matches(WIRE, 'wirefrmme')).toBe(true);
    expect(matches(WIRE, 'kanbna')).toBe(true);
    expect(matches(WIRE, 'kanbnaa')).toBe(false);
  });

  it('keeps short words exact and still needs every word', () => {
    expect(matches(WIRE, 'wirf')).toBe(false);
    expect(matches(WIRE, 'pge')).toBe(false);
    expect(matches(WIRE, 'wirefrme gantt')).toBe(false);
    expect(matches(WIRE, 'qqqqzzzz')).toBe(false);
  });

  it('ranks by exact: a typo is not an exact find', () => {
    expect(matches.exact(WIRE, 'wireframe')).toBe(true);
    expect(matches.exact(WIRE, 'wire')).toBe(true);
    expect(matches.exact(WIRE, 'wirefrme')).toBe(false);
    expect(matches(WIRE, 'wirefrme')).toBe(true);
  });

  it('stays within a CPU budget per keystroke over a whole catalogue and a long query', () => {
    const catalogue = Array.from({ length: 400 }, (_, i) => ({
      kind: `kind-${i}`,
      title: `Template number ${i} wireframe flowchart`,
      description:
        'A description with a good many words in it so each template holds plenty to compare.',
    }));
    const long = `wirefrme ${'x'.repeat(30000)}`;
    const typed = ['w', 'wi', 'wir', 'wire', 'wiref', 'wirefr', 'wirefrm', 'wirefrme', long];
    const ms = cpuMsOf(() => {
      for (const q of typed) for (const t of catalogue) matches(t, q);
    });
    expect(ms).toBeLessThan(cpuBudgetMs(1500));
  });
});
