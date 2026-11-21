import { describe, expect, it, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { nodeItemSql } from '@liveworkspace/index-app/testing';
import { DRAFT_KEEP_MS } from '@liveknowledge/document';
import { migrateDocumentSchema } from './document-schema';
import { dropStaleDrafts } from './draft-upkeep';

// docs/specs/030-knowledgebase/editing.md "A draft that is left": the daily upkeep drops drafts untouched for 30 days.

const NOW = 1_800_000_000_000;

function room() {
  const raw = new DatabaseSync(':memory:');
  const sql = nodeItemSql(raw);
  migrateDocumentSchema((q) => sql.exec(q));
  const put = (id: string, data: object) =>
    raw
      .prepare('INSERT INTO tabs (id, name, data, updated_at, element_count, rev) VALUES (?, ?, ?, 0, 0, 3)')
      .run(id, id, JSON.stringify(data));
  const read = (id: string) => {
    const row = raw.prepare('SELECT data, rev FROM tabs WHERE id = ?').get(id) as { data: string; rev: number };
    return { data: JSON.parse(row.data) as Record<string, unknown>, rev: row.rev };
  };
  return { sql, put, read };
}

const writing = { blocks: [{ id: 'a', type: 'paragraph', runs: [{ text: 'x' }] }] };

describe('dropping stale drafts', () => {
  it('drops a draft untouched for thirty days, at the next revision, and keeps the saved page', () => {
    const r = room();
    r.put('old', { elements: [], articles: { 'art-1': writing, draft: writing }, draft: { by: 'P', at: NOW - DRAFT_KEEP_MS, base: {} } });
    r.put('new', { elements: [], articles: { 'art-1': writing, draft: writing }, draft: { by: 'P', at: NOW - 1000, base: {} } });
    r.put('none', { elements: [], articles: { 'art-1': writing } });
    expect(dropStaleDrafts(r.sql, NOW)).toBe(1);
    const old = r.read('old');
    expect(old.data.draft).toBeUndefined();
    expect(old.data.articles).toEqual({ 'art-1': writing });
    expect(old.rev).toBe(4);
    expect(r.read('new').data.draft).toBeDefined();
    expect(r.read('none').rev).toBe(3);
  });

  it('never throws: a failure is logged and drops nothing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const broken = { exec: () => { throw new Error('gone'); } } as unknown as Parameters<typeof dropStaleDrafts>[0];
    expect(dropStaleDrafts(broken, NOW)).toBe(0);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
