import { describe, expect, it } from 'vitest';
import { previewText, valueDay, type PreviewContext } from './preview-values';
import { ANA, MARCO, NOW, card } from './test-fixtures';

const ctx = (over: Partial<PreviewContext> = {}): PreviewContext => ({
  card: card(48, 'Publish pricing page', { assignee: MARCO.id, due: '2026-11-20' }),
  column: 'Done',
  link: 'https://x/c/48',
  people: [ANA, MARCO],
  person: 'Ana Costa',
  rule: 'Wrap Up',
  now: NOW,
  fieldByName: (n) => (n === 'Completed On' ? '11 Nov 2026' : ''),
  ...over,
});

describe('previewText', () => {
  it('fills every value a rule may name', () => {
    expect(
      previewText(
        '{{card.title}} {{card.key}} {{card.url}} {{card.assignee}} {{card.column}} {{card.due}} {{person}} {{rule}}',
        ctx(),
      ),
    ).toBe('Publish pricing page #48 https://x/c/48 Marco Ruiz Done 20 Nov 2026 Ana Costa Wrap Up');
    expect(previewText('{{ now.date }}', ctx())).toBe(valueDay(NOW));
    expect(previewText('{{now}}', ctx())).toMatch(/2026/);
    expect(previewText('{{now + 2d}}', ctx())).toBe(valueDay(NOW + 2 * 86_400_000));
    expect(previewText('{{now - 1d}}', ctx())).toBe(valueDay(NOW - 86_400_000));
    expect(previewText('{{card.field.Completed On}}', ctx())).toBe('11 Nov 2026');
  });
  it('reads a value it cannot fill as nothing', () => {
    const bare = ctx({ card: card(1, 'X') });
    expect(previewText('[{{card.assignee}}][{{card.due}}][{{nope}}]', bare)).toBe('[][][]');
  });
});
