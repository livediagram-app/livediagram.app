import { afterEach, describe, expect, it, vi } from 'vitest';
import { ITEM_DESCRIPTION_MAX, ITEM_TITLE_MAX } from '@liveplanner/items';
import {
  cardTitleOf,
  descriptionOf,
  droppedLine,
  emailCardCreate,
  emailPerson,
  type DroppedAttachment,
} from './intake-card';
import { codeOfRecipient, isIntakeCode, newIntakeCode, senderHash } from './intake-code';
import { readDirectoryEntry, writeDirectoryEntry } from './intake-directory';
import { attachPictures, attachableType } from './intake-pictures';

const auth = vi.hoisted(() => ({
  credentials: { accountsUrl: 'https://a.test', clientId: 'c', clientSecret: 's' } as unknown,
  emails: vi.fn(),
  team: vi.fn(),
}));
vi.mock('../auth/accounts', () => ({ accountCredentials: () => auth.credentials }));
vi.mock('@liveworkspace/auth-client', async (real) => ({
  ...(await real<object>()),
  accountEmails: auth.emails,
  readTeamPeople: auth.team,
}));
const { planMemberAddresses } = await import('./intake-members');

afterEach(() => vi.restoreAllMocks());

describe('intake-code', () => {
  it('makes 26 lowercase base32 characters, never the same twice', () => {
    const codes = new Set(Array.from({ length: 200 }, newIntakeCode));
    expect(codes.size).toBe(200);
    for (const c of codes) expect(isIntakeCode(c)).toBe(true);
  });

  it('reads a recipient on the domain only', () => {
    const code = newIntakeCode();
    expect(codeOfRecipient(` Board+${code.toUpperCase()}@IN.Example.com`, 'in.example.com')).toBe(
      code,
    );
    expect(codeOfRecipient(`board+${code}@other.com`, 'in.example.com')).toBeNull();
    expect(codeOfRecipient(`board+${code}@in.example.com`, undefined)).toBeNull();
    expect(codeOfRecipient('no-at-sign', 'in.example.com')).toBeNull();
    expect(codeOfRecipient(`card-${code}@in.example.com`, 'in.example.com')).toBeNull();
    expect(codeOfRecipient(`board-${code}@in.example.com`, 'in.example.com')).toBeNull();
    expect(codeOfRecipient(`board+${code.slice(1)}1@in.example.com`, 'in.example.com')).toBeNull();
    expect(isIntakeCode('short')).toBe(false);
  });

  it('hashes an address case-blind', async () => {
    expect(await senderHash('A@B.com')).toBe(await senderHash(' a@b.com'));
    expect(await senderHash('a@b.com')).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('intake-card', () => {
  const dropped: DroppedAttachment[] = [
    { name: 'notes.docx', size: 2_200_000, reason: 'not_attachable' },
    { name: 'big.png', size: 14 * 1024 * 1024, reason: 'too_big' },
    { name: 'x.png', size: 10, reason: 'too_many' },
    { name: 'y.png', size: 10, reason: 'not_saved' },
  ];

  it('titles a card by its subject, or its sender', () => {
    expect(cardTitleOf('  Printer \n broken ', 'a@b.c')).toBe('Printer broken');
    expect(cardTitleOf('', 'a@b.c')).toBe('Email from a@b.c');
    expect(Array.from(cardTitleOf('é'.repeat(ITEM_TITLE_MAX + 5), 'a@b.c'))).toHaveLength(
      ITEM_TITLE_MAX,
    );
  });

  it('lists what was dropped, and keeps that line whole when the text is cut', () => {
    expect(droppedLine([])).toBe('');
    expect(droppedLine(dropped)).toBe(
      "Not attached: notes.docx (2.1 MB, not a picture or PDF), big.png (14 MB, over 10 MB), x.png (1 KB, over 20 attachments), y.png (1 KB, couldn't be saved).",
    );
    const long = descriptionOf('w'.repeat(ITEM_DESCRIPTION_MAX), dropped);
    expect(long.length).toBe(ITEM_DESCRIPTION_MAX);
    expect(long.endsWith(droppedLine(dropped))).toBe(true);
    expect(descriptionOf('  ', dropped)).toBe(droppedLine(dropped));
    expect(descriptionOf(' text ', [])).toBe('text');
    const huge = Array.from({ length: 400 }, (_, i) => ({ ...dropped[0]!, name: `f${i}.pdf` }));
    expect(descriptionOf('text', huge)).toHaveLength(ITEM_DESCRIPTION_MAX);
  });

  it('makes a create the item store takes', () => {
    const create = emailCardCreate({
      subject: 'Hi',
      text: '',
      sender: 'a@b.c',
      attached: [{ id: 'img_1', name: 'a.png', size: 10, type: 'image/png' }],
      dropped: [],
      typeId: 'task',
      status: 'todo',
    });
    expect(create).toMatchObject({
      type: 'task',
      fields: { title: 'Hi', fromEmail: 'a@b.c', attachments: [{ id: 'img_1' }] },
      place: { status: 'todo' },
    });
    expect(typeof create === 'object' && 'description' in create.fields).toBe(false);
    expect(
      emailCardCreate({
        subject: 'x',
        text: '',
        sender: 'a@b.c',
        attached: [],
        dropped: [],
        typeId: '',
        status: 'todo',
      }),
    ).toBe('type_invalid');
    expect(emailPerson('a@b.c', 'abcdef0123456789')).toEqual({
      id: 'email:abcdef012345',
      name: 'a@b.c',
      color: '#0f766e',
    });
  });
});

describe('intake-directory', () => {
  it('keeps one entry, and reads nothing for junk', async () => {
    const store = new Map<string, unknown>();
    const storage = {
      get: async (k: string) => store.get(k),
      put: async (k: string, v: unknown) => void store.set(k, v),
      delete: async (k: string) => store.delete(k),
    } as never;
    expect(await readDirectoryEntry(storage)).toBeNull();
    await writeDirectoryEntry(storage, { planId: 'A', boardId: 'b1' });
    expect(await readDirectoryEntry(storage)).toEqual({ planId: 'A', boardId: 'b1' });
    store.set('intake', { planId: 1 });
    expect(await readDirectoryEntry(storage)).toBeNull();
    await writeDirectoryEntry(storage, null);
    expect(store.size).toBe(0);
  });
});

describe('intake-members', () => {
  it("takes the owner's and joined members' verified addresses", async () => {
    auth.emails.mockResolvedValue({ user_1: 'Owner@X.com' });
    auth.team.mockResolvedValue({
      team: { id: 't', name: 'T' },
      members: [
        { userId: 'user_2', email: 'Joined@X.com', status: 'joined' },
        { userId: null, email: 'invited@x.com', status: 'invited' },
        { userId: 'user_3', email: 'pending@x.com', status: 'invited' },
      ],
    });
    expect(await planMemberAddresses({} as never, 'user_1', 'team_1')).toEqual(
      new Set(['owner@x.com', 'joined@x.com']),
    );
    auth.emails.mockClear();
    expect(await planMemberAddresses({} as never, 'guest_1', null)).toEqual(new Set());
    expect(auth.emails).not.toHaveBeenCalled();
  });

  it("says unavailable when accounts can't answer", async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    auth.emails.mockRejectedValue(new Error('down'));
    expect(await planMemberAddresses({} as never, 'user_1', null)).toBe('unavailable');
    auth.credentials = null;
    expect(await planMemberAddresses({} as never, 'user_1', null)).toBe('unavailable');
  });
});

describe('intake-pictures', () => {
  const PNG = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 2,
    0, 0, 0, 3, 8, 6, 0, 0, 0,
  ]);
  const plan = { id: 'A', ownerId: 'user_1' };

  it('drops every picture without a media service', async () => {
    const out = await attachPictures(
      {},
      plan,
      [{ name: 'a.png', type: 'image/png', bytes: PNG }],
      () => {},
    );
    expect(out).toEqual({
      attached: [],
      dropped: [{ name: 'a.png', size: 29, reason: 'not_saved' }],
    });
  });

  it('caps the count and names each refusal', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    let n = 0;
    vi.stubGlobal('fetch', async () => {
      n++;
      if (n === 2) return Response.json({ error: 'gallery_full' }, { status: 409 });
      if (n === 3) throw new Error('network');
      return Response.json({ image: { id: `img_${n}` }, deduped: false });
    });
    const granted: string[] = [];
    const many = Array.from({ length: 23 }, (_, i) => ({
      name: `p${i}.png`,
      type: 'image/png',
      bytes: PNG,
    }));
    const big = new Uint8Array(10 * 1024 * 1024 + 1);
    big.set(PNG);
    const out = await attachPictures(
      { MEDIA_KEY: 'k' },
      plan,
      [{ name: 'big.png', type: 'image/png', bytes: big }, ...many],
      (id) => granted.push(id),
    );
    expect(out.attached).toHaveLength(20);
    expect(granted).toHaveLength(20);
    expect(out.dropped.map((d) => d.reason)).toEqual([
      'too_big',
      'not_saved',
      'not_saved',
      'too_many',
    ]);
    vi.unstubAllGlobals();
  });

  const PDF = new TextEncoder().encode('%PDF-1.7\n1 0 obj << >> endobj\n%%EOF');

  it('reads a PDF by its %PDF- bytes alone, never its name or declared type', () => {
    expect(attachableType({ name: 'q.pdf', type: 'application/pdf', bytes: PDF })).toBe(
      'application/pdf',
    );
    // A PDF whatever its mail app called it.
    expect(attachableType({ name: 'scan', type: 'application/octet-stream', bytes: PDF })).toBe(
      'application/pdf',
    );
    expect(attachableType({ name: 'q.bin', type: 'text/html', bytes: PDF })).toBe(
      'application/pdf',
    );
    // Named and declared a PDF, but not one: HTML, a Word file, %PDF- after a leading byte.
    const html = new TextEncoder().encode('<html><script>x</script></html>');
    expect(attachableType({ name: 'q.pdf', type: 'application/pdf', bytes: html })).toBeNull();
    const docx = new TextEncoder().encode('PK\u0003\u0004 word');
    expect(attachableType({ name: 'q.pdf', type: 'application/pdf', bytes: docx })).toBeNull();
    const late = new TextEncoder().encode(' %PDF-1.7');
    expect(attachableType({ name: 'q.pdf', type: 'application/pdf', bytes: late })).toBeNull();
    // A picture goes by its bytes, whatever it was called.
    expect(attachableType({ name: 'shot.pdf', type: 'application/pdf', bytes: PNG })).toBe(
      'image/png',
    );
  });

  it('uploads an allowed PDF 0 by 0, and drops one over the cap and a refused type', async () => {
    const sent: Headers[] = [];
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      sent.push(new Headers(init.headers));
      return Response.json({ image: { id: `img_${sent.length}` }, deduped: false });
    });
    const granted: string[] = [];
    const big = new Uint8Array(10 * 1024 * 1024 + 1);
    big.set(PDF);
    const out = await attachPictures(
      { MEDIA_KEY: 'k' },
      plan,
      [
        { name: 'Quote.pdf', type: 'application/pdf', bytes: PDF },
        { name: 'huge.pdf', type: 'application/pdf', bytes: big },
        { name: 'notes.docx', type: 'application/msword', bytes: new Uint8Array(40) },
      ],
      (id) => granted.push(id),
    );
    expect(out.attached).toEqual([
      { id: 'img_1', name: 'Quote.pdf', size: PDF.byteLength, type: 'application/pdf' },
    ]);
    expect(granted).toEqual(['img_1']);
    expect(sent[0]!.get('Content-Type')).toBe('application/pdf');
    expect(sent[0]!.get('X-Image-Width')).toBe('0');
    expect(out.dropped).toEqual([
      { name: 'huge.pdf', size: big.byteLength, reason: 'too_big' },
      { name: 'notes.docx', size: 40, reason: 'not_attachable' },
    ]);
    vi.unstubAllGlobals();
  });
});
