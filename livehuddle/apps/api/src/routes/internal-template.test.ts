// The template door into livehuddle (liveworkspace/docs/specs/004-index/kits.md "The apps' door"; docs/specs/015-api/api.md
// "Internal"): a new Space from one of its templates, a project kit's part, made through the import door's path with
// source `template`. Every kit part of livehuddle names a template this file builds, so a renamed or retired template
// fails here, never in a person's run.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { kitPartsOf } from '@liveworkspace/index-client';
import { parseDocumentEnvelope } from '@livehuddle/document';

// The index as the owner reaches it with this app's key: the items it is asked to make.
const { made } = vi.hoisted(() => ({
  made: [] as {
    id: string;
    app: string;
    title?: string;
    folderId?: string | null;
    source?: string;
  }[],
}));
vi.mock('../index-service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../index-service')>()),
  indexFor: (_env: unknown, caller: { personId: string }) => ({
    createItem: async (input: (typeof made)[number]) => {
      made.push({ ...input, owner: caller.personId } as (typeof made)[number]);
      return { item: { id: input.id }, grant: {} };
    },
    deleteItem: async () => {},
  }),
}));

import { sqliteD1 } from '../test-sqlite-d1';
import { readDocumentFile } from '../document-room/document-file';
import { handleInternalItems } from './internal-items';
import { templateDocumentFile } from './internal-template';

const KEY = 'index-key';
const OWNER = 'user_ada';
const PARTS = kitPartsOf('livehuddle');

beforeEach(() => {
  made.length = 0;
});
afterEach(() => vi.restoreAllMocks());

function arrange() {
  const db = sqliteD1({ INDEX_KEY: KEY });
  const send = (method: string, path: string, body?: unknown) =>
    handleInternalItems(
      new Request(`https://api.test/api/internal/items/${path}`, {
        method,
        headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
      db.env,
    );
  return { db, send };
}

const tabsOf = (text: string) => {
  const parsed = parseDocumentEnvelope(text);
  if (!parsed.ok) throw new Error(parsed.failure);
  return parsed.envelope.document.tabs;
};

describe('the template file', () => {
  it('builds every kit part’s template, which the import’s reader takes', () => {
    expect(PARTS.length).toBeGreaterThan(0);
    for (const part of PARTS) {
      const file = templateDocumentFile(part.template, `Apollo ${part.name}`);
      expect(file, part.template).not.toBeNull();
      const tabs = tabsOf(file!);
      expect(tabs.length, part.template).toBeGreaterThan(0);
      // Its scaffold, not a blank tab: an article keeps its words beside the elements, and a plan its cards beside
      // its board, so the file is measured whole.
      expect(tabs[0]!.templateChosen, part.template).toBe(true);
      expect(file!.length, part.template).toBeGreaterThan(1500);
      expect(readDocumentFile(file!).ok, part.template).toBe(true);
    }
  });

  // Start a Call Here's Document Room (calls-from-items.md "The Space", Work Tracker 1427): the call's item on the wall.
  it('puts a call item on the Document Room’s Screen, and nothing on a link that is not a file', () => {
    const screens = (text: string) =>
      tabsOf(text)[0]!.elements.filter((el) => el.type === 'shape' && el.shape === 'screen');
    const plain = screens(templateDocumentFile('document-room', 'Launch Plan Call')!);
    expect(plain).toHaveLength(1);
    expect(plain[0]).not.toHaveProperty('liveItem');
    const file = templateDocumentFile('document-room', 'Launch Plan Call', {
      screen: { app: 'liveplanner', itemId: 'P1', name: 'Launch Plan' },
    })!;
    expect(readDocumentFile(file).ok).toBe(true);
    const [screen] = screens(file);
    expect(screen).toMatchObject({
      liveItem: { app: 'liveplanner', itemId: 'P1' },
      liveName: 'Launch Plan',
    });
    expect(screen).not.toHaveProperty('livePoster');
    // A Space is never a file a Screen shows.
    const huddle = screens(
      templateDocumentFile('document-room', 'X', {
        screen: { app: 'livehuddle', itemId: 'S1', name: 'A Space' },
      })!,
    );
    expect(huddle[0]).not.toHaveProperty('liveItem');
  });

  it('has no file for a kind the app has no template of', () => {
    expect(templateDocumentFile('no-such-template', 'Apollo')).toBeNull();
  });
});

describe('POST /api/internal/items/from-template', () => {
  it('makes the owner’s Space from the template, with source template', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const { send } = arrange();
    const part = PARTS[0]!;
    const name = `Apollo ${part.name}`;
    const res = await send('POST', 'from-template', {
      owner: OWNER,
      folderId: 'F1',
      name,
      template: part.template,
    });
    expect(res.status).toBe(201);
    const { id } = await res.json<{ id: string }>();
    expect(made).toEqual([
      { id, app: 'livehuddle', title: name, folderId: 'F1', source: 'template', owner: OWNER },
    ]);
    // It is stored, and exports as its own file with the template's tabs.
    const file = await send('GET', `${id}/export?format=file`);
    expect(file.status).toBe(200);
    expect(tabsOf(await file.text()).length).toBe(
      tabsOf(templateDocumentFile(part.template, name)!).length,
    );
  });

  it('answers a kind it has no template of 404, making nothing', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { send } = arrange();
    const res = await send('POST', 'from-template', {
      owner: OWNER,
      folderId: null,
      name: 'Apollo',
      template: 'no-such-template',
    });
    expect(res.status).toBe(404);
    expect(made).toEqual([]);
  });
});
