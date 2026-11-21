import { describe, expect, it } from 'vitest';
import {
  AI_DRAFT_MAX_TOKENS,
  AI_DRAFT_NAME_MAX,
  AI_DRAFT_PROMPT_MAX,
  AI_DRAFT_SCHEMA,
  AI_DRAFT_STEPS_READ_MAX,
  aiDraftCappedWords,
  aiDraftName,
  aiDraftOffTopicWords,
  aiDraftRequest,
  draftText,
  readAiDraft,
  type AiDraftKit,
} from './ai-draft';
import type { AutomationKind, AutomationRuleBody } from './types';
import { readRuleShell } from './validate';
import { obj } from './validate-read';

const kit: AiDraftKit<AutomationRuleBody> = {
  read: (v) =>
    readRuleShell(v, {
      trigger: (t) => obj(t, 'trigger') as AutomationKind,
      conditions: (c) => c as AutomationKind[],
      step: (s, path) => obj(s, path) as AutomationKind,
    }),
};
const ctx = { prompt: 'every Friday, post to https://mine.example', timeZone: 'UTC', rules: [] };
const reply = (rule: Record<string, unknown>) => ({ outcome: 'rule', rule });

describe('the ask', () => {
  it('sends the instructions, then the request and the app’s description as one object', () => {
    const request = aiDraftRequest('SYSTEM', 'x'.repeat(AI_DRAFT_PROMPT_MAX + 50), {
      item: { tabs: ['Roadmap'] },
    });
    expect(request.messages[0]).toEqual({ role: 'system', content: 'SYSTEM' });
    const data = JSON.parse(request.messages[1]!.content) as Record<string, unknown>;
    expect(Object.keys(data)).toEqual(['request', 'item']);
    expect(data['request']).toHaveLength(AI_DRAFT_PROMPT_MAX);
    expect(request.max_tokens).toBe(AI_DRAFT_MAX_TOKENS);
    expect(request.response_format.json_schema.schema).toBe(AI_DRAFT_SCHEMA);
  });

  it('adds the check’s words on the second ask, cut', () => {
    const request = aiDraftRequest('S', 'do it', {}, { path: 'steps.0', message: 'm'.repeat(400) });
    const data = JSON.parse(request.messages[1]!.content) as { previous: { refused: string } };
    expect(data.previous.refused.startsWith('steps.0: mmm')).toBe(true);
    expect(data.previous.refused).toHaveLength(300);
  });

  it('cuts a name and its control characters', () => {
    expect(aiDraftName(' In\tProgress ')).toBe('In Progress');
    expect(aiDraftName('x'.repeat(100))).toHaveLength(AI_DRAFT_NAME_MAX);
  });

  it('words its refusals the app’s way', () => {
    expect(aiDraftOffTopicWords('design')).toContain('a rule for this design.');
    expect(aiDraftCappedWords('design')).toContain('This design has drafted 20 rules today.');
  });
});

describe('a drafted text', () => {
  const own = 'see https://mine.example';

  it('loses control characters and links the person did not write, and is cut', () => {
    expect(draftText('a\u0000b\nc  https://evil.example  https://mine.example', own, 100)).toBe(
      'a b c https://mine.example',
    );
    expect(draftText('line one\nline\ttwo', own, 100, true)).toBe('line one\nline two');
    expect(draftText('x'.repeat(50), own, 10)).toBe('x'.repeat(10));
    expect(draftText(5, own, 10)).toBe(5);
  });
});

describe('the reply read', () => {
  it('is off topic when the model says so', () => {
    expect(readAiDraft({ outcome: 'not_a_rule' }, ctx, kit)).toEqual({ off: true });
  });

  it('is refused when it is neither a rule nor not one', () => {
    for (const bad of [
      {},
      { outcome: 'rule' },
      { outcome: 'rule', rule: [] },
      { outcome: 'maybe', rule: {} },
    ])
      expect(readAiDraft(bad, ctx, kit)).toEqual({
        refused: { path: 'outcome', message: 'reply with outcome rule and a rule, or not_a_rule' },
      });
  });

  it('reads a rule: unsaved, chain off, the saver’s time zone, a free name, each message a pick', () => {
    const read = readAiDraft(
      reply({
        name: 'Friday Post',
        trigger: { kind: 'scheduled' },
        steps: [
          { kind: 'snapshot' },
          { kind: 'notify', via: 'slack', webhook: 'made-up', name: 'Made Up', text: 'Hi' },
          'not a step',
        ].slice(0, 2),
        chain: true,
        timeZone: 'Mars/Olympus',
      }),
      { ...ctx, rules: [{ id: 'r1', name: 'Friday Post' }] },
      kit,
    );
    expect(read).toEqual({
      body: {
        name: 'Friday Post 2',
        trigger: { kind: 'scheduled' },
        conditions: [],
        steps: [{ kind: 'snapshot' }, { kind: 'notify', via: 'slack', webhook: '', text: 'Hi' }],
        chain: false,
        timeZone: 'UTC',
      },
      picks: [{ path: 'steps.1', pick: 'webhook' }],
    });
  });

  it('goes through the app’s names and its cleaning of each step', () => {
    const cleaned: string[] = [];
    const read = readAiDraft(
      reply({
        name: '',
        trigger: { kind: 'manual' },
        conditions: [{ kind: 'tab' }],
        steps: [{ kind: 'a' }, 5],
      }),
      ctx,
      {
        ...kit,
        named: (rule) => ({ ...rule, trigger: { kind: 'renamed' } }),
        cleanStep: (step, own) => {
          cleaned.push(`${String(step['kind'])}:${own === ctx.prompt}`);
        },
      },
    );
    // The step that is no object is left for the check, which refuses it.
    expect(read).toEqual({ refused: { path: 'steps.1', message: 'steps.1 must be an object' } });
    expect(cleaned).toEqual(['a:true']);
  });

  it('names a nameless rule, and cuts a list of steps before the check counts it', () => {
    const steps = Array.from({ length: AI_DRAFT_STEPS_READ_MAX + 10 }, () => ({ kind: 'a' }));
    const many = readAiDraft(reply({ name: 'Big', trigger: { kind: 'manual' }, steps }), ctx, kit);
    expect(many).toEqual({
      refused: { path: 'steps', message: 'a rule holds up to 20 actions' },
    });
    const named = readAiDraft(
      reply({ name: '', trigger: { kind: 'manual' }, steps: [] }),
      ctx,
      kit,
    );
    expect(named).toMatchObject({ body: { name: 'New Rule' }, picks: [] });
    // Steps that are no list are the check's to refuse.
    expect(
      readAiDraft(reply({ name: 'X', trigger: { kind: 'manual' }, steps: 'none' }), ctx, kit),
    ).toEqual({
      refused: { path: 'steps', message: 'steps must be a list' },
    });
  });
});
