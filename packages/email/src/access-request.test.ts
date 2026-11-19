import { describe, expect, it } from 'vitest';
import { accessGrantedParts, accessRequestedParts } from './access-request';
import { MENTION_QUOTE_CHARS } from './layout';

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const words = { noun: 'canvas', escape };

describe('the access requested email', () => {
  it('names who asks and the item, quotes the note and opens the Inbox on the request', () => {
    const parts = accessRequestedParts(
      {
        requesterName: ' Ana Diaz ',
        itemTitle: 'Launch Plan',
        note: '  I am on the launch team  ',
        href: 'https://www.example.app/explorer/inbox?at=r%3Areq_1',
      },
      words,
    );
    expect(parts.subject).toBe('Ana Diaz asked for access to Launch Plan');
    expect(parts.section.intro).toContain(
      '<strong>Ana Diaz</strong> asked for access to <strong>Launch Plan</strong>',
    );
    expect(parts.section.outro).toBe('“I am on the launch team”');
    expect(parts.section.ctaText).toBe('Review the Request');
    expect(parts.section.ctaHref).toBe('https://www.example.app/explorer/inbox?at=r%3Areq_1');
    expect(parts.reason).toContain('a canvas you manage');
  });

  it('says Someone and your canvas when it has no name or title, and leaves an empty note out', () => {
    const parts = accessRequestedParts(
      { requesterName: null, itemTitle: '  ', note: '   ', href: 'h' },
      words,
    );
    expect(parts.subject).toBe('Someone asked for access to your canvas');
    expect(parts.section.intro).toContain('<strong>Someone</strong>');
    expect(parts.section.intro).toContain('<strong>your canvas</strong>');
    expect('outro' in parts.section).toBe(false);
  });

  it('escapes what people wrote, and keeps the subject to one plain line', () => {
    const parts = accessRequestedParts(
      { requesterName: '<b>Eve</b>', itemTitle: 'A & B\nC', note: '<script>x</script>', href: 'h' },
      words,
    );
    expect(parts.section.intro).toContain('&lt;b&gt;Eve&lt;/b&gt;');
    expect(parts.section.intro).toContain('A &amp; B');
    expect(parts.section.outro).toContain('&lt;script&gt;');
    expect(parts.subject).not.toContain('\n');
  });

  it('cuts a long note at a word', () => {
    const note = 'word '.repeat(80);
    const parts = accessRequestedParts(
      { requesterName: 'Ana', itemTitle: 'T', note, href: 'h' },
      words,
    );
    expect(parts.section.outro!.length).toBeLessThanOrEqual(MENTION_QUOTE_CHARS + 3);
    expect(parts.section.outro!.endsWith('…”')).toBe(true);
  });
});

describe('the access granted email', () => {
  it('names who shared it, the item and the level, and opens it', () => {
    for (const [level, words2] of [
      ['edit', 'an Editor'],
      ['participate', 'a Participant'],
      ['view', 'a Viewer'],
    ] as const) {
      const parts = accessGrantedParts(
        { granterName: 'Bo', itemTitle: 'Roadmap', level, href: 'https://x/document/1' },
        { noun: 'plan', escape },
      );
      expect(parts.subject).toBe('Bo shared Roadmap with you');
      expect(parts.section.intro).toContain(`as ${words2}`);
      expect(parts.section.ctaText).toBe('Open the plan');
      expect(parts.section.ctaHref).toBe('https://x/document/1');
      expect(parts.reason).toContain('you asked for access to this plan');
    }
  });

  it('says Someone and a plan without a name or title', () => {
    const parts = accessGrantedParts(
      { granterName: '', itemTitle: '', level: 'view', href: 'h' },
      { noun: 'plan', escape },
    );
    expect(parts.subject).toBe('Someone shared a plan with you');
    expect(parts.section.intro).toContain('<strong>a plan</strong>');
  });
});
