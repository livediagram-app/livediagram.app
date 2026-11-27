// docs/specs/026-plan/plan-ai.md "What the AI is sent and what it may answer": the ask carries the tab, the turns
// and the instruction as data, and the reader keeps only the changes the kind takes and the role may make.
import { describe, expect, it } from 'vitest';
import {
  PLAN_AI_BUILT_IN_MAX_TOKENS,
  PLAN_AI_CHANGES_MAX,
  PLAN_AI_MAX_TOKENS,
  PLAN_AI_CHANGE_CHARS_MAX,
  PLAN_AI_KINDS,
  PLAN_AI_TAB_MAX,
  PLAN_AI_TURNS_MAX,
  isPlanAiKind,
  planAiOpsFor,
  planAiRequest,
  readPlanAi,
  type PlanAiAsk,
} from './plan-ai';

const ASK: PlanAiAsk = {
  kind: 'board',
  tabName: 'Sprint',
  tab: 'Columns: To Do, Done\n#1 Fix login (To Do)',
  instruction: 'Move #1 to Done',
  role: 'edit',
};

const userData = (ask: PlanAiAsk, previous?: { path: string; message: string }) =>
  JSON.parse(planAiRequest(ask, previous).messages[1]!.content) as Record<string, unknown>;

describe('planAiRequest', () => {
  it('sends the tab, the instruction and the kind as data, under the kind’s instructions', () => {
    const request = planAiRequest(ASK);
    expect(request.messages[0]!.role).toBe('system');
    expect(request.messages[0]!.content).toContain('"op":"move"');
    expect(request.messages[0]!.content).toContain('The person may change this tab.');
    expect(userData(ASK)).toEqual({
      tabName: 'Sprint',
      kind: 'board',
      tab: ASK.tab,
      instruction: 'Move #1 to Done',
    });
    expect(request.response_format.json_schema.name).toBe('plan_ai');
    // Strict decoding keeps only what the schema names: a change must be free to carry its title, cells and fields
    // beside its op, or every card is added as "New task" (PR 2349 verifier).
    const change = (
      request.response_format.json_schema.schema as {
        properties: { changes: { items: Record<string, unknown> } };
      }
    ).properties.changes.items;
    expect(change['required']).toEqual(['op']);
    expect(change['additionalProperties']).toBe(true);
  });

  it('has instructions for every kind, and says what a Participant and a Viewer may do', () => {
    for (const kind of PLAN_AI_KINDS)
      expect(planAiRequest({ ...ASK, kind }).messages[0]!.content.length).toBeGreaterThan(300);
    expect(planAiRequest({ ...ASK, role: 'view' }).messages[0]!.content).toContain(
      'never answer changes',
    );
    expect(planAiRequest({ ...ASK, role: 'participate' }).messages[0]!.content).toContain(
      'only an Editor can',
    );
  });

  it('keeps sorts off header and total rows, forms free of repeated questions, dashboards out of twelfths', () => {
    const say = (kind: PlanAiAsk['kind']) => planAiRequest({ ...ASK, kind }).messages[0]!.content;
    expect(say('sheet')).toContain(
      'leaves out the header row above them and any total or summary row',
    );
    expect(say('form')).toContain('Never add a question that asks what one already there asks');
    expect(say('dashboard')).toContain('never in twelfths');
  });

  it('asks built-in AI for a shorter reply, so its longest turn ends inside its 20 seconds', () => {
    const keyed = planAiRequest(ASK);
    const builtIn = planAiRequest({ ...ASK, builtIn: true });
    expect(keyed.max_tokens).toBe(PLAN_AI_MAX_TOKENS);
    expect(builtIn.max_tokens).toBe(PLAN_AI_BUILT_IN_MAX_TOKENS);
    expect(PLAN_AI_BUILT_IN_MAX_TOKENS).toBeLessThan(PLAN_AI_MAX_TOKENS);
    expect(builtIn.messages[0]!.content).toContain('at most 15 rows');
    expect(keyed.messages[0]!.content).not.toContain('at most 15 rows');
  });

  it('keeps the last turns, cut, and the tab within its bound', () => {
    const turns = Array.from({ length: 6 }, (_, i) => ({
      instruction: `q${i}`,
      reply: 'x'.repeat(2000),
    }));
    const data = userData({ ...ASK, tab: 'y'.repeat(PLAN_AI_TAB_MAX + 50), turns });
    expect((data['tab'] as string).length).toBeLessThanOrEqual(PLAN_AI_TAB_MAX);
    const sent = data['turns'] as { instruction: string; reply: string }[];
    expect(sent).toHaveLength(PLAN_AI_TURNS_MAX);
    expect(sent[0]!.instruction).toBe('q2');
    expect(sent[0]!.reply.length).toBeLessThanOrEqual(1000);
  });

  it('says why the last reply was refused on a second ask', () => {
    expect(userData(ASK, { path: 'changes', message: 'not a list' })['previous']).toEqual({
      refused: 'changes: not a list',
    });
  });
});

describe('readPlanAi', () => {
  it('reads the words and the changes', () => {
    const read = readPlanAi(
      { reply: 'Moved #1 to Done.', changes: [{ op: 'move', item: '#1', status: 'Done' }] },
      ASK,
    );
    expect(read).toEqual({
      draft: {
        reply: 'Moved #1 to Done.',
        changes: [{ op: 'move', item: '#1', status: 'Done' }],
        dropped: 0,
      },
    });
  });

  it('answers a question with no changes, and reads missing changes as none', () => {
    expect(readPlanAi({ reply: 'One card is in To Do.' }, ASK)).toEqual({
      draft: { reply: 'One card is in To Do.', changes: [], dropped: 0 },
    });
  });

  it('drops what a Viewer or a Participant may not change, and counts it', () => {
    const changes = [
      { op: 'add', title: 'New' },
      { op: 'delete', item: '#1' },
    ];
    expect(readPlanAi({ reply: 'Done', changes }, { ...ASK, role: 'view' })).toEqual({
      draft: { reply: 'Done', changes: [], dropped: 2 },
    });
    expect(readPlanAi({ reply: 'Done', changes }, { ...ASK, role: 'participate' })).toEqual({
      draft: { reply: 'Done', changes: [{ op: 'add', title: 'New' }], dropped: 1 },
    });
    expect(planAiOpsFor('form', 'participate')).toEqual([]);
    expect(planAiOpsFor('sheet', 'edit')).toContain('chart');
  });

  it('keeps at most the bound of changes', () => {
    const changes = Array.from({ length: PLAN_AI_CHANGES_MAX + 3 }, () => ({
      op: 'add',
      title: 'x',
    }));
    const read = readPlanAi({ reply: '', changes }, ASK);
    expect('draft' in read && read.draft.changes).toHaveLength(PLAN_AI_CHANGES_MAX);
    expect('draft' in read && read.draft.dropped).toBe(3);
  });

  it('refuses a reply that does not read, for a second ask', () => {
    expect(readPlanAi({ reply: 4 }, ASK)).toEqual({
      refused: { path: 'reply', message: 'reply must be a string of words to show' },
    });
    expect(readPlanAi({ reply: 'x', changes: 'move' }, ASK)).toMatchObject({
      refused: { path: 'changes' },
    });
    expect(readPlanAi({ reply: 'x', changes: [3] }, ASK)).toMatchObject({
      refused: { path: 'changes.0' },
    });
    expect(readPlanAi({ reply: 'x', changes: [{ op: 'add_row' }] }, ASK)).toMatchObject({
      refused: { path: 'changes.0.op' },
    });
    expect(
      readPlanAi(
        { reply: 'x', changes: [{ op: 'add', title: 'y'.repeat(PLAN_AI_CHANGE_CHARS_MAX) }] },
        ASK,
      ),
    ).toMatchObject({ refused: { path: 'changes.0' } });
    expect(readPlanAi({ reply: '  ', changes: [] }, ASK)).toMatchObject({
      refused: { path: 'reply' },
    });
  });

  it('cleans the words: control characters out, a link the tab and the instruction lack removed', () => {
    const read = readPlanAi(
      { reply: 'See https://evil.example/x and\u0007 done', changes: [] },
      ASK,
    );
    expect('draft' in read && read.draft.reply).not.toContain('evil.example');
    expect('draft' in read && read.draft.reply).not.toContain('\u0007');
    const own = readPlanAi(
      { reply: 'It is at https://own.example/a', changes: [] },
      { ...ASK, tab: 'Link: https://own.example/a' },
    );
    expect('draft' in own && own.draft.reply).toContain('https://own.example/a');
  });

  it('knows its kinds', () => {
    expect(isPlanAiKind('sheet')).toBe(true);
    expect(isPlanAiKind('canvas')).toBe(false);
    expect(isPlanAiKind(3)).toBe(false);
  });
});
