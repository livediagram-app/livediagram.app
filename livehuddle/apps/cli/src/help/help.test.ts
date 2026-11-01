import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { COMMAND_ALIASES, defineVerb, RESOURCES, TOP_LEVEL, VERBS } from '@livediagram/agent-verbs';
import { estimateTokens } from '@livediagram/document-views';
import {
  HELP_RESOURCE_MAX_TOKENS,
  HELP_TOP_MAX_TOKENS,
  HELP_VERB_MAX_TOKENS,
  resourceHelp,
  topHelp,
  verbHelp,
} from './help';

describe('help', () => {
  it('keeps the top level within its budget and names every resource', () => {
    const text = topHelp();
    expect(estimateTokens(text)).toBeLessThanOrEqual(HELP_TOP_MAX_TOKENS);
    const named = (word: string) => new RegExp(`(^|[ ,])${word}([ ,(]|$)`, 'm').test(text);
    for (const word of [
      ...RESOURCES.map((r) => r.name),
      ...TOP_LEVEL,
      ...Object.keys(COMMAND_ALIASES),
    ])
      expect(named(word), word).toBe(true);
    expect(text).toContain('document (doc)');
    expect(text).toMatch(
      /\n {2}presence +set, clear\n {2}wait, watch +block until, or stream, comments and changes\n/,
    );
  });

  it('keeps every resource and every verb within its budget', () => {
    for (const r of RESOURCES)
      expect(estimateTokens(resourceHelp(r.name))).toBeLessThanOrEqual(HELP_RESOURCE_MAX_TOKENS);
    for (const v of VERBS)
      expect(estimateTokens(verbHelp(v))).toBeLessThanOrEqual(HELP_VERB_MAX_TOKENS);
  });

  it("shows a verb's usage, flags, examples and what it prints", () => {
    const view = verbHelp(VERBS.find((v) => v.id === 'tab.view')!);
    expect(view).toContain('Usage: livediagram tab view <doc> [flags]');
    expect(view).toContain('  --budget <n>  Fit the view to about this many tokens');
    expect(view).toContain('  --coarse  layout: rows instead of geometry');
    expect(view).toContain('  --view <outline|graph|layout|comments|show|find>');
    expect(view).toContain('Prints: the view as the api serves it');
    expect(verbHelp(VERBS.find((v) => v.id === 'guide')!)).toContain(
      'Usage: livediagram guide [topic]',
    );
    expect(verbHelp(VERBS.find((v) => v.id === 'skill.print')!)).toContain(
      'Usage: livediagram skill print\n',
    );
  });
});

describe('verb help without a CLI projection', () => {
  it('shows the flags and no examples', () => {
    const bare = defineVerb({
      id: 'probe.bare',
      summary: 's',
      description: 'Does a thing.',
      behaviour: 'read',
      input: z.object({ name: z.string() }),
      output: z.object({}),
    });
    expect(verbHelp(bare)).toBe(
      'Does a thing.\n\nUsage: livediagram probe bare [flags]\n\nFlags\n  --name <text>  \n',
    );
  });
});

describe('help for writes', () => {
  it('shows a rest positional, a short flag, and the edit alias', () => {
    expect(verbHelp(VERBS.find((v) => v.id === 'element.set')!)).toContain(
      'Usage: livediagram element set <doc> <words…> [flags]',
    );
    expect(verbHelp(VERBS.find((v) => v.id === 'changeset.apply')!)).toContain(
      '  -f, --file <text>  The file to send, or - for stdin',
    );
    expect(topHelp()).toMatch(/\n {2}changeset +apply \(edit\), ls, show, revert\n/);
  });
});
