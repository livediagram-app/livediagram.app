import { beforeEach, describe, expect, it } from 'vitest';
import type {
  KnowledgeOverviewResponse,
  KnowledgePageReadResponse,
  KnowledgeSuggestionsResponse,
  PageHealthResponse,
  SuggestEditResponse,
} from '@liveknowledge/api-schema';
import {
  SUGGESTIONS_MAX_PENDING,
  SUGGESTION_KEPT_DAYS,
  SUGGESTION_MAX_CHARS,
  pruneSuggestions,
} from '../knowledge/suggestions';
import { knowledgeKit, type Kit, type Who } from './knowledge-test-kit';

// Edits suggested by agents (docs/specs/030-knowledgebase/ai-knowledge.md; docs/specs/024-agents/
// knowledgebase-for-agents.md): who may suggest, accept and dismiss, what a suggestion holds, and what happens when
// the page moved on.

const BEFORE = 'Deploys go out on Tuesdays after the morning standup, never on a Friday.';
const AFTER = 'Deploys go out on Mondays after the morning standup, never on a Friday.';
const SUGGESTION = { reason: 'The day changed in March.', before: BEFORE, after: AFTER };

let kit: Kit;
beforeEach(async () => {
  kit = await knowledgeKit();
});

const suggest = (who: Who, body: unknown = SUGGESTION, tab = 'deploys') =>
  kit.call(who, 'POST', `/api/documents/kb/pages/${tab}/suggestions`, body);
const pending = async (who: Who = 'editor') =>
  (
    await (
      await kit.call(who, 'GET', '/api/documents/kb/suggestions')
    ).json<KnowledgeSuggestionsResponse>()
  ).suggestions;
const markdownOf = async (tab = 'deploys') =>
  (
    await (
      await kit.call('editor', 'GET', `/api/documents/kb/pages/${tab}`)
    ).json<KnowledgePageReadResponse>()
  ).page.markdown;
const made = async (who: Who = 'agent-stored', body: unknown = SUGGESTION) =>
  (await (await suggest(who, body)).json<SuggestEditResponse>()).suggestion;

describe('suggesting an edit', () => {
  it('keeps the suggestion and changes nothing', async () => {
    const res = await suggest('agent-stored');
    expect(res.status).toBe(201);
    const { suggestion, pending: count } = await res.json<SuggestEditResponse>();
    expect(suggestion).toMatchObject({
      tab: 'deploys',
      title: 'Deploys',
      agent: 'Coding Agent',
      reason: 'The day changed in March.',
      summary: 'The day changed in March.',
      kind: 'replace',
      before: BEFORE,
      after: AFTER,
    });
    expect(suggestion.id).toMatch(/^sg_[0-9a-z]{10}$/);
    expect(count).toBe(1);
    expect(await markdownOf()).toContain('Tuesdays');
    // Every role sees what waits, and the AI Knowledge tab lists it.
    expect((await pending('viewer')).map((s) => s.id)).toEqual([suggestion.id]);
    const overview = await (
      await kit.call('viewer', 'GET', '/api/documents/kb/knowledge')
    ).json<KnowledgeOverviewResponse>();
    expect(overview.suggestions.map((s) => s.id)).toEqual([suggestion.id]);
  });

  it.each<[Who, number]>([
    ['editor', 201],
    ['participant', 201],
    ['agent', 201],
    ['agent-stored', 201],
    ['participant-agent', 201],
    ['viewer', 403],
    ['viewer-agent', 403],
    ['agent-read-only', 403],
    ['link', 403],
    ['stranger', 403],
  ])('as %s answers %i', async (who, status) => {
    expect((await suggest(who)).status).toBe(status);
  });

  it('refuses a link confined to another page as a page it cannot see', async () => {
    expect((await suggest('page-link')).status).toBe(404);
    expect((await suggest('page-link', SUGGESTION, 'holidays')).status).toBe(403);
  });

  it('appends when no passage is named', async () => {
    const s = await made('agent-stored', { reason: 'Missing.', after: '## Hotfixes\n\nAny day.' });
    expect(s).toMatchObject({ kind: 'append', before: '', after: '## Hotfixes\n\nAny day.' });
  });

  it.each([
    [{ before: BEFORE, after: AFTER }, 'no_reason'],
    [{ reason: 'x'.repeat(501), after: AFTER }, 'reason_too_long'],
    [{ reason: 'Why.', before: BEFORE }, 'no_change'],
    [{ reason: 'Why.', after: 'x'.repeat(SUGGESTION_MAX_CHARS) }, 'suggestion_too_long'],
    [{ reason: 'Why.', before: 'Deploys go out on Sundays.', after: AFTER }, 'passage_not_found'],
    [{ reason: 'Why.', before: 'Deploys', after: 'Releases' }, 'passage_ambiguous'],
  ])('refuses %j in words', async (body, error) => {
    const res = await suggest('agent-stored', body);
    expect(res.status).toBe(400);
    const answer = await res.json<{ error: string; message: string }>();
    expect(answer.error).toBe(error);
    expect(answer.message.length).toBeGreaterThan(20);
    expect(await pending()).toEqual([]);
  });

  it('holds at most 50 waiting', async () => {
    for (let i = 0; i < SUGGESTIONS_MAX_PENDING; i += 1)
      expect((await suggest('agent-stored', { reason: `r${i}`, after: 'More.' })).status).toBe(201);
    const res = await suggest('agent-stored');
    expect(res.status).toBe(409);
    expect((await res.json<{ error: string }>()).error).toBe('suggestions_full');
    expect(await pending()).toHaveLength(SUGGESTIONS_MAX_PENDING);
  });

  it('answers 404 for a page the knowledgebase lacks', async () => {
    expect((await suggest('agent-stored', SUGGESTION, 'nope')).status).toBe(404);
  });
});

describe('accepting a suggestion', () => {
  const accept = (who: Who, id: string) =>
    kit.call(who, 'POST', `/api/documents/kb/suggestions/${id}/accept`);

  it.each<[Who, number]>([
    ['participant', 200],
    ['viewer', 403],
    ['link', 403],
    ['participant-agent', 403],
    ['viewer-agent', 403],
    ['agent-stored', 403],
    ['editor', 200],
    ['agent', 200],
  ])('as %s answers %i', async (who, status) => {
    const { id } = await made();
    expect((await accept(who, id)).status).toBe(status);
    expect(await pending()).toHaveLength(status === 200 ? 0 : 1);
  });

  it('tells an agent without write what it holds and what to do', async () => {
    const { id } = await made();
    const answer = await (await accept('agent-stored', id)).json<Record<string, unknown>>();
    expect(answer).toMatchObject({
      error: 'scope_needed',
      needs: 'write',
      scopes: ['read', 'suggest'],
    });
  });

  it('applies it as one change and leaves the verified state as it was', async () => {
    expect(
      (await kit.call('editor', 'POST', '/api/documents/kb/pages/deploys/verify')).status,
    ).toBe(200);
    const health = async () =>
      (
        await (
          await kit.call('editor', 'GET', '/api/documents/kb/pages/deploys/health')
        ).json<PageHealthResponse>()
      ).knowledge;
    const verified = await health();
    const { id } = await made();
    const res = await accept('editor', id);
    expect(res.status).toBe(200);
    const { tab } = await res.json<{ tab: { id: string; rev: number } }>();
    expect(tab.id).toBe('deploys');
    const text = await markdownOf();
    expect(text).toContain('Mondays');
    expect(text).not.toContain('Tuesdays');
    // The link to another page survives the write.
    expect(text).toContain('[[Rollbacks]]');
    const after = await health();
    expect(after.state).toBe('verified');
    expect(after.verifiedAt).toBe(verified.verifiedAt);
    expect(after.verifiedBy).toBe(verified.verifiedBy);
  });

  it('appends an appended suggestion', async () => {
    const { id } = await made('agent-stored', {
      reason: 'Missing.',
      after: 'Hotfixes go any day.',
    });
    expect((await accept('editor', id)).status).toBe(200);
    const text = await markdownOf();
    expect(text).toContain('Tuesdays');
    expect(text.trim().endsWith('Hotfixes go any day.')).toBe(true);
  });

  it('fails cleanly when the passage changed, and keeps the suggestion to dismiss', async () => {
    const { id } = await made();
    const page = await markdownOf();
    const rewrite = await kit.call('agent', 'POST', '/api/documents/kb/tabs/deploys/pages', {
      article: { markdown: page.replace('Tuesdays', 'Wednesdays') },
    });
    expect(rewrite.status).toBe(200);
    const res = await accept('editor', id);
    expect(res.status).toBe(409);
    expect((await res.json<{ error: string }>()).error).toBe('suggestion_stale');
    expect(await markdownOf()).toContain('Wednesdays');
    expect(await pending()).toHaveLength(1);
    expect(
      (await kit.call('editor', 'POST', `/api/documents/kb/suggestions/${id}/dismiss`)).status,
    ).toBe(204);
    expect(await pending()).toEqual([]);
  });

  it('answers 404 for a suggestion that is not waiting', async () => {
    expect((await accept('editor', 'sg_0000000000')).status).toBe(404);
  });
});

describe('dismissing a suggestion', () => {
  it.each<[Who, number]>([
    ['participant', 204],
    ['viewer', 403],
    ['agent-stored', 403],
    ['editor', 204],
  ])('as %s answers %i', async (who, status) => {
    const { id } = await made();
    const res = await kit.call(who, 'POST', `/api/documents/kb/suggestions/${id}/dismiss`);
    expect(res.status).toBe(status);
    expect(await pending()).toHaveLength(status === 204 ? 0 : 1);
  });

  it('answers 405 for another method', async () => {
    expect((await kit.call('editor', 'DELETE', '/api/documents/kb/suggestions')).status).toBe(405);
    expect((await kit.call('editor', 'GET', '/api/documents/kb/suggestions/x/accept')).status).toBe(
      405,
    );
  });
});

describe('pruning', () => {
  it('lets a suggestion go after 90 days, and one whose page is gone', async () => {
    const old = await made();
    const orphan = await made();
    const kept = await made();
    const past = Date.now() - (SUGGESTION_KEPT_DAYS + 1) * 86_400_000;
    kit.db.sql.prepare('UPDATE suggestions SET created_at = ? WHERE id = ?').run(past, old.id);
    kit.db.sql.prepare("UPDATE suggestions SET tab = 'gone' WHERE id = ?").run(orphan.id);
    // An old one is not listed even before the daily prune runs; one for a missing page neither.
    expect((await pending()).map((s) => s.id)).toEqual([kept.id]);
    for (const statement of pruneSuggestions(Date.now()))
      kit.db.sql.prepare(statement.sql).run(...statement.params);
    const left = kit.db.sql.prepare('SELECT id FROM suggestions').all() as { id: string }[];
    expect(left.map((r) => r.id)).toEqual([kept.id]);
  });
});
