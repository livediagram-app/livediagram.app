import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_KNOWLEDGE_STYLE, type KnowledgeStyle } from '@liveknowledge/document';
import {
  exportDocumentCopy,
  importDocumentCopy,
  initDocument,
  readDocumentMeta,
} from '../document-room/document-content';
import {
  exportDocumentFile,
  importDocumentFile,
  readDocumentFile,
} from '../document-room/document-file';
import { documentSnapshotDoor } from '../document-room/document-snapshots';
import { knowledgeKit, OWNER, type Kit, type Who } from './knowledge-test-kit';

// The Knowledgebase Style (docs/specs/030-knowledgebase/page-surface.md "Knowledgebase Style"): one style on the
// document, read by every role in the document's read, set by an Editor through the metadata write.
vi.mock('../index-service', async (original) => {
  const tests = await import('../test-sqlite-d1');
  return {
    ...(await original<typeof import('../index-service')>()),
    requestGrant: tests.testRequestGrant,
    indexFor: tests.testIndexFor,
  };
});

afterEach(() => {
  vi.restoreAllMocks();
});

const DOC = '/api/documents/kb';
type Read = { document: { knowledgeStyle: KnowledgeStyle; name: string } };
const styleOf = async (kit: Kit, who: Who = 'viewer') =>
  (await (await kit.call(who, 'GET', DOC)).json<Read>()).document.knowledgeStyle;
const set = (kit: Kit, knowledgeStyle: unknown, who: Who = 'editor') =>
  kit.call(who, 'PUT', DOC, { knowledgeStyle });
const STEEL: KnowledgeStyle = {
  theme: 'steel',
  headingFont: 'poppins',
  bodyFont: 'inter',
  textSize: 'large',
  lineSpacing: 'relaxed',
  headingStyle: 'ruled',
};
const row = (kit: Kit) =>
  kit.db.sql.prepare("SELECT knowledge_style AS s FROM document WHERE id = 'kb'").get();
/** Every table but the document's own row, exactly as stored. */
const allButTheDocumentRow = (kit: Kit) => {
  const tables = (
    kit.db.sql
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'passages_fts%' AND name <> 'document'",
      )
      .all() as { name: string }[]
  ).map((t) => t.name);
  return Object.fromEntries(
    tables.map((t) => [t, JSON.stringify(kit.db.sql.prepare(`SELECT * FROM ${t}`).all())]),
  );
};

describe('the style in the document read', () => {
  it('is the Everyday look in the product’s theme for a knowledgebase that never chose, for every role', async () => {
    const kit = await knowledgeKit();
    for (const who of ['editor', 'participant', 'viewer', 'link', 'agent-read-only'] as const)
      expect(await styleOf(kit, who)).toEqual(DEFAULT_KNOWLEDGE_STYLE);
    expect(DEFAULT_KNOWLEDGE_STYLE.theme).toBe('brand');
  });
});

describe('PUT documents/<id> with knowledgeStyle', () => {
  it('sets the style for an Editor, and every role then reads it', async () => {
    const kit = await knowledgeKit();
    const res = await set(kit, STEEL);
    expect(res.status).toBe(200);
    expect((await res.json<Read>()).document.knowledgeStyle).toEqual(STEEL);
    for (const who of ['participant', 'viewer', 'link'] as const)
      expect(await styleOf(kit, who)).toEqual(STEEL);
    expect(row(kit)).toEqual({ s: JSON.stringify(STEEL) });
  });

  it('takes any of its fields over what is stored, and null clears a picked accent', async () => {
    const kit = await knowledgeKit();
    await set(kit, STEEL);
    await set(kit, { textSize: 'small', accent: '#0EA5E9' });
    expect(await styleOf(kit)).toEqual({ ...STEEL, textSize: 'small', accent: '#0ea5e9' });
    await set(kit, { accent: null });
    expect(await styleOf(kit)).toEqual({ ...STEEL, textSize: 'small' });
    // Back to the default stores nothing.
    await set(kit, DEFAULT_KNOWLEDGE_STYLE);
    expect(row(kit)).toEqual({ s: null });
  });

  it('is an Editor’s in person, or a token’s that was granted write', async () => {
    const kit = await knowledgeKit();
    expect((await set(kit, { theme: 'ocean' }, 'agent')).status).toBe(200);
    expect((await styleOf(kit)).theme).toBe('ocean');
  });

  // A Participant is an Editor minus the settings, the style and automations
  // (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "Share roles"): its metadata write orders the page tree,
  // and is refused whole when it restyles or renames the knowledgebase.
  it('lets a Participant order the pages, never restyle or rename the knowledgebase', async () => {
    const kit = await knowledgeKit();
    expect((await kit.call('participant', 'PUT', DOC, { name: 'Handbook' })).status).toBe(200);
    const renamed = await kit.call('participant', 'PUT', DOC, { name: 'Mine Now' });
    expect(renamed.status).toBe(403);
    const both = await kit.call('participant', 'PUT', DOC, {
      name: 'Handbook',
      knowledgeStyle: STEEL,
    });
    expect(both.status).toBe(403);
    const read = await (await kit.call('editor', 'GET', DOC)).json<Read>();
    expect(read.document.name).toBe('Handbook');
    expect(row(kit)).toEqual({ s: null });
  });

  it.each([
    'participant',
    'viewer',
    'link',
    'page-link',
    'stranger',
    'agent-read-only',
    'participant-agent',
    'viewer-agent',
  ] as const)('is refused for %s, who changes nothing', async (who) => {
    const kit = await knowledgeKit();
    const res = await set(kit, STEEL, who);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(await styleOf(kit, 'editor')).toEqual(DEFAULT_KNOWLEDGE_STYLE);
    expect(row(kit)).toEqual({ s: null });
  });

  it('refuses a field it cannot take, by name, and writes nothing of the save', async () => {
    const kit = await knowledgeKit();
    const error = async (knowledgeStyle: unknown, name?: string) => {
      const res = await kit.call('editor', 'PUT', DOC, {
        knowledgeStyle,
        ...(name ? { name } : {}),
      });
      const body = await res.json<{ error: string; field: string; message: string }>();
      return [res.status, body.error, body.field];
    };
    expect(await error({ theme: 'uml' })).toEqual([400, 'invalid_knowledge_style', 'theme']);
    expect(await error({ bodyFont: 'comic-sans' })).toEqual([
      400,
      'invalid_knowledge_style',
      'bodyFont',
    ]);
    expect(await error({ textSize: 'huge' })).toEqual([400, 'invalid_knowledge_style', 'textSize']);
    expect(await error({ lineSpacing: 2 })).toEqual([
      400,
      'invalid_knowledge_style',
      'lineSpacing',
    ]);
    expect(await error({ headingStyle: 'fancy' })).toEqual([
      400,
      'invalid_knowledge_style',
      'headingStyle',
    ]);
    expect(await error({ accent: 'red' })).toEqual([400, 'invalid_knowledge_style', 'accent']);
    expect(await error({ finish: 'sketch' })).toEqual([400, 'invalid_knowledge_style', 'finish']);
    expect(await error('steel')).toEqual([400, 'invalid_knowledge_style', 'knowledgeStyle']);
    // A refused style refuses the save whole: the name sent with it is not taken either.
    expect(await error({ theme: 'nope' }, 'Renamed')).toEqual([
      400,
      'invalid_knowledge_style',
      'theme',
    ]);
    const read = await (await kit.call('editor', 'GET', DOC)).json<Read>();
    expect(read.document.name).toBe('Handbook');
    expect(read.document.knowledgeStyle).toEqual(DEFAULT_KNOWLEDGE_STYLE);
  });

  it('writes the document’s one row and no page, however many times it changes', async () => {
    const kit = await knowledgeKit();
    await kit.call('editor', 'GET', '/api/documents/kb/summary');
    const before = allButTheDocumentRow(kit);
    expect(Object.keys(before)).toEqual(expect.arrayContaining(['tabs', 'knowledge_pages']));
    for (const theme of ['steel', 'ocean', 'rainbow', 'frost', 'brand']) {
      expect((await set(kit, { theme })).status).toBe(200);
      expect(allButTheDocumentRow(kit)).toEqual(before);
    }
  });

  it('leaves the style alone on a save that names none', async () => {
    const kit = await knowledgeKit();
    await set(kit, STEEL);
    expect((await kit.call('editor', 'PUT', DOC, { name: 'Renamed' })).status).toBe(200);
    expect(await styleOf(kit)).toEqual(STEEL);
  });

  it('tells every open editor in the document-meta op, once, and not for a style already held', async () => {
    const relayed: { op: { kind: string; knowledgeStyle?: unknown } }[] = [];
    const rooms = {
      idFromName: (name: string) => name,
      get: () => ({
        fetch: async (_url: string, init?: RequestInit) => {
          if (typeof init?.body === 'string')
            relayed.push(JSON.parse(init.body) as (typeof relayed)[number]);
          return new Response(null, { status: 204 });
        },
      }),
    };
    const kit = await knowledgeKit({ DOCUMENT_ROOM: rooms } as never);
    relayed.length = 0;
    await set(kit, STEEL);
    const told = () => JSON.stringify(relayed);
    expect(told()).toContain('"kind":"document-meta"');
    expect(told()).toContain(`"knowledgeStyle":${JSON.stringify(STEEL)}`);
    expect(told()).toContain('"id":"rollbacks"');
    relayed.length = 0;
    await set(kit, STEEL);
    expect(told()).not.toContain('knowledgeStyle');
  });
});

describe('the style travels with the knowledgebase', () => {
  const env = (kit: Kit) => kit.db.env;
  const stored = async (kit: Kit, id: string) =>
    (await readDocumentMeta(env(kit), id))?.knowledgeStyle;
  const start = (kit: Kit, id: string) =>
    initDocument(env(kit), id, {
      name: 'Copy',
      ownerId: OWNER,
      teamId: null,
      source: null,
      savedAt: 2,
      createdAt: 2,
    });

  it('goes with a copy of the whole knowledgebase, and not with a copy of one page', async () => {
    const kit = await knowledgeKit();
    await set(kit, STEEL);
    const whole = await exportDocumentCopy(env(kit), 'kb', null, null);
    expect(whole?.knowledgeStyle).toEqual(STEEL);
    await importDocumentCopy(env(kit), 'copy', whole!);
    await start(kit, 'copy');
    expect(await stored(kit, 'copy')).toEqual(STEEL);
    expect(await exportDocumentCopy(env(kit), 'kb', 'holidays', null)).not.toHaveProperty(
      'knowledgeStyle',
    );
    await set(kit, DEFAULT_KNOWLEDGE_STYLE);
    expect(await exportDocumentCopy(env(kit), 'kb', null, null)).not.toHaveProperty(
      'knowledgeStyle',
    );
  });

  it('is in the Drive file and the export, and a file read back makes a knowledgebase with it', async () => {
    const kit = await knowledgeKit();
    await set(kit, STEEL);
    const file = await exportDocumentFile(env(kit), 'kb', null);
    if (file.status !== 'ok' || typeof file.body !== 'string') throw new Error('no file');
    const written = JSON.parse(file.body) as { document: { knowledgeStyle?: unknown } };
    expect(written.document.knowledgeStyle).toEqual(STEEL);
    const read = readDocumentFile(file.body);
    if (!read.ok) throw new Error(read.failure);
    expect(read.content.knowledgeStyle).toEqual(STEEL);
    await importDocumentFile(env(kit), 'fromfile', { ...read.content, name: 'F', ownerId: OWNER });
    expect(await stored(kit, 'fromfile')).toEqual(STEEL);
  });

  it('comes back with a snapshot that is reverted to', async () => {
    const kit = await knowledgeKit();
    await set(kit, STEEL);
    const door = documentSnapshotDoor(env(kit), 'kb');
    const snapshot = (await door.exportFile())!;
    await set(kit, { theme: 'ocean' });
    expect(await door.replaceContent(snapshot)).toBe('ok');
    expect(await styleOf(kit)).toEqual(STEEL);
    await set(kit, DEFAULT_KNOWLEDGE_STYLE);
    const plain = (await door.exportFile())!;
    await set(kit, STEEL);
    await door.replaceContent(plain);
    expect(await styleOf(kit)).toEqual(DEFAULT_KNOWLEDGE_STYLE);
  });

  it('is taken from the create that syncs a knowledgebase kept Offline, read forgivingly', async () => {
    const kit = await knowledgeKit();
    const create = (id: string, knowledgeStyle: unknown) =>
      kit.call('editor', 'POST', '/api/documents', { id, name: 'Synced', knowledgeStyle });
    expect((await create('synced', STEEL)).status).toBeLessThan(300);
    expect(await stored(kit, 'synced')).toEqual(STEEL);
    expect((await create('odd', { theme: 'nope', textSize: 'large' })).status).toBeLessThan(300);
    expect(await stored(kit, 'odd')).toEqual({ ...DEFAULT_KNOWLEDGE_STYLE, textSize: 'large' });
  });
});
