import { describe, expect, it } from 'vitest';
import { planActions, type PlannedRun } from './plan-actions';
import type { AutomationStep } from './types';
import { BUG, NOTE, OUTLINE, bug, ctxFor } from './test-fixtures';
import { draftText } from './ai-draft';
import { plainSummary } from './ai-steps';
import { AUTOMATION_SUBJECT_MAX, freeRuleName } from './validate';
import { AUTOMATION_AI_SUMMARY_MAX, AUTOMATION_NAME_MAX, AUTOMATION_TEXT_MAX } from './types';
import { WEBHOOK_VALUE_MAX, webhookValues } from './incoming';
import { ITEM_CHECKLIST_TEXT_MAX, ITEM_TITLE_MAX } from '../limits';

// Every text a rule cuts to its cap (a comment's, a mention's, an email's subject and body, a new card's title, a
// checklist item's, a webhook message's, a Set Field title, a webhook value, an AI summary or draft, a free rule
// name) is cut by the shared cutText: never between the two halves of an emoji, which a plain `slice` left as a lone
// high surrogate (drawn as a box, stored as U+FFFD).
const EMOJI = '😀';
// Text whose emoji straddle `max` whichever parity the cut falls on: one starts with an odd count, one even.
const straddling = (max: number) => [EMOJI.repeat(max), `x${EMOJI.repeat(max)}`];
const lone = /[\uD800-\uDBFF]$/;
const whole = (s: string, max: number) => {
  expect(s).not.toMatch(lone);
  expect(s.length).toBeLessThanOrEqual(max);
  expect(s.length).toBeGreaterThanOrEqual(max - 1);
};

const done = (r: PlannedRun) => {
  if ('failed' in r) throw new Error(r.failed);
  return r;
};
const planned = (steps: AutomationStep[], text: string) =>
  done(
    planActions(
      steps,
      ctxFor(bug({ title: text, assignee: { id: 'p-sam', name: 'Sam', color: '#123456' } })),
    ),
  );

describe('A rule cuts text at its cap, never through an emoji', () => {
  it.each(straddling(AUTOMATION_TEXT_MAX))(
    'comment, mention, email and webhook message',
    (text) => {
      const r = planned(
        [
          { kind: 'comment', text: '{{card.title}}' },
          { kind: 'mention', to: { trigger: true }, text: '{{card.title}}' },
          {
            kind: 'email',
            to: { trigger: true },
            subject: '{{card.title}}',
            body: '{{card.title}}',
          },
          { kind: 'notify', via: 'slack', webhook: 'wh-1', text: '{{card.title}}' },
        ],
        text,
      );
      whole(r.comments[0]!, AUTOMATION_TEXT_MAX);
      whole(r.mentions[0]!.text, AUTOMATION_TEXT_MAX);
      whole(r.emails[0]!.body, AUTOMATION_TEXT_MAX);
      whole(r.sends[0]!.text, AUTOMATION_TEXT_MAX);
      // The subject keeps to a subject's own cap, as a typed one does.
      whole(r.emails[0]!.subject, AUTOMATION_SUBJECT_MAX);
    },
  );

  it.each(straddling(ITEM_TITLE_MAX))("a new card's title", (text) => {
    const r = planned([{ kind: 'create_card', type: 'bug', title: '{{card.title}}' }], text);
    whole(String(r.created[0]!.fields['title']), ITEM_TITLE_MAX);
  });

  it.each(straddling(ITEM_CHECKLIST_TEXT_MAX))('a checklist item', (text) => {
    const r = done(
      planActions(
        [{ kind: 'add_checklist', items: ['{{card.title}}'] }],
        ctxFor(
          { ...bug({ title: text, 'f-severity': undefined }), type: 'note' },
          {
            outline: {
              ...OUTLINE,
              types: [BUG, { ...NOTE, fields: [...NOTE.fields, 'checklist'] }],
            },
          },
        ),
      ),
    );
    whole((r.patch.set!['checklist'] as { text: string }[])[0]!.text, ITEM_CHECKLIST_TEXT_MAX);
  });

  it.each(straddling(ITEM_TITLE_MAX))('a Set Field title', (text) => {
    const r = planned([{ kind: 'set_field', field: 'title', value: { text } }], 'Card');
    whole(String(r.patch.set!['title']), ITEM_TITLE_MAX);
  });

  it.each(straddling(WEBHOOK_VALUE_MAX))('a webhook value', (text) => {
    const values = webhookValues({ s: text }, ['s']);
    whole(String(values['s']), WEBHOOK_VALUE_MAX);
  });

  it.each(straddling(AUTOMATION_AI_SUMMARY_MAX))('an AI summary and a drafted text', (text) => {
    const summary = plainSummary(text, { title: 'Card' } as Parameters<typeof plainSummary>[1]);
    expect(summary.endsWith('…')).toBe(true);
    whole(summary.slice(0, -1), AUTOMATION_AI_SUMMARY_MAX - 1);
    whole(String(draftText(text, '', 100)), 100);
  });

  it.each(straddling(AUTOMATION_NAME_MAX))('a free rule name', (text) => {
    whole(freeRuleName(text, []), AUTOMATION_NAME_MAX);
  });
});
