import { describe, expect, it } from 'vitest';
import { TEMPLATES } from './templates';
import { templateTabs } from './build-template';

// A template's description says how many tabs it makes only when that is so:
// agents read it in list_templates before making a document.
const WORDS: Record<string, number> = { two: 2, three: 3, four: 4, five: 5, six: 6 };

describe('template descriptions', () => {
  it('count the tabs each template makes', () => {
    const wrong: string[] = [];
    for (const t of TEMPLATES) {
      const said = /\b(two|three|four|five|six) tabs\b/i.exec(t.description)?.[1]?.toLowerCase();
      if (!said) continue;
      const made = templateTabs(t.kind).length;
      if (WORDS[said] !== made) wrong.push(`${t.kind}: says ${said}, makes ${made}`);
    }
    expect(wrong).toEqual([]);
  });
});
