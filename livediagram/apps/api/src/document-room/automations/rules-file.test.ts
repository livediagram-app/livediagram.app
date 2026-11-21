import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ExportQuery } from '@liveworkspace/index-app';
import type { ItemRule } from '@liveworkspace/automations/item';
import { readDocumentFile } from '../document-file';
import { ANA, BEN, box, DOC, roomWorld, type RoomWorld } from './test-automation-world';

// A canvas's rules in its file and its copies (docs/specs/013-workspace/automations.md "Files and copies"): the file
// carries them; an import and Make a Copy bring them back turned off, their tabs at the new canvas's ids, what was
// the source's own (a snapshot, a connection) left to pick; a copy without a tab a rule named leaves that pick empty.

afterEach(() => vi.restoreAllMocks());

const FILE = { format: 'file', ifVersion: null, tabId: null, code: null } as unknown as ExportQuery;

async function source(): Promise<RoomWorld> {
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  const w = roomWorld();
  await w.create([
    { id: 't1', name: 'Board', elements: [box('a')] },
    { id: 't2', name: 'Notes', elements: [] },
  ]);
  await w.rule({
    name: 'Comments on Notes',
    trigger: { kind: 'comment_added', tab: 't2' },
    conditions: [{ kind: 'tab', tabs: ['t1', 't2'] }],
    steps: [{ kind: 'take_snapshot', name: 'After a comment' }],
  });
  await w.rule({
    name: 'Reset',
    trigger: { kind: 'scheduled', every: 'day', at: '00:00' },
    steps: [{ kind: 'revert_snapshot', snapshot: 'snap-1', name: 'Clean' }],
  });
  const off = await w.rule({ name: 'Parked', trigger: { kind: 'manual' } });
  await w.send('POST', `/api/documents/${DOC}/automations/${off.id}/toggle`, { enabled: false });
  return w;
}

const rulesOf = (w: RoomWorld) =>
  w
    .rows('SELECT body, enabled FROM automation_rules ORDER BY position')
    .map((r) => ({ ...(JSON.parse(String(r['body'])) as ItemRule), row: r['enabled'] }));

async function fileOf(w: RoomWorld): Promise<string> {
  const file = await w.room.exportFile(DOC, FILE);
  if (file.status !== 'ok') throw new Error(file.status);
  return typeof file.body === 'string' ? file.body : new TextDecoder().decode(file.body);
}

describe('the file', () => {
  it('carries each rule’s body and whether it was on, and nothing else of it', async () => {
    const w = await source();
    const text = await fileOf(w);
    const { document } = JSON.parse(text) as {
      document: { automations: Record<string, unknown>[] };
    };
    expect(document.automations.map((r) => [r['name'], r['enabled']])).toEqual([
      ['Comments on Notes', true],
      ['Reset', true],
      ['Parked', false],
    ]);
    for (const rule of document.automations)
      for (const key of ['id', 'made', 'edited', 'paused']) expect(rule).not.toHaveProperty(key);
  });

  it('is byte for byte what it was for a canvas with no rules', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const w = roomWorld();
    await w.create();
    expect(await fileOf(w)).not.toContain('automations');
  });

  it('brings its rules into a new canvas turned off, their tabs at the new ids, the source’s snapshot left to pick', async () => {
    const w = await source();
    const read = readDocumentFile(await fileOf(w));
    if (!read.ok) throw new Error(read.failure);
    const made = roomWorld({}, 'doc-2');
    await made.room.importFile('doc-2', { ...read.content, name: 'Imported', ownerId: BEN });
    const tabs = made.rows('SELECT tab_id FROM document_tabs ORDER BY order_index');
    const [board, notes] = tabs.map((t) => String(t['tab_id']));
    expect(board).not.toBe('t1');
    const rules = rulesOf(made);
    expect(rules.map((r) => [r.name, r.enabled, r.row])).toEqual([
      ['Comments on Notes', false, 0],
      ['Reset', false, 0],
      ['Parked', false, 0],
    ]);
    expect(rules[0]!.trigger).toEqual({ kind: 'comment_added', tab: notes });
    expect(rules[0]!.conditions).toEqual([{ kind: 'tab', tabs: [board, notes] }]);
    expect(rules[1]!.steps[0]).toMatchObject({ kind: 'revert_snapshot', snapshot: '' });
    // Off, so nothing is heard or scheduled until someone turns one on.
    expect(made.room.automations.kinds.size).toBe(0);
    expect(made.rows('SELECT * FROM automation_schedule')).toEqual([]);
    // Turned on by its new Editor, it is heard.
    const listed = await made.send('GET', '/api/documents/doc-2/automations', undefined, {
      id: BEN,
    });
    expect(listed.status).toBe(200);
  });

  it('leaves a rule the check refuses behind, and reads a file with none', async () => {
    const w = await source();
    const envelope = JSON.parse(await fileOf(w)) as {
      document: { automations: unknown[] };
    };
    envelope.document.automations = [
      { name: 'From another app', trigger: { kind: 'card_moved' }, conditions: [], steps: [] },
      ...envelope.document.automations.slice(0, 1),
      'not a rule',
    ];
    const read = readDocumentFile(JSON.stringify(envelope));
    if (!read.ok) throw new Error(read.failure);
    const made = roomWorld({}, 'doc-3');
    await made.room.importFile('doc-3', { ...read.content, name: 'Imported', ownerId: BEN });
    expect(rulesOf(made).map((r) => r.name)).toEqual(['Comments on Notes']);
  });

  it('does not touch the canvas’s rules on a revert', async () => {
    const w = await source();
    const snap = await w.send('POST', `/api/documents/${DOC}/snapshots`, { name: 'With three' });
    const { snapshot } = await snap.json<{ snapshot: { id: string } }>();
    const extra = await w.rule({ name: 'Made after' });
    await w.send('POST', `/api/documents/${DOC}/snapshots/${snapshot.id}/revert`);
    expect(rulesOf(w).map((r) => r.name)).toContain('Made after');
    expect(extra.id).toBeTruthy();
  });
});

describe('Make a Copy', () => {
  it('brings the rules turned off, their tabs at the copy’s ids', async () => {
    const w = await source();
    const exported = await w.room.exportCopy(DOC, null, { by: ANA, code: null });
    const made = roomWorld({}, 'doc-2');
    await made.room.importCopy('doc-2', exported!.copy);
    const [board, notes] = made
      .rows('SELECT tab_id FROM document_tabs ORDER BY order_index')
      .map((t) => String(t['tab_id']));
    const rules = rulesOf(made);
    expect(rules.map((r) => [r.name, r.row])).toEqual([
      ['Comments on Notes', 0],
      ['Reset', 0],
      ['Parked', 0],
    ]);
    expect(rules[0]!.trigger).toEqual({ kind: 'comment_added', tab: notes });
    expect(rules[0]!.conditions).toEqual([{ kind: 'tab', tabs: [board, notes] }]);
    // The source keeps its own, as they were.
    expect(rulesOf(w).map((r) => r.row)).toEqual([1, 1, 0]);
  });

  it('leaves the picks of tabs the copy lacks empty', async () => {
    const w = await source();
    const exported = await w.room.exportCopy(DOC, 't1', { by: ANA, code: null });
    const made = roomWorld({}, 'doc-2');
    await made.room.importCopy('doc-2', exported!.copy);
    const [board] = made.rows('SELECT tab_id FROM document_tabs').map((t) => String(t['tab_id']));
    const [rule] = rulesOf(made);
    // The trigger's tab (Notes) did not come; the condition keeps the tab that did.
    expect(rule!.trigger).toEqual({ kind: 'comment_added', tab: '' });
    expect(rule!.conditions).toEqual([{ kind: 'tab', tabs: [board, ''] }]);
    // Something left to pick: it cannot be turned on until it is picked. (The copy's first open starts it.)
    expect((await made.send('GET', '/api/documents/doc-2', undefined, { id: ANA })).status).toBe(
      200,
    );
    const toggled = await made.send(
      'POST',
      `/api/documents/doc-2/automations/${rule!.id}/toggle`,
      { enabled: true },
      { id: ANA },
    );
    expect(toggled.status).toBe(400);
  });

  it('takes no rules through a share link', async () => {
    const w = await source();
    const exported = await w.room.exportCopy(DOC, null, { by: BEN, code: 'link-code' });
    expect(exported!.copy.automations).toBeUndefined();
    const made = roomWorld({}, 'doc-2');
    await made.room.importCopy('doc-2', exported!.copy);
    expect(rulesOf(made)).toEqual([]);
  });
});
