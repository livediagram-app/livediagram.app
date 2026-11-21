import { describe, expect, it } from 'vitest';
import type { ArticleBlock } from '@liveknowledge/document';
import { withStructureAtTop } from './structure-draft';
import { structureAiLine, structureFailureWords, structurePlaceholder } from './structure-words';

// docs/specs/030-knowledgebase/describe-to-set-up.md "Describe Structure on a page".

const para = (id: string, text: string, style?: string): ArticleBlock =>
  ({
    id,
    type: 'paragraph',
    ...(style ? { style } : {}),
    runs: text ? [{ text }] : [],
  }) as ArticleBlock;
const ids = (blocks: readonly ArticleBlock[]) => blocks.map((b) => b.id);

describe('withStructureAtTop', () => {
  const structure = [para('s1', 'Heading', 'h2'), para('s2', 'What goes here.')];
  let n = 0;
  const newId = () => `n${++n}`;

  it('puts the structure under the Title of an empty page, its empty lines gone, an empty line last', () => {
    n = 0;
    const out = withStructureAtTop(
      [para('t', 'Deploys', 'title'), para('e1', ''), para('e2', ' ')],
      structure,
      newId,
    );
    expect(ids(out)).toEqual(['t', 's1', 's2', 'n1']);
  });

  it('keeps writing someone typed meanwhile, under the structure', () => {
    n = 0;
    const out = withStructureAtTop(
      [
        para('t', 'Deploys', 'title'),
        para('sub', 'Sub', 'subtitle'),
        para('w', 'Typed.'),
        para('e', ''),
      ],
      structure,
      newId,
    );
    expect(ids(out)).toEqual(['t', 'sub', 's1', 's2', 'w', 'e', 'n1']);
  });

  it('starts the page when it has no Title block', () => {
    n = 0;
    expect(ids(withStructureAtTop([], structure, newId))).toEqual(['s1', 's2', 'n1']);
  });
});

describe('the words', () => {
  it("says the person's choice of built-in AI over the team's key, else what Ask says", () => {
    const keyed = { hasKey: true, builtIn: true };
    expect(structureAiLine(null, 'key')).toBeNull();
    expect(structureAiLine(keyed, 'built-in')).toBe('Uses built-in AI');
    expect(structureAiLine(keyed, 'key')).toBe("Uses your team's key");
    expect(structureAiLine({ hasKey: false, builtIn: true }, 'built-in')).toBe('Uses built-in AI');
    expect(structureAiLine({ hasKey: false, builtIn: false }, 'key')).toBeNull();
  });

  it('builds the placeholder from the title', () => {
    expect(structurePlaceholder(' Deploys ')).toBe('What goes on “Deploys”, in your own words.');
    expect(structurePlaceholder('')).toBe('In your own words.');
  });

  it('words every failure, with AI Settings only for whoever may open it', () => {
    const editor = { manageAi: true };
    const other = { manageAi: false };
    expect(structureFailureWords('built-in-unavailable', editor)).toMatchObject({
      title: 'Built-In AI Is Not Set Up Here',
      settings: true,
    });
    expect(structureFailureWords('built-in-unavailable', other).text).toContain('ask an Editor');
    expect(structureFailureWords('built-in-limit', other)).toMatchObject({
      title: "You Have Used Today's 10 Built-In Drafts",
      settings: false,
    });
    expect(structureFailureWords('person-limit', editor).title).toBe(
      'You Have Asked for 10 Structures This Hour',
    );
    expect(structureFailureWords('knowledgebase-limit', editor).title).toBe(
      'This Knowledgebase Has Had Its 50 Structures Today',
    );
    expect(structureFailureWords('no-purpose', editor).title).toBe('Say What the Page Is For');
    expect(structureFailureWords('needs_a_person', editor).title).toBe(
      'Only a Signed-In Editor Can Do This',
    );
    expect(structureFailureWords('network', editor).title).toBe('The Request Could Not Be Sent');
    for (const kind of ['no-structure', 'built-in-failed', 'page-gone'])
      expect(structureFailureWords(kind, editor).title).toBe('The AI Could Not Draft This Page');
    expect(structureFailureWords('ask_unavailable', editor).title).toBe(
      'Describe Structure Is Not Available Right Now',
    );
    const bad = structureFailureWords('bad-key', { ...editor, provider: 'openai' });
    expect(bad.settings).toBe(true);
    expect(bad.title).toContain('OpenAI');
    expect(structureFailureWords('overloaded', editor).text).not.toMatch(/ask again/i);
  });
});
