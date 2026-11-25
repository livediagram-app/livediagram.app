import { afterEach, describe, expect, it, vi } from 'vitest';
import { UNOWNED_PAGE } from '@liveknowledge/knowledge';
import type { KnowledgeSendDoorCall } from '@liveworkspace/index-client';
import type { DocumentGrant } from '../index-service';
import {
  ANA,
  DOC,
  identityOf,
  roomWorld,
  type RoomWorld,
} from './automations/test-automation-world';
import { pngSize, sectionMarkdown } from './knowledge-send-door';

// Send to Knowledge Base arriving (docs/specs/013-workspace/send-to-knowledge.md "The door"): the section written as
// the person through the knowledgebase's own routes, on an existing page (at the end or under a heading) or a new
// one, and the page's headings read for the picker.

afterEach(() => {
  vi.restoreAllMocks();
});

async function started(): Promise<RoomWorld> {
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  vi.spyOn(console, 'debug').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  const w = roomWorld();
  // A page with writing: an article page (the world's create passes the tab through as given).
  const page = {
    id: 't1',
    name: 'Deploys',
    elements: [],
    pages: [{ id: 'pg1', orientation: 'portrait', kind: 'article', flow: 'art' }],
    articles: {
      art: { blocks: [{ id: 'b1', type: 'paragraph', runs: [{ text: 'How we ship.' }] }] },
    },
    knowledge: UNOWNED_PAGE,
  };
  await w.create([page]);
  return w;
}

const grant = (level = 'edit') => identityOf({ level: level as never }).grant as DocumentGrant;
const SENT_FROM = {
  app: 'livediagram' as const,
  title: 'Payments',
  link: 'https://www.livediagram.app/document/D#t=t&el=e',
};
const write = (place: Record<string, unknown>, over: Record<string, unknown> = {}) =>
  ({
    op: 'write',
    person: ANA,
    place,
    heading: 'Checkout',
    markdown: 'The cart sends the order to payment.',
    sentFrom: SENT_FROM,
    ...over,
  }) as KnowledgeSendDoorCall;

const pageText = async (w: RoomWorld, tab: string): Promise<string[]> => {
  const out = await w.room.knowledgeSend(DOC, { op: 'outline', person: ANA, page: tab }, grant());
  return out.ok && 'headings' in out ? out.headings.map((h) => h.text) : [];
};

describe('Send to Knowledge Base at the knowledgebase', () => {
  it('appends the section to an existing page, headed, with the Sent From line', async () => {
    const w = await started();
    const out = await w.room.knowledgeSend(DOC, write({ page: 't1' }), grant());
    expect(out).toMatchObject({ ok: true, page: { id: 't1', title: 'Deploys' } });
    expect(await pageText(w, 't1')).toEqual(['Checkout']);
    const data = w.rows('SELECT data FROM tabs WHERE id = ?', 't1')[0]!;
    expect(String(data['data'])).toContain('Sent from ');
    expect(String(data['data'])).toContain(SENT_FROM.link);
  });

  it('writes under a heading, and refuses a heading gone since the picker read it', async () => {
    const w = await started();
    await w.room.knowledgeSend(DOC, write({ page: 't1' }, { heading: 'First' }), grant());
    await w.room.knowledgeSend(DOC, write({ page: 't1' }, { heading: 'Second' }), grant());
    const first = await w.room.knowledgeSend(
      DOC,
      write({ page: 't1', after: 'First' }, { heading: 'Between' }),
      grant(),
    );
    expect(first.ok).toBe(true);
    expect(await pageText(w, 't1')).toEqual(['First', 'Between', 'Second']);
    expect(
      await w.room.knowledgeSend(DOC, write({ page: 't1', after: 'Gone' }), grant()),
    ).toMatchObject({ ok: false, code: 'heading_unknown' });
  });

  it('makes a new page under a parent, owned by the person, and writes the section there', async () => {
    const w = await started();
    const out = await w.room.knowledgeSend(
      DOC,
      write({ newPage: { title: 'Payments', parent: 't1' } }),
      grant(),
    );
    expect(out).toMatchObject({ ok: true, page: { title: 'Payments' } });
    const id = out.ok && 'page' in out ? out.page.id : '';
    const row = w.rows('SELECT data FROM tabs WHERE id = ?', id)[0]!;
    const tab = JSON.parse(String(row['data'])) as {
      parent?: string;
      knowledge?: { owner?: string };
    };
    expect(tab.parent).toBe('t1');
    expect(tab.knowledge?.owner).toBe(ANA);
    expect(await pageText(w, id)).toEqual(['Checkout']);
  });

  it('answers no access for a grant that may not write, and page gone for a page or parent gone', async () => {
    const w = await started();
    expect(await w.room.knowledgeSend(DOC, write({ page: 't1' }), grant('view'))).toMatchObject({
      ok: false,
      code: 'no_access',
    });
    expect(await w.room.knowledgeSend(DOC, write({ page: 'gone' }), grant())).toMatchObject({
      ok: false,
      code: 'page_gone',
    });
    expect(
      await w.room.knowledgeSend(DOC, write({ newPage: { title: 'X', parent: 'gone' } }), grant()),
    ).toMatchObject({ ok: false, code: 'page_gone' });
    expect(
      await w.room.knowledgeSend(DOC, { op: 'outline', person: ANA, page: 'gone' }, grant()),
    ).toMatchObject({ ok: false, code: 'page_gone' });
  });

  it('writes the section without its picture when the picture cannot be stored', async () => {
    const w = await started();
    const out = await w.room.knowledgeSend(
      DOC,
      write({ page: 't1' }, { picture: { png: 'not-a-png', width: 10, height: 10 } }),
      grant(),
    );
    expect(out.ok).toBe(true);
    expect(String(w.rows('SELECT data FROM tabs WHERE id = ?', 't1')[0]!['data'])).not.toContain(
      '[picture]',
    );
  });
});

describe('the section', () => {
  it('reads heading, words, the picture’s place and the Sent From line, in that order', () => {
    const call = write({ page: 't1' }, { heading: 'Two\nlines' });
    if (call.op !== 'write') throw new Error('write');
    expect(sectionMarkdown(call, true)).toBe(
      `## Two lines\n\nThe cart sends the order to payment.\n\n[picture]\n\nSent from [Payments](${SENT_FROM.link}) in livediagram`,
    );
    expect(sectionMarkdown({ ...call, heading: ' ' }, false)).not.toContain('##');
  });

  it('reads a PNG’s size from its header, and nothing from other bytes', () => {
    const png = new Uint8Array(24);
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    new DataView(png.buffer).setUint32(16, 640);
    new DataView(png.buffer).setUint32(20, 480);
    expect(pngSize(png)).toEqual({ width: 640, height: 480 });
    expect(pngSize(new Uint8Array(24))).toBeNull();
    expect(pngSize(png.slice(0, 10))).toBeNull();
  });
});
